#!/usr/bin/env python3
"""
Live transcription script using OpenAI Whisper - Optimized for real-time
"""

import sys
import json
import signal
import traceback
import numpy as np
import sounddevice as sd
import whisper
from threading import Thread, Event
from queue import Queue, Empty
from collections import deque

# Configuration - Optimized for speed
SAMPLE_RATE = 16000
CHUNK_DURATION = 0.5  # 500ms chunks for faster response
BUFFER_DURATION = 3  # Keep 3 seconds of context
MODEL_SIZE = "tiny"  # Use "tiny" for even faster processing

# Global state
audio_queue = Queue()
stop_event = Event()
model = None
audio_buffer = deque(maxlen=int(BUFFER_DURATION / CHUNK_DURATION))

def log_message(msg_type, data):
    message = {"type": msg_type, "data": data}
    print(json.dumps(message), flush=True)

def log_error(error_msg):
    print(json.dumps({"error": error_msg}), file=sys.stderr, flush=True)

def initialize_model():
    global model
    try:
        log_message("status", "loading_model")
        model = whisper.load_model(MODEL_SIZE)
        log_message("status", "model_ready")
        return True
    except Exception as e:
        log_error(f"Failed to load model: {str(e)}")
        return False

def audio_callback(indata, frames, time_info, status):
    if status:
        log_error(f"Audio status: {status}")
    audio_queue.put(indata.copy())

def transcription_worker():
    global model, audio_buffer
    last_text = ""
    
    while not stop_event.is_set():
        try:
            audio_chunk = audio_queue.get(timeout=1)
            audio_data = audio_chunk[:, 0].flatten().astype(np.float32)
            
            # Add to buffer
            audio_buffer.append(audio_data)
            
            # Check if audio has content
            audio_rms = np.sqrt(np.mean(audio_data**2))
            
            if audio_rms < 0.001:  # Skip silence
                continue
            
            # Combine buffer for context (improves accuracy)
            combined_audio = np.concatenate(list(audio_buffer))
            
            # Transcribe
            result = model.transcribe(
                combined_audio,
                language="en",
                fp16=False,
                # Faster settings:
                beam_size=1,  # Faster than default 5
                best_of=1,    # Faster than default 5
                temperature=0.0  # Deterministic
            )
            
            text = result["text"].strip()
            
            # Only send if text changed (avoid duplicates)
            if text and text != last_text:
                log_message("transcription", {
                    "text": text,
                    "start": 0.0,
                    "end": CHUNK_DURATION,
                    "confidence": None
                })
                last_text = text
            
        except Empty:
            continue
        except Exception as e:
            if not stop_event.is_set():
                log_error(f"Transcription error: {str(e)}")

def signal_handler(sig, frame):
    log_message("status", "stopping")
    stop_event.set()
    sys.exit(0)

def main():
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    if not initialize_model():
        sys.exit(1)
    
    worker_thread = Thread(target=transcription_worker, daemon=True)
    worker_thread.start()
    
    try:
        log_message("status", "starting_audio")
        
        with sd.InputStream(
            samplerate=SAMPLE_RATE,
            channels=1,
            dtype='float32',
            blocksize=int(SAMPLE_RATE * CHUNK_DURATION),
            callback=audio_callback
        ):
            log_message("status", "listening")
            stop_event.wait()
            
    except Exception as e:
        log_error(f"Audio stream error: {str(e)}")
        sys.exit(1)
    finally:
        log_message("status", "stopped")

if __name__ == "__main__":
    main()