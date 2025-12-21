# Live Translation - Real-time French to English Translation Overlay

A desktop application built with **Next.js 15** and **Electron** that captures system audio from WhatsApp calls, transcribes French speech using **Deepgram Nova-2**, and translates it to English using **DeepL** with professional formality settings.

## Features

- 🎯 **Transparent Overlay**: Always-on-top subtitle bar at the bottom of your screen
- 🎤 **System Audio Capture**: Captures audio from WhatsApp calls without additional drivers
- ⚡ **Real-time Transcription**: Sub-300ms latency using Deepgram Nova-2
- 🌐 **Professional Translation**: DeepL with formal tone for business contexts
- 🔒 **Privacy-First**: Local Electron app - audio only goes to specified AI APIs
- 🎨 **Modern UI**: Built with Tailwind CSS for a clean, minimal interface

## Prerequisites

- **Node.js** 18+ and npm
- **Deepgram API Key** ([Get one here](https://console.deepgram.com/))
- **DeepL API Key** ([Get one here](https://www.deepl.com/pro-api))

## Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure API Keys:**
   
   Create a `.env.local` file in the root directory:
   ```env
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   DEEPL_API_KEY=your_deepl_api_key_here
   ```
   
   Or configure them through the Electron IPC (they'll be stored securely in the app).

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
2. **Click "Start"** - You'll be prompted to share your screen/audio
3. **Select "Share audio only"** or choose your screen with audio
4. **Make a WhatsApp call** - The app will automatically:
   - Capture the system audio
   - Transcribe French speech in real-time
   - Translate to formal English
   - Display subtitles in the overlay

5. **Click "Stop"** when done

## Architecture

### The Transparent Bridge

- **Main Process (Electron)**: Handles window transparency, always-on-top behavior, and audio permissions
- **Renderer Process (Next.js)**: Handles AI logic, UI, and audio processing

### Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 15 (App Router) + Electron | High-performance desktop UI |
| STT Engine | Deepgram Nova-2 | Sub-300ms latency transcription |
| Translation | DeepL API (Pro) | Professional formal translations |
| Audio Capture | Electron `desktopCapturer` | System audio loopback |
| Styling | Tailwind CSS | Modern, responsive UI |

## How It Works

1. **Audio Capture**: Uses `navigator.mediaDevices.getDisplayMedia` with audio loopback to capture system audio
2. **Echo Cancellation**: Filters out the user's microphone to prevent self-translation
3. **Real-time Transcription**: Audio is streamed to Deepgram via WebSocket for live transcription
4. **Translation**: When Deepgram marks a sentence as `is_final: true`, it's sent to DeepL with `formality: 'more'`
5. **Display**: Translated text appears in the transparent overlay at the bottom of the screen

## Configuration

### Window Position

The window is positioned at the bottom of the screen by default. To change this, edit `electron/main.ts`:

```typescript
y: height - 120, // Adjust this value to change vertical position
```

### Translation Settings

To modify translation behavior, edit `app/api/translate/route.ts`:

```typescript
{
  formality: 'more', // Change to 'less' or 'default'
  source_lang: 'fr', // Source language
  target_lang: 'en-US', // Target language
}
```

## Troubleshooting

### Audio Not Capturing

- Ensure you've granted screen/audio sharing permissions
- On Windows, you may need to enable "Share system audio" in the browser prompt
- Check that WhatsApp is outputting audio through your system speakers

### Translation Not Working

- Verify your DeepL API key is correct and has credits
- Check the browser console for API errors
- Ensure the transcript is being generated (check Deepgram connection)

### Window Not Transparent

- Ensure you're running the Electron app, not just the Next.js dev server
- Check that `transparent: true` is set in `electron/main.ts`
- Some operating systems may have limitations with transparency

## Security & Privacy

- API keys are stored locally via Electron IPC
- Audio streams are only sent to Deepgram and DeepL APIs
- No third-party calling services are involved
- All processing happens in your local Electron app

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

