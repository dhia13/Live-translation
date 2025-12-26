import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'live-translator-settings';

interface TranslationSettings {
    sourceLanguage: string | null;
    targetLanguage: string | null;
    translationEnabled: boolean;
}

interface UseTranslationReturn {
    sourceLanguage: string | null;
    targetLanguage: string | null;
    translationEnabled: boolean;
    setSourceLanguage: (lang: string | null) => void;
    setTargetLanguage: (lang: string | null) => void;
    setTranslationEnabled: (enabled: boolean) => void;
    getConfig: () => { source_language: string | null; target_language: string | null };
}

function loadSettings(): TranslationSettings {
    if (typeof window === 'undefined') {
        return {
            sourceLanguage: null,
            targetLanguage: 'en',
            translationEnabled: false,
        };
    }
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (error) {
        console.error('Failed to load settings from localStorage:', error);
    }
    
    return {
        sourceLanguage: null,
        targetLanguage: 'en',
        translationEnabled: false,
    };
}

function saveSettings(settings: TranslationSettings): void {
    if (typeof window === 'undefined') return;
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
        console.error('Failed to save settings to localStorage:', error);
    }
}

export function useTranslation(
    isLive: boolean,
    sendTranslationConfig: (config: { source_language: string | null; target_language: string | null }) => void
): UseTranslationReturn {
    const [sourceLanguage, setSourceLanguageState] = useState<string | null>(() => loadSettings().sourceLanguage);
    const [targetLanguage, setTargetLanguageState] = useState<string | null>(() => loadSettings().targetLanguage);
    const [translationEnabled, setTranslationEnabledState] = useState<boolean>(() => loadSettings().translationEnabled);
    
    // Load settings on mount
    useEffect(() => {
        const settings = loadSettings();
        setSourceLanguageState(settings.sourceLanguage);
        setTargetLanguageState(settings.targetLanguage);
        setTranslationEnabledState(settings.translationEnabled);
    }, []);
    
    const setSourceLanguage = useCallback((lang: string | null) => {
        setSourceLanguageState(lang);
        saveSettings({
            sourceLanguage: lang,
            targetLanguage,
            translationEnabled,
        });
    }, [targetLanguage, translationEnabled]);
    
    const setTargetLanguage = useCallback((lang: string | null) => {
        setTargetLanguageState(lang);
        saveSettings({
            sourceLanguage,
            targetLanguage: lang,
            translationEnabled,
        });
    }, [sourceLanguage, translationEnabled]);
    
    const setTranslationEnabled = useCallback((enabled: boolean) => {
        setTranslationEnabledState(enabled);
        saveSettings({
            sourceLanguage,
            targetLanguage,
            translationEnabled: enabled,
        });
    }, [sourceLanguage, targetLanguage]);

    const getConfig = useCallback(() => ({
        source_language: sourceLanguage,
        target_language: translationEnabled ? targetLanguage : null
    }), [sourceLanguage, targetLanguage, translationEnabled]);

    // Update config when settings change
    useEffect(() => {
        if (isLive) {
            const config = {
                source_language: sourceLanguage,
                target_language: translationEnabled ? targetLanguage : null
            };
            sendTranslationConfig(config);
        }
    }, [sourceLanguage, targetLanguage, translationEnabled, isLive, sendTranslationConfig]);

    return {
        sourceLanguage,
        targetLanguage,
        translationEnabled,
        setSourceLanguage,
        setTargetLanguage,
        setTranslationEnabled,
        getConfig,
    };
}

