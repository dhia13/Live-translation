# Live Transcription & Translation

A web application built with **Next.js 14** that provides real-time speech-to-text transcription, translation, and text-to-speech using **Whisper**, **Argos Translate**, and **Kokoro TTS**. Fully offline - no external APIs required.

## Features

- 🎤 **Live Transcription**: Real-time speech-to-text with Whisper AI
- 🌐 **Live Translation**: Automatic translation to your target language
- 🔊 **Text-to-Speech**: Hear translations spoken aloud with multiple voice options
- 📁 **File Upload**: Process audio/video files (MP3, WAV, MP4, WebM) with batch transcription
- 📝 **Export Options**: Download transcriptions as SRT subtitles or TXT files
- 🎨 **Modern UI**: Dark theme with shadcn/ui components
- 🔒 **Privacy-First**: All processing happens locally - no audio sent to external APIs

## Prerequisites

- **Node.js** 18+ and npm
- **Python 3.8+** for the backend server
- **ffmpeg** (required for file upload)
  - Windows: `winget install ffmpeg`
  - Linux: `sudo apt install ffmpeg`
  - Mac: `brew install ffmpeg`

## Installation

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Setup Backend Server:**

   ```bash
   cd wws-cpu
   python -m venv venv

   # Activate virtual environment:
   # Windows PowerShell
   .\venv\Scripts\Activate.ps1
   # Windows CMD
   venv\Scripts\activate.bat
   # Linux/Mac
   source venv/bin/activate

   pip install -r requirements.txt
   ```

3. **TTS Model Setup (Optional):**

   For text-to-speech, download the Kokoro model files and place them in `wws-cpu/`:
   - `kokoro-v1.0.int8.onnx`
   - `voices-v1.0.bin`

   Download from: https://github.com/thewh1teagle/kokoro-onnx/releases

4. **Start the server:**

   ```bash
   python main.py
   ```

   The server will run on `http://localhost:5000`

## Development

### Run in Development Mode

```bash
npm run dev
```

This starts the Next.js dev server on `http://localhost:3000`

### Build for Production

```bash
npm run build
```

This creates a production build in the `.next` folder.

## Usage

### Live Transcription

1. **Open the app** in your browser at `http://localhost:3000`
2. **Configure settings** - Click the gear icon to set source/target languages and TTS options
3. **Click "Start Recording"** - Allow microphone access when prompted
4. **Speak** - Your speech will be transcribed and translated in real-time
5. **Click "Stop Recording"** when done

### File Upload

1. **Click the upload icon** in the header to go to the upload page
2. **Drag & drop** or select an audio/video file (MP3, WAV, MP4, WebM)
3. **Configure processing options**:
   - Transcription only
   - Transcription + Translation
   - Transcription + Translation + TTS
4. **View results** inline with timestamps
5. **Download** as SRT subtitles or TXT file

## Architecture

### Tech Stack

| Layer         | Technology                 | Purpose                                     |
| ------------- | -------------------------- | ------------------------------------------- |
| Framework     | Next.js 14 (App Router)    | React-based web UI                          |
| STT Engine    | Faster Whisper             | Local transcription via Python              |
| Translation   | Argos Translate            | Offline translation                         |
| TTS Engine    | Kokoro ONNX                | Text-to-speech with multiple voices         |
| Server        | Python Socket.IO + aiohttp | Real-time transcription & REST API          |
| Styling       | Tailwind CSS + shadcn/ui   | Modern, dark theme UI                       |

## How It Works

1. **Audio Capture**: Uses browser's `navigator.mediaDevices.getUserMedia` for microphone access
2. **Local Processing**: Audio is processed locally using Faster Whisper
3. **Real-time Transcription**: Audio chunks are sent via Socket.IO to the local transcription server
4. **Translation & TTS**: Transcribed text is translated and optionally converted to speech
5. **Display**: Results appear in the web interface with captions and history

## Configuration

### Transcription Server Settings

The server configuration is in `wws-cpu/server/config.py`:

```python
MODEL_SIZE = "small"  # Options: tiny, base, small, medium, large
DEVICE = "cpu"        # or "cuda" for GPU
COMPUTE_TYPE = "int8" # Options: int8, float16, float32
CHUNK_DURATION = 5.0  # Seconds of audio per chunk
```

## Troubleshooting

### Audio Not Capturing

- Ensure you've granted microphone permissions in your browser
- Check that your microphone is working and selected as the input device
- Try refreshing the page and granting permissions again

### Transcription Not Working

- Ensure the Python server is running: `cd wws-cpu && python main.py`
- Check that the virtual environment is activated and dependencies are installed
- Verify the server is listening on `http://localhost:5000`
- Check the Python server console for error messages
- Ensure port 5000 is not in use by another application

### File Upload Issues

- Ensure ffmpeg is installed and available in your PATH
- Check that the file is a supported format (MP3, WAV, MP4, WebM)
- Verify the file is under 200MB

### Text-to-Speech Crashes the Server

If the server stops with `Error processing file '.../espeak-ng-data/phontab': No such file or directory`,
the espeak-ng library bundled with Kokoro could not use its data folder. It rejects data paths longer
than about 160 characters, which happens when the project sits in a deeply nested folder. Copy the
folder printed by `python -c "import espeakng_loader; print(espeakng_loader.get_data_path())"` to a
short path (for example `C:\espeak-ng-data` or `/opt/espeak-ng-data`) and start the server with
`TTS_ESPEAK_DATA_PATH` set to that path.

## Project Structure

```
src/                    # Next.js app (App Router)
  app/
    components/         # UI components
    hooks/              # React hooks
    upload/             # File upload page
    page.tsx            # Main live transcription page
wws-cpu/                # Python transcription server
  server/               # Server modules
  main.py               # Server entry point
  requirements.txt      # Python dependencies
```

## Security & Privacy

- All transcription happens locally on your device
- No audio data is sent to external APIs
- No API keys required
- Audio is transmitted only between the browser and local transcription server via Socket.IO

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
