"""
File processing service for handling uploaded audio/video files.
Uses ffmpeg for audio extraction from video formats.
"""
import asyncio
import os
import uuid
import wave
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Optional, List, Dict, Tuple

import numpy as np

from .config import Config
from .transcription import TranscriptionEngine
from .translation import TranslationService
from .tts import TTSService


class ProcessingMode(Enum):
    TRANSCRIBE = "transcribe"
    TRANSCRIBE_TRANSLATE = "transcribe_translate"
    TRANSCRIBE_TRANSLATE_TTS = "transcribe_translate_tts"


class JobStatus(Enum):
    PENDING = "pending"
    EXTRACTING = "extracting"
    TRANSCRIBING = "transcribing"
    TRANSLATING = "translating"
    SYNTHESIZING = "synthesizing"
    COMPLETE = "complete"
    ERROR = "error"


@dataclass
class TranscriptionSegment:
    """A single transcription segment with timing"""
    id: int
    start: float
    end: float
    text: str
    translated_text: Optional[str] = None
    language: Optional[str] = None


@dataclass
class ProcessingJob:
    """Represents a file processing job"""
    job_id: str
    filename: str
    status: JobStatus = JobStatus.PENDING
    progress: float = 0.0
    mode: ProcessingMode = ProcessingMode.TRANSCRIBE
    source_language: Optional[str] = None
    target_language: Optional[str] = None
    tts_voice: Optional[str] = None
    tts_speed: float = 1.0

    # Results
    segments: List[TranscriptionSegment] = field(default_factory=list)
    audio_duration: float = 0.0
    error_message: Optional[str] = None
    tts_audio_path: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert job to dictionary for JSON serialization"""
        return {
            "job_id": self.job_id,
            "filename": self.filename,
            "status": self.status.value,
            "progress": self.progress,
            "mode": self.mode.value,
            "source_language": self.source_language,
            "target_language": self.target_language,
            "audio_duration": self.audio_duration,
            "segments": [
                {
                    "id": seg.id,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text,
                    "translatedText": seg.translated_text,
                    "language": seg.language
                }
                for seg in self.segments
            ],
            "error_message": self.error_message,
            "has_tts_audio": self.tts_audio_path is not None
        }


class FileProcessor:
    """Handles file upload processing pipeline"""

    def __init__(
        self,
        config: Config,
        transcription_engine: TranscriptionEngine,
        translation_service: TranslationService,
        tts_service: TTSService
    ):
        self.config = config
        self.transcription_engine = transcription_engine
        self.translation_service = translation_service
        self.tts_service = tts_service
        self.jobs: Dict[str, ProcessingJob] = {}

        # Ensure directories exist
        os.makedirs(config.upload.upload_dir, exist_ok=True)
        os.makedirs(config.upload.results_dir, exist_ok=True)

    def create_job(
        self,
        filename: str,
        mode: str,
        source_language: Optional[str],
        target_language: Optional[str],
        tts_voice: Optional[str],
        tts_speed: float
    ) -> ProcessingJob:
        """Create a new processing job"""
        job_id = str(uuid.uuid4())

        job = ProcessingJob(
            job_id=job_id,
            filename=filename,
            mode=ProcessingMode(mode),
            source_language=source_language,
            target_language=target_language,
            tts_voice=tts_voice or self.config.tts.default_voice,
            tts_speed=tts_speed
        )

        self.jobs[job_id] = job
        return job

    def get_job(self, job_id: str) -> Optional[ProcessingJob]:
        """Get a job by ID"""
        return self.jobs.get(job_id)

    def delete_job(self, job_id: str) -> bool:
        """Delete a job and its files"""
        job = self.jobs.get(job_id)
        if not job:
            return False

        # Clean up files
        upload_path = Path(self.config.upload.upload_dir) / job_id
        if upload_path.exists():
            for f in upload_path.iterdir():
                f.unlink()
            upload_path.rmdir()

        results_path = Path(self.config.upload.results_dir) / job_id
        if results_path.exists():
            for f in results_path.iterdir():
                f.unlink()
            results_path.rmdir()

        del self.jobs[job_id]
        return True

    async def extract_audio(self, input_path: str, output_path: str) -> Tuple[bool, float]:
        """
        Extract audio from video/audio file using ffmpeg.
        Converts to 16kHz mono WAV for Whisper compatibility.

        Returns: (success, duration_seconds)
        """
        cmd = [
            self.config.upload.ffmpeg_path,
            '-i', input_path,
            '-vn',  # No video
            '-acodec', 'pcm_s16le',  # 16-bit PCM
            '-ar', '16000',  # 16kHz sample rate
            '-ac', '1',  # Mono
            '-y',  # Overwrite output
            output_path
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()

            if process.returncode != 0:
                print(f"FFmpeg error: {stderr.decode()}")
                return False, 0.0

            # Get duration
            duration = await self._get_audio_duration(output_path)
            return True, duration

        except Exception as e:
            print(f"Audio extraction error: {e}")
            return False, 0.0

    async def _get_audio_duration(self, audio_path: str) -> float:
        """Get audio duration using ffprobe"""
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            audio_path
        ]

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()

            if process.returncode == 0:
                return float(stdout.decode().strip())
        except:
            pass

        # Fallback: read WAV file directly
        try:
            with wave.open(audio_path, 'rb') as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                return frames / float(rate)
        except:
            return 0.0

    def _load_audio(self, audio_path: str) -> np.ndarray:
        """Load audio file as numpy array"""
        with wave.open(audio_path, 'rb') as wf:
            frames = wf.readframes(wf.getnframes())
            audio = np.frombuffer(frames, dtype=np.int16)
            # Normalize to float32
            audio = audio.astype(np.float32) / 32768.0
            return audio

    async def process_file(self, job: ProcessingJob, file_path: str) -> ProcessingJob:
        """Main processing pipeline"""
        import time
        total_start = time.time()
        timings = {}

        try:
            # Create job directories
            job_upload_dir = Path(self.config.upload.upload_dir) / job.job_id
            job_results_dir = Path(self.config.upload.results_dir) / job.job_id
            job_upload_dir.mkdir(exist_ok=True)
            job_results_dir.mkdir(exist_ok=True)

            # Step 1: Extract audio (10% of progress)
            step_start = time.time()
            job.status = JobStatus.EXTRACTING
            job.progress = 0.0
            print(f"\n[FileProcessor] === STEP 1: EXTRACTING AUDIO ===")

            wav_path = str(job_upload_dir / "audio.wav")
            success, duration = await self.extract_audio(file_path, wav_path)

            if not success:
                job.status = JobStatus.ERROR
                job.error_message = "Failed to extract audio from file"
                return job

            job.audio_duration = duration
            job.progress = 0.1
            timings['extract'] = time.time() - step_start
            print(f"[FileProcessor] Extract complete: {timings['extract']:.1f}s (audio: {duration:.1f}s)")

            # Step 2: Transcribe (50% of progress)
            step_start = time.time()
            job.status = JobStatus.TRANSCRIBING
            print(f"\n[FileProcessor] === STEP 2: TRANSCRIBING ===")

            # Load audio
            audio = self._load_audio(wav_path)

            # Use faster-whisper's segment-based transcription
            loop = asyncio.get_running_loop()
            segments = await loop.run_in_executor(
                None,
                self._transcribe_with_segments,
                audio,
                job.source_language
            )

            job.segments = segments
            job.progress = 0.6
            timings['transcribe'] = time.time() - step_start
            print(f"[FileProcessor] Transcribe complete: {timings['transcribe']:.1f}s ({len(segments)} segments)")

            # Step 3: Translate if needed (20% of progress)
            if job.mode in [ProcessingMode.TRANSCRIBE_TRANSLATE, ProcessingMode.TRANSCRIBE_TRANSLATE_TTS]:
                step_start = time.time()
                job.status = JobStatus.TRANSLATING
                print(f"\n[FileProcessor] === STEP 3: TRANSLATING ({len(job.segments)} segments) ===")

                # Batch translate for speed - combine segments with separator
                BATCH_SIZE = 10
                SEPARATOR = " ||| "
                source_lang = job.segments[0].language if job.segments else 'en'

                # Process in batches
                for batch_start in range(0, len(job.segments), BATCH_SIZE):
                    batch_end = min(batch_start + BATCH_SIZE, len(job.segments))
                    batch_segments = job.segments[batch_start:batch_end]

                    # Combine texts
                    batch_texts = [seg.text for seg in batch_segments if seg.text]
                    if batch_texts and job.target_language:
                        combined = SEPARATOR.join(batch_texts)

                        # Translate combined text
                        translated_combined = await loop.run_in_executor(
                            None,
                            self.translation_service.translate,
                            combined,
                            source_lang,
                            job.target_language
                        )

                        # Split back and assign. The model can drop or rewrite the separator,
                        # so if the parts no longer line up, translate each segment on its own.
                        translated_parts = translated_combined.split(SEPARATOR.strip())
                        if len(translated_parts) != len(batch_texts):
                            translated_parts = [
                                await loop.run_in_executor(
                                    None,
                                    self.translation_service.translate,
                                    text,
                                    source_lang,
                                    job.target_language
                                )
                                for text in batch_texts
                            ]
                        text_idx = 0
                        for seg in batch_segments:
                            if seg.text and text_idx < len(translated_parts):
                                seg.translated_text = translated_parts[text_idx].strip()
                                text_idx += 1

                    # Update progress
                    job.progress = 0.6 + (0.2 * batch_end / len(job.segments))
                    print(f"[FileProcessor] Translated {batch_end}/{len(job.segments)} segments...")

                timings['translate'] = time.time() - step_start
                print(f"[FileProcessor] Translate complete: {timings['translate']:.1f}s")

            job.progress = 0.8

            # Step 4: Generate TTS if needed (20% of progress)
            if job.mode == ProcessingMode.TRANSCRIBE_TRANSLATE_TTS and self.tts_service.is_available:
                step_start = time.time()
                job.status = JobStatus.SYNTHESIZING
                print(f"\n[FileProcessor] === STEP 4: GENERATING TTS ===")

                # Combine ALL text into one string for single TTS call (much faster)
                all_texts = []
                for seg in job.segments:
                    tts_text = seg.translated_text or seg.text
                    if tts_text:
                        all_texts.append(tts_text)

                if all_texts:
                    combined_text = " ... ".join(all_texts)
                    tts_lang = job.target_language or 'en'
                    # Use faster speed for file processing (at least 1.2x)
                    tts_speed = max(job.tts_speed, 1.2)

                    print(f"[FileProcessor] TTS: {len(combined_text)} chars, speed: {tts_speed}x")
                    job.progress = 0.85

                    audio_bytes, sample_rate = await loop.run_in_executor(
                        None,
                        self.tts_service.synthesize,
                        combined_text,
                        tts_lang,
                        job.tts_voice,
                        tts_speed
                    )

                    if audio_bytes:
                        tts_path = str(job_results_dir / "tts_audio.wav")
                        with open(tts_path, 'wb') as f:
                            f.write(audio_bytes)
                        job.tts_audio_path = tts_path

                timings['tts'] = time.time() - step_start
                print(f"[FileProcessor] TTS complete: {timings['tts']:.1f}s")

            job.status = JobStatus.COMPLETE
            job.progress = 1.0

            # Print timing summary
            total_time = time.time() - total_start
            print(f"\n[FileProcessor] === TIMING SUMMARY ===")
            print(f"  Extract:    {timings.get('extract', 0):.1f}s")
            print(f"  Transcribe: {timings.get('transcribe', 0):.1f}s")
            print(f"  Translate:  {timings.get('translate', 0):.1f}s")
            print(f"  TTS:        {timings.get('tts', 0):.1f}s")
            print(f"  TOTAL:      {total_time:.1f}s")
            print(f"  Audio len:  {job.audio_duration:.1f}s")
            print(f"  Ratio:      {total_time / job.audio_duration:.1f}x realtime")
            print(f"================================\n")

        except Exception as e:
            job.status = JobStatus.ERROR
            job.error_message = str(e)
            print(f"Processing error: {e}")

        return job

    def _transcribe_with_segments(
        self,
        audio: np.ndarray,
        source_language: Optional[str]
    ) -> List[TranscriptionSegment]:
        """Transcribe audio and return segments with timing"""
        segments = []

        # Use faster-whisper's segment output
        result_segments, info = self.transcription_engine.model.transcribe(
            audio,
            language=source_language,
            beam_size=5,
            best_of=5,
            temperature=0.0,
            vad_filter=True,
            vad_parameters=dict(min_silence_duration_ms=500)
        )

        detected_language = info.language

        for i, seg in enumerate(result_segments):
            text = seg.text.strip()
            if text:
                segments.append(TranscriptionSegment(
                    id=i + 1,
                    start=seg.start,
                    end=seg.end,
                    text=text,
                    language=detected_language
                ))

        return segments

    def _concatenate_wav_files(self, wav_bytes_list: List[bytes], output_path: str):
        """Concatenate multiple WAV byte streams into one file"""
        if not wav_bytes_list:
            return

        # Read parameters from first WAV
        import io
        first_wav = wave.open(io.BytesIO(wav_bytes_list[0]), 'rb')
        params = first_wav.getparams()
        first_wav.close()

        # Write concatenated audio
        with wave.open(output_path, 'wb') as output:
            output.setparams(params)

            for wav_bytes in wav_bytes_list:
                with wave.open(io.BytesIO(wav_bytes), 'rb') as wf:
                    output.writeframes(wf.readframes(wf.getnframes()))

    def generate_srt(self, segments: List[TranscriptionSegment], include_translation: bool = False) -> str:
        """Generate SRT subtitle format"""
        lines = []

        for seg in segments:
            # SRT index
            lines.append(str(seg.id))

            # Timestamps (HH:MM:SS,mmm --> HH:MM:SS,mmm)
            start_time = self._format_srt_time(seg.start)
            end_time = self._format_srt_time(seg.end)
            lines.append(f"{start_time} --> {end_time}")

            # Text
            if include_translation and seg.translated_text:
                lines.append(seg.translated_text)
            else:
                lines.append(seg.text)

            lines.append("")  # Empty line between entries

        return "\n".join(lines)

    def _format_srt_time(self, seconds: float) -> str:
        """Format seconds as SRT timestamp (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millis = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

    def generate_txt(
        self,
        segments: List[TranscriptionSegment],
        include_timestamps: bool = True,
        include_translation: bool = False
    ) -> str:
        """Generate plain text format. If include_translation is True, outputs translated text only."""
        lines = []

        for seg in segments:
            # Use translated text if requested and available, otherwise original
            text = seg.translated_text if (include_translation and seg.translated_text) else seg.text

            if include_timestamps:
                timestamp = f"[{self._format_time(seg.start)} - {self._format_time(seg.end)}]"
                lines.append(f"{timestamp} {text}")
            else:
                lines.append(text)

        return "\n".join(lines)

    def _format_time(self, seconds: float) -> str:
        """Format seconds as MM:SS"""
        minutes = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{minutes:02d}:{secs:02d}"
