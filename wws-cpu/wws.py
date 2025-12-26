import asyncio
import base64
import numpy as np
import socketio
from aiohttp import web
import io
import wave
from faster_whisper import WhisperModel
import os
from concurrent.futures import ThreadPoolExecutor
import time
import statistics
from asyncio import Queue
from deep_translator import GoogleTranslator
from functools import lru_cache

# --- CONFIGURATION ---
MODEL_SIZE = "small"
DEVICE = "cpu"
COMPUTE_TYPE = "int8"
NUM_THREADS = os.cpu_count() or 4
SAMPLE_RATE = 16000
CHUNK_DURATION = 5.0
OVERLAP_DURATION = 1.0
MAX_CONCURRENT_JOBS = 2
SEND_STATS_EVERY = 10
# ---------------------

print("=" * 60)
print("🎙️  Live Transcription & Translation Server - Whisper AI")
print("=" * 60)
print(f"Model: {MODEL_SIZE}")
print(f"Device: {DEVICE}")
print(f"Compute: {COMPUTE_TYPE}")
print(f"Threads: {NUM_THREADS}")
print(f"Chunk: {CHUNK_DURATION}s (overlap: {OVERLAP_DURATION}s)")
print("=" * 60)

# Optimize CPU threading
os.environ["OMP_NUM_THREADS"] = str(NUM_THREADS)
os.environ["MKL_NUM_THREADS"] = str(NUM_THREADS)

# Load Model
print(f"\n⏳ Loading Whisper {MODEL_SIZE} model...")
model = WhisperModel(
    MODEL_SIZE,
    device=DEVICE,
    compute_type=COMPUTE_TYPE,
    cpu_threads=NUM_THREADS,
    num_workers=1
)
print("✅ Model loaded successfully!\n")

# Socket.IO setup
sio = socketio.AsyncServer(
    async_mode='aiohttp',
    cors_allowed_origins='*',
    ping_timeout=120,
    ping_interval=25,
    max_http_buffer_size=10_000_000
)
app = web.Application()
sio.attach(app)

# Thread pool
executor = ThreadPoolExecutor(max_workers=MAX_CONCURRENT_JOBS)

# Translation cache to avoid re-translating same phrases
translation_cache = {}

# Language code mapping for Whisper to Google Translate
LANGUAGE_MAP = {
    'en': 'en',
    'fr': 'fr',
    'es': 'es',
    'de': 'de',
    'it': 'it',
    'pt': 'pt',
    'ru': 'ru',
    'ja': 'ja',
    'ko': 'ko',
    'zh': 'zh-CN',
    'ar': 'ar',
    'hi': 'hi',
    'nl': 'nl',
    'pl': 'pl',
    'tr': 'tr',
}

def get_language_icon(lang_code):
    """Get flag emoji for language"""
    icons = {
        'en': '🇬🇧',
        'fr': '🇫🇷',
        'es': '🇪🇸',
        'de': '🇩🇪',
        'it': '🇮🇹',
        'pt': '🇵🇹',
        'ru': '🇷🇺',
        'ja': '🇯🇵',
        'ko': '🇰🇷',
        'zh': '🇨🇳',
        'ar': '🇸🇦',
        'hi': '🇮🇳',
        'nl': '🇳🇱',
        'pl': '🇵🇱',
        'tr': '🇹🇷',
    }
    return icons.get(lang_code, '🌐')

def translate_text(text, source_lang, target_lang):
    """Translate text using Google Translator with caching"""
    try:
        # Don't translate if source and target are the same
        if source_lang == target_lang:
            return text
        
        # Check cache
        cache_key = f"{source_lang}:{target_lang}:{text}"
        if cache_key in translation_cache:
            return translation_cache[cache_key]
        
        # Map language codes
        source = LANGUAGE_MAP.get(source_lang, source_lang)
        target = LANGUAGE_MAP.get(target_lang, target_lang)
        
        # Translate
        translator = GoogleTranslator(source=source, target=target)
        translated = translator.translate(text)
        
        # Cache result (limit cache size)
        if len(translation_cache) > 1000:
            translation_cache.clear()
        translation_cache[cache_key] = translated
        
        return translated
        
    except Exception as e:
        print(f"❌ Translation error: {e}")
        return text  # Return original text if translation fails

