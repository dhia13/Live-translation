# Architecture: The Transparent Bridge

This document explains the architectural decisions and how the "Transparent Bridge" between Electron and Next.js works.

## Overview

The app consists of two main processes:

1. **Main Process (Electron)**: System-level operations
2. **Renderer Process (Next.js)**: UI and AI logic

## The Bridge Components

### 1. Electron Main Process (`electron/main.ts`)

**Responsibilities:**
- Creates transparent, frameless, always-on-top window
- Handles audio permissions via `setDisplayMediaRequestHandler`
- Manages IPC for secure API key storage
- Positions window at bottom of screen

**Key Features:**
```typescript
transparent: true      // Window transparency
frame: false          // No window frame
alwaysOnTop: true     // Stays above other windows
audio: 'loopback'     // System audio capture
```

### 2. Preload Script (`electron/preload.ts`)

**Purpose:** Secure bridge between main and renderer processes

**Exposes:**
- `window.electronAPI.getApiKeys()` - Retrieve stored API keys
- `window.electronAPI.setApiKeys()` - Store API keys securely

**Security:** Uses `contextBridge` to prevent direct Node.js access from renderer

### 3. Next.js Renderer Process

#### Audio Capture Hook (`hooks/useAudioCapture.ts`)

**Flow:**
1. Request system audio via `getDisplayMedia`
2. Process audio with `AudioContext`
3. Convert to Int16Array for Deepgram
4. Stream to Deepgram WebSocket
5. Receive transcription results

**Echo Cancellation:**
- Uses `echoCancellation: true` in audio constraints
- Filters out local microphone input

#### Translation Hook (`hooks/useTranslation.ts`)

**Flow:**
1. Receives final transcripts from Deepgram
2. Debounces API calls (300ms)
3. Sends to Next.js API route
4. Returns translated text

**Optimization:**
- Only translates when `is_final: true`
- Debouncing prevents excessive API calls

#### API Route (`app/api/translate/route.ts`)

**Purpose:** Server-side DeepL integration

**Features:**
- Uses `deepl-node` SDK
- Sets `formality: 'more'` for professional tone
- Handles errors gracefully

### 4. UI Components

#### Subtitle Overlay (`components/SubtitleOverlay.tsx`)

**Design:**
- Transparent black background (`bg-black/85`)
- Large, readable text (24px)
- Shows controls on hover
- Pulse animation when active

#### Settings Modal (`components/SettingsModal.tsx`)

**Features:**
- Secure API key input
- Links to API key registration
- Success/error feedback
- Persists via Electron IPC

## Data Flow

```
System Audio (WhatsApp)
    ↓
getDisplayMedia (Browser API)
    ↓
AudioContext Processing
    ↓
Int16Array Conversion
    ↓
Deepgram WebSocket (Real-time)
    ↓
Final Transcript (is_final: true)
    ↓
DeepL API Translation
    ↓
UI Display (Subtitle Overlay)
```

## Security Considerations

1. **API Keys:**
   - Stored via Electron IPC (not in renderer)
   - Can be persisted with electron-store in production
   - Environment variables for development

2. **Audio Privacy:**
   - Only sent to Deepgram and DeepL
   - No third-party services
   - Local processing where possible

3. **Context Isolation:**
   - Renderer cannot access Node.js directly
   - Preload script acts as secure bridge

## Performance Optimizations

1. **Audio Processing:**
   - Uses ScriptProcessorNode (compatible)
   - Could upgrade to AudioWorklet for better performance

2. **Translation:**
   - Debouncing prevents API spam
   - Only translates final transcripts
   - Caching could be added

3. **UI:**
   - Minimal re-renders
   - Transparent overlay (low overhead)
   - Tailwind CSS (optimized)

## Extension Points

### Adding More Languages

1. Update Deepgram language in `useAudioCapture.ts`
2. Update DeepL source language in `route.ts`
3. Add language selector UI

### Improving Audio Quality

1. Adjust `sampleRate` in AudioContext
2. Tune Deepgram parameters (`endpointing`, `utterance_end_ms`)
3. Add noise reduction filters

### Adding Features

1. **History:** Store translations in local storage
2. **Export:** Save transcripts to file
3. **Customization:** User-defined window position/size
4. **Multiple Languages:** Support multiple source/target pairs

## Known Limitations

1. **ScriptProcessorNode:** Deprecated but still functional
   - Consider migrating to AudioWorklet

2. **API Key Storage:** Currently in-memory
   - Use electron-store for persistence

3. **Platform Differences:**
   - macOS may need additional permissions
   - Linux audio capture varies by distro

4. **Deepgram SDK:** Event handling may vary by version
   - Check SDK docs if issues arise

## Testing Recommendations

1. **Audio Capture:**
   - Test with different audio sources
   - Verify echo cancellation works
   - Check system audio capture

2. **Translation:**
   - Test with various French phrases
   - Verify formality setting
   - Check error handling

3. **UI:**
   - Test on different screen sizes
   - Verify transparency works
   - Check always-on-top behavior

4. **IPC:**
   - Test API key storage/retrieval
   - Verify security boundaries
   - Check error cases



