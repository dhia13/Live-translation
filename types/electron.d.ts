export interface ElectronAPI {
  getApiKeys: () => Promise<{ deepgram: string; deepl: string }>;
  setApiKeys: (keys: { deepgram?: string; deepl?: string }) => Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

