import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for translation updates from the main process
    onTranslationUpdate: (callback: (text: string) => void) => {
        ipcRenderer.on('translation-data', (_event, value) => callback(value));
    },
    removeListeners: () => ipcRenderer.removeAllListeners('translation-data'),
    // Whisper transcription methods
    transcribeWithWhisper: (audioData: Float32Array | ArrayBuffer | number[], options?: { language?: string; translate?: boolean }) =>
        ipcRenderer.invoke('transcribe-with-whisper', audioData, options),
    sendAudioChunk: (buffer: Float32Array) => ipcRenderer.send('stream-audio-to-whisper', buffer), onWhisperText: (callback: (text: string) => void) =>
        ipcRenderer.on('whisper-text', (_event, text) => callback(text)),
    testWhisper: () => ipcRenderer.invoke('test-whisper-transcription'),
    testWhisperTranscription: () => ipcRenderer.invoke('test-whisper-transcription'),
});