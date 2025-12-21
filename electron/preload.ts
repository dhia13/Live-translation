import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getApiKeys: () => ipcRenderer.invoke('get-api-keys'),
  setApiKeys: (keys: { deepgram?: string; deepl?: string }) =>
    ipcRenderer.invoke('set-api-keys', keys),
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  setWindowHeight: (height: number) => ipcRenderer.invoke('set-window-height', height),
  setWindowOpacity: (opacity: number) => ipcRenderer.invoke('set-window-opacity', opacity),
  getWindowOpacity: () => ipcRenderer.invoke('get-window-opacity'),
  // TTS audio routing
  registerTTSStream: (streamId: string) => ipcRenderer.invoke('register-tts-stream', streamId),
  unregisterTTSStream: () => ipcRenderer.invoke('unregister-tts-stream'),
  getTTSAudioStream: () => ipcRenderer.invoke('get-tts-audio-stream'),
  createVirtualMicrophone: () => ipcRenderer.invoke('create-virtual-microphone'),
});

// Type definitions for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getApiKeys: () => Promise<{ deepgram: string; deepl: string }>;
      setApiKeys: (keys: { deepgram?: string; deepl?: string }) => Promise<{ success: boolean }>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      setWindowHeight: (height: number) => Promise<void>;
      setWindowOpacity: (opacity: number) => Promise<void>;
      getWindowOpacity: () => Promise<number>;
      registerTTSStream: (streamId: string) => Promise<{ success: boolean }>;
      unregisterTTSStream: () => Promise<void>;
      getTTSAudioStream: () => Promise<{ streamId: string | null; registered: boolean; message: string }>;
      createVirtualMicrophone: () => Promise<{ success: boolean; message?: string; sources?: Array<{ id: string; name: string }>; error?: string }>;
    };
  }
}

