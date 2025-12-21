'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseTranslationOptions {
    targetLanguage: string;
    sourceLanguage?: string;
    debounceMs?: number;
    apiKey?: string;
}

interface UseTranslationReturn {
    translatedText: string;
    isTranslating: boolean;
    error: string | null;
    translate: (text: string) => Promise<void>;
}

export function useTranslation({
    targetLanguage,
    sourceLanguage = 'English',
    debounceMs = 500,
    apiKey,
}: UseTranslationOptions): UseTranslationReturn {
    const [translatedText, setTranslatedText] = useState<string>('');
    const [isTranslating, setIsTranslating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const lastTextRef = useRef<string>('');
    const abortControllerRef = useRef<AbortController | null>(null);

    const translate = useCallback(async (text: string) => {
        if (!text || !text.trim()) {
            setTranslatedText('');
            return;
        }

        // Don't translate if text hasn't changed
        if (text === lastTextRef.current) {
            return;
        }

        // Store the text we want to translate
        const textToTranslate = text;
        lastTextRef.current = text;

        // Clear any existing debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        // Debounce the translation - wait for transcript to stabilize
        debounceTimerRef.current = setTimeout(async () => {
            // Check if text has changed again during debounce period
            if (textToTranslate !== lastTextRef.current) {
                // Text changed, skip this translation
                return;
            }

            try {
                setIsTranslating(true);
                setError(null);

                // Create new abort controller for this request
                const abortController = new AbortController();
                abortControllerRef.current = abortController;

                // Call your Next.js API route (DeepL) - optimized for speed
                const response = await fetch('/api/translate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        text: textToTranslate,
                        apiKey,
                        targetLanguage,
                        sourceLanguage,
                    }),
                    signal: abortController.signal,
                });

                // Quick check if text changed while request was in flight
                if (textToTranslate !== lastTextRef.current) {
                    return;
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({ error: 'Translation failed' }));
                    throw new Error(errorData.error || `API error: ${response.status}`);
                }

                const data = await response.json();

                // Final check before setting translated text
                if (textToTranslate === lastTextRef.current && data.translatedText) {
                    setTranslatedText(data.translatedText);
                }

            } catch (err: any) {
                if (err.name === 'AbortError') {
                    // Silently handle abort - it's expected when new text arrives
                    return;
                }
                // Only set error if this is still the current text
                if (textToTranslate === lastTextRef.current) {
                    console.error('Translation error:', err);
                    setError(`Translation failed: ${err.message}`);
                }
            } finally {
                // Only clear translating state if this is still the current request
                if (textToTranslate === lastTextRef.current) {
                    setIsTranslating(false);
                    abortControllerRef.current = null;
                }
            }
        }, debounceMs);

    }, [targetLanguage, sourceLanguage, debounceMs, apiKey]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    return {
        translatedText,
        isTranslating,
        error,
        translate,
    };
}