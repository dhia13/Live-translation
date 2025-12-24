'use client';

import { useEffect, useRef, useState } from 'react';

interface Caption {
    text: string;
    timestamp: number;
    id: number;
}

export default function SubtitleOverlay() {
    const [currentText, setCurrentText] = useState('');
    const [captionHistory, setCaptionHistory] = useState<Caption[]>([]);
    const [isLive, setIsLive] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [selectedFile, setSelectedFile] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [status, setStatus] = useState<string>('');
    const socketRef = useRef<any>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const captionIdRef = useRef(0);
    const audioContextRef = useRef<AudioContext | null>(null);

    useEffect(() => {
        console.log('Component mounted');

        // Setup for file transcription
        if (typeof window !== 'undefined' && window.electronAPI) {
            console.log('Electron API available');
        }

        // Cleanup on unmount
        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    const handleSelectFile = async () => {
        try {
            const path = await window.electronAPI?.selectAudioFile();
            if (path) {
                setSelectedFile(path);
                setError(null);
            }
        } catch (err) {
            console.error('Error selecting file:', err);
            setError('Failed to select file');
        }
    };

    const handleTranscribe = async () => {
        if (!selectedFile) return;

        setCurrentText('Transcribing...');
        setIsTranscribing(true);
        setError(null);

        try {
            const result = await window.electronAPI?.transcribeAudio(selectedFile);

            if (result?.success) {
                setCurrentText(result.text || 'No text returned');

                const newCaption: Caption = {
                    text: result.text || '',
                    timestamp: Date.now(),
                    id: captionIdRef.current++
                };
                setCaptionHistory(prev => [...prev, newCaption].slice(-5));
            } else {
                setError(result?.error || 'Transcription failed');
                setCurrentText('');
            }
        } catch (err: any) {
            setError(err.message || 'Unknown error');
            setCurrentText('');
        } finally {
            setIsTranscribing(false);
        }
    };

    const startLiveCaption = async () => {
        try {
            setCurrentText('Requesting microphone access...');
            setError(null);

            // Get microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            });

            console.log('Microphone access granted');
            setCurrentText('Connecting to server...');

            // Import socket.io-client dynamically
            const { io } = await import('socket.io-client');

            // Connect to Socket.IO server
            const socket = io('http://127.0.0.1:5000', {
                transports: ['websocket'],
                reconnection: true
            });
            socketRef.current = socket;

            socket.on('connect', () => {
                console.log('✓ Connected to Whisper server');
                setStatus('Connected');
                setCurrentText('Listening...');
                socket.emit('start_listening');
            });

            socket.on('transcription', (data: any) => {
                console.log('📝 Transcription:', data.text);
                setCurrentText(data.text);

                const newCaption: Caption = {
                    text: data.text,
                    timestamp: Date.now(),
                    id: captionIdRef.current++
                };
                setCaptionHistory(prev => [...prev, newCaption].slice(-5));
            });

            socket.on('status', (data: any) => {
                console.log('Server status:', data.message);
                setStatus(data.message);
            });

            socket.on('error', (data: any) => {
                console.error('Server error:', data.message);
                setError(data.message);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from server');
                setStatus('Disconnected');
            });

            // Create media recorder (WebM format)
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            // Handle audio data
            mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    console.log('Audio chunk received:', event.data.size, 'bytes');

                    try {
                        // Convert WebM to WAV using Web Audio API
                        const arrayBuffer = await event.data.arrayBuffer();
                        const audioContext = new AudioContext({ sampleRate: 16000 });
                        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

                        // Get mono channel
                        const float32Data = audioBuffer.getChannelData(0);

                        // Convert Float32Array to base64
                        const uint8Array = new Uint8Array(float32Data.buffer);
                        const base64Audio = btoa(String.fromCharCode(...uint8Array));

                        console.log('Sending audio to server:', float32Data.length, 'samples');

                        // Send to server
                        if (socket.connected) {
                            socket.emit('audio_chunk', { audio: base64Audio });
                        }

                        audioContext.close();
                    } catch (err) {
                        console.error('Error processing audio:', err);
                    }
                }
            };

            mediaRecorder.onerror = (event: any) => {
                console.error('MediaRecorder error:', event.error);
                setError('Recording error: ' + event.error);
            };

            // Start recording in 1-second chunks
            console.log('Starting audio recording...');
            mediaRecorder.start(1000); // Get data every 1 second
            setIsLive(true);

        } catch (err: any) {
            console.error('Failed to start live caption:', err);
            setError(err.message || 'Failed to access microphone');
            setCurrentText('');
            setIsLive(false);
        }
    };

    const stopLiveCaption = () => {
        console.log('Stopping live caption...');

        // Stop media recorder
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            mediaRecorderRef.current = null;
        }

        // Disconnect socket
        if (socketRef.current) {
            socketRef.current.emit('stop_listening');
            socketRef.current.disconnect();
            socketRef.current = null;
        }

        setIsLive(false);
        setCurrentText('');
        setStatus('');
        audioChunksRef.current = [];
    };

    const handleToggleLive = async () => {
        if (isLive) {
            stopLiveCaption();
        } else {
            await startLiveCaption();
        }
    };

    return (
        <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex flex-col items-center justify-center p-4">
            {error && (
                <div className="absolute top-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-md">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">⚠️</span>
                        <span className="font-medium">{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="ml-2 text-white hover:text-gray-200"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <div className="absolute top-8 left-8">
                <h1 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                    🎤 Live Translation
                </h1>
                <p className="text-gray-300 text-sm">
                    Real-time Speech-to-Text with Whisper
                </p>
            </div>

            <div className="absolute top-8 right-8 flex gap-3">
                <button
                    onClick={handleSelectFile}
                    disabled={isTranscribing || isLive}
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg text-white font-medium shadow-lg transition-all transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none"
                >
                    📁 Select File
                </button>

                {selectedFile && !isLive && (
                    <button
                        onClick={handleTranscribe}
                        disabled={isTranscribing}
                        className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-lg text-white font-medium shadow-lg transition-all transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isTranscribing ? '⏳ Transcribing...' : '▶️ Transcribe'}
                    </button>
                )}

                <button
                    onClick={handleToggleLive}
                    disabled={isTranscribing}
                    className={`px-5 py-2.5 rounded-lg text-white font-medium shadow-lg transition-all transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none ${isLive
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                >
                    {isLive ? '⏹ Stop Live' : '🎙️ Start Live'}
                </button>
            </div>

            {selectedFile && !isLive && (
                <div className="absolute top-24 right-8 bg-gray-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg text-sm shadow-lg">
                    <span className="text-gray-400">File: </span>
                    <span className="font-medium">{selectedFile.split('\\').pop()}</span>
                </div>
            )}

            <div className="w-full max-w-6xl flex flex-col gap-4">
                {captionHistory.length > 0 && (
                    <div className="bg-black/40 backdrop-blur-md rounded-xl p-4 max-h-48 overflow-y-auto space-y-2">
                        {captionHistory.map((caption) => (
                            <div
                                key={caption.id}
                                className="bg-gray-800/60 rounded-lg px-4 py-2 text-gray-300 text-lg animate-fade-in"
                            >
                                {caption.text}
                            </div>
                        ))}
                    </div>
                )}

                <div className="bg-black/70 backdrop-blur-xl rounded-2xl p-10 shadow-2xl border-2 border-purple-500/30 min-h-[200px] flex items-center justify-center">
                    {isTranscribing && (
                        <div className="flex justify-center mb-4">
                            <div className="flex space-x-2">
                                <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                        </div>
                    )}

                    <p className="text-white text-4xl font-semibold text-center leading-relaxed">
                        {currentText || 'Select a file or start live caption...'}
                    </p>
                </div>
            </div>

            <div className="absolute bottom-8 flex items-center gap-4">
                {isLive && (
                    <div className="flex items-center gap-2 bg-red-600/90 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg">
                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                        <span className="text-white font-medium">LIVE</span>
                    </div>
                )}

                {status && (
                    <div className="bg-gray-800/80 backdrop-blur-sm text-gray-300 rounded-full px-4 py-2 text-sm shadow-lg">
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}