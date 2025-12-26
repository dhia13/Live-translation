import { StatsData } from '../types';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface StatsPanelProps {
    isLive: boolean;
    inferenceTime: number;
    translationTime: number;
    translationEnabled: boolean;
    captionCount: number;
    stats: StatsData | null;
}

export default function StatsPanel({
    isLive,
    inferenceTime,
    translationTime,
    translationEnabled,
    captionCount,
    stats,
}: StatsPanelProps) {
    if (!isLive) {
        return null;
    }

    const statItems = [
        { label: 'Inference', value: `${inferenceTime.toFixed(2)}s`, icon: '⚡' },
        ...(translationEnabled ? [{ label: 'Translation', value: `${translationTime.toFixed(2)}s`, icon: '🌐' }] : []),
        { label: 'Total Time', value: `${(inferenceTime + translationTime).toFixed(2)}s`, icon: '⏱️' },
        { label: 'Chunks', value: captionCount, icon: '✓' },
        { label: 'Avg Latency', value: stats ? `${stats.avg_latency.toFixed(2)}s` : '-', icon: '📊' },
    ];

    return (
        <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {statItems.map((stat, i) => (
                    <Card 
                        key={i} 
                        className="group relative p-5 bg-gradient-to-br from-zinc-900/70 via-zinc-900/60 to-black/70 border-zinc-800 backdrop-blur-xl hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-black/50 animate-scaleIn"
                        style={{ animationDelay: `${i * 50}ms` }}
                    >
                        {/* Subtle gradient overlay on hover */}
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/0 to-cyan-500/0 rounded-2xl opacity-0 group-hover:opacity-10 transition-opacity duration-300" />
                        
                        <CardContent className="p-0 relative">
                            <div className="flex items-center gap-2.5 mb-2">
                                <span className="text-xl filter drop-shadow-sm">{stat.icon}</span>
                                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                                    {stat.label}
                                </span>
                            </div>
                            <p className="text-3xl font-bold text-zinc-100 bg-gradient-to-r from-zinc-100 to-zinc-300 bg-clip-text text-transparent">
                                {stat.value}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {stats && stats.dropped_chunks > 0 && (
                <Alert variant="destructive" className="mt-4 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-yellow-500/30 backdrop-blur-xl shadow-lg shadow-yellow-500/10 animate-slideInRight">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-yellow-500/20 border border-yellow-500/40 flex items-center justify-center">
                        <span className="text-lg">⚠️</span>
                    </div>
                    <AlertDescription className="text-sm font-medium text-yellow-200">
                        {stats.dropped_chunks} chunk{stats.dropped_chunks !== 1 ? 's' : ''} dropped due to processing overload
                    </AlertDescription>
                </Alert>
            )}
        </>
    );
}

