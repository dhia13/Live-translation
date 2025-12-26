'use client';
import { useEffect, useRef, useState } from 'react';

interface Caption {
    text: string;
    timestamp: number;
    id: number;
}

interface TranscriptionData {
    text: string;
    inference_time?: number;
    count?: number;
    final?: boolean;
}

interface StatusData {
    message: string;
    device: string;
    model: string;
    compute_type: string;
}

interface StatsData {
    avg_latency: number;
    total_processed: number;
    dropped_chunks: number;
}

let globalSocket: any = null;
let socketUsers = 0;

export default function LiveTranslator() {
    const [currentText, setCurrentText] = useState('');
    const [captionHistory, setCaptionHistory] = useState<Caption[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Disconnected');
    const [serverInfo, setServerInfo] = useState<{ device: string; model: string } | null>(null);
    const [micLevel, setMicLevel] = useState(0);
    const [inferenceTime, setInferenceTime] = useState<number>(0);
    const [stats, setStats] = useState<StatsData | null>(null);

    const socketRef = useRef<any>(null);
    const streamsRef = useRef<MediaStream[]>([]);
    const captionIdRef = useRef(0);
    const animationIdRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const workletNodeRef = useRef<AudioWorkletNode | null>(null);
    const audioBufferRef = useRef<Int16Array[]>([]);
    const lastSendTimeRef = useRef<number>(Date.now());
    const isStoppingRef = useRef(false);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Monitor connection and auto-stop if disconnected
    useEffect(() => {
        const checkConnection = setInterval(() => {
            if (isLive && socketRef.current && !socketRef.current.connected) {
                console.warn('Connection lost while recording');
                setError('Connection lost - stopping recording');
                stopLive();
            }
        }, 2000);

        return () => clearInterval(checkConnection);
    }, [isLive]);

    useEffect(() => {
        socketUsers++;

        const initSocket = async () => {
            try {
                if (!globalSocket) {
                    const { io } = await import('socket.io-client');
                    globalSocket = io('http://127.0.0.1:5000', {
                        transports: ['websocket'],
                        reconnection: true,
                        reconnectionAttempts: 10,
                        reconnectionDelay: 1000,
                        reconnectionDelayMax: 5000,
                        timeout: 20000,
                    });
                }

                if (!globalSocket._handlersSet) {
                    globalSocket.on('connect', () => {
                        console.log('✅ Connected to server');
                        setStatus('Connected');
                        setError(null);
                    });

                    globalSocket.on('disconnect', (reason: string) => {
                        console.log('❌ Disconnected:', reason);
                        setStatus('Disconnected');
                        if (isLive) {
                            setError('Disconnected from server');
                        }
                    });

                    globalSocket.on('reconnect', (attemptNumber: number) => {
                        console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
                        setStatus('Connected');
                        setError(null);
                    });

                    globalSocket.on('status', (data: StatusData) => {
                        console.log('📊 Server status:', data);
                        setServerInfo({ device: data.device, model: data.model });
                        setStatus('Connected');
                    });

                    globalSocket.on('transcription', (data: TranscriptionData) => {
                        if (data.text.trim()) {
                            setCurrentText(data.text);

                            if (data.inference_time) {
                                setInferenceTime(data.inference_time);
                            }

                            const newCap = {
                                text: data.text,
                                timestamp: Date.now(),
                                id: captionIdRef.current++
                            };
                            setCaptionHistory(prev => [...prev, newCap].slice(-5));

                            if (data.final) {
                                console.log('🏁 Final transcription received');
                            }
                        }
                    });

                    globalSocket.on('stats', (data: StatsData) => {
                        setStats(data);
                        console.log('📈 Stats:', data);
                    });

                    globalSocket.on('error', (err: any) => {
                        console.error('Server error:', err);
                        setError(err.message || 'Server error');
                    });

                    globalSocket.on('connect_error', (err: Error) => {
                        console.error('Connection error:', err);
                        setError('Cannot connect to server. Is it running on port 5000?');
                    });

                    globalSocket.on('pong', () => {
                        // Keep alive response
                    });

                    globalSocket._handlersSet = true;
                }
                socketRef.current = globalSocket;

                // Start ping interval
                pingIntervalRef.current = setInterval(() => {
                    if (socketRef.current?.connected) {
                        socketRef.current.emit('ping');
                    }
                }, 30000);

            } catch (err) {
                console.error('Socket initialization failed:', err);
                setError('Socket initialization failed');
            }
        };

        initSocket();

        return () => {
            socketUsers--;
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
            if (socketUsers <= 0 && globalSocket) {
                globalSocket.disconnect();
                globalSocket = null;
            }
        };
    }, []);

    const startLive = async () => {
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
            setError(null);
            setCaptionHistory([]);
            setCurrentText('Listening...');
            setStats(null);
            audioBufferRef.current = [];
            lastSendTimeRef.current = Date.now();
            isStoppingRef.current = false;

            console.log('✅ Recording started');

        } catch (err: any) {
            console.error('❌ Microphone error:', err);
            setError(err.message || 'Microphone access denied');
            stopLive();
        }
    };

    const sendAudioBuffer = () => {
        if (audioBufferRef.current.length === 0 || !socketRef.current?.connected || isStoppingRef.current) {
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

            socketRef.current.emit('audio_chunk', base64);
            audioBufferRef.current = [];

        } catch (err) {
            console.error('❌ Error sending audio:', err);
        }
    };

    const stopLive = () => {
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
        if (socketRef.current?.connected) {
            socketRef.current.emit('stop_recording');
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
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isLive) {
                stopLive();
            }
        };
    }, []);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">

            {/* Animated gradient orbs */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-1/4 -left-48 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-cyan-600/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
                {/* Header */}
                <header className="border-b border-white/5 bg-slate-900/50 backdrop-blur-xl">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                    </svg>
                                </div>
                                {status === 'Connected' && (
                                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse" />
                                )}
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold">Live Transcription</h1>
                                <p className="text-xs text-slate-400">
                                    {serverInfo ? `${serverInfo.model} • ${serverInfo.device}` : status}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Mic level indicator */}
                            {isLive && (
                                <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
                                    <svg className="w-4 h-4 text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                                    </svg>
                                    <div className="flex gap-0.5 items-end h-4">
                                        {[...Array(8)].map((_, i) => (
                                            <div
                                                key={i}
                                                className="w-1 bg-gradient-to-t from-cyan-500 to-violet-500 rounded-full transition-all duration-100"
                                                style={{
                                                    height: `${Math.max(4, Math.min(16, (micLevel / 100) * 16 * (i + 1) / 8))}px`,
                                                    opacity: micLevel > (i * 12.5) ? 1 : 0.3
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={isLive ? stopLive : startLive}
                                disabled={status !== 'Connected' || isStoppingRef.current}
                                className={`px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${isLive
                                    ? 'bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 shadow-lg shadow-red-500/25'
                                    : 'bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 shadow-lg shadow-violet-500/25 disabled:opacity-50 disabled:cursor-not-allowed'
                                    }`}
                            >
                                {isLive ? (
                                    <>
                                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                        Stop Recording
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                        </svg>
                                        Start Recording
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Main content */}
                <main className="max-w-6xl mx-auto px-6 py-16">
                    <div className="space-y-8">
                        {/* Previous captions */}
                        {captionHistory.slice(0, -1).length > 0 && (
                            <div className="space-y-4">
                                {captionHistory.slice(0, -1).map((cap, idx) => (
                                    <div
                                        key={cap.id}
                                        className="p-6 rounded-2xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm transition-all duration-500"
                                        style={{ opacity: 0.3 + (idx * 0.2) }}
                                    >
                                        <p className="text-2xl text-slate-300 leading-relaxed">
                                            {cap.text}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Current caption */}
                        <div className="relative">
                            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600 to-cyan-600 rounded-3xl opacity-20 blur-xl" />
                            <div className="relative p-8 rounded-3xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-pulse" />
                                    <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                                        {isLive ? 'Live' : 'Ready'}
                                    </span>
                                </div>
                                <p className="text-4xl md:text-5xl font-semibold leading-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
                                    {currentText || (isLive ? "Listening..." : "Ready to transcribe")}
                                </p>
                            </div>
                        </div>

                        {/* Stats */}
                        {isLive && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Inference Time', value: `${inferenceTime.toFixed(2)}s`, icon: '⚡' },
                                    { label: 'Chunk Size', value: '5s', icon: '📊' },
                                    { label: 'Transcriptions', value: captionHistory.length, icon: '✓' },
                                    { label: 'Avg Latency', value: stats ? `${stats.avg_latency.toFixed(2)}s` : '-', icon: '⏱️' },
                                ].map((stat, i) => (
                                    <div key={i} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/30 backdrop-blur-sm">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-lg">{stat.icon}</span>
                                            <span className="text-xs text-slate-400">{stat.label}</span>
                                        </div>
                                        <p className="text-2xl font-semibold text-white">{stat.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Additional stats */}
                        {stats && stats.dropped_chunks > 0 && (
                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 backdrop-blur-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-yellow-500">⚠️</span>
                                    <span className="text-sm text-yellow-200">
                                        {stats.dropped_chunks} chunks dropped due to processing overload
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </main>

                {/* Error notification */}
                {error && (
                    <div className="fixed bottom-6 right-6 max-w-md z-50">
                        <div className="p-4 rounded-xl bg-red-500/90 backdrop-blur-xl border border-red-400/50 shadow-xl shadow-red-500/20">
                            <div className="flex items-start gap-3">
                                <svg className="w-5 h-5 text-white flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                                <div className="flex-1">
                                    <p className="font-semibold text-white">Error</p>
                                    <p className="text-sm text-red-100 mt-1">{error}</p>
                                </div>
                                <button
                                    onClick={() => setError(null)}
                                    className="text-white/80 hover:text-white"
                                >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}