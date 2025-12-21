'use client';

import { useState, useRef, useCallback } from 'react';
import { createClient } from '@deepgram/sdk';

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
  const deepgramConnectionRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startCapture = useCallback(async () => {
    if (!apiKey) {
      setError('Deepgram API key not configured');
      return;
    }

    try {
      setError(null);
      
      // Request system audio capture (loopback)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        audio: {
          echoCancellation: true, // Filter out user's mic
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        } as MediaTrackConstraints,
        video: false,
      });

      mediaStreamRef.current = stream;

      // Create AudioContext for processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Create MediaStreamAudioSourceNode
      const source = audioContext.createMediaStreamSource(stream);
      
      // Create a ScriptProcessorNode for audio processing (legacy API, but works)
      // For modern browsers, we'd use AudioWorklet, but this is more compatible
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to Int16Array for Deepgram
        const int16Data = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          // Clamp and convert to 16-bit integer
          const s = Math.max(-1, Math.min(1, inputData[i]));
          int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Send audio data to Deepgram
        if (deepgramConnectionRef.current) {
          try {
            // Deepgram SDK connection has a send method for raw audio data
            const connection = deepgramConnectionRef.current as any;
            if (connection.readyState === 1 && typeof connection.send === 'function') {
              // Send as ArrayBuffer for binary data
              connection.send(int16Data.buffer);
            }
          } catch (err) {
            console.error('Error sending audio to Deepgram:', err);
          }
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      // Initialize Deepgram WebSocket connection
      const deepgram = createClient(apiKey);
      const connection = deepgram.listen.live.transcription({
        model: 'nova-2',
        language: 'fr',
        smart_format: true,
        interim_results: true,
        endpointing: 300,
        utterance_end_ms: 1000,
      });

      deepgramConnectionRef.current = connection as any;

      connection.on('open', () => {
        setIsListening(true);
        setTranscript('');
      });

      // Handle Deepgram transcription results
      connection.on('results', (data: any) => {
        try {
          const transcriptData = data.channel?.alternatives?.[0]?.transcript;
          const isFinal = data.is_final;
          
          if (transcriptData) {
            if (isFinal) {
              // Only update transcript when final to avoid flickering
              setTranscript(transcriptData);
            }
          }
        } catch (err) {
          console.error('Error parsing Deepgram results:', err);
        }
      });

      // Handle metadata and other events
      connection.on('metadata', (data: any) => {
        console.log('Deepgram metadata:', data);
      });

      connection.on('error', (err: any) => {
        console.error('Deepgram error:', err);
        setError(`Deepgram error: ${err.message || 'Unknown error'}`);
        setIsListening(false);
      });

      connection.on('close', () => {
        setIsListening(false);
      });

      connection.on('warning', (warning: any) => {
        console.warn('Deepgram warning:', warning);
      });

      // Handle stream end (user stops sharing)
      stream.getAudioTracks()[0].onended = () => {
        stopCapture();
      };

    } catch (err: any) {
      console.error('Error starting audio capture:', err);
      setError(`Failed to start audio capture: ${err.message || 'Unknown error'}`);
      setIsListening(false);
    }
  }, [apiKey]);

  const stopCapture = useCallback(() => {
    // Close Deepgram connection
    if (deepgramConnectionRef.current) {
      deepgramConnectionRef.current.close();
      deepgramConnectionRef.current = null;
    }

    // Stop all media tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Close AudioContext
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

