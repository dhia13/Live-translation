"""
Audio processing utilities for decoding and preprocessing audio data.
"""
import base64
import io
import wave
from typing import Optional, Tuple

import numpy as np

from .config import AudioConfig


class AudioProcessor:
    """Handles audio decoding and preprocessing"""

    def __init__(self, config: Optional[AudioConfig] = None):
        self.config = config or AudioConfig()

    def decode_chunk(
        self,
        data: str,
        current_format: Optional[str] = None
    ) -> Tuple[Optional[np.ndarray], Optional[str]]:
        """
        Decode incoming base64 audio data.

        Args:
            data: Base64-encoded audio data
            current_format: Previously detected format (for consistency)

        Returns:
            Tuple of (audio_samples, detected_format)
            Returns (None, format) if decoding fails
        """
        try:
            audio_bytes = base64.b64decode(data)

            # Auto-detect format from header
            detected_format = current_format
            if detected_format is None:
                detected_format = self._detect_format(audio_bytes)

            # Process based on format
            if detected_format == 'wav':
                samples = self._decode_wav(audio_bytes)
            elif detected_format == 'raw_pcm':
                samples = self._decode_raw_pcm(audio_bytes)
            else:
                # Unknown format, try raw PCM as fallback
                samples = self._decode_raw_pcm(audio_bytes)
                detected_format = 'raw_pcm'

            return samples, detected_format

        except Exception as e:
            print(f"Audio decode error: {e}")
            return None, current_format

    def _detect_format(self, audio_bytes: bytes) -> str:
        """Detect audio format from header bytes"""
        if len(audio_bytes) < 4:
            return 'raw_pcm'

        header = audio_bytes[:4]

        if header == b'RIFF':
            return 'wav'
        elif header == b'\x1a\xE5\xdf\xa3':
            return 'webm'
        else:
            return 'raw_pcm'

    def _decode_wav(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """Decode WAV format audio"""
        try:
            with wave.open(io.BytesIO(audio_bytes), 'rb') as wf:
                # Only support 16-bit audio
                if wf.getsampwidth() != 2:
                    print(f"Unsupported sample width: {wf.getsampwidth()}")
                    return None

                frames = wf.readframes(wf.getnframes())
                samples = np.frombuffer(frames, dtype=np.int16)

                # Convert stereo to mono by averaging channels
                if wf.getnchannels() == 2:
                    samples = samples.reshape(-1, 2).mean(axis=1).astype(np.int16)

                # Normalize to float32 [-1.0, 1.0]
                return samples.astype(np.float32) / 32768.0

        except Exception as e:
            print(f"WAV decode error: {e}")
            return None

    def _decode_raw_pcm(self, audio_bytes: bytes) -> Optional[np.ndarray]:
        """Decode raw PCM (16-bit signed integer) audio"""
        try:
            # Ensure even length for int16
            if len(audio_bytes) % 2 != 0:
                audio_bytes = audio_bytes[:-1]

            if len(audio_bytes) == 0:
                return None

            samples = np.frombuffer(audio_bytes, dtype=np.int16)

            # Normalize to float32 [-1.0, 1.0]
            return samples.astype(np.float32) / 32768.0

        except Exception as e:
            print(f"Raw PCM decode error: {e}")
            return None

    def compute_rms(self, samples: np.ndarray) -> float:
        """Compute RMS (Root Mean Square) energy of audio samples"""
        if len(samples) == 0:
            return 0.0
        return float(np.sqrt(np.mean(samples ** 2)))

    def is_silence(self, samples: np.ndarray) -> bool:
        """Check if audio samples are below silence threshold"""
        return self.compute_rms(samples) < self.config.silence_threshold

    def get_duration(self, samples: np.ndarray) -> float:
        """Get duration of audio samples in seconds"""
        return len(samples) / self.config.sample_rate

    def has_minimum_duration(self, samples: np.ndarray) -> bool:
        """Check if audio has minimum required duration"""
        return self.get_duration(samples) >= self.config.min_audio_duration