# Client state
client_buffers = {}

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    client_buffers[sid] = {
        'audio': np.array([], dtype=np.float32),
        'format': None,
        'total_processed': 0,
        'is_processing': False,
        'connected': True,
        'start_time': time.time(),
        'processing_queue': Queue(),
        'queue_task': None,
        'latencies': [],
        'chunk_sizes': [],
        'dropped_chunks': 0,
        # Translation settings
        'source_language': None,  # Auto-detect or specified
        'target_language': None,  # Translation target
        'translation_enabled': False
    }
    print(f"✅ Client connected: {sid[:8]}")
    
    await sio.emit('status', {
        'message': 'Connected',
        'device': DEVICE,
        'model': MODEL_SIZE,
        'compute_type': COMPUTE_TYPE
    }, room=sid)
    
    # Start queue processor
    client_buffers[sid]['queue_task'] = asyncio.create_task(process_queue(sid))

@sio.event
async def set_translation(sid, data):
    """Configure translation settings for client"""
    if sid not in client_buffers:
        return
    
    buffer = client_buffers[sid]
    
    source_lang = data.get('source_language')  # e.g., 'fr', 'en', or None for auto-detect
    target_lang = data.get('target_language')  # e.g., 'en', 'fr'
    
    buffer['source_language'] = source_lang
    buffer['target_language'] = target_lang
    buffer['translation_enabled'] = target_lang is not None
    
    source_icon = get_language_icon(source_lang) if source_lang else '🔍'
    target_icon = get_language_icon(target_lang) if target_lang else ''
    
    print(f"   🌐 [{sid[:8]}] Translation: {source_icon} {source_lang or 'auto'} → {target_icon} {target_lang or 'none'}")
    
    await sio.emit('translation_config', {
        'source_language': source_lang,
        'target_language': target_lang,
        'enabled': buffer['translation_enabled']
    }, room=sid)

def decode_audio_chunk(data, current_format):
    """Decode incoming audio data"""
    try:
        audio_bytes = base64.b64decode(data)
        
        # Auto-detect format
        if current_format is None:
            header = audio_bytes[:4]
            if header == b'RIFF':
                current_format = 'wav'
            elif header == b'\x1a\xE5\xdf\xa3':
                current_format = 'webm'
            else:
                current_format = 'raw_pcm'
        
        # Process WAV
        if current_format == 'wav':
            with wave.open(io.BytesIO(audio_bytes), 'rb') as wf:
                if wf.getsampwidth() != 2:
                    return None, current_format
                
                samples = np.frombuffer(
                    wf.readframes(wf.getnframes()),
                    dtype=np.int16
                )
                
                # Stereo to mono
                if wf.getnchannels() == 2:
                    samples = samples.reshape(-1, 2).mean(axis=1).astype(np.int16)
                
                return samples.astype(np.float32) / 32768.0, current_format
        
        # Process raw PCM
        elif current_format == 'raw_pcm':
            # Ensure even length for int16
            if len(audio_bytes) % 2 != 0:
                audio_bytes = audio_bytes[:-1]
            
            if len(audio_bytes) == 0:
                return None, current_format
            
            samples = np.frombuffer(audio_bytes, dtype=np.int16)
            return samples.astype(np.float32) / 32768.0, current_format
            
    except Exception as e:
        print(f"❌ Decode error: {e}")
    
    return None, current_format

def detect_hallucination(text: str) -> bool:
    """Advanced hallucination detection"""
    if not text or len(text.strip()) == 0:
        return True
    
    # Common hallucination phrases (YouTube-style outros, etc.)
    hallucination_phrases = [
        "thank you for watching",
        "thanks for watching",
        "subscribe to my channel",
        "like and subscribe",
        "don't forget to subscribe",
        "merci de votre attention",
        "merci d'avoir regardé",
        "n'oubliez pas de vous abonner",
        "abonnez-vous",
        "likez et abonnez",
        "sous-titres par",
        "subtitles by",
        "transcribed by",
        "music playing",
        "[music]",
        "[applause]"
    ]
    
    text_lower = text.lower().strip()
    
    # Check for hallucination phrases
    for phrase in hallucination_phrases:
        if phrase in text_lower:
            return True
    
    # Check for excessive repetition
    words = text.split()
    if len(words) > 5:
        unique_words = set(words)
        unique_ratio = len(unique_words) / len(words)
        if unique_ratio < 0.4:
            return True
    
    # Check for unrealistic length (5s audio shouldn't produce 500+ characters)
    if len(text) > 500:
        return True
    
    # Check for single repeated word
    if len(words) > 3:
        word_counts = {}
        for word in words:
            word_counts[word] = word_counts.get(word, 0) + 1
        max_count = max(word_counts.values())
        if max_count > len(words) * 0.6:
            return True
    
    return False

