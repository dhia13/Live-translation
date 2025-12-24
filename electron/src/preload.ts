import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // File transcription
    selectAudioFile: () => ipcRenderer.invoke('select-audio-file'),
    transcribeAudio: (path: string) => ipcRenderer.invoke('transcribe-audio', path),

    // Live caption
    startLiveCaption: () => ipcRenderer.invoke('start-live-caption'),
    stopLiveCaption: () => ipcRenderer.invoke('stop-live-caption'),

    // Live caption events
    onCaptionPartial: (callback: (data: { text: string }) => void) => {
        ipcRenderer.on('caption-partial', (_event, data) => callback(data));
    },
    onCaptionFinal: (callback: (data: any) => void) => {
        ipcRenderer.on('caption-final', (_event, data) => callback(data));
    },
    onCaptionStatus: (callback: (data: { status: string }) => void) => {
        ipcRenderer.on('caption-status', (_event, data) => callback(data));
    },
    onCaptionError: (callback: (data: { error: string }) => void) => {
        ipcRenderer.on('caption-error', (_event, data) => callback(data));
    },
});