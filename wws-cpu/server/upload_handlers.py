"""
HTTP handlers for file upload functionality.
Separate from Socket.IO handlers for better file handling.
"""
import asyncio
import os
from pathlib import Path
from typing import Optional

from aiohttp import web

from .config import Config
from .file_processor import FileProcessor, ProcessingMode


class UploadHandlers:
    """HTTP handlers for file upload API"""

    def __init__(self, config: Config, file_processor: FileProcessor):
        self.config = config
        self.file_processor = file_processor

    def register_routes(self, app: web.Application):
        """Register HTTP routes"""
        # Add CORS middleware for all upload routes
        app.router.add_post('/api/upload', self.handle_upload)
        app.router.add_get('/api/jobs/{job_id}', self.handle_get_job)
        app.router.add_get('/api/jobs/{job_id}/download/{format}', self.handle_download)
        app.router.add_get('/api/jobs/{job_id}/tts-audio', self.handle_tts_audio)
        app.router.add_delete('/api/jobs/{job_id}', self.handle_delete_job)
        app.router.add_options('/api/upload', self.handle_cors_preflight)
        app.router.add_options('/api/jobs/{job_id}', self.handle_cors_preflight)
        app.router.add_options('/api/jobs/{job_id}/download/{format}', self.handle_cors_preflight)
        app.router.add_options('/api/jobs/{job_id}/tts-audio', self.handle_cors_preflight)

    def _add_cors_headers(self, response: web.Response) -> web.Response:
        """Add CORS headers to response"""
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        return response

    async def handle_cors_preflight(self, request: web.Request) -> web.Response:
        """Handle CORS preflight requests"""
        response = web.Response()
        return self._add_cors_headers(response)

    async def handle_upload(self, request: web.Request) -> web.Response:
        """Handle file upload with multipart form data"""
        try:
            # Check content length
            content_length = request.content_length or 0
            max_size = self.config.upload.max_file_size_mb * 1024 * 1024

            if content_length > max_size:
                return self._add_cors_headers(web.json_response({
                    "error": f"File too large. Maximum size is {self.config.upload.max_file_size_mb}MB"
                }, status=413))

            # Parse multipart form
            reader = await request.multipart()

            file_data = None
            filename = None
            mode = "transcribe"
            source_language: Optional[str] = None
            target_language: Optional[str] = None
            tts_voice: Optional[str] = None
            tts_speed = 1.0

            async for field in reader:
                if field.name == 'file':
                    filename = field.filename
                    file_data = await field.read()
                elif field.name == 'mode':
                    mode = (await field.read()).decode()
                elif field.name == 'source_language':
                    val = (await field.read()).decode()
                    source_language = val if val else None
                elif field.name == 'target_language':
                    val = (await field.read()).decode()
                    target_language = val if val else None
                elif field.name == 'tts_voice':
                    tts_voice = (await field.read()).decode()
                elif field.name == 'tts_speed':
                    try:
                        tts_speed = float((await field.read()).decode())
                    except:
                        pass

            if not file_data or not filename:
                return self._add_cors_headers(web.json_response({
                    "error": "No file provided"
                }, status=400))

            # Validate file extension
            ext = Path(filename).suffix.lower()
            if ext not in self.config.upload.allowed_extensions:
                return self._add_cors_headers(web.json_response({
                    "error": f"Invalid file type. Allowed: {', '.join(self.config.upload.allowed_extensions)}"
                }, status=400))

            # Validate mode
            try:
                ProcessingMode(mode)
            except ValueError:
                return self._add_cors_headers(web.json_response({
                    "error": "Invalid processing mode"
                }, status=400))

            # Create job
            job = self.file_processor.create_job(
                filename=filename,
                mode=mode,
                source_language=source_language,
                target_language=target_language,
                tts_voice=tts_voice,
                tts_speed=tts_speed
            )

            # Save uploaded file
            job_dir = Path(self.config.upload.upload_dir) / job.job_id
            job_dir.mkdir(exist_ok=True)
            file_path = job_dir / filename

            with open(file_path, 'wb') as f:
                f.write(file_data)

            print(f"[Upload] Job {job.job_id[:8]} created: {filename} ({len(file_data) / 1024 / 1024:.1f}MB)")
            print(f"[Upload] Config - mode: {mode}, source: {source_language}, target: {target_language}")

            # Start processing in background
            asyncio.create_task(self.file_processor.process_file(job, str(file_path)))

            return self._add_cors_headers(web.json_response({
                "job_id": job.job_id,
                "status": job.status.value,
                "message": "File uploaded successfully"
            }))

        except Exception as e:
            print(f"[Upload] Error: {e}")
            return self._add_cors_headers(web.json_response({
                "error": str(e)
            }, status=500))

    async def handle_get_job(self, request: web.Request) -> web.Response:
        """Get job status and results"""
        job_id = request.match_info['job_id']
        job = self.file_processor.get_job(job_id)

        if not job:
            return self._add_cors_headers(web.json_response({
                "error": "Job not found"
            }, status=404))

        return self._add_cors_headers(web.json_response(job.to_dict()))

    async def handle_download(self, request: web.Request) -> web.Response:
        """Download results as SRT or TXT"""
        job_id = request.match_info['job_id']
        format_type = request.match_info['format']

        job = self.file_processor.get_job(job_id)

        if not job:
            return self._add_cors_headers(web.json_response({
                "error": "Job not found"
            }, status=404))

        if job.status.value != "complete":
            return self._add_cors_headers(web.json_response({
                "error": "Job not complete"
            }, status=400))

        # Check query param for translation preference (default: translated if available)
        # ?type=original or ?type=translated
        download_type = request.query.get('type', 'translated')
        has_translation = job.mode in [ProcessingMode.TRANSCRIBE_TRANSLATE, ProcessingMode.TRANSCRIBE_TRANSLATE_TTS]
        include_translation = has_translation and download_type == 'translated'

        # Filename suffix based on type
        suffix = "_translated" if include_translation else "_original"

        if format_type == 'srt':
            content = self.file_processor.generate_srt(job.segments, include_translation)
            filename = f"{Path(job.filename).stem}{suffix}.srt"
            content_type = "application/x-subrip"
        elif format_type == 'txt':
            content = self.file_processor.generate_txt(job.segments, True, include_translation)
            filename = f"{Path(job.filename).stem}{suffix}.txt"
            content_type = "text/plain"
        else:
            return self._add_cors_headers(web.json_response({
                "error": "Invalid format. Use 'srt' or 'txt'"
            }, status=400))

        response = web.Response(
            body=content.encode('utf-8'),
            content_type=content_type,
            headers={
                'Content-Disposition': f'attachment; filename="{filename}"'
            }
        )
        return self._add_cors_headers(response)

    async def handle_tts_audio(self, request: web.Request) -> web.Response:
        """Stream TTS audio for playback"""
        job_id = request.match_info['job_id']
        job = self.file_processor.get_job(job_id)

        if not job:
            return self._add_cors_headers(web.json_response({
                "error": "Job not found"
            }, status=404))

        if not job.tts_audio_path or not os.path.exists(job.tts_audio_path):
            return self._add_cors_headers(web.json_response({
                "error": "TTS audio not available"
            }, status=404))

        # Stream the audio file
        with open(job.tts_audio_path, 'rb') as f:
            audio_data = f.read()

        response = web.Response(
            body=audio_data,
            content_type='audio/wav',
            headers={
                'Content-Disposition': f'inline; filename="tts_audio.wav"'
            }
        )
        return self._add_cors_headers(response)

    async def handle_delete_job(self, request: web.Request) -> web.Response:
        """Delete a job and its files"""
        job_id = request.match_info['job_id']

        if self.file_processor.delete_job(job_id):
            print(f"[Upload] Job {job_id[:8]} deleted")
            return self._add_cors_headers(web.json_response({
                "message": "Job deleted successfully"
            }))
        else:
            return self._add_cors_headers(web.json_response({
                "error": "Job not found"
            }, status=404))