def process_audio(audio_samples, source_language=None):
    """Run Whisper inference with enhanced anti-hallucination"""
    try:
        # Check minimum duration
        if len(audio_samples) < SAMPLE_RATE * 0.5:
            return None, None
        
        # Check if audio is too quiet (likely silence)
        rms = np.sqrt(np.mean(audio_samples**2))
        if rms < 0.01:
            return None, None
        
        # Transcribe with quality settings
        segments, info = model.transcribe(
            audio_samples,
            language=source_language,  # Use specified language or auto-detect
            beam_size=5,
            best_of=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=400
            ),
            condition_on_previous_text=False,
            # Anti-hallucination
            compression_ratio_threshold=2.4,
            log_prob_threshold=-1.0,
            no_speech_threshold=0.6,
            repetition_penalty=1.2,
            no_repeat_ngram_size=3
        )
        
        # Collect text
        text = " ".join(seg.text for seg in segments).strip()
        
        # Enhanced hallucination detection
        if detect_hallucination(text):
            return None, None
        
        # Return text and detected language
        detected_lang = info.language if hasattr(info, 'language') else None
        return text, detected_lang
        
    except Exception as e:
        print(f"❌ Inference error: {e}")
        return None, None

async def process_queue(sid):
    """Process audio chunks from queue"""
    if sid not in client_buffers:
        return
    
    buffer = client_buffers[sid]
    
    try:
        while buffer['connected']:
            # Wait for data in queue
            try:
                data = await asyncio.wait_for(
                    buffer['processing_queue'].get(),
                    timeout=1.0
                )
            except asyncio.TimeoutError:
                continue
            
            # Decode audio
            samples, detected_format = decode_audio_chunk(data, buffer['format'])
            
            if samples is None:
                continue
            
            # Set format on first chunk
            if buffer['format'] is None:
                buffer['format'] = detected_format
                print(f"   📡 [{sid[:8]}] Format detected: {detected_format}")
            
            # Append to buffer
            buffer['audio'] = np.append(buffer['audio'], samples)
            buffer['chunk_sizes'].append(len(samples))
            
            # Process when buffer is full
            buffer_duration = len(buffer['audio']) / SAMPLE_RATE
            
            if buffer_duration >= CHUNK_DURATION:
                # Extract chunk
                chunk_size = int(SAMPLE_RATE * CHUNK_DURATION)
                audio_to_process = buffer['audio'][:chunk_size].copy()
                
                # Keep overlap
                overlap_samples = int(SAMPLE_RATE * OVERLAP_DURATION)
                buffer['audio'] = buffer['audio'][chunk_size - overlap_samples:]
                
                # Audio quality check
                rms = np.sqrt(np.mean(audio_to_process**2))
                
                # Run inference
                start_time = time.time()
                loop = asyncio.get_running_loop()
                
                # Get transcription with detected language
                result = await loop.run_in_executor(
                    executor, 
                    process_audio, 
                    audio_to_process,
                    buffer['source_language']
                )
                text, detected_lang = result
                
                inference_time = time.time() - start_time
                
                # Track latency
                buffer['latencies'].append(inference_time)
                
                # Send result
                if buffer['connected']:
                    if text:
                        buffer['total_processed'] += 1
                        
                        # Use detected language or specified source language
                        source_lang = detected_lang or buffer['source_language'] or 'unknown'
                        
                        # Translate if enabled
                        translated_text = None
                        translation_time = 0
                        
                        if buffer['translation_enabled'] and buffer['target_language']:
                            trans_start = time.time()
                            translated_text = await loop.run_in_executor(
                                executor,
                                translate_text,
                                text,
                                source_lang,
                                buffer['target_language']
                            )
                            translation_time = time.time() - trans_start
                        
                        # Get language icons
                        source_icon = get_language_icon(source_lang)
                        target_icon = get_language_icon(buffer['target_language']) if buffer['translation_enabled'] else ''
                        
                        # Log output
                        total_time = inference_time + translation_time
                        log_msg = f"   {source_icon} [{sid[:8]}] ({total_time:.1f}s) {text[:60]}{'...' if len(text) > 60 else ''}"
                        if translated_text:
                            log_msg += f"\n   {target_icon} → {translated_text[:60]}{'...' if len(translated_text) > 60 else ''}"
                        print(log_msg)
                        
                        # Send to client
                        response = {
                            'text': text,
                            'language': source_lang,
                            'inference_time': inference_time,
                            'count': buffer['total_processed']
                        }
                        
                        if translated_text:
                            response['translated_text'] = translated_text
                            response['target_language'] = buffer['target_language']
                            response['translation_time'] = translation_time
                        
                        await sio.emit('transcription', response, room=sid)
                    else:
                        print(f"   🔇 [{sid[:8]}] Filtered (RMS: {rms:.4f})")
                    
                    # Send stats periodically
                    if buffer['total_processed'] % SEND_STATS_EVERY == 0 and buffer['latencies']:
                        avg_latency = statistics.mean(buffer['latencies'][-SEND_STATS_EVERY:])
                        await sio.emit('stats', {
                            'avg_latency': round(avg_latency, 2),
                            'total_processed': buffer['total_processed'],
                            'dropped_chunks': buffer['dropped_chunks']
                        }, room=sid)
            
    except Exception as e:
        print(f"❌ Queue processor error [{sid[:8]}]: {e}")
    finally:
        print(f"   🛑 Queue processor stopped for {sid[:8]}")

