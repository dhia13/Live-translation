'use client';

import SubtitleOverlay from '@/components/SubtitleOverlay';
import { useBidirectionalAudio } from '@/hooks/useBidirectionalAudio';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';
import { useTranslation } from '@/hooks/useTranslation';
import { useEffect, useRef, useState } from 'react';

// Feature flag: Set to false to disable translation and test TTS only
const ENABLE_TRANSLATION = false;

export default function Home() {
    const [apiKeys, setApiKeys] = useState<{ deepgram?: string; deepl?: string }>({});
    const [isConfigured, setIsConfigured] = useState(false);
    const [missingKeys, setMissingKeys] = useState<{ deepgram: boolean; deepl: boolean }>({
        deepgram: true,
        deepl: true
    });

    // Bidirectional audio capture
    const {
        incomingTranscript, // French speaker's speech (transcribed)
        outgoingTranscript,  // User's English speech (transcribed)
        isListening,
        startCapture,
        stopCapture,
        error: audioError,
        getTTSStream,
        getMicStream,
        getTTSAudioContext,
        getTTSDestination
    } = useBidirectionalAudio(apiKeys.deepgram);

    // Track when user is speaking to prevent echo
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const userSpeakingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Translation: French → English (for incoming audio)
    const {
        translatedText: incomingTranslated,
        isTranslating: isTranslatingIncoming,
        error: incomingTranslationError,
        translate: translateIncoming
    } = useTranslation({
        targetLanguage: 'English',
        sourceLanguage: 'French',
        debounceMs: 150,
        apiKey: apiKeys.deepl,
    });

    // Translation: English → French (for outgoing audio)
    const {
        translatedText: outgoingTranslated,
        isTranslating: isTranslatingOutgoing,
        error: outgoingTranslationError,
        translate: translateOutgoing
    } = useTranslation({
        targetLanguage: 'French',
        sourceLanguage: 'English',
        debounceMs: 150,
        apiKey: apiKeys.deepl,
    });

    // Text-to-speech for translations
    const { speak: speakText, speakToStream } = useTextToSpeech();

    useEffect(() => {
        // Load API keys from Electron IPC
        if (typeof window !== 'undefined' && window.electronAPI) {
            window.electronAPI.getApiKeys().then((keys) => {
                setApiKeys(keys);
                const hasDeepgram = !!keys.deepgram;
                const hasDeepl = !!keys.deepl;
                setMissingKeys({ deepgram: !hasDeepgram, deepl: !hasDeepl });
                // Only require DeepL key if translation is enabled
                setIsConfigured(hasDeepgram && (ENABLE_TRANSLATION ? hasDeepl : true));
            });
        }
    }, []);

    // Translate incoming French speech to English (only if translation is enabled)
    useEffect(() => {
        if (ENABLE_TRANSLATION && incomingTranscript && apiKeys.deepl) {
            translateIncoming(incomingTranscript);
        }
    }, [incomingTranscript, apiKeys.deepl, translateIncoming]);

    // Track when user is speaking to prevent echo (less aggressive)
    useEffect(() => {
        if (outgoingTranscript && outgoingTranscript.trim()) {
            setIsUserSpeaking(true);
            // Clear existing timeout
            if (userSpeakingTimeoutRef.current) {
                clearTimeout(userSpeakingTimeoutRef.current);
            }
            // Reset after 500ms of no speech (much shorter to allow TTS sooner)
            userSpeakingTimeoutRef.current = setTimeout(() => {
                setIsUserSpeaking(false);
            }, 500);
        }
        return () => {
            if (userSpeakingTimeoutRef.current) {
                clearTimeout(userSpeakingTimeoutRef.current);
            }
        };
    }, [outgoingTranscript]);

    // Debug: Log transcript changes
    useEffect(() => {
        console.log('[PAGE] Incoming transcript changed:', incomingTranscript || '(empty)');
    }, [incomingTranscript]);

    useEffect(() => {
        console.log('[PAGE] Outgoing transcript changed:', outgoingTranscript || '(empty)');
    }, [outgoingTranscript]);

    // INCOMING TTS DISABLED - Focus on outgoing only
    // useEffect(() => {
    //     // Disabled - focusing on outgoing (microphone → TTS → call) only
    // }, [incomingTranscript, incomingTranslated, speakText, isUserSpeaking]);

    // Translate outgoing English speech to French and speak it (only if translation is enabled)
    useEffect(() => {
        if (ENABLE_TRANSLATION && outgoingTranscript && apiKeys.deepl) {
            translateOutgoing(outgoingTranscript);
        }
    }, [outgoingTranscript, apiKeys.deepl, translateOutgoing]);

    // Generate TTS audio from user's speech and route it to replace microphone input
    // This makes the other person hear TTS instead of the user's actual voice
    useEffect(() => {
        console.log('[PAGE] TTS useEffect triggered:', {
            isListening,
            outgoingTranscript: outgoingTranscript || '(empty)',
            hasTranscript: !!outgoingTranscript && !!outgoingTranscript.trim()
        });

        if (!isListening) {
            console.log('[PAGE] TTS skipped: not listening');
            return;
        }

        if (!outgoingTranscript || !outgoingTranscript.trim()) {
            console.log('[PAGE] TTS skipped: no outgoing transcript');
            return;
        }

        const generateTTSForCall = async () => {
            const audioContext = getTTSAudioContext();
            const destination = getTTSDestination();

            if (!audioContext || !destination) {
                console.log('[PAGE] TTS stream not ready yet');
                return;
            }

            try {
                // Generate TTS audio and route it to the stream
                const textToSpeak = ENABLE_TRANSLATION && outgoingTranslated
                    ? outgoingTranslated
                    : outgoingTranscript;

                const language = ENABLE_TRANSLATION ? 'fr-FR' : 'en-US';

                console.log('[PAGE] ===== Generating TTS for call =====');
                console.log('[PAGE] Text:', textToSpeak.substring(0, 50));
                console.log('[PAGE] Language:', language);
                console.log('[PAGE] AudioContext available:', !!audioContext);
                console.log('[PAGE] Destination available:', !!destination);

                try {
                    await speakToStream(textToSpeak, audioContext, destination, language);
                    console.log('[PAGE] ✓ TTS audio generated and routed to stream');
                } catch (ttsError: any) {
                    console.error('[PAGE] ✗ Error in speakToStream:', ttsError);
                    console.error('[PAGE] Error details:', {
                        message: ttsError?.message,
                        stack: ttsError?.stack,
                        name: ttsError?.name
                    });
                    // Don't crash the app - just log the error
                    // The fallback SpeechSynthesis should handle it
                }
            } catch (err) {
                console.error('[PAGE] Error generating TTS for call:', err);
            }
        };

        // Debounce to avoid generating TTS for every transcript update
        const timeoutId = setTimeout(() => {
            generateTTSForCall();
        }, 300); // Wait 300ms after transcript changes

        return () => clearTimeout(timeoutId);
    }, [outgoingTranscript, outgoingTranslated, isListening, getTTSAudioContext, getTTSDestination, speakToStream]);

    const handleStart = async () => {
        if (!apiKeys.deepgram) {
            return;
        }
        await startCapture();
    };

    const handleStop = () => {
        stopCapture();
    };

    // Combine errors (only include translation errors if translation is enabled)
    const error = audioError || (ENABLE_TRANSLATION && (incomingTranslationError || outgoingTranslationError)) || null;

    // Build display text for main subtitle
    const mainDisplayText = ENABLE_TRANSLATION
        ? (incomingTranslated || incomingTranscript || '')
        : (incomingTranscript || outgoingTranscript || '');

    return (
        <div
            className="w-full h-full flex items-start justify-start pointer-events-none"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div className="w-full h-full">
                {/* Main subtitle overlay - Always show for controls */}
                <SubtitleOverlay
                    text={mainDisplayText}
                    isActive={isListening}
                    onStart={handleStart}
                    onStop={handleStop}
                    isConfigured={isConfigured}
                    missingKeys={missingKeys}
                    error={error}
                />

                {/* Subtitle cards container - side by side */}
                {(incomingTranscript || outgoingTranscript) && (
                    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 pointer-events-none z-30 flex gap-4 items-end max-w-5xl px-4">
                        {/* Incoming subtitle (French) - left side */}
                        {incomingTranscript && (
                            <div className="flex-1 min-w-0">
                                <div className="bg-blue-900/90 text-blue-100 px-6 py-3 rounded-lg text-base text-center backdrop-blur-md border border-blue-700/50 shadow-xl">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                        </svg>
                                        <span className="text-blue-400 text-xs font-semibold">
                                            {ENABLE_TRANSLATION ? 'Incoming (FR → EN)' : 'Incoming (French)'}
                                        </span>
                                    </div>
                                    <div className="text-blue-100 text-lg font-medium break-words">
                                        {ENABLE_TRANSLATION && incomingTranscript && incomingTranslated ? (
                                            <>
                                                <span className="text-blue-300 italic">{incomingTranscript}</span>
                                                <span className="mx-2 text-blue-500">→</span>
                                                <span className="text-blue-100 font-medium">{incomingTranslated}</span>
                                            </>
                                        ) : (
                                            incomingTranscript || 'Waiting for incoming audio...'
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Outgoing subtitle (English) - right side */}
                        {outgoingTranscript && (
                            <div className="flex-1 min-w-0">
                                <div className="bg-green-900/90 text-green-100 px-6 py-3 rounded-lg text-base text-center backdrop-blur-md border border-green-700/50 shadow-xl">
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        <span className="text-green-400 text-xs font-semibold">
                                            {ENABLE_TRANSLATION ? 'You (EN → FR)' : 'You (English)'}
                                        </span>
                                    </div>
                                    <div className="text-green-100 text-lg font-medium break-words">
                                        {ENABLE_TRANSLATION && outgoingTranscript && outgoingTranslated ? (
                                            <>
                                                <span className="text-green-300 italic">{outgoingTranscript}</span>
                                                <span className="mx-2 text-green-500">→</span>
                                                <span className="text-green-100 font-medium">{outgoingTranslated}</span>
                                            </>
                                        ) : (
                                            outgoingTranscript || 'Waiting for your speech...'
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Translation status indicators (only show if translation is enabled) */}
                {ENABLE_TRANSLATION && (isTranslatingIncoming || isTranslatingOutgoing) && (
                    <div className="absolute top-4 right-4 pointer-events-auto z-30">
                        <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm animate-pulse flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Translating...
                        </div>
                    </div>
                )}

                {/* TTS Mode indicator with setup instructions */}
                {!ENABLE_TRANSLATION && isListening && (
                    <div className="absolute bottom-1 right-4 pointer-events-auto z-30 max-w-md">
                        <div className="bg-purple-500/90 text-white px-4 py-3 rounded-lg text-sm backdrop-blur-sm shadow-lg border border-purple-400/50">
                            <div className="flex items-center gap-2 mb-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                <span className="font-semibold">TTS Mode Active</span>
                            </div>
                            <div className="text-xs text-purple-100 space-y-1">
                                <div>⚠️ Verify setup:</div>
                                <div>1. Windows output = CABLE Input</div>
                                <div>2. WhatsApp mic = CABLE Output</div>
                                <div className="text-purple-200 mt-2">Check console for detailed logs</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}