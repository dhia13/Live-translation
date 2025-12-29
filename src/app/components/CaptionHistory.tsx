import { Caption } from '../types';
import { getLanguageInfo } from '../constants';
import { Card, CardContent } from '@/components/ui/card';

interface CaptionHistoryProps {
    captions: Caption[];
    targetLanguage: string | null;
}

export default function CaptionHistory({ captions, targetLanguage }: CaptionHistoryProps) {
    if (captions.length === 0) {
        return null;
    }

    // Reverse to show newest first, then fade older items at the bottom
    const reversedCaptions = [...captions].reverse();
    const totalCaptions = reversedCaptions.length;

    return (
        <div className="relative space-y-3">
            {/* Fade overlay at bottom */}
            {totalCaptions > 3 && (
                <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-zinc-950 via-zinc-950/80 to-transparent pointer-events-none z-10" />
            )}

            {reversedCaptions.map((cap, idx) => {
                // Calculate opacity: newest (idx=0) is brightest, older items fade
                const opacity = Math.max(0.15, 1 - (idx * 0.2));
                const scale = Math.max(0.95, 1 - (idx * 0.01));

                return (
                    <Card
                        key={cap.id}
                        className="group relative p-5 bg-gradient-to-br from-zinc-900/60 via-zinc-900/50 to-black/60 border-zinc-800/50 backdrop-blur-xl transition-all duration-300 hover:border-zinc-700 hover:bg-zinc-900/70"
                        style={{
                            opacity,
                            transform: `scale(${scale})`,
                        }}
                    >
                        <CardContent className="p-0">
                            <div className="relative flex items-start gap-3">
                                {cap.language && (
                                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
                                        <span className="text-base">{getLanguageInfo(cap.language).flag}</span>
                                    </div>
                                )}
                                <p className="text-lg md:text-xl text-zinc-200 leading-relaxed flex-1 font-medium">
                                    {cap.text}
                                </p>
                            </div>
                            {cap.translatedText && (
                                <div className="relative flex items-start gap-3 mt-3 pt-3 border-t border-zinc-800/50">
                                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                                        <span className="text-base">{getLanguageInfo(targetLanguage).flag}</span>
                                    </div>
                                    <p className="text-base md:text-lg text-zinc-400 leading-relaxed flex-1">
                                        {cap.translatedText}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

