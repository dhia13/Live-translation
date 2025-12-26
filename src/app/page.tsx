'use client';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useState } from 'react';
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
        captionId,
        setError: setSocketError,
        sendTranslationConfig,
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
                />

                <main className="max-w-6xl mx-auto px-6 py-16">
                    <div className="space-y-8">
                        {captionHistory.length > 0 && (
                            <Card className="mb-4 bg-zinc-900/50 border-zinc-800">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-lg font-semibold text-zinc-100">
                                        History ({captionHistory.length})
                                    </CardTitle>
                                    <SaveDialog captions={captionHistory} targetLanguage={targetLanguage} />
                                </CardHeader>
                            </Card>
                        )}
                        {captionHistory.slice(0, -1).length > 0 && (
                            <CaptionHistory
                                captions={captionHistory.slice(0, -1)}
                                targetLanguage={targetLanguage}
                            />
                        )}

                        <CurrentCaption
                            currentText={currentText}
                            currentTranslation={currentTranslation}
                            detectedLanguage={detectedLanguage}
                            targetLanguage={targetLanguage}
                            isLive={isLive}
                        />

                        <StatsPanel
                            isLive={isLive}
                            inferenceTime={inferenceTime}
                            translationTime={translationTime}
                            translationEnabled={translationEnabled}
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
