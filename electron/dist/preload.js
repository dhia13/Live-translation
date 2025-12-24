"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for translation updates from the main process
    onTranslationUpdate: (callback) => {
        electron_1.ipcRenderer.on('translation-data', (_event, value) => callback(value));
    },
    removeListeners: () => electron_1.ipcRenderer.removeAllListeners('translation-data'),
    // Whisper transcription methods
    transcribeWithWhisper: (audioData, options) => electron_1.ipcRenderer.invoke('transcribe-with-whisper', audioData, options),
    sendAudioChunk: (buffer) => electron_1.ipcRenderer.send('stream-audio-to-whisper', buffer), onWhisperText: (callback) => electron_1.ipcRenderer.on('whisper-text', (_event, text) => callback(text)),
    testWhisper: () => electron_1.ipcRenderer.invoke('test-whisper-transcription'),
    testWhisperTranscription: () => electron_1.ipcRenderer.invoke('test-whisper-transcription'),
});