@sio.event
async def audio_chunk(sid, data):
    """Handle incoming audio chunks - queue them for processing"""
    if sid not in client_buffers or not client_buffers[sid]['connected']:
        return
    
    try:
        buffer = client_buffers[sid]
        
        # Check queue size to prevent memory issues
        queue_size = buffer['processing_queue'].qsize()
        if queue_size > 20:
            buffer['dropped_chunks'] += 1
            if buffer['dropped_chunks'] % 10 == 0:
                print(f"   ⚠️  [{sid[:8]}] Queue overload, dropped {buffer['dropped_chunks']} chunks")
            return
        
        # Add to queue
        await buffer['processing_queue'].put(data)
        
    except Exception as e:
        print(f"❌ Error queuing chunk: {e}")

@sio.event
async def stop_recording(sid):
    """Process final audio chunk"""
    if sid not in client_buffers or not client_buffers[sid]['connected']:
        return
    
    buffer = client_buffers[sid]
    
    # Wait for queue to empty
    timeout = 100
    while not buffer['processing_queue'].empty() and timeout > 0:
        await asyncio.sleep(0.1)
        timeout -= 1
    
    # Process remaining audio
    if len(buffer['audio']) > SAMPLE_RATE * 0.5:
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            executor, 
            process_audio, 
            buffer['audio'],
            buffer['source_language']
        )
        text, detected_lang = result
        
        if text and buffer['connected'] and not detect_hallucination(text):
            buffer['total_processed'] += 1
            
            # Translate final chunk if enabled
            translated_text = None
            if buffer['translation_enabled'] and buffer['target_language']:
                source_lang = detected_lang or buffer['source_language'] or 'unknown'
                translated_text = await loop.run_in_executor(
                    executor,
                    translate_text,
                    text,
                    source_lang,
                    buffer['target_language']
                )
            
            print(f"   🏁 [{sid[:8]}] Final: {text[:80]}{'...' if len(text) > 80 else ''}")
            
            response = {
                'text': text,
                'final': True,
                'count': buffer['total_processed']
            }
            
            if translated_text:
                response['translated_text'] = translated_text
                response['target_language'] = buffer['target_language']
            
            await sio.emit('transcription', response, room=sid)
    
    # Clear buffer
    buffer['audio'] = np.array([], dtype=np.float32)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    if sid in client_buffers:
        buffer = client_buffers[sid]
        buffer['connected'] = False
        
        # Cancel queue processor
        if buffer['queue_task'] and not buffer['queue_task'].done():
            buffer['queue_task'].cancel()
            try:
                await buffer['queue_task']
            except asyncio.CancelledError:
                pass
        
        session_time = time.time() - buffer['start_time']
        avg_latency = statistics.mean(buffer['latencies']) if buffer['latencies'] else 0
        
        print(f"❌ Client disconnected: {sid[:8]}")
        print(f"   ⏱️  Session: {session_time:.0f}s")
        print(f"   📊 Processed: {buffer['total_processed']} chunks")
        print(f"   ⚡ Avg latency: {avg_latency:.2f}s")
        print(f"   🗑️  Dropped: {buffer['dropped_chunks']} chunks")
        
        # Cleanup after delay
        await asyncio.sleep(1.0)
        if sid in client_buffers:
            del client_buffers[sid]

@sio.event
async def ping(sid):
    """Handle ping from client"""
    await sio.emit('pong', room=sid)

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Server starting on http://0.0.0.0:5000")
    print("=" * 60)
    print("💡 Waiting for connections...\n")
    
    web.run_app(app, host='0.0.0.0', port=5000, print=None)