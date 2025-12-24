"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // File transcription
    selectAudioFile: () => electron_1.ipcRenderer.invoke('select-audio-file'),
    transcribeAudio: (path) => electron_1.ipcRenderer.invoke('transcribe-audio', path),
    // Live caption
    startLiveCaption: () => electron_1.ipcRenderer.invoke('start-live-caption'),
    stopLiveCaption: () => electron_1.ipcRenderer.invoke('stop-live-caption'),
    // Live caption events
    onCaptionPartial: (callback) => {
        electron_1.ipcRenderer.on('caption-partial', (_event, data) => callback(data));
    },
    onCaptionFinal: (callback) => {
        electron_1.ipcRenderer.on('caption-final', (_event, data) => callback(data));
    },
    onCaptionStatus: (callback) => {
        electron_1.ipcRenderer.on('caption-status', (_event, data) => callback(data));
    },
    onCaptionError: (callback) => {
        electron_1.ipcRenderer.on('caption-error', (_event, data) => callback(data));
    },
});
