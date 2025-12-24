#!/usr/bin/env python3
"""
Socket.IO server for real-time Whisper transcription
Using modern async/await without deprecated eventlet
"""

import os
import sys
import json
import base64
import asyncio
import numpy as np
import whisper
from aiohttp import web
import socketio

# Configuration
MODEL_SIZE = "base"  # or "tiny" for faster
SAMPLE_RATE = 16000

# Global state
model = None
audio_buffers = {}  # Per-client audio buffers
BUFFER_SIZE = SAMPLE_RATE * 2  # 2 seconds

def log_message(msg_type, data):
    """Send log message to stdout"""
    message = {"type": msg_type, "data": data}
    print(json.dumps(message), flush=True)

def load_whisper_model():
    """Load Whisper model"""
    global model
    try:
        log_message("status", "loading_model")
        model = whisper.load_model(MODEL_SIZE)
        log_message("status", "model_ready")
        return True
    except Exception as e:
        log_message("error", f"Failed to load model: {str(e)}")
        return False

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='aiohttp',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

app = web.Application()
sio.attach(app)

@sio.event
async def connect(sid, environ):
    """Handle client connection"""
    log_message("status", f"client_connected: {sid}")
    await sio.emit('status', {'message': 'Connected to Whisper server'}, room=sid)

@sio.event
async def disconnect(sid):
    """Handle client disconnection"""
    global audio_buffers
    if sid in audio_buffers:
        del audio_buffers[sid]
    log_message("status", f"client_disconnected: {sid}")

@sio.event
async def audio_chunk(sid, data):
    """
    Handle incoming audio chunk
    Expected format: base64 encoded Float32Array
    """
    global audio_buffers, model
    
    try:
        # Initialize buffer for this client if needed
        if sid not in audio_buffers:
            audio_buffers[sid] = []
        
        # Decode base64 audio data
        audio_bytes = base64.b64decode(data['audio'])
        audio_array = np.frombuffer(audio_bytes, dtype=np.float32)
        
        # Add to buffer
        audio_buffers[sid].extend(audio_array)
        
        # Keep buffer size manageable
        if len(audio_buffers[sid]) > BUFFER_SIZE:
            audio_buffers[sid] = audio_buffers[sid][-BUFFER_SIZE:]
        
        # Need at least 1 second of audio
        if len(audio_buffers[sid]) < SAMPLE_RATE:
            return
        
        # Convert to numpy array
        audio_data = np.array(audio_buffers[sid], dtype=np.float32)
        
        # Check if audio has content (not silence)
        audio_rms = np.sqrt(np.mean(audio_data**2))
        
        if audio_rms < 0.001:  # Too quiet
            return
        
        # Run transcription in executor (non-blocking)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: model.transcribe(
                audio_data,
                language="en",
                fp16=False,
                beam_size=1,
                best_of=1,
                temperature=0.0
            )
        )
        
        text = result["text"].strip()
        
        if text:
            # Send transcription back to client
            await sio.emit('transcription', {
                'text': text,
                'timestamp': asyncio.get_event_loop().time()
            }, room=sid)
            
            log_message("transcription", {"text": text})
            
            # Clear half the buffer
            audio_buffers[sid] = audio_buffers[sid][len(audio_buffers[sid])//2:]
    
    except Exception as e:
        log_message("error", f"Transcription error: {str(e)}")
        await sio.emit('error', {'message': str(e)}, room=sid)

@sio.event
async def start_listening(sid):
    """Handle start listening command"""
    global audio_buffers
    audio_buffers[sid] = []
    log_message("status", "listening")
    await sio.emit('status', {'message': 'Listening...'}, room=sid)

@sio.event
async def stop_listening(sid):
    """Handle stop listening command"""
    global audio_buffers
    if sid in audio_buffers:
        audio_buffers[sid] = []
    log_message("status", "stopped")
    await sio.emit('status', {'message': 'Stopped'}, room=sid)

async def main():
    """Start the Socket.IO server"""
    # Load model
    if not load_whisper_model():
        sys.exit(1)
    
    # Start server
    log_message("status", "server_starting")
    port = 5000
    
    print(f"\n{'='*50}")
    print(f"Whisper Socket.IO Server")
    print(f"{'='*50}")
    print(f"Server running on: http://localhost:{port}")
    print(f"Ready to receive audio streams...")
    print(f"{'='*50}\n")
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    
    # Keep running
    await asyncio.Event().wait()

if __name__ == '__main__':
    asyncio.run(main())