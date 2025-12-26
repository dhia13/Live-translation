// Live transcription is handled directly in React - no Electron API needed
export interface ElectronAPI { }

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}