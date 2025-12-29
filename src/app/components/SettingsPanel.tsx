import { LANGUAGES, getLanguageInfo } from '../constants';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Languages, Globe, Settings2, Volume2, VolumeX } from 'lucide-react';
import { Voice } from '../types';

interface SettingsPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    translationEnabled: boolean;
    sourceLanguage: string | null;
    targetLanguage: string | null;
    detectedLanguage: string | null;
    isLive: boolean;
    onToggleTranslation: () => void;
    onSourceLanguageChange: (lang: string | null) => void;
    onTargetLanguageChange: (lang: string | null) => void;
    // TTS props
    ttsEnabled: boolean;
    ttsAvailable: boolean;
    ttsVoice: string;
    ttsSpeed: number;
    voices: Voice[];
    isPlayingTTS: boolean;
    onToggleTTS: () => void;
    onTTSVoiceChange: (voice: string) => void;
    onTTSSpeedChange: (speed: number) => void;
}

export default function SettingsPanel({
    open,
    onOpenChange,
    translationEnabled,
    sourceLanguage,
    targetLanguage,
    detectedLanguage,
    isLive,
    onToggleTranslation,
    onSourceLanguageChange,
    onTargetLanguageChange,
    // TTS props
    ttsEnabled,
    ttsAvailable,
    ttsVoice,
    ttsSpeed,
    voices,
    isPlayingTTS,
    onToggleTTS,
    onTTSVoiceChange,
    onTTSSpeedChange,
}: SettingsPanelProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950/95 border-zinc-800 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-zinc-100">
                        <Settings2 className="w-5 h-5 text-violet-400" />
                        Settings
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Configure translation and text-to-speech preferences
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 mt-4">
                    {/* Enable Translation */}
                    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                                        <Globe className="w-5 h-5 text-violet-400" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-zinc-100">Enable Translation</CardTitle>
                                        <CardDescription className="text-xs text-zinc-500">
                                            Automatically translate transcriptions
                                        </CardDescription>
                                    </div>
                                </div>
                                <Switch
                                    checked={translationEnabled}
                                    onCheckedChange={onToggleTranslation}
                                />
                            </div>
                        </CardHeader>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Source Language */}
                        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                    <Languages className="w-4 h-4 text-zinc-400" />
                                    Source Language
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-500">
                                    Language to detect from audio
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Select
                                    value={sourceLanguage || 'auto'}
                                    onValueChange={(value) => onSourceLanguageChange(value === 'auto' ? null : value)}
                                    disabled={isLive}
                                >
                                    <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-100 hover:bg-zinc-900">
                                        <SelectValue placeholder="Auto-detect" />
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
                            </CardContent>
                        </Card>

                        {/* Target Language */}
                        <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-zinc-400" />
                                    Target Language
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-500">
                                    Language to translate to
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Select
                                    value={targetLanguage || undefined}
                                    onValueChange={(value) => onTargetLanguageChange(value || null)}
                                    disabled={!translationEnabled}
                                >
                                    <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-100 hover:bg-zinc-900">
                                        <SelectValue placeholder="Select language" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-zinc-950 border-zinc-800">
                                        {LANGUAGES.filter(l => l.code !== null).map((lang) => (
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
                            </CardContent>
                        </Card>
                    </div>

                    {translationEnabled && detectedLanguage && (
                        <Alert className="bg-gradient-to-r from-violet-500/10 via-cyan-500/10 to-violet-500/10 border-violet-500/20">
                            <div className="flex items-center gap-3 text-sm font-medium">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/20 border border-violet-500/30">
                                    <span className="text-lg">{getLanguageInfo(detectedLanguage).flag}</span>
                                    <span className="text-violet-200">{getLanguageInfo(detectedLanguage).name}</span>
                                </div>
                                <ArrowRight className="w-5 h-5 text-zinc-500" />
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/30">
                                    <span className="text-lg">{getLanguageInfo(targetLanguage).flag}</span>
                                    <span className="text-cyan-200">{getLanguageInfo(targetLanguage).name}</span>
                                </div>
                            </div>
                        </Alert>
                    )}

                    {/* TTS Section Divider */}
                    <div className="border-t border-zinc-800 pt-4">
                        <h3 className="text-sm font-medium text-zinc-400 mb-4">Text-to-Speech</h3>
                    </div>

                    {/* Enable TTS */}
                    <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg ${ttsAvailable ? 'bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border-emerald-500/30' : 'bg-zinc-800 border-zinc-700'} border flex items-center justify-center`}>
                                        {ttsEnabled && isPlayingTTS ? (
                                            <Volume2 className="w-5 h-5 text-emerald-400 animate-pulse" />
                                        ) : (
                                            <VolumeX className="w-5 h-5 text-zinc-400" />
                                        )}
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-semibold text-zinc-100">
                                            Enable Text-to-Speech
                                            {!ttsAvailable && <span className="ml-2 text-xs text-amber-500">(Not available)</span>}
                                        </CardTitle>
                                        <CardDescription className="text-xs text-zinc-500">
                                            Read translations aloud using AI voice
                                        </CardDescription>
                                    </div>
                                </div>
                                <Switch
                                    checked={ttsEnabled}
                                    onCheckedChange={onToggleTTS}
                                    disabled={!ttsAvailable}
                                />
                            </div>
                        </CardHeader>
                    </Card>

                    {ttsAvailable && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* TTS Voice */}
                            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                                <CardHeader>
                                    <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                        <Volume2 className="w-4 h-4 text-zinc-400" />
                                        Voice
                                    </CardTitle>
                                    <CardDescription className="text-xs text-zinc-500">
                                        Select AI voice for speech
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <Select
                                        value={ttsVoice}
                                        onValueChange={onTTSVoiceChange}
                                        disabled={!ttsEnabled}
                                    >
                                        <SelectTrigger className="w-full bg-zinc-950 border-zinc-800 text-zinc-100 hover:bg-zinc-900">
                                            <SelectValue placeholder="Select voice" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-950 border-zinc-800 max-h-60">
                                            {voices.map((voice) => (
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
                                </CardContent>
                            </Card>

                            {/* TTS Speed */}
                            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 transition-colors">
                                <CardHeader>
                                    <CardTitle className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                                        Speed
                                    </CardTitle>
                                    <CardDescription className="text-xs text-zinc-500">
                                        Speech speed: {ttsSpeed.toFixed(1)}x
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <input
                                        type="range"
                                        min="0.5"
                                        max="2.0"
                                        step="0.1"
                                        value={ttsSpeed}
                                        onChange={(e) => onTTSSpeedChange(parseFloat(e.target.value))}
                                        disabled={!ttsEnabled}
                                        className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500 disabled:opacity-50"
                                    />
                                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                                        <span>0.5x</span>
                                        <span>1.0x</span>
                                        <span>2.0x</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

