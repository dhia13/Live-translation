'use client';

import { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [deepgramKey, setDeepgramKey] = useState('');
  const [deeplKey, setDeeplKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState({ deepgram: false, deepl: false });
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen && typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getApiKeys().then((keys) => {
        setDeepgramKey(keys.deepgram || '');
        setDeeplKey(keys.deepl || '');
      });
    }
    // Reset message when modal opens
    setMessage(null);
  }, [isOpen]);

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
      setMessage({ type: 'success', text: 'API keys saved successfully!' });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: `Failed to save: ${error.message}` });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto animate-fadeIn overflow-y-auto p-4 rounded-2xl"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl p-4 w-full max-w-md border border-white/10 shadow-2xl transform transition-all animate-slideUp max-h-[calc(100%-2rem)] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API Configuration
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="space-y-4">
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
                className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:border-purple-500 focus:ring-1 focus:ring-purple-500/20 focus:outline-none transition-all placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowKeys({ ...showKeys, deepgram: !showKeys.deepgram })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
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
              <a
                href="https://console.deepgram.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline transition-colors"
              >
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
                className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700 text-white rounded-lg focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 focus:outline-none transition-all placeholder-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowKeys({ ...showKeys, deepl: !showKeys.deepl })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
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
              <a
                href="https://www.deepl.com/pro-api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                deepl.com/pro-api
              </a>
            </p>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-2.5 rounded-lg border backdrop-blur-sm transition-all animate-slideDown text-sm ${
                message.type === 'success'
                  ? 'bg-green-500/20 text-green-300 border-green-500/30'
                  : 'bg-red-500/20 text-red-300 border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-2">
                {message.type === 'success' ? (
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg flex items-center justify-center gap-1.5"
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
              onClick={onClose}
              className="px-4 py-2 bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-600 hover:to-gray-700 text-white rounded-lg font-semibold text-sm transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

