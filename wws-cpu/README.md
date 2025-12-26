# Whisper WebSocket Server (CPU)

Real-time speech-to-text transcription server using Faster Whisper and Socket.IO. Optimized for CPU inference with support for French and English.

## Features

- 🚀 **Faster Whisper**: Optimized Whisper implementation with CTranslate2
- 🎯 **Auto Language Detection**: Automatically detects French and English
- 🧠 **Anti-Hallucination**: Advanced filtering to prevent false transcriptions
- ⚡ **Queue-Based Processing**: Efficient audio chunk processing with queue management
- 📊 **Performance Stats**: Real-time latency and processing statistics
- 🔄 **Overlap Processing**: Seamless transcription with chunk overlap

## Setup

### Prerequisites

- Python 3.8 or higher
- Virtual environment support
- Windows/Linux/Mac compatible

### Installation

1. Create a virtual environment:

```bash
python -m venv venv
```

2. Activate the virtual environment:

```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1

# Windows Command Prompt
venv\Scripts\activate.bat

# Linux/Mac
source venv/bin/activate
```

3. Install dependencies:

```bash
pip install -r requirements.txt
```

**Note**: `faster-whisper` uses CTranslate2. On Windows, pre-built wheels are available via pip. On Linux, you may need to install system dependencies. See the [faster-whisper documentation](https://github.com/guillaumekln/faster-whisper) for details.

## Running the Server

1. Ensure the virtual environment is activated
2. Start the server:

```bash
python wws.py
```

The server will start on `http://0.0.0.0:5000` and display:

```
============================================================
🎙️  Live Transcription Server - Whisper AI (FIXED)
============================================================
Model: small
Device: cpu
Compute: int8
Threads: [your CPU count]
Chunk: 5.0s (overlap: 1.0s)
============================================================

⏳ Loading Whisper small model...
✅ Model loaded successfully!

============================================================
🚀 Server starting on http://0.0.0.0:5000
============================================================
💡 Waiting for connections...
```

## API

The server accepts Socket.IO connections and handles the following events:

### Client Events

- `connect`: Client connection established
- `disconnect`: Client disconnected
- `audio_chunk`: Audio data (base64 encoded WAV or raw PCM)
- `stop_recording`: Signal to process final audio chunk
- `ping`: Health check ping

### Server Events

- `status`: Server status and configuration info
- `transcription`: Transcribed text with inference time and count
- `stats`: Performance statistics (latency, processed chunks, dropped chunks)
- `pong`: Response to ping

### Example Client Connection

```javascript
const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to server');
});

socket.on('status', (data) => {
  console.log('Server status:', data);
});

socket.on('transcription', (data) => {
  console.log('Transcription:', data.text);
  console.log('Inference time:', data.inference_time, 's');
});

// Send audio chunk (base64 encoded)
socket.emit('audio_chunk', base64AudioData);

// Stop recording
socket.emit('stop_recording');
```

## Configuration

Edit `wws.py` to customize:

- **MODEL_SIZE**: `"small"` (options: tiny, base, small, medium, large)
- **DEVICE**: `"cpu"` (or `"cuda"` for GPU)
- **COMPUTE_TYPE**: `"int8"` (options: int8, float16, float32)
- **SAMPLE_RATE**: `16000` Hz
- **CHUNK_DURATION**: `5.0` seconds
- **OVERLAP_DURATION**: `1.0` seconds
- **MAX_CONCURRENT_JOBS**: `2` (number of parallel processing threads)
- **Port**: `5000` (change in `web.run_app()` call)

## Dependencies

- `numpy>=1.24.0`: Numerical operations
- `python-socketio>=5.10.0`: WebSocket server
- `aiohttp>=3.9.0`: Async HTTP server
- `pydub>=0.25.1`: Audio processing utilities
- `faster-whisper>=0.10.0`: Optimized Whisper implementation

## Troubleshooting

- **Virtual environment not activated**: Ensure you've activated the venv before running
- **Port 5000 in use**: Change the port in `web.run_app()` or stop the conflicting service
- **Missing dependencies**: Run `pip install -r requirements.txt` again
- **Model download issues**: The model will be downloaded automatically on first run
- **Slow performance**: Consider using a smaller model (`tiny` or `base`) or reducing `CHUNK_DURATION`

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the server gracefully. The server will:
- Wait for ongoing processing to complete
- Process any remaining audio chunks
- Clean up client connections
- Display session statistics
