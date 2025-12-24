export interface ElectronAPI {
  onTranslationUpdate: (callback: (text: string) => void) => void;
  removeListeners: () => void;
  transcribeWithWhisper: (audioData: Float32Array | ArrayBuffer | number[], options?: { language?: string; translate?: boolean }) => Promise<{ success: boolean; text?: string; error?: string }>;
  testWhisperTranscription: () => Promise<{ success: boolean; text?: string; error?: string; message?: string }>;
  sendAudioChunk: (buffer: Float32Array) => void;
  onWhisperText: (callback: (text: string) => void) => (() => void);
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

