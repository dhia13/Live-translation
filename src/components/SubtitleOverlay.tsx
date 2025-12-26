import { useEffect, useRef, useState } from 'react';

interface Caption {
    text: string;
    timestamp: number;
    id: number;
}

// Global Socket.IO connection singleton
let globalSocket: any = null;
let socketUsers = 0;

export default function SubtitleOverlay() {
    const [currentText, setCurrentText] = useState('');
    const [captionHistory, setCaptionHistory] = useState<Caption[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('Disconnected');
    const [micLevel, setMicLevel] = useState(0);

    const socketRef = useRef<any>(null);
    const streamsRef = useRef<MediaStream[]>([]);
    const captionIdRef = useRef(0);
    const animationIdRef = useRef<number | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        socketUsers++;

        const initSocket = async () => {
            try {
                if (!globalSocket) {
                    const { io } = await import('socket.io-client');
                    globalSocket = io('http://127.0.0.1:5000', {
                        transports: ['websocket'],
                        reconnection: true,
                    });
                }

                if (!globalSocket._handlersSet) {
                    globalSocket.on('connect', () => setStatus('Connected'));
                    globalSocket.on('disconnect', () => setStatus('Disconnected'));

                    // Matches the 'translation' or 'transcription' event from Python
                    globalSocket.on('translation', (data: { text: string }) => {
                        if (data.text.trim()) {
                            setCurrentText(data.text);
                            const newCap = {
                                text: data.text,
                                timestamp: Date.now(),
                                id: captionIdRef.current++
                            };
                            setCaptionHistory(prev => [...prev, newCap].slice(-4));
                        }
                    });

                    globalSocket.on('error', (err: any) => setError(err.message));
                    globalSocket._handlersSet = true;
                }
                socketRef.current = globalSocket;
            } catch (err) {
                setError('Socket initialization failed');
            }
        };

        initSocket();

        return () => {
            socketUsers--;
            if (socketUsers <= 0 && globalSocket) {
                globalSocket.disconnect();
                globalSocket = null;
            }
        };
    }, []);

    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(blob);
        });
    };

    const startLive = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000 }
            });
            streamsRef.current = [stream];

            // 1. Start Audio Analysis for UI
            const ctx = new AudioContext();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            const dataArray = new Uint8Array(analyser.frequencyBinCount);

            const draw = () => {
                analyser.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setMicLevel(Math.min(average * 1.5, 100));
                animationIdRef.current = requestAnimationFrame(draw);
            };
            draw();

            // 2. Start Recording Chunks
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = async (e) => {
                if (e.data.size > 0 && socketRef.current?.connected) {
                    const base64 = await blobToBase64(e.data);
                    // Send to Python server
                    socketRef.current.emit('audio_chunk', base64);
                }
            };

            // Send a chunk every 1 second (optimal for Whisper GPU context)
            recorder.start(1000);
            setIsLive(true);
            setError(null);
        } catch (err) {
            setError('Microphone access denied');
        }
    };

    const stopLive = () => {
        mediaRecorderRef.current?.stop();
        if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
        audioContextRef.current?.close();
        streamsRef.current.forEach(s => s.getTracks().forEach(t => t.stop()));
        setIsLive(false);
        setMicLevel(0);
    };

    return (
        <div className="fixed inset-0 bg-[#0a0a0c] text-white flex flex-col font-sans selection:bg-blue-500/30">

            {/* Top Navigation Bar */}
            <header className="p-6 flex justify-between items-center border-b border-white/5 bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            AI LIVE TRANSLATOR
                        </h2>
                        <span className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">
                            {status} • NVIDIA/INTEL GPU ACCELERATED
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {/* Professional Mic Meter */}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Input</span>
                        <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-400 transition-all duration-75"
                                style={{ width: `${micLevel}%` }}
                            />
                        </div>
                    </div>

                    <button
                        onClick={isLive ? stopLive : startLive}
                        className={`px-8 py-2.5 rounded-full font-black text-sm transition-all duration-300 transform active:scale-95 ${isLive
                            ? 'bg-red-500 hover:bg-red-600 shadow-[0_0_20px_rgba(239,68,68,0.4)]'
                            : 'bg-white text-black hover:bg-gray-200 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
                            }`}
                    >
                        {isLive ? 'STOP SESSION' : 'START LIVE CAPTIONS'}
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col items-center justify-center px-12 pb-24 relative overflow-hidden">

                {/* Background Decorative Element */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-900/10 blur-[120px] rounded-full -z-10"></div>

                <div className="w-full max-w-5xl space-y-8">

                    {/* Subtitle History (Faded) */}
                    <div className="space-y-4 opacity-30 transition-all duration-700">
                        {captionHistory.slice(0, -1).map((cap) => (
                            <p key={cap.id} className="text-3xl font-medium leading-tight">
                                {cap.text}
                            </p>
                        ))}
                    </div>

                    {/* Active Subtitle (Bright) */}
                    <div className="relative pt-8">
                        <div className="absolute -top-4 left-0 text-[10px] font-black text-blue-500 tracking-[0.3em] uppercase">
                            Current Stream
                        </div>
                        <p className="text-6xl md:text-7xl font-bold leading-[1.15] tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                            {currentText || (isLive ? "Listening to audio..." : "System Ready.")}
                        </p>
                    </div>
                </div>
            </main>

            {/* Error Bar */}
            {error && (
                <div className="absolute bottom-0 w-full bg-red-500/90 backdrop-blur-md p-3 text-center text-sm font-bold uppercase tracking-widest animate-slide-up">
                    ⚠️ SYSTEM ERROR: {error}
                </div>
            )}

            <footer className="p-6 border-t border-white/5 bg-black/20 text-[10px] text-gray-600 font-mono flex justify-between">
                <div>WHISPER_ENGINE_STABLE_V3</div>
                <div className="flex gap-4">
                    <span>LATENCY: ~240MS</span>
                    <span>GPU_LOAD: 12%</span>
                </div>
            </footer>
        </div>
    );
}