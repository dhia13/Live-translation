'use client';

import { useState } from 'react';
import { Caption } from '../types';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText } from 'lucide-react';

interface SaveDialogProps {
    captions: Caption[];
    targetLanguage: string | null;
}

export default function SaveDialog({ captions, targetLanguage }: SaveDialogProps) {
    const [open, setOpen] = useState(false);

    const formatTimestamp = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const saveAsText = () => {
        if (captions.length === 0) return;

        let content = 'Live Translation Transcript\n';
        content += `Generated: ${new Date().toLocaleString()}\n`;
        content += '='.repeat(50) + '\n\n';

        captions.forEach((cap, idx) => {
            content += `[${idx + 1}] ${formatTimestamp(cap.timestamp)}\n`;
            content += `Original: ${cap.text}\n`;
            if (cap.translatedText) {
                content += `Translation: ${cap.translatedText}\n`;
            }
            content += '\n';
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${Date.now()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    const saveAsJSON = () => {
        if (captions.length === 0) return;

        const data = {
            metadata: {
                generated: new Date().toISOString(),
                totalCaptions: captions.length,
                targetLanguage,
            },
            captions: captions.map(cap => ({
                id: cap.id,
                text: cap.text,
                translatedText: cap.translatedText,
                language: cap.language,
                timestamp: cap.timestamp,
                formattedTimestamp: formatTimestamp(cap.timestamp),
            })),
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Download className="w-4 h-4" />
                    Save Transcript
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Save Transcript</DialogTitle>
                    <DialogDescription>
                        Save {captions.length} transcription{captions.length !== 1 ? 's' : ''} to your device.
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-3 py-4">
                    <Button
                        onClick={saveAsText}
                        variant="outline"
                        className="w-full justify-start gap-2"
                        disabled={captions.length === 0}
                    >
                        <FileText className="w-4 h-4" />
                        Save as Text (.txt)
                    </Button>
                    <Button
                        onClick={saveAsJSON}
                        variant="outline"
                        className="w-full justify-start gap-2"
                        disabled={captions.length === 0}
                    >
                        <FileText className="w-4 h-4" />
                        Save as JSON (.json)
                    </Button>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


