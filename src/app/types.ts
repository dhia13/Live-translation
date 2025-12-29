export interface Caption {
    text: string;
    translatedText?: string;
    language?: string;
    timestamp: number;
    id: number;
}

export interface TranscriptionData {
    text: string;
    translated_text?: string;
    language?: string;
    target_language?: string;
    inference_time?: number;
    translation_time?: number;
    count?: number;
    final?: boolean;
    // TTS audio data
    tts_audio?: string;  // Base64 encoded WAV
    tts_sample_rate?: number;
    tts_time?: number;
}

export interface StatusData {
    message: string;
    device: string;
    model: string;
    compute_type: string;
    tts_available?: boolean;
    tts_default_voice?: string;
}

export interface StatsData {
    avg_latency: number;
    total_processed: number;
    dropped_chunks: number;
}

export interface TranslationConfig {
    source_language: string | null;
    target_language: string | null;
    enabled: boolean;
}

export interface Language {
    code: string | null;
    name: string;
    flag: string;
}

export interface ServerInfo {
    device: string;
    model: string;
    tts_available?: boolean;
}

export interface Voice {
    id: string;
    name: string;
    gender: string;
    accent: string;
}

export interface TTSConfig {
    enabled: boolean;
    voice: string;
    speed: number;
    available: boolean;
}

// File upload types
export type ProcessingMode = 'transcribe' | 'transcribe_translate' | 'transcribe_translate_tts';

export type JobStatus = 'pending' | 'extracting' | 'transcribing' | 'translating' | 'synthesizing' | 'complete' | 'error';

export interface UploadConfig {
    mode: ProcessingMode;
    sourceLanguage: string | null;
    targetLanguage: string | null;
    ttsVoice: string;
    ttsSpeed: number;
}

export interface TranscriptionSegment {
    id: number;
    start: number;
    end: number;
    text: string;
    translatedText?: string;
    language?: string;
}

export interface ProcessingJob {
    job_id: string;
    filename: string;
    status: JobStatus;
    progress: number;
    mode: ProcessingMode;
    source_language: string | null;
    target_language: string | null;
    audio_duration: number;
    segments: TranscriptionSegment[];
    error_message?: string;
    has_tts_audio: boolean;
}
