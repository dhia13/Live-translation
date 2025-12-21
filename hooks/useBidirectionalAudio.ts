'use client';

import { createClient } from '@deepgram/sdk';
import { useCallback, useEffect, useRef, useState } from 'react';

interface UseBidirectionalAudioReturn {
    incomingTranscript: string;
    outgoingTranscript: string;
    isListening: boolean;
    startCapture: () => Promise<void>;
    stopCapture: () => void;
    error: string | null;
    connectionStatus: {
        incoming: 'disconnected' | 'connecting' | 'connected' | 'error';
        outgoing: 'disconnected' | 'connecting' | 'connected' | 'error';
    };
    getTTSStream: () => MediaStream | null;
    getMicStream: () => MediaStream | null;
    getTTSAudioContext: () => AudioContext | null;
    getTTSDestination: () => MediaStreamAudioDestinationNode | null;
}

export function useBidirectionalAudio(apiKey?: string): UseBidirectionalAudioReturn {
    const [incomingTranscript, setIncomingTranscript] = useState<string>('');
    const [outgoingTranscript, setOutgoingTranscript] = useState<string>('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<{
        incoming: 'disconnected' | 'connecting' | 'connected' | 'error';
        outgoing: 'disconnected' | 'connecting' | 'connected' | 'error';
    }>({
        incoming: 'disconnected',
        outgoing: 'disconnected',
    });

    // Refs for streams and connections
    const incomingStreamRef = useRef<MediaStream | null>(null);
    const incomingConnectionRef = useRef<any>(null);
    const incomingMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const incomingReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const incomingReconnectAttemptsRef = useRef(0);

    const outgoingStreamRef = useRef<MediaStream | null>(null);
    const outgoingConnectionRef = useRef<any>(null);
    const outgoingMediaRecorderRef = useRef<MediaRecorder | null>(null);
    const outgoingReconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const outgoingReconnectAttemptsRef = useRef(0);

    // TTS audio stream for replacing microphone input
    const ttsAudioContextRef = useRef<AudioContext | null>(null);
    const ttsStreamDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
    const ttsMediaStreamRef = useRef<MediaStream | null>(null);
    const originalMicTrackRef = useRef<MediaStreamTrack | null>(null);
    const systemAudioStreamRef = useRef<MediaStream | null>(null); // System audio capture for TTS

    // Track if we're intentionally stopping to prevent auto-reconnect
    const intentionalStopRef = useRef(false);

    // Cleanup function
    const cleanup = useCallback(() => {
        console.log('Cleaning up audio resources...');
        
        // Cleanup audio monitoring if it exists
        if ((window as any).__audioMonitoringCleanup) {
            (window as any).__audioMonitoringCleanup();
            delete (window as any).__audioMonitoringCleanup;
        }

        // Clear reconnect timers
        if (incomingReconnectTimeoutRef.current) {
            clearTimeout(incomingReconnectTimeoutRef.current);
            incomingReconnectTimeoutRef.current = null;
        }
        if (outgoingReconnectTimeoutRef.current) {
            clearTimeout(outgoingReconnectTimeoutRef.current);
            outgoingReconnectTimeoutRef.current = null;
        }

        // Reset reconnect attempts
        incomingReconnectAttemptsRef.current = 0;
        outgoingReconnectAttemptsRef.current = 0;

        // Stop incoming MediaRecorder
        if (incomingMediaRecorderRef.current && incomingMediaRecorderRef.current.state !== 'inactive') {
            try {
                incomingMediaRecorderRef.current.stop();
            } catch (e) {
                console.warn('Error stopping incoming recorder:', e);
            }
        }
        if (incomingConnectionRef.current) {
            try {
                incomingConnectionRef.current.finish();
            } catch (e) {
                console.warn('Error closing incoming connection:', e);
            }
        }
        incomingStreamRef.current?.getTracks().forEach(track => track.stop());

        // Stop outgoing MediaRecorder
        if (outgoingMediaRecorderRef.current && outgoingMediaRecorderRef.current.state !== 'inactive') {
            try {
                outgoingMediaRecorderRef.current.stop();
            } catch (e) {
                console.warn('Error stopping outgoing recorder:', e);
            }
        }
        if (outgoingConnectionRef.current) {
            try {
                outgoingConnectionRef.current.finish();
            } catch (e) {
                console.warn('Error closing outgoing connection:', e);
            }
        }
        outgoingStreamRef.current?.getTracks().forEach(track => track.stop());
        originalMicTrackRef.current?.stop();

        // Stop system audio capture
        if (systemAudioStreamRef.current) {
            systemAudioStreamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
            systemAudioStreamRef.current = null;
        }

        // Unregister TTS stream from Electron (fire and forget)
        if (typeof window !== 'undefined' && (window as any).electronAPI) {
            (window as any).electronAPI.unregisterTTSStream().catch((e: any) => {
                console.warn('Error unregistering TTS stream:', e);
            });
        }

        // Cleanup TTS audio context
        if (ttsAudioContextRef.current) {
            try {
                ttsAudioContextRef.current.close().catch(console.error);
            } catch (e) {
                console.warn('Error closing TTS audio context:', e);
            }
        }

        // Clear refs
        incomingMediaRecorderRef.current = null;
        incomingConnectionRef.current = null;
        incomingStreamRef.current = null;
        outgoingMediaRecorderRef.current = null;
        outgoingConnectionRef.current = null;
        outgoingStreamRef.current = null;
        ttsAudioContextRef.current = null;
        ttsStreamDestinationRef.current = null;
        ttsMediaStreamRef.current = null;
        originalMicTrackRef.current = null;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            intentionalStopRef.current = true;
            cleanup();
        };
    }, [cleanup]);

    const validateApiKey = (key: string): boolean => {
        const trimmed = key.trim();
        if (!trimmed || trimmed.length < 20) {
            setError('Invalid Deepgram API key. Please check your configuration.');
            return false;
        }
        // Deepgram API keys typically start with specific prefixes
        // Check if it looks like a valid format (not strict validation, just basic check)
        if (!trimmed.match(/^[a-zA-Z0-9_-]+$/)) {
            setError('Invalid Deepgram API key format. Please verify your API key.');
            return false;
        }
        return true;
    };

    const startMediaRecorder = (stream: MediaStream, connection: any, type: 'incoming' | 'outgoing') => {
        try {
            // Use MediaRecorder to capture audio in a format Deepgram can process
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
            });

            if (type === 'incoming') {
                incomingMediaRecorderRef.current = mediaRecorder;
            } else {
                outgoingMediaRecorderRef.current = mediaRecorder;
            }

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && connection) {
                    try {
                        // Send audio data to Deepgram
                        connection.send(event.data);
                        // Log periodically to confirm audio is being sent
                        if (Math.random() < 0.01) { // Log ~1% of sends to avoid spam
                            console.log(`[${type.toUpperCase()}] Sent audio chunk: ${event.data.size} bytes`);
                        }
                    } catch (e) {
                        console.error(`Error sending ${type} audio data:`, e);
                    }
                } else {
                    if (event.data.size === 0) {
                        console.warn(`[${type.toUpperCase()}] Empty audio chunk received`);
                    }
                    if (!connection) {
                        console.warn(`[${type.toUpperCase()}] No connection available to send audio`);
                    }
                }
            };
            
            // Add state monitoring
            mediaRecorder.onstart = () => {
                console.log(`[${type.toUpperCase()}] MediaRecorder started, state: ${mediaRecorder.state}`);
            };
            
            mediaRecorder.onstop = () => {
                console.log(`[${type.toUpperCase()}] MediaRecorder stopped`);
            };
            
            // Monitor track state
            stream.getAudioTracks().forEach((track, i) => {
                track.onended = () => {
                    console.warn(`[${type.toUpperCase()}] Audio track ${i} ended unexpectedly`);
                };
                track.onmute = () => {
                    console.warn(`[${type.toUpperCase()}] Audio track ${i} muted`);
                };
                track.onunmute = () => {
                    console.log(`[${type.toUpperCase()}] Audio track ${i} unmuted`);
                };
                
                // Log track settings
                const settings = track.getSettings();
                console.log(`[${type.toUpperCase()}] Audio track ${i} settings:`, {
                    deviceId: settings.deviceId,
                    groupId: settings.groupId,
                    sampleRate: settings.sampleRate,
                    channelCount: settings.channelCount,
                    echoCancellation: settings.echoCancellation,
                    noiseSuppression: settings.noiseSuppression,
                    autoGainControl: settings.autoGainControl,
                });
            });

            mediaRecorder.onerror = (event: any) => {
                console.error(`${type} MediaRecorder error:`, event.error);
                setError(`${type} audio recording error: ${event.error?.message || 'Unknown error'}`);
            };

            // Start recording with timeslice to get data frequently
            mediaRecorder.start(100); // Reduced from 250ms to 100ms for lower latency
            console.log(`${type} MediaRecorder started`);
            
            // Monitor data availability
            let dataChunkCount = 0;
            const originalOndataavailable = mediaRecorder.ondataavailable;
            mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    dataChunkCount++;
                    if (dataChunkCount % 10 === 0) { // Log every 10 chunks
                        console.log(`[${type.toUpperCase()}] Audio data chunk received (size: ${event.data.size} bytes, chunks: ${dataChunkCount})`);
                    }
                } else {
                    console.warn(`[${type.toUpperCase()}] Empty audio data chunk received`);
                }
                if (originalOndataavailable) {
                    originalOndataavailable(event);
                }
            };
        } catch (err: any) {
            console.error(`Error starting ${type} MediaRecorder:`, err);
            setError(`Failed to start ${type} audio recording: ${err.message}`);
        }
    };

    const handleConnectionError = (err: any, type: 'incoming' | 'outgoing', apiKeyParam?: string) => {
        // Try to extract more detailed error information
        let errorMessage = 'Unknown error';

        if (err instanceof Error) {
            errorMessage = err.message;
        } else if (err.message) {
            errorMessage = err.message;
        } else if (typeof err === 'string') {
            errorMessage = err;
        } else if (err.target && err.target instanceof WebSocket) {
            // WebSocket error - try to get more details
            const ws = err.target;
            errorMessage = `WebSocket error: ${ws.readyState === WebSocket.CLOSED ? 'Connection closed' : 'Connection failed'}`;

            // Check if there's a response URL or status
            if (ws.url) {
                console.error(`${type} WebSocket URL:`, ws.url);
            }
        } else {
            errorMessage = JSON.stringify(err);
        }

        console.error(`${type} connection error details:`, err);
        console.error(`${type} error message:`, errorMessage);

        // Check for specific error codes in the message
        const lowerMessage = errorMessage.toLowerCase();

        if (lowerMessage.includes('401') || lowerMessage.includes('unauthorized') || lowerMessage.includes('403') || lowerMessage.includes('forbidden')) {
            setError('Invalid Deepgram API key. Please verify your credentials in the Electron app settings. Make sure your API key is correct and has the necessary permissions.');
            // Don't retry on auth errors
            if (type === 'incoming') {
                incomingReconnectAttemptsRef.current = 999;
            } else {
                outgoingReconnectAttemptsRef.current = 999;
            }
        } else if (lowerMessage.includes('400') || lowerMessage.includes('bad request')) {
            const apiKeyPreview = apiKeyParam ? `${apiKeyParam.substring(0, 8)}...${apiKeyParam.substring(apiKeyParam.length - 4)}` : 'not set';
            setError(`Bad request to Deepgram (400). This usually means:\n1. Invalid API key format (current: ${apiKeyPreview})\n2. Missing or invalid parameters\n3. API key doesn't have required permissions\n4. API key may be expired or revoked\n\nPlease verify your API key in the Electron app settings. Make sure:\n- The API key is complete (no spaces or extra characters)\n- The API key starts with the correct format\n- Your Deepgram account has credits/quota available`);
            // Don't retry on bad request errors
            if (type === 'incoming') {
                incomingReconnectAttemptsRef.current = 999;
            } else {
                outgoingReconnectAttemptsRef.current = 999;
            }
        } else if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
            setError('Rate limit exceeded. Please try again later.');
        } else {
            setError(`${type} audio error: ${errorMessage}`);
        }
    };

    const attemptReconnect = (type: 'incoming' | 'outgoing') => {
        if (intentionalStopRef.current) return;

        const attemptsRef = type === 'incoming' ? incomingReconnectAttemptsRef : outgoingReconnectAttemptsRef;
        const timeoutRef = type === 'incoming' ? incomingReconnectTimeoutRef : outgoingReconnectTimeoutRef;

        // Don't retry more than 3 times
        if (attemptsRef.current >= 3) {
            console.log(`Max reconnection attempts reached for ${type} audio`);
            setError(`Failed to connect ${type} audio after multiple attempts. Please check your API key and try again.`);
            return;
        }

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        attemptsRef.current++;
        const delay = Math.min(3000 * attemptsRef.current, 10000); // Exponential backoff, max 10s

        console.log(`Attempting to reconnect ${type} audio (attempt ${attemptsRef.current}/3) in ${delay}ms...`);

        timeoutRef.current = setTimeout(async () => {
            if (!intentionalStopRef.current && apiKey) {
                try {
                    const trimmedKey = apiKey.trim();
                    if (!trimmedKey) {
                        console.error(`Cannot reconnect ${type} audio: API key is empty`);
                        return;
                    }
                    if (type === 'incoming' && incomingStreamRef.current) {
                        await setupIncomingAudio(trimmedKey, incomingStreamRef.current);
                    } else if (type === 'outgoing' && outgoingStreamRef.current) {
                        await setupOutgoingAudio(trimmedKey, outgoingStreamRef.current);
                    }
                } catch (err) {
                    console.error(`Failed to reconnect ${type} audio:`, err);
                }
            }
        }, delay);
    };

    const setupIncomingAudio = async (apiKey: string, stream: MediaStream) => {
        setConnectionStatus(prev => ({ ...prev, incoming: 'connecting' }));

        // Ensure API key is trimmed and valid
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            setError('API key is empty');
            setConnectionStatus(prev => ({ ...prev, incoming: 'error' }));
            throw new Error('API key is empty');
        }

        try {
            console.log(`Setting up incoming audio with API key: ${trimmedKey.substring(0, 8)}...${trimmedKey.substring(trimmedKey.length - 4)}`);

            // Create Deepgram client
            const deepgram = createClient(trimmedKey);

            const connection = deepgram.listen.live({
                model: 'nova-2',
                language: 'fr', // French - change to 'en-US' if the other person speaks English
                smart_format: true,
                interim_results: true,
                endpointing: 300,
                utterance_end_ms: 1000,
                // Add these to help with detection
                vad_events: false, // Disable VAD events to avoid conflicts
                punctuate: true,
            });
            
            console.log('[INCOMING] Deepgram connection configured for language: fr');
            console.log('[INCOMING] ⚠️  If the other person speaks English, change language to "en-US"');

            incomingConnectionRef.current = connection;

            connection.on('open', () => {
                console.log('✓ Incoming audio connection established');
                setConnectionStatus(prev => ({ ...prev, incoming: 'connected' }));
                incomingReconnectAttemptsRef.current = 0; // Reset on successful connection
                startMediaRecorder(stream, connection, 'incoming');
            });

            connection.on('Results', (data: any) => {
                // Log full data structure for debugging
                console.log('[INCOMING] Full result data:', JSON.stringify(data, null, 2));

                const transcript = data.channel?.alternatives?.[0]?.transcript;
                const isFinal = data.is_final;
                const speech_final = data.speech_final;

                console.log(`[INCOMING] Result - isFinal: ${isFinal}, speech_final: ${speech_final}, hasTranscript: ${!!transcript}, transcript:`, transcript || '(empty)');

                if (transcript?.trim()) {
                    if (isFinal || speech_final) {
                        console.log('✓ [INCOMING] Setting final transcript:', transcript);
                        setIncomingTranscript(transcript);
                    } else {
                        console.log('[INCOMING] Interim result (not setting):', transcript);
                        // Optionally show interim results for debugging
                        // setIncomingTranscript(transcript + '...');
                    }
                } else {
                    console.log('[INCOMING] Empty transcript received - checking alternatives...');
                    // Check if there are other alternatives
                    if (data.channel?.alternatives && data.channel.alternatives.length > 0) {
                        console.log('[INCOMING] Alternatives found:', data.channel.alternatives);
                    }
                }
            });

            connection.on('error', (err: any) => {
                console.error('Incoming audio error:', err);
                setConnectionStatus(prev => ({ ...prev, incoming: 'error' }));
                handleConnectionError(err, 'incoming', trimmedKey);
            });

            connection.on('close', (event: any) => {
                console.log('Incoming connection closed:', event.code, event.reason);
                setConnectionStatus(prev => ({ ...prev, incoming: 'disconnected' }));

                // Only retry on abnormal closures
                if (!intentionalStopRef.current && event.code !== 1000 && incomingReconnectAttemptsRef.current < 3) {
                    attemptReconnect('incoming');
                }
            });

            connection.on('warning', (warning: any) => {
                console.warn('Incoming audio warning:', warning);
            });

        } catch (err: any) {
            console.error('Failed to setup incoming audio:', err);
            setConnectionStatus(prev => ({ ...prev, incoming: 'error' }));
            handleConnectionError(err, 'incoming', trimmedKey);
            throw err;
        }
    };

    const setupOutgoingAudio = async (apiKey: string, stream: MediaStream) => {
        setConnectionStatus(prev => ({ ...prev, outgoing: 'connecting' }));

        // Ensure API key is trimmed and valid
        const trimmedKey = apiKey.trim();
        if (!trimmedKey) {
            setError('API key is empty');
            setConnectionStatus(prev => ({ ...prev, outgoing: 'error' }));
            throw new Error('API key is empty');
        }

        try {
            console.log(`Setting up outgoing audio with API key: ${trimmedKey.substring(0, 8)}...${trimmedKey.substring(trimmedKey.length - 4)}`);

            // Create Deepgram client
            const deepgram = createClient(trimmedKey);

            const connection = deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                interim_results: true,
                endpointing: 300,
                utterance_end_ms: 1000,
            });

            outgoingConnectionRef.current = connection;

            connection.on('open', () => {
                console.log('✓ Outgoing audio connection established');
                setConnectionStatus(prev => ({ ...prev, outgoing: 'connected' }));
                outgoingReconnectAttemptsRef.current = 0; // Reset on successful connection
                startMediaRecorder(stream, connection, 'outgoing');
            });

            connection.on('Results', (data: any) => {
                const transcript = data.channel?.alternatives?.[0]?.transcript;
                const isFinal = data.is_final;
                const speech_final = data.speech_final;
                const confidence = data.channel?.alternatives?.[0]?.confidence || 0;

                console.log(`[OUTGOING] Result received:`);
                console.log(`  - Transcript: "${transcript || '(empty)'}"`);
                console.log(`  - Confidence: ${confidence}`);
                console.log(`  - isFinal: ${isFinal}, speech_final: ${speech_final}`);
                
                // Log full data structure for debugging empty transcripts
                if (!transcript?.trim()) {
                    console.log('[OUTGOING] ⚠️  Empty transcript - Full result data:', JSON.stringify(data, null, 2));
                    console.log('[OUTGOING] Possible reasons:');
                    console.log('   1. No speech detected (microphone not picking up sound)');
                    console.log('   2. Microphone is muted');
                    console.log('   3. Audio level too low');
                    console.log('   4. Background noise too high');
                    console.log('   5. Wrong microphone selected');
                }

                // Use interim results for lower latency (show immediately, update when final)
                if (transcript?.trim()) {
                    if (isFinal || speech_final) {
                        console.log('✅ [OUTGOING] Setting final transcript:', transcript);
                        setOutgoingTranscript(transcript);
                    } else {
                        // Show interim results immediately for lower perceived latency
                        console.log('📝 [OUTGOING] Setting interim transcript:', transcript);
                        setOutgoingTranscript(transcript);
                    }
                } else {
                    console.log('[OUTGOING] Empty transcript, not updating state');
                }
            });

            connection.on('error', (err: any) => {
                console.error('Outgoing audio error:', err);
                setConnectionStatus(prev => ({ ...prev, outgoing: 'error' }));
                handleConnectionError(err, 'outgoing', trimmedKey);
            });

            connection.on('close', (event: any) => {
                console.log('Outgoing connection closed:', event.code, event.reason);
                setConnectionStatus(prev => ({ ...prev, outgoing: 'disconnected' }));

                // Only retry on abnormal closures
                if (!intentionalStopRef.current && event.code !== 1000 && outgoingReconnectAttemptsRef.current < 3) {
                    attemptReconnect('outgoing');
                }
            });

            connection.on('warning', (warning: any) => {
                console.warn('Outgoing audio warning:', warning);
            });

        } catch (err: any) {
            console.error('Failed to setup outgoing audio:', err);
            setConnectionStatus(prev => ({ ...prev, outgoing: 'error' }));
            handleConnectionError(err, 'outgoing', trimmedKey);
            throw err;
        }
    };

    const startCapture = useCallback(async () => {
        if (!apiKey) {
            setError('Deepgram API key not configured');
            return;
        }

        if (!validateApiKey(apiKey)) {
            return;
        }

        intentionalStopRef.current = false;
        setError(null);

        // Reset reconnect attempts
        incomingReconnectAttemptsRef.current = 0;
        outgoingReconnectAttemptsRef.current = 0;

        // Trim and validate API key before use
        const trimmedApiKey = apiKey.trim();
        if (!trimmedApiKey) {
            setError('Deepgram API key is empty. Please configure your API key in settings.');
            return;
        }

        console.log('Starting bidirectional audio capture with API key:', trimmedApiKey.substring(0, 8) + '...' + trimmedApiKey.substring(trimmedApiKey.length - 4));

        try {
            // INCOMING AUDIO DISABLED - Focus on outgoing (microphone) only
            console.log('📢 Incoming audio capture DISABLED - focusing on microphone only');
            console.log('   Flow: Your Voice → Deepgram → TTS → Call Microphone');

            // Create a dummy stream for incoming (not used, but needed for setup)
            const dummyIncomingStream = new MediaStream();
            incomingStreamRef.current = dummyIncomingStream;

            // Capture microphone (outgoing) - your speech (for transcription only)
            // IMPORTANT: We need the REAL microphone, NOT CABLE Output!
            console.log('📢 Requesting microphone access...');
            console.log('⚠️  Make sure to select your REAL microphone, not CABLE Output!');
            
            // First, get list of available microphones
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            console.log('📋 Available microphones:');
            audioInputs.forEach((device, i) => {
                const isCable = device.label.toLowerCase().includes('cable');
                console.log(`  ${i + 1}. ${device.label}${isCable ? ' ⚠️  (This is CABLE Output - DO NOT USE!)' : ''}`);
            });
            
            // Find a microphone that is NOT CABLE Output
            const realMicrophone = audioInputs.find(device => 
                !device.label.toLowerCase().includes('cable') && 
                !device.label.toLowerCase().includes('virtual')
            );
            
            if (!realMicrophone) {
                console.error('❌ No real microphone found! Only CABLE Output is available.');
                console.error('   Please disconnect CABLE Output from being the default microphone.');
                setError('No real microphone found. CABLE Output is selected as microphone. Please select your real microphone in Windows Sound Settings.');
                return;
            }
            
            console.log(`✓ Using microphone: ${realMicrophone.label}`);
            console.log(`  Device ID: ${realMicrophone.deviceId}`);
            
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    deviceId: { exact: realMicrophone.deviceId }, // Explicitly use the real microphone
                    echoCancellation: false, // Disable to preserve audio quality for Deepgram
                    noiseSuppression: false, // Disable to preserve audio quality
                    autoGainControl: false, // Disable to preserve audio quality
                    sampleRate: 48000,
                    channelCount: 1,
                },
            });

            // Store original mic track (we'll use it for transcription)
            const micTrack = micStream.getAudioTracks()[0];
            originalMicTrackRef.current = micTrack;
            
            console.log('✓ Microphone access granted');
            const micSettings = micTrack.getSettings();
            console.log('  � microphone track:', {
                id: micTrack.id,
                label: micTrack.label || 'Default Microphone',
                enabled: micTrack.enabled,
                muted: micTrack.muted,
                readyState: micTrack.readyState,
                settings: micSettings
            });
            
            // Check if microphone is muted
            if (micTrack.muted) {
                console.error('❌ MICROPHONE IS MUTED! Please unmute it in Windows Sound Settings.');
                setError('Microphone is muted. Please unmute it and try again.');
            }
            
            // Check if we got a valid microphone
            if (!micTrack.label || micTrack.label === 'default') {
                console.warn('⚠️  Using default microphone - make sure it\'s the correct one');
            }
            
            // Monitor microphone track state
            micTrack.onended = () => {
                console.warn('[OUTGOING] Microphone track ended!');
            };
            
            micTrack.onmute = () => {
                console.warn('[OUTGOING] ⚠️  Microphone track muted!');
            };
            
            micTrack.onunmute = () => {
                console.log('[OUTGOING] ✓ Microphone track unmuted');
            };
            
            // Create an AudioContext to monitor audio levels
            const monitorContext = new AudioContext({ sampleRate: 48000 });
            const source = monitorContext.createMediaStreamSource(micStream);
            const analyser = monitorContext.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            
            // Monitor audio levels - always log to see what's happening
            let audioCheckCount = 0;
            const checkAudioLevels = () => {
                audioCheckCount++;
                const dataArray = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                const max = Math.max(...dataArray);
                
                // Log every check (every 500ms) for the first 20 checks (10 seconds)
                if (audioCheckCount <= 20) {
                    if (average > 5) {
                        console.log(`[OUTGOING] 🔊 Audio detected! Average: ${average.toFixed(1)}, Max: ${max}`);
                    } else {
                        console.log(`[OUTGOING] 🔇 No audio detected. Level: ${average.toFixed(1)} (speak louder or check microphone)`);
                    }
                } else if (average > 5) {
                    // After 10 seconds, only log when audio is detected
                    console.log(`[OUTGOING] 🔊 Audio detected! Level: ${average.toFixed(1)}`);
                }
            };
            
            // Check audio levels every 500ms
            const audioLevelInterval = setInterval(checkAudioLevels, 500);
            
            // Store interval reference for cleanup
            const cleanupAudioMonitoring = () => {
                clearInterval(audioLevelInterval);
                monitorContext.close();
            };
            
            // Stop monitoring when capture stops
            // We'll call this in the cleanup function
            (window as any).__audioMonitoringCleanup = cleanupAudioMonitoring;

            // Create TTS audio stream using Web Audio API
            // This will be used to replace microphone input in the call
            const audioContext = new AudioContext({ sampleRate: 48000 });
            ttsAudioContextRef.current = audioContext;

            // Resume AudioContext immediately to ensure it's active
            if (audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            console.log('✓ TTS AudioContext created and resumed, state:', audioContext.state);

            const destination = audioContext.createMediaStreamDestination();
            ttsStreamDestinationRef.current = destination;
            ttsMediaStreamRef.current = destination.stream;

            // Log stream details
            const tracks = destination.stream.getAudioTracks();
            console.log('✓ TTS MediaStream created with', tracks.length, 'audio track(s)');
            tracks.forEach((track, i) => {
                console.log(`  Track ${i}:`, {
                    id: track.id,
                    enabled: track.enabled,
                    settings: track.getSettings()
                });
            });

            // Register TTS stream with Electron main process for routing
            if (typeof window !== 'undefined' && (window as any).electronAPI) {
                try {
                    // Get the stream ID from the MediaStream
                    const streamId = destination.stream.id;
                    await (window as any).electronAPI.registerTTSStream(streamId);
                    console.log('✓ TTS stream registered with Electron:', streamId);

                    // Create virtual microphone source
                    try {
                        const virtualMic = await (window as any).electronAPI.createVirtualMicrophone();
                        if (virtualMic.success) {
                            console.log('✓ Virtual microphone source created');
                        }
                    } catch (err) {
                        console.warn('Failed to create virtual microphone:', err);
                    }
                } catch (err) {
                    console.warn('Failed to register TTS stream with Electron:', err);
                }
            }

            // IMPORTANT: We DON'T use system audio loopback here because it would capture BOTH:
            // 1. Your voice (from microphone, potentially playing back)
            // 2. TTS audio (playing through speakers)
            // This creates a feedback loop!
            //
            // Solution: TTS will be routed DIRECTLY to the destination stream
            // WITHOUT playing through speakers. This requires using a TTS API that returns audio data.

            console.log('✓ TTS stream ready');
            console.log('📢 Virtual Microphone Mode:');
            console.log('   - TTS will be routed directly to stream (NOT through speakers)');
            console.log('   - Your voice is NOT included in the stream');
            console.log('   - Only TTS audio goes to the call');
            console.log('   - No system audio capture (prevents feedback loop)');

            // Create outgoing stream with TTS audio instead of microphone
            // The TTS audio will be captured from system audio when it plays
            const outgoingStream = new MediaStream();
            // Add TTS audio track (will be populated with TTS when user speaks)
            destination.stream.getAudioTracks().forEach(track => {
                outgoingStream.addTrack(track);
            });

            outgoingStreamRef.current = outgoingStream;

            console.log('✓ TTS audio stream created for microphone replacement');
            console.log('📢 TTS Routing: Audio will be captured from system audio when TTS plays');

            // Setup ONLY outgoing audio (microphone → Deepgram → TTS → Call)
            // Incoming audio is disabled for now
            console.log('📢 Setting up outgoing audio only...');
            await setupOutgoingAudio(trimmedApiKey, micStream); // Use mic for transcription only

            // Log instructions for TTS routing
            console.log('✓ Audio setup complete');
            console.log('📢 TTS Routing Instructions:');
            console.log('   1. The TTS audio stream is ready and will be generated when you speak');
            console.log('   2. To route TTS to your call app:');
            console.log('      - Windows: Install VB-Audio Virtual Cable, set it as your microphone');
            console.log('      - macOS: Install BlackHole, set it as your microphone');
            console.log('   3. The app will generate TTS audio from your speech automatically');

            setIsListening(true);
            console.log('✓ Bidirectional audio capture started successfully');

        } catch (err: any) {
            console.error('Failed to start audio capture:', err);
            console.error('Error details:', {
                name: err.name,
                message: err.message,
                stack: err.stack
            });

            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('Permission denied. Please allow access to microphone and screen sharing. In Electron, check system permissions in Settings > Privacy & Security.');
            } else if (err.name === 'NotFoundError') {
                setError('No audio device found. Please check your hardware.');
            } else if (err.name === 'NotSupportedError') {
                setError('Audio capture not supported in this browser.');
            } else if (err.message?.includes('Permission denied')) {
                setError('Permission denied. Please grant microphone and screen sharing permissions.');
            } else {
                setError(`Failed to start: ${err.message || 'Unknown error'}`);
            }

            cleanup();
            setIsListening(false);
        }
    }, [apiKey, cleanup]);

    const stopCapture = useCallback(() => {
        console.log('Stopping audio capture...');
        intentionalStopRef.current = true;
        cleanup();
        setIsListening(false);
        setIncomingTranscript('');
        setOutgoingTranscript('');
        setConnectionStatus({
            incoming: 'disconnected',
            outgoing: 'disconnected',
        });
        setError(null);
    }, [cleanup]);

    const getTTSStream = useCallback((): MediaStream | null => {
        return ttsMediaStreamRef.current;
    }, []);

    const getMicStream = useCallback((): MediaStream | null => {
        if (originalMicTrackRef.current) {
            const stream = new MediaStream([originalMicTrackRef.current]);
            return stream;
        }
        return null;
    }, []);

    const getTTSAudioContext = useCallback((): AudioContext | null => {
        return ttsAudioContextRef.current;
    }, []);

    const getTTSDestination = useCallback((): MediaStreamAudioDestinationNode | null => {
        return ttsStreamDestinationRef.current;
    }, []);

    return {
        incomingTranscript,
        outgoingTranscript,
        isListening,
        startCapture,
        stopCapture,
        error,
        connectionStatus,
        getTTSStream,
        getMicStream,
        getTTSAudioContext,
        getTTSDestination,
    };
}