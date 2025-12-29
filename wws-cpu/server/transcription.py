"""
Whisper transcription engine with hallucination detection.
"""
import os
from typing import Optional, Tuple

import numpy as np
from faster_whisper import WhisperModel

from .config import WhisperConfig, AudioConfig, HallucinationConfig


class HallucinationDetector:
    """Detects common Whisper hallucinations"""

    def __init__(self, config: Optional[HallucinationConfig] = None):
        self.config = config or HallucinationConfig()

    def is_hallucination(self, text: str) -> bool:
        """
        Check if transcription output is likely a hallucination.

        Args:
            text: Transcription output to check

        Returns:
            True if the text appears to be a hallucination
        """
        if not text or len(text.strip()) == 0:
            return True

        text_lower = text.lower().strip()

        # Check for known hallucination phrases
        for phrase in self.config.hallucination_phrases:
            if phrase in text_lower:
                return True

        # Check for excessive length
        if len(text) > self.config.max_output_length:
            return True

        # Check for word repetition patterns
        words = text.split()

        if len(words) >= self.config.min_words_for_repetition_check:
            # Check unique word ratio
            unique_words = set(words)
            unique_ratio = len(unique_words) / len(words)
            if unique_ratio < self.config.min_unique_word_ratio:
                return True

            # Check for single dominant word
            word_counts = {}
            for word in words:
                word_counts[word] = word_counts.get(word, 0) + 1

            max_count = max(word_counts.values())
            if max_count > len(words) * self.config.max_single_word_ratio:
                return True

        return False


class TranscriptionEngine:
    """Whisper-based transcription engine"""

    def __init__(
        self,
        whisper_config: Optional[WhisperConfig] = None,
        audio_config: Optional[AudioConfig] = None,
        hallucination_config: Optional[HallucinationConfig] = None
    ):
        self.whisper_config = whisper_config or WhisperConfig()
        self.audio_config = audio_config or AudioConfig()
        self.hallucination_detector = HallucinationDetector(hallucination_config)
        self._model: Optional[WhisperModel] = None

    def initialize(self):
        """Load the Whisper model"""
        if self._model is not None:
            return

        # Optimize CPU threading
        os.environ["OMP_NUM_THREADS"] = str(self.whisper_config.num_threads)
        os.environ["MKL_NUM_THREADS"] = str(self.whisper_config.num_threads)

        print(f"\nLoading Whisper {self.whisper_config.model_size} model...")

        self._model = WhisperModel(
            self.whisper_config.model_size,
            device=self.whisper_config.device,
            compute_type=self.whisper_config.compute_type,
            cpu_threads=self.whisper_config.num_threads,
            num_workers=self.whisper_config.num_workers
        )

        print("Model loaded successfully!\n")

    @property
    def model(self) -> WhisperModel:
        """Get the loaded model, initializing if needed"""
        if self._model is None:
            self.initialize()
        return self._model

    def transcribe(
        self,
        audio_samples: np.ndarray,
        source_language: Optional[str] = None
    ) -> Tuple[Optional[str], Optional[str]]:
        """
        Transcribe audio samples.

        Args:
            audio_samples: Audio data as float32 numpy array
            source_language: Optional source language code (None for auto-detect)

        Returns:
            Tuple of (transcribed_text, detected_language)
            Returns (None, None) if transcription fails or is filtered
        """
        try:
            # Check minimum duration
            duration = len(audio_samples) / self.audio_config.sample_rate
            if duration < self.audio_config.min_audio_duration:
                return None, None

            # Check if audio is too quiet (likely silence)
            rms = np.sqrt(np.mean(audio_samples ** 2))
            if rms < 0.01:
                return None, None

            # Run transcription
            segments, info = self.model.transcribe(
                audio_samples,
                language=source_language,
                beam_size=5,
                best_of=5,
                temperature=0.0,
                vad_filter=True,
                vad_parameters=dict(
                    min_silence_duration_ms=500,
                    speech_pad_ms=400
                ),
                condition_on_previous_text=False,
                # Anti-hallucination parameters
                compression_ratio_threshold=2.4,
                log_prob_threshold=-1.0,
                no_speech_threshold=0.6,
                repetition_penalty=1.2,
                no_repeat_ngram_size=3
            )

            # Collect text from segments
            text = " ".join(seg.text for seg in segments).strip()

            # Check for hallucination
            if self.hallucination_detector.is_hallucination(text):
                return None, None

            # Return text and detected language
            detected_lang = info.language if hasattr(info, 'language') else None
            return text, detected_lang

        except Exception as e:
            print(f"Transcription error: {e}")
            return None, None
