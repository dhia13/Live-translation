export interface ElectronAPI {
  // File transcription
  selectAudioFile: () => Promise<string | null>;
  transcribeAudio: (path: string) => Promise<{
    success: boolean;
    text?: string;
    error?: string
  }>;

  // Live caption
  startLiveCaption: () => Promise<{ success: boolean; error?: string }>;
  stopLiveCaption: () => Promise<{ success: boolean }>;

  // Live caption events
  onCaptionPartial: (callback: (data: { text: string }) => void) => void;
  onCaptionFinal: (callback: (data: any) => void) => void;
  onCaptionStatus: (callback: (data: { status: string }) => void) => void;
  onCaptionError: (callback: (data: { error: string }) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}