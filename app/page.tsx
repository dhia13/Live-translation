'use client';

import { useEffect, useState } from 'react';
import SubtitleOverlay from '@/components/SubtitleOverlay';
import { useAudioCapture } from '@/hooks/useAudioCapture';
import { useTranslation } from '@/hooks/useTranslation';

export default function Home() {
  const [apiKeys, setApiKeys] = useState<{ deepgram?: string; deepl?: string }>({});
  const [isConfigured, setIsConfigured] = useState(false);
  const [missingKeys, setMissingKeys] = useState<{ deepgram: boolean; deepl: boolean }>({ deepgram: true, deepl: true });
  
  const { transcript, isListening, startCapture, stopCapture, error: audioError } = useAudioCapture(apiKeys.deepgram);
  const { translatedText, isTranslating } = useTranslation(transcript, apiKeys.deepl);

  useEffect(() => {
    // Load API keys from Electron IPC
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.getApiKeys().then((keys) => {
        setApiKeys(keys);
        const hasDeepgram = !!keys.deepgram;
        const hasDeepl = !!keys.deepl;
        setMissingKeys({ deepgram: !hasDeepgram, deepl: !hasDeepl });
        setIsConfigured(hasDeepgram && hasDeepl);
      });
    }
  }, []);

  const handleStart = async () => {
    if (!apiKeys.deepgram || !apiKeys.deepl) {
      // Error will be shown in SubtitleOverlay component
      return;
    }
    await startCapture();
  };

  const handleStop = () => {
    stopCapture();
  };

  return (
    <div 
      className="w-full h-full flex items-start justify-start pointer-events-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="w-full h-full">
        <SubtitleOverlay
          text={translatedText || transcript}
          isActive={isListening || isTranslating}
          onStart={handleStart}
          onStop={handleStop}
          isConfigured={isConfigured}
          missingKeys={missingKeys}
          error={audioError}
        />
      </div>
    </div>
  );
}

