import { getLanguageInfo } from '../constants';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CurrentCaptionProps {
    currentText: string;
    currentTranslation: string;
    detectedLanguage: string | null;
    targetLanguage: string | null;
    isLive: boolean;
}

export default function CurrentCaption({
    currentText,
    currentTranslation,
    detectedLanguage,
    targetLanguage,
    isLive,
}: CurrentCaptionProps) {
    return (
        <div className="relative group">
            {/* Animated gradient glow */}
            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-600 via-cyan-600 to-violet-600 rounded-3xl opacity-30 blur-2xl group-hover:opacity-40 transition-opacity duration-500 animate-pulse" />
            <div className="absolute -inset-1 bg-gradient-to-r from-violet-600/20 to-cyan-600/20 rounded-3xl blur-xl" />
            
            <Card className="relative p-10 md:p-12 bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-black/90 border-zinc-800 backdrop-blur-2xl shadow-2xl shadow-black/50 animate-scaleIn">
                <CardContent className="p-0">
                    {/* Status badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="relative">
                            <div className="w-3 h-3 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full">
                                {isLive && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 rounded-full animate-ping opacity-75" />
                                )}
                            </div>
                        </div>
                        <Badge variant="outline" className="text-xs font-bold text-zinc-300 uppercase tracking-widest border-zinc-700 bg-zinc-800/50">
                            {isLive ? 'Live Transcription' : 'Ready'}
                        </Badge>
                        {detectedLanguage && (
                            <>
                                <span className="text-zinc-600">•</span>
                                <Badge variant="outline" className="flex items-center gap-1.5 border-zinc-700 bg-zinc-800/50">
                                    <span className="text-sm">{getLanguageInfo(detectedLanguage).flag}</span>
                                    <span className="text-xs font-medium text-zinc-300">
                                        {getLanguageInfo(detectedLanguage).name}
                                    </span>
                                </Badge>
                            </>
                        )}
                    </div>

                    {/* Original Text */}
                    <div className="relative">
                        <p className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-300 bg-clip-text text-transparent drop-shadow-lg">
                            {currentText || (
                                <span className="inline-flex items-center gap-2">
                                    <span className="text-zinc-500">{isLive ? "Listening..." : "Ready to transcribe"}</span>
                                {isLive && (
                                    <span className="inline-flex gap-1">
                                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                        <span className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </span>
                                )}
                            </span>
                        )}
                    </p>
                </div>

                {/* Translation */}
                {currentTranslation && (
                    <div className="mt-8 pt-8 border-t border-zinc-800 animate-slideUp">
                        <div className="flex items-center gap-2.5 mb-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500/20 to-cyan-500/20 border border-violet-500/30">
                                <span className="text-xl">{getLanguageInfo(targetLanguage).flag}</span>
                                <span className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                                    Translation
                                </span>
                            </div>
                        </div>
                        <p className="text-3xl md:text-4xl lg:text-5xl font-semibold leading-tight text-zinc-200 bg-gradient-to-r from-zinc-200 to-zinc-300 bg-clip-text text-transparent">
                            {currentTranslation}
                        </p>
                    </div>
                )}
                </CardContent>
            </Card>
        </div>
    );
}

