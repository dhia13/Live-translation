'use client';

import { createClient } from '@deepgram/sdk';
import { useCallback, useRef, useState } from 'react';

interface UseAudioCaptureReturn {
    transcript: string;
    isListening: boolean;
    startCapture: () => Promise<void>;
    stopCapture: () => void;
    error: string | null;
}

export function useAudioCapture(apiKey?: string): UseAudioCaptureReturn {
    const [transcript, setTranscript] = useState<string>('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const mediaStreamRef = useRef<MediaStream | null>(null);
    const deepgramConnectionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const startCapture = useCallback(async () => {
        if (!apiKey) {
            setError('Deepgram API key not configured');
            return;
        }

        try {
            setError(null);

            // Request microphone audio capture
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
            });

            mediaStreamRef.current = stream;

            // Create Deepgram client and connection
            const deepgram = createClient(apiKey);

            const connection = deepgram.listen.live({
                model: 'nova-2',
                language: 'en-US',
                smart_format: true,
                interim_results: true,
                endpointing: 200, // Reduced from 300ms for faster sentence detection
                utterance_end_ms: 500, // Reduced from 1000ms for faster finalization
            });

            deepgramConnectionRef.current = connection;

            // Set up connection event handlers
            connection.on('open', () => {
                console.log('Deepgram connection opened');
                setIsListening(true);
                setTranscript('');

                // Start sending audio data using MediaRecorder
                startMediaRecorder(stream, connection);
            });

            connection.on('Results', (data: any) => {
                const transcriptData = data.channel?.alternatives?.[0]?.transcript;
                if (transcriptData && transcriptData.trim()) {
                    console.log('Transcript:', transcriptData);
                    setTranscript(prev => {
                        // For interim results, replace the text
                        // For final results, you might want to append
                        return transcriptData;
                    });
                }
            });

            connection.on('error', (err: any) => {
                console.error('Deepgram error:', err);
                setError(`Deepgram error: ${err.message || 'Unknown error'}`);
            });

            connection.on('close', () => {
                console.log('Deepgram connection closed');
                setIsListening(false);
            });

            connection.on('warning', (warning: any) => {
                console.warn('Deepgram warning:', warning);
            });

        } catch (err: any) {
            console.error('Error starting audio capture:', err);
            setError(`Failed to start: ${err.message}`);
            setIsListening(false);
        }
    }, [apiKey]);

    const startMediaRecorder = (stream: MediaStream, connection: any) => {
        try {
            // Use MediaRecorder to capture audio in a format Deepgram can process
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
            });

            mediaRecorderRef.current = mediaRecorder;

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0 && connection) {
                    // Send audio data to Deepgram
                    connection.send(event.data);
                }
            };

            mediaRecorder.onerror = (event: any) => {
                console.error('MediaRecorder error:', event.error);
                setError(`Recording error: ${event.error?.message || 'Unknown error'}`);
            };

            // Start recording with timeslice to get data frequently
            mediaRecorder.start(100); // Reduced to 100ms for faster audio chunks and lower latency
            console.log('MediaRecorder started');

        } catch (err: any) {
            console.error('Error starting MediaRecorder:', err);
            setError(`MediaRecorder error: ${err.message}`);
        }
    };

    const stopCapture = useCallback(() => {
        console.log('Stopping audio capture...');

        // Stop MediaRecorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current = null;
        }

        // Close Deepgram connection
        if (deepgramConnectionRef.current) {
            try {
                deepgramConnectionRef.current.finish();
            } catch (err) {
                console.error('Error closing Deepgram connection:', err);
            }
            deepgramConnectionRef.current = null;
        }

        // Stop media stream
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }

        // Close audio context if exists
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(console.error);
            audioContextRef.current = null;
        }

        setIsListening(false);
        setTranscript('');
    }, []);

    return {
        transcript,
        isListening,
        startCapture,
        stopCapture,
        error,
    };
}