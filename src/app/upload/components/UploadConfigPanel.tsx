'use client';
import { ProcessingMode, UploadConfig } from '../../types';
import { LANGUAGES } from '../../constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Languages, Volume2, Play, Loader2, FileText, Globe } from 'lucide-react';

interface UploadConfigPanelProps {
    config: UploadConfig;
    onConfigChange: (config: UploadConfig) => void;
    onStartProcessing: () => void;
    isUploading: boolean;
}

const MODES: { value: ProcessingMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
        value: 'transcribe',
        label: 'Transcription Only',
        description: 'Speech to text',
        icon: <FileText className="w-5 h-5" />
    },
    {
        value: 'transcribe_translate',
        label: 'Transcribe + Translate',
        description: 'Speech to text with translation',
        icon: <Globe className="w-5 h-5" />
    },
    {
        value: 'transcribe_translate_tts',
        label: 'Full Pipeline',
        description: 'Transcription, translation, and TTS',
        icon: <Volume2 className="w-5 h-5" />
    },
];

const VOICES = [
    { id: 'af_heart', name: 'Heart', gender: 'female', accent: 'American' },
    { id: 'bf_emma', name: 'Emma', gender: 'female', accent: 'British' },
    { id: 'am_adam', name: 'Adam', gender: 'male', accent: 'American' },
    { id: 'bm_george', name: 'George', gender: 'male', accent: 'British' },
];

export default function UploadConfigPanel({ config, onConfigChange, onStartProcessing, isUploading }: UploadConfigPanelProps) {
    return (
        <Card className="mt-6 bg-zinc-900/50 border-zinc-800">
            <CardHeader>
                <CardTitle className="text-lg">Processing Options</CardTitle>
                <CardDescription>Configure how your file should be processed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Mode Selection */}
                <div className="space-y-3">
                    <label className="text-sm font-medium text-zinc-300">Processing Mode</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {MODES.map((mode) => (
                            <button
                                key={mode.value}
                                onClick={() => onConfigChange({ ...config, mode: mode.value })}
                                disabled={isUploading}
                                className={`p-4 rounded-lg border text-left transition-all ${
                                    config.mode === mode.value
                                        ? 'border-violet-500 bg-violet-500/10'
                                        : 'border-zinc-700 hover:border-zinc-600'
                                } disabled:opacity-50`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={config.mode === mode.value ? 'text-violet-400' : 'text-zinc-500'}>
                                        {mode.icon}
                                    </span>
                                    <span className="font-medium text-zinc-100">{mode.label}</span>
                                </div>
                                <p className="text-xs text-zinc-500">{mode.description}</p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Language Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                            <Languages className="w-4 h-4" />
                            Source Language
                        </label>
                        <Select
                            value={config.sourceLanguage || 'auto'}
                            onValueChange={(v) => onConfigChange({ ...config, sourceLanguage: v === 'auto' ? null : v })}
                            disabled={isUploading}
                        >
                            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-950 border-zinc-800">
                                {LANGUAGES.map((lang) => (
                                    <SelectItem
                                        key={lang.code || 'auto'}
                                        value={lang.code || 'auto'}
                                        className="text-zinc-100 focus:bg-zinc-900"
                                    >
                                        {lang.flag} {lang.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {config.mode !== 'transcribe' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                Target Language
                            </label>
                            <Select
                                value={config.targetLanguage || ''}
                                onValueChange={(v) => onConfigChange({ ...config, targetLanguage: v || null })}
                                disabled={isUploading}
                            >
                                <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                    <SelectValue placeholder="Select language" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-950 border-zinc-800">
                                    {LANGUAGES.filter(l => l.code).map((lang) => (
                                        <SelectItem
                                            key={lang.code}
                                            value={lang.code!}
                                            className="text-zinc-100 focus:bg-zinc-900"
                                        >
                                            {lang.flag} {lang.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>

                {/* TTS Options */}
                {config.mode === 'transcribe_translate_tts' && (
                    <div className="space-y-4 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700">
                        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                            <Volume2 className="w-4 h-4 text-emerald-400" />
                            Text-to-Speech Options
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500">Voice</label>
                                <Select
                                    value={config.ttsVoice}
                                    onValueChange={(v) => onConfigChange({ ...config, ttsVoice: v })}
                                    disabled={isUploading}
                                >
                                    <SelectTrigger className="bg-zinc-950 border-zinc-800 text-zinc-100">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-zinc-800">
                                        {VOICES.map((voice) => (
                                            <SelectItem
                                                key={voice.id}
                                                value={voice.id}
                                                className="text-zinc-100 focus:bg-zinc-900"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <span>{voice.gender === 'female' ? '👩' : '👨'}</span>
                                                    <span>{voice.name}</span>
                                                    <span className="text-zinc-500 text-xs">({voice.accent})</span>
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs text-zinc-500">Speed: {config.ttsSpeed.toFixed(1)}x</label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2.0"
                                    step="0.1"
                                    value={config.ttsSpeed}
                                    onChange={(e) => onConfigChange({ ...config, ttsSpeed: parseFloat(e.target.value) })}
                                    disabled={isUploading}
                                    className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                                />
                                <div className="flex justify-between text-xs text-zinc-600">
                                    <span>0.5x</span>
                                    <span>1.0x</span>
                                    <span>2.0x</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Validation Warning */}
                {config.mode !== 'transcribe' && !config.targetLanguage && (
                    <p className="text-amber-400 text-sm">Please select a target language for translation.</p>
                )}

                {/* Start Button */}
                <Button
                    onClick={onStartProcessing}
                    disabled={isUploading || (config.mode !== 'transcribe' && !config.targetLanguage)}
                    variant="default"
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500"
                    size="lg"
                >
                    {isUploading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Uploading...
                        </>
                    ) : (
                        <>
                            <Play className="w-5 h-5 mr-2" />
                            Start Processing
                        </>
                    )}
                </Button>
            </CardContent>
        </Card>
    );
}
