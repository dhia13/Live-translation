// electron/whisper-addon.ts

export interface WhisperParams {
    model: string;
    buffer: Buffer;
    language?: string;
    translate?: boolean;
    threads?: number;
}

export interface WhisperResult {
    text: string;
    segments: Array<{
        start: number;
        end: number;
        text: string;
    }>;
}

// This is the key part:
export interface WhisperAddon {
    whisper_transcribe: (
        params: WhisperParams,
        callback: (err: Error | null, result: WhisperResult) => void
    ) => void;
}