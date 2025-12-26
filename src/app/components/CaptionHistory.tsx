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

    const totalCaptions = captions.length;
    const fadeThreshold = Math.max(1, Math.floor(totalCaptions * 0.6)); // Fade items after 60% of history
    
    return (
        <div className="space-y-3">
            {captions.map((cap, idx) => {
                const isOld = idx < totalCaptions - fadeThreshold;
                const age = totalCaptions - idx - 1;
                const shouldFade = isOld && age > 0;
                
                return (
                <Card
                    key={cap.id}
                    className={`group relative p-6 bg-gradient-to-br from-zinc-900/60 via-zinc-900/50 to-black/60 border-zinc-800/50 backdrop-blur-xl transition-all duration-500 hover:border-zinc-700 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-black/50 hover:scale-[1.02] animate-slideUp ${
                        shouldFade ? 'animate-fadeOutOld' : ''
                    }`}
                    style={{ 
                        opacity: shouldFade ? Math.max(0.1, 0.4 - (age * 0.1)) : 0.4 + (idx * 0.15),
                        animationDelay: `${idx * 50}ms`
                    }}
                >
                    {/* Subtle glow effect on hover */}
                    <div className="absolute inset-0 bg-gradient-to-r from-violet-500/0 via-cyan-500/0 to-violet-500/0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-500" />
                    
                    <CardContent className="p-0">
                        <div className="relative flex items-start gap-3 mb-3">
                            {cap.language && (
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-zinc-800/50 border border-zinc-700/50 flex items-center justify-center">
                                    <span className="text-lg">{getLanguageInfo(cap.language).flag}</span>
                                </div>
                            )}
                            <p className="text-xl md:text-2xl text-zinc-200 leading-relaxed flex-1 font-medium">
                                {cap.text}
                            </p>
                        </div>
                        {cap.translatedText && (
                            <div className="relative flex items-start gap-3 mt-4 pt-4 border-t border-zinc-800">
                                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                                    <span className="text-lg">{getLanguageInfo(targetLanguage).flag}</span>
                                </div>
                                <p className="text-lg md:text-xl text-zinc-300 leading-relaxed flex-1">
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

