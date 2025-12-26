interface MicLevelIndicatorProps {
    micLevel: number;
}

export default function MicLevelIndicator({ micLevel }: MicLevelIndicatorProps) {
    return (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-gradient-to-br from-zinc-900/80 to-zinc-900/60 border border-zinc-800 backdrop-blur-sm shadow-lg">
            <div className="relative">
                <svg className="w-5 h-5 text-zinc-300" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
                </svg>
                {micLevel > 50 && (
                    <div className="absolute inset-0 bg-cyan-400 rounded-full animate-ping opacity-75" />
                )}
            </div>
            <div className="flex gap-1 items-end h-5">
                {[...Array(8)].map((_, i) => {
                    const isActive = micLevel > (i * 12.5);
                    const height = Math.max(3, Math.min(20, (micLevel / 100) * 20 * (i + 1) / 8));
                    return (
                        <div
                            key={i}
                            className="w-1.5 rounded-full transition-all duration-150 ease-out"
                            style={{
                                height: `${height}px`,
                                background: isActive 
                                    ? `linear-gradient(to top, ${i < 4 ? '#8b5cf6' : i < 6 ? '#06b6d4' : '#ef4444'}, ${i < 4 ? '#a78bfa' : i < 6 ? '#22d3ee' : '#f87171'})`
                                    : 'linear-gradient(to top, #27272a, #3f3f46)',
                                opacity: isActive ? 1 : 0.2,
                                boxShadow: isActive ? `0 0 ${height / 2}px ${i < 4 ? 'rgba(139, 92, 246, 0.5)' : i < 6 ? 'rgba(6, 182, 212, 0.5)' : 'rgba(239, 68, 68, 0.5)'}` : 'none'
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

