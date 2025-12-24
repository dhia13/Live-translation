'use client';

import { useEffect, useRef, useState } from 'react';

interface SubtitleOverlayProps {
    text: string;
    isActive: boolean;
    onStart: () => void;
    onStop: () => void;
    isConfigured: boolean;
    error?: string | null;
}

export default function SubtitleOverlay({
    text,
    isActive,
    onStart,
    onStop,
    isConfigured,
    error,
}: SubtitleOverlayProps) {
    const [showControls, setShowControls] = useState(true);
    const [showSettings, setShowSettings] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [opacity, setOpacity] = useState(1.0);
    const [enableIncoming, setEnableIncoming] = useState(true);
    const [enableOutgoing, setEnableOutgoing] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Auto-hide controls after 3 seconds if not hovering
    useEffect(() => {
        if (!isHovering && !isActive) {
            const timer = setTimeout(() => setShowControls(false), 3000);
            return () => clearTimeout(timer);
        } else {
            setShowControls(true);
        }
    }, [isHovering, isActive]);

    const handleSave = async () => {
        if (!window.electronAPI) {
            setMessage({ type: 'error', text: 'Electron API not available' });
            return;
        }

        setSaving(true);
        setMessage(null);

        try {
            setMessage({ type: 'success', text: 'Settings saved!' });
            setTimeout(() => {
                setShowSettings(false);
                window.location.reload();
            }, 1500);
        } catch (error: any) {
            setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
        } finally {
            setSaving(false);
        }
    };



    return (
        <div
            ref={containerRef}
            className="w-full h-full pointer-events-auto relative"
            onMouseEnter={() => {
                setIsHovering(true);
                setShowControls(true);
            }}
            onMouseLeave={() => setIsHovering(false)}
        >

            {/* Subtitle Display */}
            <div
                className="w-full h-full px-10 py-6 bg-gradient-to-b from-black/90 via-black/85 to-black/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl relative overflow-visible"
                style={{
                    position: 'relative',
                    zIndex: 10,
                    pointerEvents: 'auto'
                } as React.CSSProperties}
            >
                {/* Control Icons - Right Side */}
                <div
                    className={`absolute top-3 right-3 flex items-center gap-2 transition-all duration-300 z-30 ${showControls || isHovering
                        ? 'opacity-100 translate-x-0'
                        : 'opacity-0 translate-x-2'
                        }`}
                    style={{
                        pointerEvents: (showControls || isHovering) ? 'auto' : 'none'
                    } as React.CSSProperties}
                >
                    {/* Start/Stop Button */}
                    <button
                        onClick={(e) => {
                            console.log('[SubtitleOverlay] Button clicked, isActive:', isActive, 'isConfigured:', isConfigured);
                            e.preventDefault();
                            e.stopPropagation();
                            if (isActive) {
                                onStop();
                            } else {
                                onStart();
                            }
                        }}
                        disabled={!isConfigured}
                        className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${isActive
                            ? 'bg-red-600/90 hover:bg-red-700 text-white'
                            : 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
                            } ${!isConfigured ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
                        title={isActive ? 'Stop transcription' : 'Start transcription'}
                    >
                        {isActive ? (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                            </svg>
                        )}
                    </button>

                    {/* Settings/Error/Warning Button - Merged */}
                    <button
                        onClick={() => {
                            if (error || !isConfigured) {
                                setShowSettings(true);
                            } else {
                                setShowSettings(!showSettings);
                            }
                        }}
                        className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${error
                            ? 'bg-red-500/90 hover:bg-red-600 text-white animate-shake'
                            : !isConfigured
                                ? 'bg-amber-500/90 hover:bg-amber-600 text-white'
                                : showSettings
                                    ? 'bg-blue-600/90 hover:bg-blue-700 text-white'
                                    : 'bg-slate-700/90 hover:bg-slate-600 text-white'
                            }`}
                        title={error || !isConfigured ? (error || 'Ready to transcribe') : 'Settings'}
                    >
                        {error ? (
                            // Error icon
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                        ) : !isConfigured ? (
                            // Warning icon for missing keys
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            // Settings icon
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        )}
                    </button>
                </div>

                {/* Animated background gradient */}
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-emerald-500/5 animate-pulse"></div>
                )}

                <div className="relative z-10 pr-20 h-full flex flex-col" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                    {showSettings ? (
                        /* Settings Form */
                        <div className="space-y-5 animate-fadeIn overflow-y-auto max-h-[calc(100vh-4rem)] pr-2" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                            {/* Header */}
                            <div className="flex items-center justify-between mb-2 pb-3 border-b border-gray-700">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    Settings
                                    {loadingSettings && (
                                        <svg className="animate-spin h-4 w-4 text-blue-400 ml-2" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                    )}
                                </h3>
                            </div>

                            {loadingSettings ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="flex flex-col items-center gap-2">
                                        <svg className="animate-spin h-8 w-8 text-blue-400" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                        </svg>
                                        <span className="text-gray-400 text-sm">Loading settings...</span>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {/* Window Opacity Control */}
                                    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/50">
                                        <label className="flex text-xs font-semibold text-gray-300 mb-2 items-center gap-1.5">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                            </svg>
                                            Window Opacity: {Math.round(opacity * 100)}%
                                        </label>
                                        <input
                                            type="range"
                                            min="0.1"
                                            max="1"
                                            step="0.05"
                                            value={opacity}
                                            onChange={(e) => setOpacity(parseFloat(e.target.value))}
                                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                        />
                                        <div className="flex justify-between text-xs text-gray-400 mt-1">
                                            <span>10%</span>
                                            <span>100%</span>
                                        </div>
                                    </div>

                                    {/* Transcription Provider Settings */}
                                    <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                                        <h3 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
                                            <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                                            </svg>
                                            Transcription Provider
                                        </h3>
                                        <div className="flex items-center justify-between mb-3">
                                            <div className="flex-1">
                                                <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                                                    Transcription Method
                                                </label>
                                                <p className="text-xs text-gray-400 mt-0.5">Using local Whisper transcription</p>
                                            </div>
                                        </div>
                                        {/* Audio Settings */}
                                        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                                            <h3 className="text-xs font-semibold text-gray-300 mb-3 flex items-center gap-1.5">
                                                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                                </svg>
                                                Audio Settings
                                            </h3>

                                            {/* Incoming Audio Toggle */}
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex-1">
                                                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                                        </svg>
                                                        Enable Incoming Audio
                                                    </label>
                                                    <p className="text-xs text-gray-400 mt-0.5">Capture and transcribe incoming audio</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEnableIncoming(!enableIncoming)}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${enableIncoming ? 'bg-blue-600' : 'bg-gray-600'
                                                        }`}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableIncoming ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                    />
                                                </button>
                                            </div>

                                            {/* Outgoing Audio Toggle */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <label className="text-xs font-medium text-gray-300 flex items-center gap-2">
                                                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                        </svg>
                                                        Enable Outgoing Audio
                                                    </label>
                                                    <p className="text-xs text-gray-400 mt-0.5">Capture and transcribe your microphone</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setEnableOutgoing(!enableOutgoing)}
                                                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${enableOutgoing ? 'bg-green-600' : 'bg-gray-600'
                                                        }`}
                                                >
                                                    <span
                                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${enableOutgoing ? 'translate-x-5' : 'translate-x-0'
                                                            }`}
                                                    />
                                                </button>
                                            </div>
                                        </div>




                                        {/* Message */}
                                        {message && (
                                            <div className={`p-3 rounded-lg border backdrop-blur-sm text-xs ${message.type === 'success'
                                                ? 'bg-green-500/20 text-green-300 border-green-500/30'
                                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                                                }`}>
                                                <div className="flex items-start gap-2">
                                                    {message.type === 'success' ? (
                                                        <svg className="w-4 h-4 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-4 h-4 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                    <span className="font-medium">{message.text}</span>
                                                </div>
                                            </div>
                                        )}


                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Subtitle Text */
                        <div className="flex-1 flex flex-col justify-center items-center select-none" style={{ pointerEvents: 'auto' } as React.CSSProperties}>
                            <p
                                className={`text-white text-center text-3xl font-semibold leading-relaxed transition-all duration-300 select-none ${text ? 'opacity-100 scale-100' : 'opacity-40 scale-95'
                                    }`}
                                style={{
                                    textShadow: '0 2px 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)',
                                    userSelect: 'none',
                                    WebkitUserSelect: 'none',
                                }}
                            >
                                {text || (isActive ? 'Listening...' : 'Ready to transcribe')}
                            </p>

                            {/* Status Indicator */}
                            <div className="flex justify-center items-center gap-2 mt-4 select-none">
                                {isActive ? (
                                    <>
                                        <div className="flex gap-1.5">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                        </div>
                                        <span className="text-xs text-emerald-300 font-medium select-none">Live</span>
                                    </>
                                ) : (
                                    <span className="text-xs text-gray-400 font-medium select-none">Idle</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

