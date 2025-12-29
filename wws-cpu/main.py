"""
Live Transcription & Translation Server - Entry Point

Usage:
    python main.py

Environment variables (optional):
    WHISPER_MODEL       - Model size (tiny, base, small, medium, large)
    WHISPER_DEVICE      - Device to use (cpu, cuda)
    WHISPER_COMPUTE_TYPE - Compute type (int8, float16, float32)
    NUM_THREADS         - Number of CPU threads
    CHUNK_DURATION      - Audio chunk duration in seconds
    OVERLAP_DURATION    - Overlap between chunks in seconds
    SERVER_HOST         - Server host (default: 0.0.0.0)
    SERVER_PORT         - Server port (default: 5000)
    TTS_ENABLED         - Enable TTS (true/false)
    TTS_MODEL_PATH      - Path to kokoro ONNX model
    TTS_VOICES_PATH     - Path to voices.bin file
    TTS_DEFAULT_VOICE   - Default TTS voice
    TTS_DEFAULT_SPEED   - Default TTS speed (1.0 = normal)
"""
import asyncio
import signal
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Optional

import socketio
from aiohttp import web

from server.config import Config
from server.transcription import TranscriptionEngine
from server.translation import TranslationService
from server.tts import TTSService
from server.handlers import TranscriptionHandlers
from server.file_processor import FileProcessor
from server.upload_handlers import UploadHandlers


class TranscriptionServer:
    """Main server class with graceful shutdown support"""

    def __init__(self, config: Optional[Config] = None):
        self.config = config or Config.from_env()
        self._shutdown_event = asyncio.Event()
        self._executor: Optional[ThreadPoolExecutor] = None
        self._sio: Optional[socketio.AsyncServer] = None
        self._app: Optional[web.Application] = None
        self._handlers: Optional[TranscriptionHandlers] = None
        self._transcription_engine: Optional[TranscriptionEngine] = None
        self._translation_service: Optional[TranslationService] = None
        self._tts_service: Optional[TTSService] = None
        self._file_processor: Optional[FileProcessor] = None
        self._upload_handlers: Optional[UploadHandlers] = None

    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        if sys.platform != 'win32':
            # Unix-like systems
            loop = asyncio.get_event_loop()
            for sig in (signal.SIGTERM, signal.SIGINT):
                loop.add_signal_handler(sig, self._signal_handler)
        else:
            # Windows - use different approach
            signal.signal(signal.SIGINT, self._sync_signal_handler)
            signal.signal(signal.SIGTERM, self._sync_signal_handler)

    def _signal_handler(self):
        """Async signal handler"""
        print("\nShutdown signal received...")
        self._shutdown_event.set()

    def _sync_signal_handler(self, signum, frame):
        """Sync signal handler for Windows"""
        print("\nShutdown signal received...")
        self._shutdown_event.set()

    async def _cleanup(self):
        """Cleanup resources"""
        print("Cleaning up resources...")

        # Shutdown executor
        if self._executor:
            self._executor.shutdown(wait=True, cancel_futures=True)
            print("   Thread pool shutdown complete")

        # Clear translation cache
        if self._translation_service:
            stats = self._translation_service.get_stats()
            print(f"   Translation cache stats: {stats}")
            self._translation_service.clear_cache()

        # Log TTS stats
        if self._tts_service:
            tts_stats = self._tts_service.get_stats()
            print(f"   TTS stats: {tts_stats}")

        print("Cleanup complete")

    def initialize(self):
        """Initialize server components"""
        self.config.print_config()

        # Create thread pool
        self._executor = ThreadPoolExecutor(
            max_workers=self.config.server.max_concurrent_jobs
        )

        # Create Socket.IO server
        self._sio = socketio.AsyncServer(
            async_mode='aiohttp',
            cors_allowed_origins='*',
            ping_timeout=self.config.server.ping_timeout,
            ping_interval=self.config.server.ping_interval,
            max_http_buffer_size=self.config.server.max_http_buffer_size
        )

        # Create aiohttp app
        self._app = web.Application()
        self._sio.attach(self._app)

        # Initialize services
        self._transcription_engine = TranscriptionEngine(
            self.config.whisper,
            self.config.audio,
            self.config.hallucination
        )
        self._transcription_engine.initialize()

        self._translation_service = TranslationService(self.config.translation)

        # Initialize TTS service
        self._tts_service = TTSService(self.config.tts)
        if self.config.tts.enabled:
            self._tts_service.initialize()

        # Setup handlers
        self._handlers = TranscriptionHandlers(
            self._sio,
            self.config,
            self._transcription_engine,
            self._translation_service,
            self._tts_service,
            self._executor
        )

        # Setup file upload handlers
        self._file_processor = FileProcessor(
            self.config,
            self._transcription_engine,
            self._translation_service,
            self._tts_service
        )
        self._upload_handlers = UploadHandlers(self.config, self._file_processor)
        self._upload_handlers.register_routes(self._app)
        print("File upload API enabled at /api/upload")

    async def run(self):
        """Run the server"""
        self.initialize()
        self._setup_signal_handlers()

        # Create runner
        runner = web.AppRunner(self._app)
        await runner.setup()

        site = web.TCPSite(
            runner,
            self.config.server.host,
            self.config.server.port
        )

        print("=" * 60)
        print(f"Server starting on http://{self.config.server.host}:{self.config.server.port}")
        print("=" * 60)
        print("Waiting for connections...\n")

        await site.start()

        # Wait for shutdown signal
        await self._shutdown_event.wait()

        # Graceful shutdown
        print("\nShutting down server...")
        await runner.cleanup()
        await self._cleanup()

        print("Server stopped")


def main():
    """Main entry point"""
    server = TranscriptionServer()

    try:
        asyncio.run(server.run())
    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"Server error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
