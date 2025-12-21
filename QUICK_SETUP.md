# Quick Setup: Make Electron App Appear as Microphone

## The Problem

Electron apps cannot create system microphone devices without a virtual audio driver. To make your app appear in the microphone dropdown, you need a virtual audio cable.

## Solution: Use VB-Audio Virtual Cable (Windows)

### Step 1: Install Virtual Cable

1. Download VB-Audio Virtual Cable from: https://vb-audio.com/Cable/
2. Install it (requires admin privileges)
3. Restart your computer if prompted

### Step 2: Configure Windows Audio

1. Right-click the speaker icon in system tray → **Open Sound settings**
2. Go to **Sound Control Panel** → **Playback** tab
3. Find **"CABLE Input"** and set it as **Default Device**
4. Go to **Recording** tab
5. Find **"CABLE Output"** - this will appear as a microphone option

### Step 3: Configure Your Call App

1. In your call app (WhatsApp, Zoom, etc.), open audio settings
2. Select **"CABLE Output"** as your microphone input
3. The Electron app's TTS audio will now flow through the virtual cable

### Step 4: Test

1. Start your Electron app
2. Begin a call
3. Speak - TTS will generate
4. The other person should hear the TTS voice through "CABLE Output"

## How It Works

```
Your Voice → Electron App (transcribes) → TTS Generated → Speakers → Virtual Cable → Call App → Other Person
```

The TTS audio plays through your speakers, gets captured by the virtual cable, and sent to the call app as microphone input.

## Alternative: Use System Audio Capture

If you don't want to install virtual audio software, the app can:

1. Capture system audio (where TTS plays)
2. Route it to the call app via the existing system audio capture

However, this requires the call app to support custom audio sources, which most don't.

## Troubleshooting

**Virtual Cable not appearing:**

- Make sure it's installed correctly
- Check Device Manager for "VB-Audio Virtual Cable"
- Restart your computer

**No audio in call:**

- Verify "CABLE Output" is selected as microphone
- Check Windows sound settings
- Ensure TTS is generating (check console logs)

**Echo/feedback:**

- The app already has echo cancellation built in
- Make sure your physical microphone is muted in the call app
