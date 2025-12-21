export interface ElectronAPI {
  getApiKeys: () => Promise<{ deepgram: string; deepl: string }>;
  setApiKeys: (keys: { deepgram?: string; deepl?: string }) => Promise<{ success: boolean }>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  setWindowHeight: (height: number) => Promise<void>;
  setWindowOpacity: (opacity: number) => Promise<void>;
  getWindowOpacity: () => Promise<number>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

