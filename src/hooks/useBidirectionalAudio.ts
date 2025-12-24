'use client';

import { useCallback, useRef, useState } from 'react';

const AUDIO_SAMPLE_RATE = 16000;
// Increased chunk size for better audio quality
const CHUNK_SIZE = AUDIO_SAMPLE_RATE * 2.5;

export function useBidirectionalAudio() {
    const [outgoingTranscript, setOutgoingTranscript] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const streamsRef = useRef<MediaStream[]>([]);
    const audioContextsRef = useRef<AudioContext[]>([]);
    // Track animation frame ID for cleanup
    const animationFrameIdRef = useRef<number | null>(null);
    const whisperListenerRef = useRef<(() => void) | null>(null);

    const cleanup = useCallback(() => {
        setIsListening(false);
        // Cancel animation frame
        if (animationFrameIdRef.current !== null) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        // Remove Whisper text listener
        if (whisperListenerRef.current) {
            whisperListenerRef.current();
            whisperListenerRef.current = null;
        }
        // Stop all media streams
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        // Close all audio contexts
        audioContextsRef.current.forEach(ctx => {
            if (ctx.state !== 'closed') ctx.close();
        });
        streamsRef.current = [];
        audioContextsRef.current = [];
        setOutgoingTranscript('');
    }, []);

    const setupAudioCapture = (stream: MediaStream) => {
        console.log('[Audio Capture] Setting up audio capture...');
        const audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
        audioContextsRef.current.push(audioContext);

        const source = audioContext.createMediaStreamSource(stream);
        // Use AnalyserNode instead of deprecated ScriptProcessorNode
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 4096; // Buffer size for analysis
        analyser.smoothingTimeConstant = 0.8;

        source.connect(analyser);
        console.log('[Audio Capture] Audio context created, analyser connected');

        let pcmBuffer = new Float32Array(0);
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);

        // Poll audio data using requestAnimationFrame (modern, non-deprecated approach)
        const processAudio = () => {
            // Get time domain data (PCM samples)
            analyser.getFloatTimeDomainData(dataArray);

            // Check if we're getting actual audio signal (not just silence)
            const maxAmplitude = Math.max(...Array.from(dataArray.map(Math.abs)));
            if (maxAmplitude > 0.01) {
                // Only log occasionally to avoid spam
                if (Math.random() < 0.01) {
                    console.log('[Audio Capture] Audio signal detected, max amplitude:', maxAmplitude.toFixed(4));
                }
            }

            // Append new data to our internal buffer
            const newBuffer = new Float32Array(pcmBuffer.length + dataArray.length);
            newBuffer.set(pcmBuffer);
            newBuffer.set(dataArray, pcmBuffer.length);
            pcmBuffer = newBuffer;

            // Send chunks for live transcription (1.5 seconds worth of audio)
            const LIVE_CHUNK_SIZE = AUDIO_SAMPLE_RATE * 1.5;
            if (pcmBuffer.length >= LIVE_CHUNK_SIZE) {
                const chunkToSend = pcmBuffer.slice(0, LIVE_CHUNK_SIZE);
                pcmBuffer = pcmBuffer.slice(LIVE_CHUNK_SIZE);

                // Stream audio chunk to main process for Whisper transcription
                console.log('[Audio Capture] Sending chunk:', chunkToSend.length, 'samples');
                window.electronAPI?.sendAudioChunk(chunkToSend);
            }

            // Continue polling
            animationFrameIdRef.current = requestAnimationFrame(processAudio);
        };

        // Start the audio processing loop
        animationFrameIdRef.current = requestAnimationFrame(processAudio);
    };

    const startCapture = useCallback(async () => {
        try {
            console.log('[Audio Capture] Starting capture...');
            setError(null);
            cleanup();

            // Set up Whisper transcription result listener
            if (window.electronAPI?.onWhisperText) {
                console.log('[Audio Capture] Setting up Whisper text listener...');
                const cleanupListener = window.electronAPI.onWhisperText((text: string) => {
                    console.log('[Audio Capture] Received Whisper transcription:', text);
                    if (text.trim()) {
                        setOutgoingTranscript(text);
                    }
                });
                whisperListenerRef.current = cleanupListener;
            } else {
                console.warn('[Audio Capture] electronAPI.onWhisperText not available!');
            }

            // Capture microphone audio (outgoing)
            console.log('[Audio Capture] Requesting microphone access...');
            const micStream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, sampleRate: AUDIO_SAMPLE_RATE }
            });
            console.log('[Audio Capture] Microphone access granted, stream:', micStream.id);
            streamsRef.current.push(micStream);
            setupAudioCapture(micStream);

            setIsListening(true);
            console.log('[Audio Capture] Capture started successfully!');
        } catch (err: any) {
            console.error('[Audio Capture] Error:', err);
            setError(err.message);
            cleanup();
        }
    }, [cleanup]);

    return { outgoingTranscript, isListening, startCapture, stopCapture: cleanup, error };
}