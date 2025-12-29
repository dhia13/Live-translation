'use client';
import { useCallback, useEffect, useState, useRef } from 'react';
import BackgroundOrbs from './components/BackgroundOrbs';
import CaptionHistory from './components/CaptionHistory';
import CurrentCaption from './components/CurrentCaption';
import ErrorNotification from './components/ErrorNotification';
import Header from './components/Header';
import SaveDialog from './components/SaveDialog';
import SettingsPanel from './components/SettingsPanel';
import StatsPanel from './components/StatsPanel';
import { useAudioRecording } from './hooks/useAudioRecording';
import { useSocket } from './hooks/useSocket';
import { useTranscription } from './hooks/useTranscription';
import { useTranslation } from './hooks/useTranslation';
import { TranscriptionData } from './types';

export default function LiveTranslator() {
    const [showSettings, setShowSettings] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Transcription management
    const { captionHistory, addTranscription, clearHistory } = useTranscription();

    // TTS state
    const [ttsEnabled, setTTSEnabled] = useState(false);
    const [ttsVoice, setTTSVoice] = useState('af_heart');
    const [ttsSpeed, setTTSSpeed] = useState(1.0);
    const [isPlayingTTS, setIsPlayingTTS] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioQueueRef = useRef<string[]>([]);
    const isProcessingAudioRef = useRef(false);

    // Socket connection
    const {
        socket,
        status,
        error: socketError,
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
        captionId,
        setError: setSocketError,
        sendTranslationConfig,
        sendTTSConfig,
        requestVoices,
    } = useSocket((data: TranscriptionData) => {
        addTranscription(data, captionId.current++);
    });

    // Update error state from socket
    useEffect(() => {
        setError(socketError);
    }, [socketError]);

    // Audio recording
    const handleRecordingStart = useCallback(() => {
        clearHistory();
        setError(null);
    }, [clearHistory]);

    const handleRecordingStop = useCallback(() => {
        // Cleanup handled in hook
    }, []);

    const {
        isLive,
        micLevel,
        startLive,
        stopLive,
        isStopping,
    } = useAudioRecording(socket, handleRecordingStart, handleRecordingStop);

    // Translation settings
    const {
        sourceLanguage,
        targetLanguage,
        translationEnabled,
        setSourceLanguage,
        setTargetLanguage,
        setTranslationEnabled,
    } = useTranslation(isLive, sendTranslationConfig);

    // Initialize AudioContext
    useEffect(() => {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        return () => {
            if (audioContextRef.current) {
                audioContextRef.current.close();
            }
        };
    }, []);

    // Play TTS audio when received
    const playTTSAudio = useCallback(async (base64Audio: string) => {
        if (!audioContextRef.current || !base64Audio) return;

        try {
            // Decode base64 to ArrayBuffer
            const binaryString = atob(base64Audio);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }

            // Decode audio data
            const audioBuffer = await audioContextRef.current.decodeAudioData(bytes.buffer);

            // Create source node
            const source = audioContextRef.current.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContextRef.current.destination);

            setIsPlayingTTS(true);
            source.onended = () => setIsPlayingTTS(false);
            source.start(0);
        } catch (error) {
            console.error('Error playing TTS audio:', error);
            setIsPlayingTTS(false);
        }
    }, []);

    // Auto-play TTS audio when received
    useEffect(() => {
        if (ttsAudio && ttsEnabled) {
            playTTSAudio(ttsAudio);
        }
    }, [ttsAudio, ttsEnabled, playTTSAudio]);

    // Send TTS config when settings change or when going live
    useEffect(() => {
        if (socket?.connected) {
            sendTTSConfig({ enabled: ttsEnabled, voice: ttsVoice, speed: ttsSpeed });
        }
    }, [ttsEnabled, ttsVoice, ttsSpeed, isLive, socket, sendTTSConfig]);

    // Request voices when connected
    useEffect(() => {
        if (status === 'Connected') {
            requestVoices();
        }
    }, [status, requestVoices]);

    // Monitor connection and auto-stop if disconnected
    useEffect(() => {
        const checkConnection = setInterval(() => {
            if (isLive && socket && !socket.connected) {
                console.warn('Connection lost while recording');
                setError('Connection lost - stopping recording');
                stopLive();
            }
        }, 2000);

        return () => clearInterval(checkConnection);
    }, [isLive, socket, stopLive]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (isLive) {
                stopLive();
            }
        };
    }, [isLive, stopLive]);

    const handleStartStop = useCallback(() => {
        if (isLive) {
            stopLive();
        } else {
            startLive();
        }
    }, [isLive, startLive, stopLive]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
            <BackgroundOrbs />

            <div className="relative z-10">
                <Header
                    status={status}
                    serverInfo={serverInfo}
                    isLive={isLive}
                    micLevel={micLevel}
                    isStopping={isStopping.current}
                    onToggleSettings={() => setShowSettings(!showSettings)}
                    onStartStop={handleStartStop}
                />

                <SettingsPanel
                    open={showSettings}
                    onOpenChange={setShowSettings}
                    translationEnabled={translationEnabled}
                    sourceLanguage={sourceLanguage}
                    targetLanguage={targetLanguage}
                    detectedLanguage={detectedLanguage}
                    isLive={isLive}
                    onToggleTranslation={() => setTranslationEnabled(!translationEnabled)}
                    onSourceLanguageChange={setSourceLanguage}
                    onTargetLanguageChange={setTargetLanguage}
                    // TTS props
                    ttsEnabled={ttsEnabled}
                    ttsAvailable={ttsAvailable}
                    ttsVoice={ttsVoice}
                    ttsSpeed={ttsSpeed}
                    voices={voices}
                    isPlayingTTS={isPlayingTTS}
                    onToggleTTS={() => setTTSEnabled(!ttsEnabled)}
                    onTTSVoiceChange={setTTSVoice}
                    onTTSSpeedChange={setTTSSpeed}
                />

                <main className="max-w-6xl mx-auto px-6 py-16">
                    <div className="space-y-6">
                        {/* Save button when there's history */}
                        {captionHistory.length > 0 && (
                            <div className="flex justify-end">
                                <SaveDialog captions={captionHistory} targetLanguage={targetLanguage} />
                            </div>
                        )}

                        {/* Current caption - always on top */}
                        <CurrentCaption
                            currentText={currentText}
                            currentTranslation={currentTranslation}
                            detectedLanguage={detectedLanguage}
                            targetLanguage={targetLanguage}
                            isLive={isLive}
                        />

                        {/* History stacks below current, fading toward bottom */}
                        {captionHistory.length > 0 && (
                            <CaptionHistory
                                captions={captionHistory}
                                targetLanguage={targetLanguage}
                            />
                        )}

                        <StatsPanel
                            isLive={isLive}
                            inferenceTime={inferenceTime}
                            translationTime={translationTime}
                            ttsTime={ttsTime}
                            translationEnabled={translationEnabled}
                            ttsEnabled={ttsEnabled}
                            captionCount={captionHistory.length}
                            stats={stats}
                        />
                    </div>
                </main>

                {error && (
                    <ErrorNotification
                        error={error}
                        onDismiss={() => {
                            setError(null);
                            setSocketError(null);
                        }}
                    />
                )}
            </div>
        </div>
    );
}
