# Live Transcription - Real-time Speech-to-Text Overlay

A desktop application built with **Next.js 15** and **Electron** that captures system audio and transcribes speech using **Whisper** (local transcription).

## Features

- 🎯 **Transparent Overlay**: Always-on-top subtitle bar at the bottom of your screen
- 🎤 **System Audio Capture**: Captures audio from calls without additional drivers
- ⚡ **Local Transcription**: Uses Whisper running locally on your device
- 🔒 **Privacy-First**: All processing happens locally - no audio sent to external APIs
- 🎨 **Modern UI**: Built with Tailwind CSS for a clean, minimal interface

## Prerequisites

- **Node.js** 18+ and npm
- **Whisper Model**: Download a Whisper model file (e.g., `ggml-base.bin` or `ggml-medium.bin`)
- **Whisper Server**: Built `whisper-server.exe` from whisper.cpp (see whisper folder)

## Installation

1. **Clone and install dependencies:**

   ```bash
   npm install
   ```

2. **Setup Whisper:**

   - Ensure you have a Whisper model file in `whisper/whisper.cpp/models/`
   - The app will automatically start the whisper-server when transcription begins

## Development

### Run in Development Mode

```bash
npm run electron:dev
```

This will:

1. Start the Next.js dev server on `http://localhost:3000`
2. Compile Electron TypeScript files
3. Launch the Electron app

### Build for Production

```bash
npm run electron:build
```

This creates a distributable Electron app in the `dist` folder.

## Usage

1. **Start the app** - The transparent overlay window will appear at the bottom of your screen
2. **Click "Start"** - You'll be prompted twice:
   - First: Select "Share audio" or your screen with audio (for incoming call audio)
   - Second: Allow microphone access (for your voice)
3. **Make a WhatsApp call** - The app will automatically:
   - **Incoming (French → English)**: Capture system audio, transcribe French speech, translate to English, display subtitles
   - **Outgoing (English → French)**: Capture your microphone, transcribe English, translate to French, speak it aloud via TTS
4. **You'll see**:

   - Main subtitle: What the French speaker said (translated to English)
   - Bottom text: Your English speech and its French translation
   - The French translation of your speech will be spoken aloud

5. **Click "Stop"** when done

## Architecture

### The Transparent Bridge

- **Main Process (Electron)**: Handles window transparency, always-on-top behavior, and audio permissions
- **Renderer Process (Next.js)**: Handles AI logic, UI, and audio processing

### Tech Stack

| Layer         | Technology                         | Purpose                               |
| ------------- | ---------------------------------- | ------------------------------------- |
| Framework     | Next.js 15 (App Router) + Electron | High-performance desktop UI           |
| STT Engine    | Whisper (Local)                    | Local transcription using whisper.cpp |
| Audio Capture | Electron `desktopCapturer`         | System audio loopback                 |
| Styling       | Tailwind CSS                       | Modern, responsive UI                 |

## How It Works

1. **Audio Capture**: Uses `navigator.mediaDevices.getDisplayMedia` with audio loopback to capture system audio
2. **Local Processing**: Audio is processed locally using Whisper via whisper-server.exe
3. **Real-time Transcription**: Audio chunks are sent to the local Whisper server for transcription
4. **Display**: Transcribed text appears in the transparent overlay at the bottom of the screen

## Configuration

### Window Position

The window is positioned at the bottom of the screen by default. To change this, edit `electron/main.ts`:

```typescript
y: height - 120, // Adjust this value to change vertical position
```

### Whisper Settings

The app uses `whisper-server.exe` running on `localhost:8080`. To modify settings, edit `electron/main.ts`:

```typescript
whisperProcess = spawn(exePath, [
  "-m",
  modelPath,
  "--ov-e-device",
  "GPU", // Use GPU acceleration
  "--port",
  "8080",
]);
```

## Troubleshooting

### Audio Not Capturing

- Ensure you've granted screen/audio sharing permissions
- On Windows, you may need to enable "Share system audio" in the browser prompt
- Check that audio is outputting through your system speakers

### Transcription Not Working

- Verify that whisper-server.exe is built and available
- Check that the Whisper model file exists in the expected location
- Check the Electron console for whisper-server startup messages
- Ensure port 8080 is not in use by another application

### Window Not Transparent

- Ensure you're running the Electron app, not just the Next.js dev server
- Check that `transparent: true` is set in `electron/main.ts`
- Some operating systems may have limitations with transparency

## Project Structure (quick view)

```
configs/                # Build and tooling configs
electron/               # Electron main & preload + whisper service starter
native/
  whisper-addon/ (contents omitted)
resources/              # Binaries, installers, models
src/                    # Next.js app (App Router)
types/                  # Type declarations
whisper/whisper.cpp/    # Upstream whisper.cpp sources and builds
```

## Security & Privacy

- All transcription happens locally on your device
- No audio data is sent to external APIs
- No API keys required
- All processing happens in your local Electron app

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
