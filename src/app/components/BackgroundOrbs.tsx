export default function BackgroundOrbs() {
    return (
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
            {/* Animated gradient orbs */}
            <div className="absolute top-1/4 -left-48 w-96 h-96 bg-gradient-to-br from-violet-600/30 to-violet-800/20 rounded-full blur-3xl animate-float" />
            <div className="absolute bottom-1/4 -right-48 w-96 h-96 bg-gradient-to-br from-cyan-600/30 to-cyan-800/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/15 to-indigo-600/10 rounded-full blur-3xl animate-pulse" />
            
            {/* Additional subtle orbs for depth */}
            <div className="absolute top-0 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '1s' }} />
            <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '3s' }} />
            
            {/* Animated gradient mesh overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-violet-900/0 via-transparent to-cyan-900/0 opacity-50" />
        </div>
    );
}

