"""
Socket.IO event handlers with backpressure support and TTS.
"""
import asyncio
import time
import statistics
from asyncio import Queue
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, Optional

import numpy as np
import socketio

from .config import Config
from .audio import AudioProcessor
from .transcription import TranscriptionEngine
from .translation import TranslationService
from .tts import TTSService, AVAILABLE_VOICES


class ClientState:
    """Manages state for a connected client"""

    def __init__(self, sid: str, config: Config):
        self.sid = sid
        self.config = config
        self.audio_buffer = np.array([], dtype=np.float32)
        self.audio_format: Optional[str] = None
        self.total_processed = 0
        self.connected = True
        self.start_time = time.time()
        self.processing_queue: Queue = Queue()
        self.queue_task: Optional[asyncio.Task] = None

        # Statistics
        self.latencies: list = []
        self.chunk_sizes: list = []
        self.dropped_chunks = 0

        # Translation settings
        self.source_language: Optional[str] = None
        self.target_language: Optional[str] = None
        self.translation_enabled = False

        # TTS settings
        self.tts_enabled = False
        self.tts_voice: Optional[str] = None
        self.tts_speed: float = 1.0

    @property
    def session_duration(self) -> float:
        return time.time() - self.start_time

    @property
    def avg_latency(self) -> float:
        return statistics.mean(self.latencies) if self.latencies else 0.0

    @property
    def queue_size(self) -> int:
        return self.processing_queue.qsize()


