'use client';

import SubtitleOverlay from '@/src/components/SubtitleOverlay';
import { useBidirectionalAudio } from '@/src/hooks/useBidirectionalAudio';
import { useState } from 'react';

export default function Home() {
    const [isConfigured] = useState(true);

    // Outgoing audio capture (microphone)
    const {
        outgoingTranscript,
        isListening,
        startCapture,
        stopCapture,
        error: audioError,
    } = useBidirectionalAudio();

    const handleStart = async () => {
        console.log('[Page] handleStart called');
        try {
            await startCapture();
            console.log('[Page] startCapture completed');
        } catch (err) {
            console.error('[Page] Error in startCapture:', err);
        }
    };

    const handleStop = () => {
        stopCapture();
    };

    const error = audioError || null;
    const mainDisplayText = outgoingTranscript || '';

    return (
        <div
            className="w-full h-full flex items-start justify-start pointer-events-none"
        >
            <div className="w-full h-full">
                {/* Main subtitle overlay - Always show for controls */}
                <SubtitleOverlay
                    text={mainDisplayText}
                    isActive={isListening}
                    onStart={handleStart}
                    onStop={handleStop}
                    isConfigured={isConfigured}
                    error={error}
                />


                {/* Outgoing subtitle card */}
                {outgoingTranscript && (
                    <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 pointer-events-none z-30 max-w-5xl px-4">
                        <div className="bg-green-900/90 text-green-100 px-6 py-3 rounded-lg text-base text-center backdrop-blur-md border border-green-700/50 shadow-xl">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                <span className="text-green-400 text-xs font-semibold">
                                    You
                                </span>
                            </div>
                            <div className="text-green-100 text-lg font-medium break-words">
                                {outgoingTranscript || 'Waiting for your speech...'}
                            </div>
                        </div>
                    </div>
                )}


            </div>
        </div>
    );
}