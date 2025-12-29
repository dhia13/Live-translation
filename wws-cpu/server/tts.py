"""
Text-to-Speech service using kokoro-onnx.
Converts translated text to speech audio.
"""
import base64
import io
import os
import threading
from dataclasses import dataclass, field
from typing import Optional, Tuple, List

import numpy as np

try:
    from kokoro_onnx import Kokoro
    KOKORO_AVAILABLE = True
except ImportError:
    KOKORO_AVAILABLE = False
    Kokoro = None


@dataclass
class TTSConfig:
    """TTS configuration settings"""
    enabled: bool = True
    model_path: str = "kokoro-v1.0.onnx"
    voices_path: str = "voices-v1.0.bin"
    default_voice: str = "af_heart"
    default_speed: float = 1.0
    sample_rate: int = 24000  # Kokoro outputs 24kHz audio

    # Voice mapping by language (for automatic voice selection)
    language_voices: dict = field(default_factory=lambda: {
        'en': 'af_heart',      # American female
        'fr': 'af_heart',      # Use American female for French (no native French voice)
        'default': 'af_heart'
    })


# Kokoro language code mapping
KOKORO_LANG_MAP = {
    'en': 'en-us',
    'fr': 'fr-fr',
    'default': 'en-us',
}

# Available Kokoro voices (2 female, 2 male)
AVAILABLE_VOICES = [
    # Female voices
    {'id': 'af_heart', 'name': 'Heart', 'gender': 'female', 'accent': 'American'},
    {'id': 'bf_emma', 'name': 'Emma', 'gender': 'female', 'accent': 'British'},
    # Male voices
    {'id': 'am_adam', 'name': 'Adam', 'gender': 'male', 'accent': 'American'},
    {'id': 'bm_george', 'name': 'George', 'gender': 'male', 'accent': 'British'},
]


class TTSService:
    """Text-to-Speech service using Kokoro ONNX"""

    def __init__(self, config: Optional[TTSConfig] = None):
        self.config = config or TTSConfig()
        self._kokoro: Optional[Kokoro] = None
        self._lock = threading.RLock()
        self._initialized = False
        self._available = KOKORO_AVAILABLE

    @property
    def is_available(self) -> bool:
        """Check if TTS is available"""
        return self._available and self.config.enabled

    def initialize(self) -> bool:
        """Initialize the Kokoro TTS model"""
        if not self._available:
            print("TTS: kokoro-onnx not installed. Install with: pip install kokoro-onnx")
            return False

        if self._initialized:
            return True

        with self._lock:
            if self._initialized:
                return True

            try:
                # Check if model files exist
                model_path = self.config.model_path
                voices_path = self.config.voices_path

                if not os.path.exists(model_path):
                    print(f"TTS: Model file not found: {model_path}")
                    print("Download from: https://github.com/thewh1teagle/kokoro-onnx/releases")
                    self._available = False
                    return False

                if not os.path.exists(voices_path):
                    print(f"TTS: Voices file not found: {voices_path}")
                    print("Download from: https://github.com/thewh1teagle/kokoro-onnx/releases")
                    self._available = False
                    return False

                print(f"TTS: Loading Kokoro model from {model_path}...")
                self._kokoro = Kokoro(model_path, voices_path)
                self._initialized = True
                print("TTS: Kokoro model loaded successfully!")
                return True

            except Exception as e:
                print(f"TTS: Failed to initialize Kokoro: {e}")
                self._available = False
                return False

    def get_voice_for_language(self, lang_code: str) -> str:
        """Get the appropriate voice for a language"""
        return self.config.language_voices.get(
            lang_code,
            self.config.language_voices.get('default', self.config.default_voice)
        )

    def get_kokoro_lang(self, lang_code: str) -> str:
        """Convert language code to Kokoro format"""
        return KOKORO_LANG_MAP.get(lang_code, 'en-us')

    def synthesize(
        self,
        text: str,
        language: str = 'en',
        voice: Optional[str] = None,
        speed: Optional[float] = None
    ) -> Tuple[Optional[bytes], int]:
        """
        Synthesize text to speech.

        Args:
            text: Text to synthesize
            language: Target language code
            voice: Voice ID (optional, auto-selected based on language if not provided)
            speed: Speech speed multiplier (optional)

        Returns:
            Tuple of (audio_bytes_wav, sample_rate) or (None, 0) on failure
        """
        if not self.is_available or not text or not text.strip():
            return None, 0

        if not self._initialized:
            if not self.initialize():
                return None, 0

        try:
            # Select voice and language
            selected_voice = voice or self.get_voice_for_language(language)
            selected_speed = speed or self.config.default_speed
            kokoro_lang = self.get_kokoro_lang(language)

            with self._lock:
                # Generate audio
                samples, sample_rate = self._kokoro.create(
                    text,
                    voice=selected_voice,
                    speed=selected_speed,
                    lang=kokoro_lang
                )

            # Convert to WAV bytes
            wav_bytes = self._samples_to_wav(samples, sample_rate)
            return wav_bytes, sample_rate

        except Exception as e:
            print(f"TTS: Synthesis error: {e}")
            return None, 0

    def synthesize_to_base64(
        self,
        text: str,
        language: str = 'en',
        voice: Optional[str] = None,
        speed: Optional[float] = None
    ) -> Tuple[Optional[str], int]:
        """
        Synthesize text and return as base64-encoded WAV.

        Returns:
            Tuple of (base64_audio, sample_rate) or (None, 0) on failure
        """
        wav_bytes, sample_rate = self.synthesize(text, language, voice, speed)
        if wav_bytes:
            return base64.b64encode(wav_bytes).decode('utf-8'), sample_rate
        return None, 0

    def _samples_to_wav(self, samples: np.ndarray, sample_rate: int) -> bytes:
        """Convert numpy samples to WAV bytes"""
        import wave

        # Ensure samples are in the right format
        if samples.dtype == np.float32 or samples.dtype == np.float64:
            # Convert float to int16
            samples = (samples * 32767).astype(np.int16)

        # Create WAV in memory
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(samples.tobytes())

        return buffer.getvalue()

    def get_available_voices(self) -> List[dict]:
        """Get list of available voices"""
        return AVAILABLE_VOICES

    def get_stats(self) -> dict:
        """Get TTS service stats"""
        return {
            'available': self._available,
            'initialized': self._initialized,
            'model_path': self.config.model_path,
            'default_voice': self.config.default_voice
        }


# Global service instance
_tts_service: Optional[TTSService] = None
_tts_lock = threading.Lock()


def get_tts_service(config: Optional[TTSConfig] = None) -> TTSService:
    """Get or create the global TTS service"""
    global _tts_service
    with _tts_lock:
        if _tts_service is None:
            _tts_service = TTSService(config)
        return _tts_service
