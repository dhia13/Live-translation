'use client';
import { useState, useRef, useEffect } from 'react';
import { ProcessingJob } from '../../types';
import { getLanguageInfo } from '../../constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Play, Pause, RotateCcw, FileText, Clock } from 'lucide-react';

interface ResultsViewerProps {
    job: ProcessingJob;
    onDownloadSrt: (type: 'original' | 'translated') => void;
    onDownloadTxt: (type: 'original' | 'translated') => void;
    ttsAudioUrl: string | null;
    onNewUpload: () => void;
}

export default function ResultsViewer({
    job,
    onDownloadSrt,
    onDownloadTxt,
    ttsAudioUrl,
    onNewUpload
}: ResultsViewerProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        if (ttsAudioUrl) {
            audioRef.current = new Audio(ttsAudioUrl);

            audioRef.current.addEventListener('loadedmetadata', () => {
                setDuration(audioRef.current?.duration || 0);
            });

            audioRef.current.addEventListener('timeupdate', () => {
                setCurrentTime(audioRef.current?.currentTime || 0);
            });

            audioRef.current.addEventListener('ended', () => {
                setIsPlaying(false);
                setCurrentTime(0);
            });

            return () => {
                audioRef.current?.pause();
                audioRef.current = null;
            };
        }
    }, [ttsAudioUrl]);

    const togglePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTimestamp = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const hasTranslation = job.mode !== 'transcribe' && job.segments.some(s => s.translatedText);

    return (
        <div className="space-y-6 mt-6">
            {/* Action Bar */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Original downloads */}
                            <div className="flex items-center gap-1">
                                <span className="text-xs text-zinc-500 mr-1">Original:</span>
                                <Button variant="outline" size="sm" onClick={() => onDownloadSrt('original')} className="gap-1.5">
                                    <Download className="w-3.5 h-3.5" />
                                    SRT
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => onDownloadTxt('original')} className="gap-1.5">
                                    <FileText className="w-3.5 h-3.5" />
                                    TXT
                                </Button>
                            </div>

                            {/* Translated downloads (only if translation was done) */}
                            {hasTranslation && (
                                <div className="flex items-center gap-1 ml-2 pl-2 border-l border-zinc-700">
                                    <span className="text-xs text-zinc-500 mr-1">Translated:</span>
                                    <Button variant="outline" size="sm" onClick={() => onDownloadSrt('translated')} className="gap-1.5">
                                        <Download className="w-3.5 h-3.5" />
                                        SRT
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={() => onDownloadTxt('translated')} className="gap-1.5">
                                        <FileText className="w-3.5 h-3.5" />
                                        TXT
                                    </Button>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            {ttsAudioUrl && (
                                <Button
                                    onClick={togglePlayPause}
                                    className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
                                >
                                    {isPlaying ? (
                                        <>
                                            <Pause className="w-4 h-4" />
                                            Pause TTS
                                        </>
                                    ) : (
                                        <>
                                            <Play className="w-4 h-4" />
                                            Play TTS
                                        </>
                                    )}
                                </Button>
                            )}
                            <Button variant="ghost" onClick={onNewUpload} className="gap-2">
                                <RotateCcw className="w-4 h-4" />
                                New Upload
                            </Button>
                        </div>
                    </div>

                    {/* Audio Progress */}
                    {ttsAudioUrl && duration > 0 && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-zinc-500 w-12">{formatTime(currentTime)}</span>
                                <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-100"
                                        style={{ width: `${(currentTime / duration) * 100}%` }}
                                    />
                                </div>
                                <span className="text-xs text-zinc-500 w-12 text-right">{formatTime(duration)}</span>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-zinc-100">{job.segments.length}</p>
                        <p className="text-xs text-zinc-500">Segments</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-zinc-100">{formatTime(job.audio_duration)}</p>
                        <p className="text-xs text-zinc-500">Duration</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-zinc-100">
                            {job.segments.reduce((acc, s) => acc + s.text.split(' ').length, 0)}
                        </p>
                        <p className="text-xs text-zinc-500">Words</p>
                    </CardContent>
                </Card>
                <Card className="bg-zinc-900/50 border-zinc-800">
                    <CardContent className="p-4 text-center">
                        <p className="text-2xl font-bold text-zinc-100">
                            {job.segments[0]?.language ? getLanguageInfo(job.segments[0].language).flag : '-'}
                        </p>
                        <p className="text-xs text-zinc-500">Detected</p>
                    </CardContent>
                </Card>
            </div>

            {/* Transcription Results */}
            <Card className="bg-zinc-900/50 border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="w-5 h-5 text-violet-400" />
                        Transcription Results
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 max-h-[500px] overflow-y-auto">
                    {job.segments.map((segment) => (
                        <div
                            key={segment.id}
                            className="p-4 rounded-lg border border-zinc-800 bg-zinc-800/30 hover:bg-zinc-800/50 transition-colors"
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                                <span className="text-xs text-zinc-500 font-mono">
                                    {formatTimestamp(segment.start)} - {formatTimestamp(segment.end)}
                                </span>
                                {segment.language && (
                                    <span className="text-sm ml-2">
                                        {getLanguageInfo(segment.language).flag}
                                    </span>
                                )}
                            </div>
                            <p className="text-zinc-200">{segment.text}</p>
                            {segment.translatedText && (
                                <div className="mt-3 pt-3 border-t border-zinc-700">
                                    <div className="flex items-center gap-2 mb-1">
                                        {job.target_language && (
                                            <span className="text-sm">
                                                {getLanguageInfo(job.target_language).flag}
                                            </span>
                                        )}
                                        <span className="text-xs text-zinc-500">Translation</span>
                                    </div>
                                    <p className="text-zinc-400">{segment.translatedText}</p>
                                </div>
                            )}
                        </div>
                    ))}

                    {job.segments.length === 0 && (
                        <p className="text-zinc-500 text-center py-8">No transcription results</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
