"""
Configuration settings for the transcription server.
All thresholds and parameters are configurable.
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WhisperConfig:
    """Whisper model configuration"""
    model_size: str = "tiny"
    device: str = "cpu"
    compute_type: str = "int8"
    num_threads: int = field(default_factory=lambda: os.cpu_count() or 4)
    num_workers: int = 1


@dataclass
class AudioConfig:
    """Audio processing configuration"""
    sample_rate: int = 16000
    chunk_duration: float = 5.0
    overlap_duration: float = 1.0
    min_audio_duration: float = 0.5
    silence_threshold: float = 0.01  # RMS threshold for silence detection


@dataclass
class HallucinationConfig:
    """Hallucination detection thresholds"""
    max_output_length: int = 500
    min_unique_word_ratio: float = 0.4
    max_single_word_ratio: float = 0.6
    min_words_for_repetition_check: int = 5

    # Common hallucination phrases (YouTube-style outros, etc.)
    hallucination_phrases: list = field(default_factory=lambda: [
        "thank you for watching",
        "thanks for watching",
        "subscribe to my channel",
        "welcome to my channel",
        "welcome to the channel",
        "welcome to the video",
        "welcome to the stream",
        "welcome to the show",
        "welcome to the event",
        "welcome to the party",
        "welcome to the club",
        "welcome to the restaurant",
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
    ])


@dataclass
class TranslationConfig:
    """Translation service configuration"""
    cache_max_size: int = 1000
    cache_ttl_seconds: int = 3600  # 1 hour TTL


@dataclass
class TTSConfig:
    """Text-to-Speech configuration"""
    enabled: bool = True
    model_path: str = "kokoro-v1.0.int8.onnx"
    voices_path: str = "voices-v1.0.bin"
    default_voice: str = "af_heart"
    default_speed: float = 1.0
    sample_rate: int = 24000  # Kokoro outputs 24kHz audio

    # Voice mapping by language (for automatic voice selection)
    language_voices: dict = field(default_factory=lambda: {
        'en': 'af_heart',
        'fr': 'bf_emma',      # British female for French-like accent
        'default': 'af_heart'
    })


@dataclass
class ServerConfig:
    """Server and Socket.IO configuration"""
    host: str = "0.0.0.0"
    port: int = 5000
    max_concurrent_jobs: int = 2
    stats_interval: int = 10
    ping_timeout: int = 120
    ping_interval: int = 25
    max_http_buffer_size: int = 10_000_000

    # Backpressure settings
    max_queue_size: int = 20
    backpressure_threshold: int = 15  # Start warning at this level
    backpressure_delay_ms: int = 100  # Delay to suggest to client


@dataclass
class UploadConfig:
    """File upload configuration"""
    max_file_size_mb: int = 200
    allowed_extensions: list = field(default_factory=lambda: ['.mp3', '.wav', '.mp4', '.webm'])
    upload_dir: str = "uploads"
    results_dir: str = "results"
    ffmpeg_path: str = "ffmpeg"
    cleanup_after_hours: int = 24


@dataclass
class Config:
    """Main configuration container"""
    whisper: WhisperConfig = field(default_factory=WhisperConfig)
    audio: AudioConfig = field(default_factory=AudioConfig)
    hallucination: HallucinationConfig = field(default_factory=HallucinationConfig)
    translation: TranslationConfig = field(default_factory=TranslationConfig)
    tts: TTSConfig = field(default_factory=TTSConfig)
    server: ServerConfig = field(default_factory=ServerConfig)
    upload: UploadConfig = field(default_factory=UploadConfig)

    @classmethod
    def from_env(cls) -> "Config":
        """Create config from environment variables"""
        config = cls()

        # Override from environment
        if os.getenv("WHISPER_MODEL"):
            config.whisper.model_size = os.getenv("WHISPER_MODEL")
        if os.getenv("WHISPER_DEVICE"):
            config.whisper.device = os.getenv("WHISPER_DEVICE")
        if os.getenv("WHISPER_COMPUTE_TYPE"):
            config.whisper.compute_type = os.getenv("WHISPER_COMPUTE_TYPE")
        if os.getenv("NUM_THREADS"):
            config.whisper.num_threads = int(os.getenv("NUM_THREADS"))

        if os.getenv("CHUNK_DURATION"):
            config.audio.chunk_duration = float(os.getenv("CHUNK_DURATION"))
        if os.getenv("OVERLAP_DURATION"):
            config.audio.overlap_duration = float(os.getenv("OVERLAP_DURATION"))

        if os.getenv("SERVER_HOST"):
            config.server.host = os.getenv("SERVER_HOST")
        if os.getenv("SERVER_PORT"):
            config.server.port = int(os.getenv("SERVER_PORT"))

        if os.getenv("MAX_HALLUCINATION_LENGTH"):
            config.hallucination.max_output_length = int(os.getenv("MAX_HALLUCINATION_LENGTH"))

        # TTS settings
        if os.getenv("TTS_ENABLED"):
            config.tts.enabled = os.getenv("TTS_ENABLED").lower() in ('true', '1', 'yes')
        if os.getenv("TTS_MODEL_PATH"):
            config.tts.model_path = os.getenv("TTS_MODEL_PATH")
        if os.getenv("TTS_VOICES_PATH"):
            config.tts.voices_path = os.getenv("TTS_VOICES_PATH")
        if os.getenv("TTS_DEFAULT_VOICE"):
            config.tts.default_voice = os.getenv("TTS_DEFAULT_VOICE")
        if os.getenv("TTS_DEFAULT_SPEED"):
            config.tts.default_speed = float(os.getenv("TTS_DEFAULT_SPEED"))

        return config

    def print_config(self):
        """Print configuration summary"""
        print("=" * 60)
        print("Live Transcription & Translation Server - Whisper AI")
        print("=" * 60)
        print(f"Model: {self.whisper.model_size}")
        print(f"Device: {self.whisper.device}")
        print(f"Compute: {self.whisper.compute_type}")
        print(f"Threads: {self.whisper.num_threads}")
        print(f"Chunk: {self.audio.chunk_duration}s (overlap: {self.audio.overlap_duration}s)")
        print(f"Max queue: {self.server.max_queue_size} (backpressure at {self.server.backpressure_threshold})")
        print(f"TTS: {'Enabled' if self.tts.enabled else 'Disabled'} (voice: {self.tts.default_voice})")
        print("=" * 60)
