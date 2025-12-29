import { useRef, useState, useCallback } from 'react';

interface UseAudioRecordingReturn {
    isLive: boolean;
    micLevel: number;
    startLive: () => Promise<void>;
    stopLive: () => void;
    sendAudioBuffer: () => void;
    isStopping: React.MutableRefObject<boolean>;
}

export function useAudioRecording(
    socket: any,
    onStart?: () => void,
    onStop?: () => void
): UseAudioRecordingReturn {
    const [isLive, setIsLive] = useState(false);
    const [micLevel, setMicLevel] = useState(0);
    const streamsRef = useRef<MediaStream[]>([]);
    const animationIdRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const audioBufferRef = useRef<Int16Array[]>([]);
    const lastSendTimeRef = useRef<number>(Date.now());
    const isStoppingRef = useRef(false);

    const sendAudioBuffer = useCallback(() => {
        if (audioBufferRef.current.length === 0 || !socket?.connected || isStoppingRef.current) {
            return;
        }

        try {
            // Concatenate all buffered chunks
            const totalLength = audioBufferRef.current.reduce((sum, arr) => sum + arr.length, 0);
            const combined = new Int16Array(totalLength);
            let offset = 0;
            for (const chunk of audioBufferRef.current) {
                combined.set(chunk, offset);
                offset += chunk.length;
            }

            // Convert to base64
            const bytes = new Uint8Array(combined.buffer);
            const base64 = btoa(String.fromCharCode(...bytes));

            socket.emit('audio_chunk', base64);
            audioBufferRef.current = [];

        } catch (err) {
            console.error('❌ Error sending audio:', err);
        }
    }, [socket]);

    const startLive = useCallback(async () => {
        if (isStoppingRef.current) {
            console.warn('Still stopping previous session');
            return;
        }

        try {
            console.log('🎤 Starting microphone capture...');

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });
            streamsRef.current = [stream];

            // Create audio context
            const ctx = new AudioContext({ sampleRate: 16000 });
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);

            // Analyzer for UI visualization
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const draw = () => {
                if (!isStoppingRef.current) {
                    analyser.getByteFrequencyData(dataArray);
                    const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                    setMicLevel(Math.min(average * 1.5, 100));
                    animationIdRef.current = requestAnimationFrame(draw);
                }
            };
            draw();

            // Try to use AudioWorklet, fallback to ScriptProcessor
            let processorNode: AudioWorkletNode | ScriptProcessorNode | null = null;

            try {
                // AudioWorklet (modern approach)
                const workletCode = `
                    class PCMProcessor extends AudioWorkletProcessor {
                        process(inputs, outputs, parameters) {
                            const input = inputs[0];
                            if (input.length > 0) {
                                const inputData = input[0];
                                const pcm = new Int16Array(inputData.length);
                                
                                for (let i = 0; i < inputData.length; i++) {
                                    const s = Math.max(-1, Math.min(1, inputData[i]));
                                    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                                }
                                
                                this.port.postMessage(pcm);
                            }
                            return true;
                        }
                    }
                    registerProcessor('pcm-processor', PCMProcessor);
                `;

                const blob = new Blob([workletCode], { type: 'application/javascript' });
                const workletUrl = URL.createObjectURL(blob);

                await ctx.audioWorklet.addModule(workletUrl);
                URL.revokeObjectURL(workletUrl);

                const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
                workletNodeRef.current = workletNode;

                workletNode.port.onmessage = (e) => {
                    const pcm: Int16Array = e.data;
                    audioBufferRef.current.push(pcm);

                    // Send buffered audio every 300ms
                    const now = Date.now();
                    if (now - lastSendTimeRef.current >= 300) {
                        sendAudioBuffer();
                        lastSendTimeRef.current = now;
                    }
                };

                source.connect(workletNode);
                workletNode.connect(ctx.destination);
                processorNode = workletNode;

                console.log('✅ Using AudioWorklet');

            } catch (workletError) {
                console.warn('AudioWorklet not available, using ScriptProcessor:', workletError);

                // Fallback to ScriptProcessor
                const bufferSize = 4096;
                const processor = ctx.createScriptProcessor(bufferSize, 1, 1);

                processor.onaudioprocess = (e) => {
                    if (isStoppingRef.current) return;

                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcm = new Int16Array(inputData.length);

                    for (let i = 0; i < inputData.length; i++) {
                        const s = Math.max(-1, Math.min(1, inputData[i]));
                        pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                    }

                    audioBufferRef.current.push(pcm);

                    // Send buffered audio every 300ms
                    const now = Date.now();
                    if (now - lastSendTimeRef.current >= 300) {
                        sendAudioBuffer();
                        lastSendTimeRef.current = now;
                    }
                };

                source.connect(processor);
                processor.connect(ctx.destination);
                processorNode = processor;

                console.log('✅ Using ScriptProcessor (fallback)');
            }

            setIsLive(true);
            audioBufferRef.current = [];
            lastSendTimeRef.current = Date.now();
            isStoppingRef.current = false;

            onStart?.();

            console.log('✅ Recording started');

        } catch (err: any) {
            console.error('❌ Microphone error:', err);
            onStop?.();
        }
    }, [sendAudioBuffer, onStart, onStop]);

    const stopLive = useCallback(() => {
        if (isStoppingRef.current) {
            console.warn('Already stopping');
            return;
        }

        isStoppingRef.current = true;
        console.log('🛑 Stopping recording...');

        // Send any remaining audio
        if (audioBufferRef.current.length > 0) {
            sendAudioBuffer();
        }

        // Signal end of recording to server
        if (socket?.connected) {
            socket.emit('stop_recording');
        }

        // Stop animation
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }

        // Disconnect and cleanup audio nodes
        if (workletNodeRef.current) {
            try {
                workletNodeRef.current.port.close();
                workletNodeRef.current.disconnect();
            } catch (e) {
                console.warn('Error disconnecting worklet:', e);
            }
            workletNodeRef.current = null;
        }

        // Close audio context
        if (audioContextRef.current) {
            audioContextRef.current.close().catch(e =>
                console.warn('Error closing audio context:', e)
            );
            audioContextRef.current = null;
        }

        // Stop all media tracks
        streamsRef.current.forEach(s => {
            s.getTracks().forEach(t => {
                t.stop();
                console.log(`Track stopped: ${t.kind}`);
            });
        });
        streamsRef.current = [];

        // Clear buffers
        audioBufferRef.current = [];

        setIsLive(false);
        setMicLevel(0);

        // Reset after a delay
        setTimeout(() => {
            isStoppingRef.current = false;
            console.log('✅ Recording stopped');
        }, 500);

        onStop?.();
    }, [socket, sendAudioBuffer, onStop]);

    return {
        isLive,
        micLevel,
        startLive,
        stopLive,
        sendAudioBuffer,
        isStopping: isStoppingRef,
    };
}


