import { useState, useCallback } from 'react';
import { Caption, TranscriptionData } from '../types';

interface UseTranscriptionReturn {
    captionHistory: Caption[];
    addTranscription: (data: TranscriptionData, captionId: number) => void;
    clearHistory: () => void;
}

export function useTranscription(): UseTranscriptionReturn {
    const [captionHistory, setCaptionHistory] = useState<Caption[]>([]);

    const addTranscription = useCallback((data: TranscriptionData, captionId: number) => {
        const newCap: Caption = {
            text: data.text,
            translatedText: data.translated_text,
            language: data.language,
            timestamp: Date.now(),
            id: captionId
        };
        setCaptionHistory(prev => [...prev, newCap].slice(-5));
    }, []);

    const clearHistory = useCallback(() => {
        setCaptionHistory([]);
    }, []);

    return {
        captionHistory,
        addTranscription,
        clearHistory,
    };
}


