'use client';

import { useCallback, useRef } from 'react';

interface UseTextToSpeechReturn {
    speak: (text: string, language?: string, options?: { volume?: number; preventEcho?: boolean }) => void;
    speakToStream: (text: string, audioContext: AudioContext, destination: MediaStreamAudioDestinationNode, language?: string) => Promise<void>;
    stop: () => void;
    isSpeaking: boolean;
}

export function useTextToSpeech(): UseTextToSpeechReturn {
    const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const isSpeakingRef = useRef(false);
    const lastSpeakTimeRef = useRef(0);
    const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    const speak = useCallback((text: string, language: string = 'en-US', options?: { volume?: number; preventEcho?: boolean }) => {
        if (!text.trim()) {
            console.log('TTS: Empty text, skipping');
            return;
        }

        // Prevent echo: Don't speak if user just spoke (within last 500ms - less aggressive)
        const now = Date.now();
        const timeSinceLastSpeak = now - lastSpeakTimeRef.current;
        if (options?.preventEcho && timeSinceLastSpeak < 500) {
            console.log('TTS: Skipping to prevent echo (user just spoke)', timeSinceLastSpeak, 'ms ago');
            return;
        }

        console.log('TTS: Speaking text:', text.substring(0, 50) + '...', 'Language:', language, 'Volume:', options?.volume || 0.8);

        // Stop any current speech
        if (window.speechSynthesis.speaking) {
            console.log('TTS: Cancelling previous speech');
            window.speechSynthesis.cancel();
        }

        // Create new utterance
        const utterance = new SpeechSynthesisUtterance(text);

        // Configure voice settings
        utterance.lang = language;
        utterance.rate = 1.0; // Normal speed
        utterance.pitch = 1.0; // Normal pitch
        // Use provided volume or default to 0.8 (higher for better audibility)
        utterance.volume = options?.volume !== undefined ? options.volume : 0.8;

        // Try to find a good voice for the specified language
        const voices = window.speechSynthesis.getVoices();
        const langPrefix = language.split('-')[0]; // e.g., 'fr' from 'fr-FR'

        let selectedVoice = voices.find(
            (voice) => voice.lang.startsWith(langPrefix) && voice.localService === false
        ) || voices.find((voice) => voice.lang.startsWith(langPrefix));

        if (selectedVoice) {
            utterance.voice = selectedVoice;
        }

        utteranceRef.current = utterance;
        isSpeakingRef.current = true;

        // Handle speech end
        utterance.onend = () => {
            isSpeakingRef.current = false;
        };

        utterance.onerror = (error) => {
            console.error('Speech synthesis error:', error);
            isSpeakingRef.current = false;
        };

        // Speak
        window.speechSynthesis.speak(utterance);
        lastSpeakTimeRef.current = now;
    }, []);

    const speakToStream = useCallback(async (
        text: string,
        audioContext: AudioContext,
        destination: MediaStreamAudioDestinationNode,
        language: string = 'en-US'
    ): Promise<void> => {
        if (!text.trim()) {
            console.log('TTS: Empty text, skipping stream generation');
            return;
        }

        return new Promise(async (resolve, reject) => {
            // Wrap everything in try-catch to prevent crashes
            try {
                console.log('[TTS] ===== Starting speakToStream =====');
                console.log('[TTS] Text:', text.substring(0, 50), 'Language:', language);
                console.log('[TTS] AudioContext state:', audioContext.state);
                console.log('[TTS] Destination stream ID:', destination.stream.id);

                // Validate inputs
                if (!audioContext || audioContext.state === 'closed') {
                    throw new Error('AudioContext is closed or invalid');
                }
                if (!destination || !destination.stream) {
                    throw new Error('Destination stream is invalid');
                }

                // SOLUTION: Skip Edge TTS API (it's failing with 403) and use SpeechSynthesis directly
                // This plays TTS through speakers so VB-Audio Virtual Cable can capture it

                console.log('[TTS] Using SpeechSynthesis (Edge TTS API is blocked with 403 errors)');

                try {
                    // Create SpeechSynthesis utterance
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = language;
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    utterance.volume = 1.0; // Full volume so CABLE Input can capture it

                    // Select voice for the language
                    const voices = window.speechSynthesis.getVoices();
                    const langPrefix = language.split('-')[0];
                    let selectedVoice = voices.find(
                        (voice) => voice.lang.startsWith(langPrefix) && voice.localService === false
                    ) || voices.find((voice) => voice.lang.startsWith(langPrefix));

                    if (selectedVoice) {
                        utterance.voice = selectedVoice;
                        console.log('[TTS] Using voice:', selectedVoice.name);
                    } else {
                        console.log('[TTS] Using default voice for language:', language);
                    }

                    // Ensure AudioContext is running
                    if (audioContext.state === 'suspended') {
                        await audioContext.resume();
                        console.log('[TTS] AudioContext resumed');
                    }

                    // Create a gain node to route audio to both destinations
                    const gainNode = audioContext.createGain();
                    gainNode.gain.value = 1.0;

                    // Connect gain node to both destinations:
                    // 1. MediaStream destination (for potential future use)
                    // 2. AudioContext destination (speakers for VB-Audio capture)
                    gainNode.connect(destination);
                    gainNode.connect(audioContext.destination); // Keep this for VB-Audio to capture

                    console.log('[TTS] Audio routing setup complete');
                    console.log('[TTS] ========================================');
                    console.log('[TTS] ⚠️  IMPORTANT: Audio Routing Setup Required');
                    console.log('[TTS] ========================================');
                    console.log('[TTS] For the other person to hear TTS (not your real voice):');
                    console.log('[TTS]   1. Set Windows default audio output to "CABLE Input"');
                    console.log('[TTS]      (Right-click speaker icon → Sound settings → Sound Control Panel)');
                    console.log('[TTS]      (Playback tab → Right-click "CABLE Input" → Set as Default Device)');
                    console.log('[TTS]   2. In your call app: Settings → Audio → Microphone');
                    console.log('[TTS]      Select "CABLE Output (VB-Audio Virtual Cable)"');
                    console.log('[TTS]   3. Make sure the call app is NOT using your real microphone');
                    console.log('[TTS] ========================================');

                    // Handle speech synthesis events
                    utterance.onstart = () => {
                        console.log('[TTS] ✓ SpeechSynthesis started - audio playing through speakers');
                        console.log('[TTS] VB-Audio Virtual Cable should capture this audio');
                    };

                    utterance.onend = () => {
                        console.log('[TTS] ✓ SpeechSynthesis complete');
                        console.log('[TTS] Audio played through speakers - CABLE Input should have captured it');
                        resolve();
                    };

                    utterance.onerror = (error) => {
                        console.error('[TTS] SpeechSynthesis error:', error);
                        reject(new Error(`SpeechSynthesis failed: ${error.error || 'Unknown error'}`));
                    };

                    // Start speech synthesis (plays through speakers)
                    console.log('[TTS] Starting SpeechSynthesis playback...');
                    window.speechSynthesis.speak(utterance);

                    // Log stream status
                    const tracks = destination.stream.getAudioTracks();
                    console.log('[TTS] MediaStream has', tracks.length, 'audio track(s)');

                } catch (speechError: any) {
                    console.error('[TTS] SpeechSynthesis failed:', speechError);
                    console.error('[TTS] Error details:', {
                        name: speechError.name,
                        message: speechError.message,
                        stack: speechError.stack
                    });
                    reject(new Error(`SpeechSynthesis failed: ${speechError.message}`));
                }

            } catch (err: any) {
                console.error('[TTS] ✗ Fatal error in speakToStream:', err);
                console.error('[TTS] Error details:', {
                    name: err?.name,
                    message: err?.message,
                    stack: err?.stack
                });

                // Try fallback SpeechSynthesis as last resort
                try {
                    console.log('[TTS] Attempting final fallback: SpeechSynthesis...');
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = language;
                    utterance.volume = 1.0;
                    utterance.onend = () => {
                        console.log('[TTS] Fallback SpeechSynthesis completed');
                        resolve();
                    };
                    utterance.onerror = () => {
                        console.error('[TTS] Fallback SpeechSynthesis also failed');
                        reject(err);
                    };
                    window.speechSynthesis.speak(utterance);
                } catch (fallbackErr: any) {
                    console.error('[TTS] Fallback also failed:', fallbackErr);
                    reject(err); // Reject with original error
                }
            }
        });
    }, []);

    const stop = useCallback(() => {
        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
        }
        isSpeakingRef.current = false;
    }, []);

    return {
        speak,
        speakToStream,
        stop,
        isSpeaking: isSpeakingRef.current,
    };
}

