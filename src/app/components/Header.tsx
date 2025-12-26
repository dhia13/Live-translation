import MicLevelIndicator from './MicLevelIndicator';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

interface HeaderProps {
    status: string;
    serverInfo: { device: string; model: string } | null;
    isLive: boolean;
    micLevel: number;
    isStopping: boolean;
    onToggleSettings: () => void;
    onStartStop: () => void;
}

export default function Header({
    status,
    serverInfo,
    isLive,
    micLevel,
    isStopping,
    onToggleSettings,
    onStartStop,
}: HeaderProps) {
    return (
        <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-2xl shadow-lg shadow-black/40">
            <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity" />
                        <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
                            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                            </svg>
                        </div>
                        {status === 'Connected' && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-zinc-950 shadow-lg shadow-emerald-500/50">
                                <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75" />
                            </div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-bold bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                            Live Translator
                        </h1>
                        <p className="text-xs text-zinc-500 font-medium">
                            {serverInfo ? `${serverInfo.model.toUpperCase()} • ${serverInfo.device.toUpperCase()}` : status}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Settings button */}
                    <Button
                        onClick={onToggleSettings}
                        variant="ghost"
                        size="icon"
                        className="relative"
                        aria-label="Settings"
                    >
                        <Settings className="w-5 h-5" />
                    </Button>

                    {/* Mic level indicator */}
                    {isLive && <MicLevelIndicator micLevel={micLevel} />}

                    <Button
                        onClick={onStartStop}
                        disabled={status !== 'Connected' || isStopping}
                        variant={isLive ? "destructive" : "gradient"}
                        className="group relative overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                        {isLive ? (
                            <>
                                <div className="relative w-2.5 h-2.5 bg-white rounded-full mr-2">
                                    <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-75" />
                                </div>
                                <span className="relative">Stop Recording</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-4 h-4 relative mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                                </svg>
                                <span className="relative">Start Recording</span>
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </header>
    );
}