class TranscriptionHandlers:
    """Socket.IO event handlers for transcription server"""

    def __init__(
        self,
        sio: socketio.AsyncServer,
        config: Config,
        transcription_engine: TranscriptionEngine,
        translation_service: TranslationService,
        tts_service: TTSService,
        executor: ThreadPoolExecutor
    ):
        self.sio = sio
        self.config = config
        self.audio_processor = AudioProcessor(config.audio)
        self.transcription_engine = transcription_engine
        self.translation_service = translation_service
        self.tts_service = tts_service
        self.executor = executor
        self.clients: Dict[str, ClientState] = {}

        # Register event handlers
        self._register_handlers()

    def _register_handlers(self):
        """Register Socket.IO event handlers"""
        self.sio.on('connect', self.handle_connect)
        self.sio.on('disconnect', self.handle_disconnect)
        self.sio.on('audio_chunk', self.handle_audio_chunk)
        self.sio.on('set_translation', self.handle_set_translation)
        self.sio.on('set_tts', self.handle_set_tts)
        self.sio.on('get_voices', self.handle_get_voices)
        self.sio.on('stop_recording', self.handle_stop_recording)
        self.sio.on('ping', self.handle_ping)

    async def handle_connect(self, sid: str, environ: dict):
        """Handle client connection"""
        self.clients[sid] = ClientState(sid, self.config)
        print(f"Client connected: {sid[:8]}")

        await self.sio.emit('status', {
            'message': 'Connected',
            'device': self.config.whisper.device,
            'model': self.config.whisper.model_size,
            'compute_type': self.config.whisper.compute_type,
            'backpressure_threshold': self.config.server.backpressure_threshold,
            'max_queue_size': self.config.server.max_queue_size,
            'tts_available': self.tts_service.is_available,
            'tts_default_voice': self.config.tts.default_voice
        }, room=sid)

        # Start queue processor
        client = self.clients[sid]
        client.queue_task = asyncio.create_task(self._process_queue(sid))

    async def handle_disconnect(self, sid: str):
        """Handle client disconnection"""
        if sid not in self.clients:
            return

        client = self.clients[sid]
        client.connected = False

        # Cancel queue processor
        if client.queue_task and not client.queue_task.done():
            client.queue_task.cancel()
            try:
                await client.queue_task
            except asyncio.CancelledError:
                pass

        # Log session stats
        print(f"Client disconnected: {sid[:8]}")
        print(f"   Session: {client.session_duration:.0f}s")
        print(f"   Processed: {client.total_processed} chunks")
        print(f"   Avg latency: {client.avg_latency:.2f}s")
        print(f"   Dropped: {client.dropped_chunks} chunks")

        # Cleanup after delay
        await asyncio.sleep(1.0)
        if sid in self.clients:
            del self.clients[sid]

    async def handle_audio_chunk(self, sid: str, data: Any):
        """Handle incoming audio chunks with backpressure"""
        if sid not in self.clients or not self.clients[sid].connected:
            return

        client = self.clients[sid]
        queue_size = client.queue_size

        # Backpressure: warn client when approaching limit
        if queue_size >= self.config.server.backpressure_threshold:
            await self.sio.emit('backpressure', {
                'queue_size': queue_size,
                'max_size': self.config.server.max_queue_size,
                'suggested_delay_ms': self.config.server.backpressure_delay_ms
            }, room=sid)

        # Drop chunk if queue is full
        if queue_size >= self.config.server.max_queue_size:
            client.dropped_chunks += 1
            if client.dropped_chunks % 10 == 0:
                print(f"   [{sid[:8]}] Queue overload, dropped {client.dropped_chunks} chunks")
            return

        # Add to queue
        await client.processing_queue.put(data)

    async def handle_set_translation(self, sid: str, data: dict):
        """Configure translation settings for client"""
        if sid not in self.clients:
            return

        client = self.clients[sid]
        source_lang = data.get('source_language')
        target_lang = data.get('target_language')

        client.source_language = source_lang
        client.target_language = target_lang
        client.translation_enabled = target_lang is not None

        source_icon = self.translation_service.get_language_icon(source_lang)
        target_icon = self.translation_service.get_language_icon(target_lang)

        print(f"   [{sid[:8]}] Translation: {source_icon} {source_lang or 'auto'} -> {target_icon} {target_lang or 'none'}")

        await self.sio.emit('translation_config', {
            'source_language': source_lang,
            'target_language': target_lang,
            'enabled': client.translation_enabled
        }, room=sid)

    async def handle_set_tts(self, sid: str, data: dict):
        """Configure TTS settings for client"""
        if sid not in self.clients:
            return

        client = self.clients[sid]
        client.tts_enabled = data.get('enabled', False)
        client.tts_voice = data.get('voice', self.config.tts.default_voice)
        client.tts_speed = data.get('speed', self.config.tts.default_speed)

        tts_status = "enabled" if client.tts_enabled else "disabled"
        print(f"   [{sid[:8]}] TTS: {tts_status} (voice: {client.tts_voice}, speed: {client.tts_speed}x)")

        await self.sio.emit('tts_config', {
            'enabled': client.tts_enabled,
            'voice': client.tts_voice,
            'speed': client.tts_speed,
            'available': self.tts_service.is_available
        }, room=sid)

    async def handle_get_voices(self, sid: str):
        """Return list of available TTS voices"""
        await self.sio.emit('voices', {
            'voices': AVAILABLE_VOICES,
            'default': self.config.tts.default_voice
        }, room=sid)

    async def handle_stop_recording(self, sid: str):
        """Process final audio chunk"""
        if sid not in self.clients or not self.clients[sid].connected:
            return

        client = self.clients[sid]

        # Wait for queue to empty
        timeout = 100
        while not client.processing_queue.empty() and timeout > 0:
            await asyncio.sleep(0.1)
            timeout -= 1

        # Process remaining audio
        min_samples = int(self.config.audio.sample_rate * self.config.audio.min_audio_duration)
        if len(client.audio_buffer) > min_samples:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(
                self.executor,
                self.transcription_engine.transcribe,
                client.audio_buffer,
                client.source_language
            )
            text, detected_lang = result

            if text and client.connected:
                client.total_processed += 1
                source_lang = detected_lang or client.source_language or 'unknown'

                # Translate if enabled
                translated_text = None
                if client.translation_enabled and client.target_language:
                    translated_text = await loop.run_in_executor(
                        self.executor,
                        self.translation_service.translate,
                        text,
                        source_lang,
                        client.target_language
                    )

                print(f"   [{sid[:8]}] Final: {text[:80]}{'...' if len(text) > 80 else ''}")

                response = {
                    'text': text,
                    'final': True,
                    'count': client.total_processed
                }

                if translated_text:
                    response['translated_text'] = translated_text
                    response['target_language'] = client.target_language

                # Synthesize TTS if enabled
                if client.tts_enabled and self.tts_service.is_available:
                    tts_text = translated_text if translated_text else text
                    tts_lang = client.target_language if translated_text else source_lang

                    tts_start = time.time()
                    audio_base64, sample_rate = await loop.run_in_executor(
                        self.executor,
                        self.tts_service.synthesize_to_base64,
                        tts_text,
                        tts_lang,
                        client.tts_voice,
                        client.tts_speed
                    )
                    tts_time = time.time() - tts_start

                    if audio_base64:
                        response['tts_audio'] = audio_base64
                        response['tts_sample_rate'] = sample_rate
                        response['tts_time'] = tts_time
                        print(f"   [{sid[:8]}] TTS: {len(audio_base64)} bytes ({tts_time:.2f}s)")

                await self.sio.emit('transcription', response, room=sid)

        # Clear buffer
        client.audio_buffer = np.array([], dtype=np.float32)

    async def handle_ping(self, sid: str):
        """Handle ping from client"""
        await self.sio.emit('pong', room=sid)

    async def _process_queue(self, sid: str):
        """Process audio chunks from queue"""
        if sid not in self.clients:
            return

        client = self.clients[sid]
        sample_rate = self.config.audio.sample_rate
        chunk_duration = self.config.audio.chunk_duration
        overlap_duration = self.config.audio.overlap_duration

        try:
            while client.connected:
                # Wait for data in queue
                try:
                    data = await asyncio.wait_for(
                        client.processing_queue.get(),
                        timeout=1.0
                    )
                except asyncio.TimeoutError:
                    continue

                # Decode audio
                samples, detected_format = self.audio_processor.decode_chunk(
                    data, client.audio_format
                )

                if samples is None:
                    continue

                # Set format on first chunk
                if client.audio_format is None:
                    client.audio_format = detected_format
                    print(f"   [{sid[:8]}] Format detected: {detected_format}")

                # Append to buffer
                client.audio_buffer = np.append(client.audio_buffer, samples)
                client.chunk_sizes.append(len(samples))

                # Process when buffer is full
                buffer_duration = len(client.audio_buffer) / sample_rate

                if buffer_duration >= chunk_duration:
                    # Extract chunk
                    chunk_size = int(sample_rate * chunk_duration)
                    audio_to_process = client.audio_buffer[:chunk_size].copy()

                    # Keep overlap
                    overlap_samples = int(sample_rate * overlap_duration)
                    client.audio_buffer = client.audio_buffer[chunk_size - overlap_samples:]

                    # Audio quality check
                    rms = self.audio_processor.compute_rms(audio_to_process)

                    # Run inference
                    start_time = time.time()
                    loop = asyncio.get_running_loop()

                    result = await loop.run_in_executor(
                        self.executor,
                        self.transcription_engine.transcribe,
                        audio_to_process,
                        client.source_language
                    )
                    text, detected_lang = result

                    inference_time = time.time() - start_time
                    client.latencies.append(inference_time)

                    # Send result
                    if client.connected:
                        if text:
                            client.total_processed += 1

                            source_lang = detected_lang or client.source_language or 'unknown'

                            # Translate if enabled
                            translated_text = None
                            translation_time = 0

                            if client.translation_enabled and client.target_language:
                                trans_start = time.time()
                                translated_text = await loop.run_in_executor(
                                    self.executor,
                                    self.translation_service.translate,
                                    text,
                                    source_lang,
                                    client.target_language
                                )
                                translation_time = time.time() - trans_start

                            # Get language icons
                            source_icon = self.translation_service.get_language_icon(source_lang)
                            target_icon = self.translation_service.get_language_icon(client.target_language)

                            # Log output
                            total_time = inference_time + translation_time
                            log_msg = f"   {source_icon} [{sid[:8]}] ({total_time:.1f}s) {text[:60]}{'...' if len(text) > 60 else ''}"
                            if translated_text:
                                log_msg += f"\n   {target_icon} -> {translated_text[:60]}{'...' if len(translated_text) > 60 else ''}"
                            print(log_msg)

                            # Send to client
                            response = {
                                'text': text,
                                'language': source_lang,
                                'inference_time': inference_time,
                                'count': client.total_processed
                            }

                            if translated_text:
                                response['translated_text'] = translated_text
                                response['target_language'] = client.target_language
                                response['translation_time'] = translation_time

                            # Synthesize TTS if enabled
                            if client.tts_enabled and self.tts_service.is_available:
                                tts_text = translated_text if translated_text else text
                                tts_lang = client.target_language if translated_text else source_lang

                                tts_start = time.time()
                                audio_base64, sample_rate = await loop.run_in_executor(
                                    self.executor,
                                    self.tts_service.synthesize_to_base64,
                                    tts_text,
                                    tts_lang,
                                    client.tts_voice,
                                    client.tts_speed
                                )
                                tts_time = time.time() - tts_start

                                if audio_base64:
                                    response['tts_audio'] = audio_base64
                                    response['tts_sample_rate'] = sample_rate
                                    response['tts_time'] = tts_time

                            await self.sio.emit('transcription', response, room=sid)
                        else:
                            print(f"   [{sid[:8]}] Filtered (RMS: {rms:.4f})")

                        # Send stats periodically
                        if client.total_processed % self.config.server.stats_interval == 0 and client.latencies:
                            recent_latencies = client.latencies[-self.config.server.stats_interval:]
                            avg_latency = statistics.mean(recent_latencies)
                            await self.sio.emit('stats', {
                                'avg_latency': round(avg_latency, 2),
                                'total_processed': client.total_processed,
                                'dropped_chunks': client.dropped_chunks,
                                'queue_size': client.queue_size
                            }, room=sid)

        except Exception as e:
            print(f"Queue processor error [{sid[:8]}]: {e}")
        finally:
            print(f"   Queue processor stopped for {sid[:8]}")
