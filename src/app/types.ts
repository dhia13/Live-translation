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
}

export interface StatusData {
    message: string;
    device: string;
    model: string;
    compute_type: string;
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
}

