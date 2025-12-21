# Quick Setup Guide

## Prerequisites

1. **Node.js 18+** installed
2. **Deepgram API Key** - Sign up at [console.deepgram.com](https://console.deepgram.com/)
3. **DeepL API Key** - Sign up at [deepl.com/pro-api](https://www.deepl.com/pro-api)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

You have two options:

#### Option A: Environment Variables (Recommended for Development)

Create a `.env.local` file in the root directory:

```env
DEEPGRAM_API_KEY=your_deepgram_key_here
DEEPL_API_KEY=your_deepl_key_here
```

#### Option B: Settings UI (Recommended for Production)

1. Run the app
2. Click the "⚙️ Settings" button
3. Enter your API keys
4. Click "Save"

### 3. Run the Application

#### Development Mode

```bash
npm run electron:dev
```

This will:

- Start Next.js dev server on port 3000
- Compile Electron TypeScript files
- Launch the Electron window

#### Production Build

```bash
npm run electron:build
```

This creates a distributable app in the `dist` folder.

## First Run

1. **Start the app** - A transparent window appears at the bottom of your screen
2. **Configure API keys** if not using environment variables
3. **Click "Start"** button
4. **Grant audio permissions** when prompted:
   - Select "Share audio only" or choose your screen
   - Make sure "Share system audio" is checked (Windows)
5. **Make a WhatsApp call** - The app will automatically transcribe and translate

## Troubleshooting

### Audio Not Capturing

- **Windows**: Ensure "Share system audio" is checked in the sharing dialog
- **macOS**: May require additional permissions in System Preferences
- **Linux**: Check PulseAudio/PipeWire configuration

### Deepgram Connection Issues

- Verify your API key is correct
- Check your Deepgram account has credits
- Ensure you're using the correct model (`nova-2`)

### Translation Not Working

- Verify DeepL API key is correct
- Check DeepL account has credits
- Ensure the source language is set to French (`fr`)

### Window Not Visible

- Check that the window isn't behind other windows
- Try clicking the app icon in the taskbar
- Restart the app

## Architecture Notes

- **Main Process**: Electron handles window management and IPC
- **Renderer Process**: Next.js handles UI and audio processing
- **Audio Pipeline**: System audio → AudioContext → Deepgram WebSocket
- **Translation Pipeline**: Final transcripts → DeepL API → UI display

## Next Steps

- Customize window position in `electron/main.ts`
- Adjust translation formality in `app/api/translate/route.ts`
- Modify subtitle styling in `components/SubtitleOverlay.tsx`
