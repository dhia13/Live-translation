# Whisper Socket.IO Server

Real-time speech-to-text transcription server using OpenAI Whisper and Socket.IO.

## Setup

### Prerequisites

- Python 3.8 or higher
- Virtual environment support

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

## Running the Server

1. Ensure the virtual environment is activated
2. Start the server:

```bash
python whisper_socketio_server.py
```

The server will start on `http://localhost:5000` and display:

```
==================================================
Whisper Socket.IO Server
==================================================
Server running on: http://localhost:5000
Ready to receive audio streams...
==================================================
```

## API

The server accepts Socket.IO connections and handles the following events:

- `connect`: Client connection established
- `disconnect`: Client disconnected
- `audio_chunk`: Audio data (base64 encoded Float32Array)
- `start_listening`: Start audio processing
- `stop_listening`: Stop audio processing

### Response Events

- `status`: Server status messages
- `transcription`: Transcribed text with timestamp
- `error`: Error messages

## Configuration

- **Model**: `base` (change in `whisper_socketio_server.py` MODEL_SIZE)
- **Sample Rate**: 16000 Hz
- **Buffer Size**: 2 seconds
- **Port**: 5000

## Troubleshooting

- Ensure virtual environment is activated before running
- Check that port 5000 is not in use by other applications
- Verify all dependencies are installed in the virtual environment

## Stopping the Server

Press `Ctrl+C` in the terminal to stop the server gracefully.
