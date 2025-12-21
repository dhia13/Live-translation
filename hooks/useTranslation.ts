'use client';

import { useState, useEffect, useRef } from 'react';

interface UseTranslationReturn {
  translatedText: string;
  isTranslating: boolean;
  error: string | null;
}

export function useTranslation(
  transcript: string,
  apiKey?: string
): UseTranslationReturn {
  const [translatedText, setTranslatedText] = useState<string>('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const translationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only translate when we have a final transcript and API key
    if (!transcript.trim() || !apiKey) {
      setTranslatedText('');
      return;
    }

    // Debounce translation to avoid too many API calls
    if (translationTimeoutRef.current) {
      clearTimeout(translationTimeoutRef.current);
    }

    setIsTranslating(true);
    setError(null);

    translationTimeoutRef.current = setTimeout(async () => {
      try {
        // Call Next.js API route for translation
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: transcript,
            apiKey,
          }),
        });

        if (!response.ok) {
          throw new Error(`Translation failed: ${response.statusText}`);
        }

        const data = await response.json();
        setTranslatedText(data.translatedText || '');
      } catch (err: any) {
        console.error('Translation error:', err);
        setError(`Translation error: ${err.message || 'Unknown error'}`);
        setTranslatedText('');
      } finally {
        setIsTranslating(false);
      }
    }, 300); // 300ms debounce

    return () => {
      if (translationTimeoutRef.current) {
        clearTimeout(translationTimeoutRef.current);
      }
    };
  }, [transcript, apiKey]);

  return {
    translatedText,
    isTranslating,
    error,
  };
}

