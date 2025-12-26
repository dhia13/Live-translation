import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

interface ErrorNotificationProps {
    error: string;
    onDismiss: () => void;
}

export default function ErrorNotification({ error, onDismiss }: ErrorNotificationProps) {
    return (
        <div className="fixed bottom-6 right-6 max-w-md z-50 animate-slideInRight">
            <Alert variant="destructive" className="relative p-5 bg-gradient-to-br from-red-500/95 via-red-600/95 to-red-500/95 backdrop-blur-2xl border-red-400/60 shadow-2xl shadow-red-500/30">
                {/* Animated glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-400/20 to-red-500/0 rounded-2xl animate-pulse" />
                
                <div className="relative flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-red-400/30 border border-red-400/50 flex items-center justify-center">
                        <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                        <AlertTitle className="font-bold text-white text-sm uppercase tracking-wider mb-1">
                            Error
                        </AlertTitle>
                        <AlertDescription className="text-sm text-red-50 leading-relaxed">
                            {error}
                        </AlertDescription>
                    </div>
                    <Button
                        onClick={onDismiss}
                        variant="ghost"
                        size="icon"
                        className="flex-shrink-0 text-white/70 hover:text-white hover:bg-white/10 h-8 w-8"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </Alert>
        </div>
    );
}

