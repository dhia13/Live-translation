import { useEffect, useRef, useState, useCallback } from 'react';
import { TranscriptionData, StatusData, StatsData, TranslationConfig, Voice } from '../types';

let globalSocket: any = null;
let socketUsers = 0;

interface UseSocketReturn {
    socket: any;
    status: string;
    error: string | null;
    serverInfo: { device: string; model: string; tts_available?: boolean } | null;
    stats: StatsData | null;
    currentText: string;
    currentTranslation: string;
    detectedLanguage: string | null;
    inferenceTime: number;
    translationTime: number;
    ttsTime: number;
    ttsAudio: string | null;
    ttsAvailable: boolean;
    voices: Voice[];
    captionId: React.MutableRefObject<number>;
    setError: (error: string | null) => void;
    sendTranslationConfig: (config: { source_language: string | null; target_language: string | null }) => void;
    sendTTSConfig: (config: { enabled: boolean; voice: string; speed: number }) => void;
    requestVoices: () => void;
}

export function useSocket(
    onTranscription: (data: TranscriptionData) => void
): UseSocketReturn {
    const [status, setStatus] = useState<string>('Disconnected');
    const [error, setError] = useState<string | null>(null);
    const [serverInfo, setServerInfo] = useState<{ device: string; model: string; tts_available?: boolean } | null>(null);
    const [stats, setStats] = useState<StatsData | null>(null);
    const [currentText, setCurrentText] = useState('');
    const [currentTranslation, setCurrentTranslation] = useState('');
    const [detectedLanguage, setDetectedLanguage] = useState<string | null>(null);
    const [inferenceTime, setInferenceTime] = useState<number>(0);
    const [translationTime, setTranslationTime] = useState<number>(0);
    const [ttsTime, setTTSTime] = useState<number>(0);
    const [ttsAudio, setTTSAudio] = useState<string | null>(null);
    const [ttsAvailable, setTTSAvailable] = useState<boolean>(false);
    const [voices, setVoices] = useState<Voice[]>([]);
    const socketRef = useRef<any>(null);
    const captionIdRef = useRef(0);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const onTranscriptionRef = useRef(onTranscription);

    // Update callback ref when it changes
    useEffect(() => {
        onTranscriptionRef.current = onTranscription;
    }, [onTranscription]);

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
                    });

                    globalSocket.on('reconnect', (attemptNumber: number) => {
                        console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
                        setStatus('Connected');
                        setError(null);
                    });

                    globalSocket.on('status', (data: StatusData) => {
                        console.log('📊 Server status:', data);
                        setServerInfo({
                            device: data.device,
                            model: data.model,
                            tts_available: data.tts_available
                        });
                        setTTSAvailable(data.tts_available || false);
                        setStatus('Connected');
                    });

                    globalSocket.on('transcription', (data: TranscriptionData) => {
                        if (data.text.trim()) {
                            setCurrentText(data.text);
                            setCurrentTranslation(data.translated_text || '');
                            setDetectedLanguage(data.language || null);

                            if (data.inference_time) {
                                setInferenceTime(data.inference_time);
                            }
                            if (data.translation_time) {
                                setTranslationTime(data.translation_time);
                            }
                            if (data.tts_time) {
                                setTTSTime(data.tts_time);
                            }
                            if (data.tts_audio) {
                                setTTSAudio(data.tts_audio);
                            }

                            onTranscriptionRef.current(data);

                            if (data.final) {
                                console.log('🏁 Final transcription received');
                            }
                        }
                    });

                    globalSocket.on('translation_config', (data: TranslationConfig) => {
                        console.log('🌐 Translation config confirmed:', data);
                    });

                    globalSocket.on('tts_config', (data: any) => {
                        console.log('🔊 TTS config confirmed:', data);
                        setTTSAvailable(data.available || false);
                    });

                    globalSocket.on('voices', (data: { voices: Voice[]; default: string }) => {
                        console.log('🎙️ Voices received:', data.voices.length);
                        setVoices(data.voices);
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

    const sendTranslationConfig = useCallback((config: { source_language: string | null; target_language: string | null }) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('set_translation', config);
        }
    }, []);

    const sendTTSConfig = useCallback((config: { enabled: boolean; voice: string; speed: number }) => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('set_tts', config);
        }
    }, []);

    const requestVoices = useCallback(() => {
        if (socketRef.current?.connected) {
            socketRef.current.emit('get_voices');
        }
    }, []);

    return {
        socket: socketRef.current,
        status,
        error,
        serverInfo,
        stats,
        currentText,
        currentTranslation,
        detectedLanguage,
        inferenceTime,
        translationTime,
        ttsTime,
        ttsAudio,
        ttsAvailable,
        voices,
        captionId: captionIdRef,
        setError,
        sendTranslationConfig,
        sendTTSConfig,
        requestVoices,
    };
}

