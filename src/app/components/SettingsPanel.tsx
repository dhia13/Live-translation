import { LANGUAGES, getLanguageInfo } from '../constants';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowRight, Languages, Globe, Settings2 } from 'lucide-react';

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
}: SettingsPanelProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl bg-zinc-950/95 border-zinc-800 backdrop-blur-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold text-zinc-100">
                        <Settings2 className="w-5 h-5 text-violet-400" />
                        Translation Settings
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Configure language detection and translation preferences
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
                </div>
            </DialogContent>
        </Dialog>
    );
}

