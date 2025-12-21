'use client';

import { useState, useEffect, useRef } from 'react';

// Helper function to get missing keys message
function getMissingKeysMessage(missingKeys: { deepgram: boolean; deepl: boolean }): string {
  const missing: string[] = [];
  if (missingKeys.deepgram) missing.push('Deepgram');
  if (missingKeys.deepl) missing.push('DeepL');
  
  if (missing.length === 0) return 'Ready to translate';
  if (missing.length === 1) return `${missing[0]} key is missing`;
  return `${missing.join(' and ')} keys are missing`;
}

// Helper function to get missing keys status text
function getMissingKeysStatus(missingKeys: { deepgram: boolean; deepl: boolean }): string {
  const missing: string[] = [];
  if (missingKeys.deepgram) missing.push('Deepgram');
  if (missingKeys.deepl) missing.push('DeepL');
  
  if (missing.length === 0) return 'Idle';
  if (missing.length === 1) return `${missing[0]} Missing`;
  return 'Keys Missing';
}

interface SubtitleOverlayProps {
  text: string;
  isActive: boolean;
  onStart: () => void;
  onStop: () => void;
  isConfigured: boolean;
  missingKeys?: { deepgram: boolean; deepl: boolean };
  error?: string | null;
}

export default function SubtitleOverlay({
  text,
  isActive,
  onStart,
  onStop,
  isConfigured,
  missingKeys = { deepgram: false, deepl: false },
  error,
}: SubtitleOverlayProps) {
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [deepgramKey, setDeepgramKey] = useState('');
  const [deeplKey, setDeeplKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState({ deepgram: false, deepl: false });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [opacity, setOpacity] = useState(1.0);
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

  // Load API keys and opacity when settings opens
  useEffect(() => {
    if (showSettings && typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getApiKeys().then((keys) => {
        setDeepgramKey(keys.deepgram || '');
        setDeeplKey(keys.deepl || '');
      });
      window.electronAPI.getWindowOpacity().then((currentOpacity) => {
        setOpacity(currentOpacity);
      });
      setMessage(null);
    }
  }, [showSettings]);

  // Update window opacity when slider changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.setWindowOpacity(opacity);
    }
  }, [opacity]);

  // Update window height based on content (debounced to prevent flickering)
  useEffect(() => {
    if (containerRef.current && typeof window !== 'undefined' && window.electronAPI) {
      let timeoutId: NodeJS.Timeout;
      
      const updateHeight = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          const height = containerRef.current?.scrollHeight || 140;
          // No title bar, so just use content height
          const totalHeight = height;
          window.electronAPI?.setWindowHeight(totalHeight);
        }, 100); // Debounce by 100ms to prevent flickering during resize
      };

      // Update height when content changes
      updateHeight();
      
      // Use ResizeObserver to watch for content size changes
      const resizeObserver = new ResizeObserver(() => {
        updateHeight();
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        clearTimeout(timeoutId);
        resizeObserver.disconnect();
      };
    }
  }, [showSettings, text, message]);

  const handleSave = async () => {
    if (!window.electronAPI) {
      setMessage({ type: 'error', text: 'Electron API not available' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      await window.electronAPI.setApiKeys({
        deepgram: deepgramKey.trim() || undefined,
        deepl: deeplKey.trim() || undefined,
      });
      setMessage({ type: 'success', text: 'API keys saved!' });
      setTimeout(() => {
        setShowSettings(false);
        // Reload page to update isConfigured state
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
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >

      {/* Subtitle Display */}
      <div 
        className="w-full h-full px-10 py-6 bg-gradient-to-b from-black/90 via-black/85 to-black/90 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl relative overflow-visible"
        style={{ 
          WebkitAppRegion: 'drag', // Make draggable by default
          position: 'relative', 
          zIndex: 10,
          pointerEvents: 'auto'
        } as React.CSSProperties}
        onMouseDown={(e) => {
          // Stop drag if clicking on buttons
          const target = e.target as HTMLElement;
          if (target.closest('[data-no-drag]')) {
            return;
          }
        }}
      >
        {/* Control Icons - Right Side */}
        <div 
          data-no-drag
          className={`absolute top-3 right-3 flex items-center gap-2 transition-all duration-300 z-30 ${
            showControls || isHovering
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-2'
          }`}
          style={{ 
            WebkitAppRegion: 'no-drag', 
            pointerEvents: (showControls || isHovering) ? 'auto' : 'none'
          } as React.CSSProperties}
        >
          {/* Start/Stop Button */}
          <button
            onClick={isActive ? onStop : onStart}
            disabled={!isConfigured}
            className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${
              isActive
                ? 'bg-red-600/90 hover:bg-red-700 text-white'
                : 'bg-emerald-500/90 hover:bg-emerald-600 text-white'
            } ${!isConfigured ? 'opacity-50 cursor-not-allowed hover:scale-100' : ''}`}
            title={isActive ? 'Stop translation' : 'Start translation'}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
            className={`p-2 rounded-lg transition-all duration-200 transform hover:scale-110 active:scale-95 shadow-lg ${
              error
                ? 'bg-red-500/90 hover:bg-red-600 text-white animate-shake'
                : !isConfigured
                ? 'bg-amber-500/90 hover:bg-amber-600 text-white'
                : showSettings
                ? 'bg-blue-600/90 hover:bg-blue-700 text-white'
                : 'bg-slate-700/90 hover:bg-slate-600 text-white'
            }`}
            title={error || !isConfigured ? (error || getMissingKeysMessage(missingKeys)) : 'Settings'}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
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
        
        <div className="relative z-10 pr-20 h-full flex flex-col" style={{ pointerEvents: 'auto', WebkitAppRegion: 'drag' } as React.CSSProperties}>
          {showSettings ? (
            /* Settings Form */
            <div className="space-y-4 animate-fadeIn" style={{ pointerEvents: 'auto', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </h3>
              </div>

              {/* Window Opacity Control */}
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
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
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>10%</span>
                  <span>100%</span>
                </div>
              </div>

              {/* Deepgram API Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-4 4v-4H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                  </svg>
                  Deepgram API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys.deepgram ? 'text' : 'password'}
                    value={deepgramKey}
                    onChange={(e) => setDeepgramKey(e.target.value)}
                    placeholder="Enter your Deepgram API key"
                    className="w-full px-3 py-2 pr-10 text-sm bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:outline-none transition-all placeholder-gray-500"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys({ ...showKeys, deepgram: !showKeys.deepgram })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    title={showKeys.deepgram ? 'Hide key' : 'Show key'}
                  >
                    {showKeys.deepgram ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L3 6.581m3.29-3.29L12 12m-5.71-5.71L12 12" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Get key at{' '}
                  <a href="https://console.deepgram.com/" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">
                    console.deepgram.com
                  </a>
                </p>
              </div>

              {/* DeepL API Key */}
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-2 flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.75 7H18a1 1 0 110 2h-5a1 1 0 01-1-1v-1H5a1 1 0 01-1-1v-2a1 1 0 011-1h2.75A14.87 14.87 0 018 5H6a1 1 0 00-1 1v1a1 1 0 01-2 0V3a1 1 0 011-1h1V2z" clipRule="evenodd" />
                  </svg>
                  DeepL API Key
                </label>
                <div className="relative">
                  <input
                    type={showKeys.deepl ? 'text' : 'password'}
                    value={deeplKey}
                    onChange={(e) => setDeeplKey(e.target.value)}
                    placeholder="Enter your DeepL API key"
                    className="w-full px-3 py-2 pr-10 text-sm bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all placeholder-gray-500"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKeys({ ...showKeys, deepl: !showKeys.deepl })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
                    style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                    title={showKeys.deepl ? 'Hide key' : 'Show key'}
                  >
                    {showKeys.deepl ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m0 0L3 6.581m3.29-3.29L12 12m-5.71-5.71L12 12" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Get key at{' '}
                  <a href="https://www.deepl.com/pro-api" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">
                    deepl.com/pro-api
                  </a>
                </p>
              </div>

              {/* Message */}
              {message && (
                <div className={`p-2.5 rounded-lg border backdrop-blur-sm text-sm ${
                  message.type === 'success'
                    ? 'bg-green-500/20 text-green-300 border-green-500/30'
                    : 'bg-red-500/20 text-red-300 border-red-500/30'
                }`}>
                  <div className="flex items-center gap-2">
                    {message.type === 'success' ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className="font-medium text-xs">{message.text}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-1.5"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  {saving ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Save
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* Subtitle Text */
            <div className="flex-1 flex flex-col justify-center items-center select-none" style={{ pointerEvents: 'auto', WebkitAppRegion: 'drag' } as React.CSSProperties}>
              <p
                className={`text-white text-center text-3xl font-semibold leading-relaxed transition-all duration-300 select-none ${
                  text ? 'opacity-100 scale-100' : 'opacity-40 scale-95'
                }`}
                style={{
                  textShadow: '0 2px 10px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 0, 0, 0.5)',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                }}
              >
                {text || (isActive ? 'Listening...' : (!isConfigured ? getMissingKeysMessage(missingKeys) : 'Ready to translate'))}
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
                ) : !isConfigured ? (
                  <span className="text-xs text-amber-400 font-medium select-none">{getMissingKeysStatus(missingKeys)}</span>
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

