'use client';
import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useFileUpload } from '../hooks/useFileUpload';
import { UploadConfig } from '../types';
import BackgroundOrbs from '../components/BackgroundOrbs';
import UploadDropzone from './components/UploadDropzone';
import UploadConfigPanel from './components/UploadConfigPanel';
import ProcessingProgress from './components/ProcessingProgress';
import ResultsViewer from './components/ResultsViewer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Mic, Upload } from 'lucide-react';

export default function UploadPage() {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [config, setConfig] = useState<UploadConfig>({
        mode: 'transcribe_translate',
        sourceLanguage: null,
        targetLanguage: 'en',
        ttsVoice: 'af_heart',
        ttsSpeed: 1.0,
    });

    const {
        isUploading,
        currentJob,
        error,
        uploadFile,
        downloadResult,
        getTtsAudioUrl,
        clearJob
    } = useFileUpload();

    const handleFileSelect = useCallback((file: File | null) => {
        setSelectedFile(file);
    }, []);

    const handleStartProcessing = useCallback(() => {
        if (selectedFile) {
            uploadFile(selectedFile, config);
        }
    }, [selectedFile, config, uploadFile]);

    const handleNewUpload = useCallback(() => {
        clearJob();
        setSelectedFile(null);
    }, [clearJob]);

    const isProcessing = currentJob && currentJob.status !== 'complete' && currentJob.status !== 'error';
    const isComplete = currentJob?.status === 'complete';

    return (
        <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-black text-zinc-100">
            <BackgroundOrbs />

            <div className="relative z-10">
                {/* Header */}
                <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur-2xl">
                    <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link href="/">
                                <Button variant="ghost" size="icon" aria-label="Back to Live Mode">
                                    <ArrowLeft className="w-5 h-5" />
                                </Button>
                            </Link>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                                    <Upload className="w-5 h-5 text-violet-400" />
                                </div>
                                <div>
                                    <h1 className="text-lg font-bold">File Upload</h1>
                                    <p className="text-xs text-zinc-500">Process audio & video files</p>
                                </div>
                            </div>
                        </div>
                        <Link href="/">
                            <Button variant="outline" className="gap-2">
                                <Mic className="w-4 h-4" />
                                Live Mode
                            </Button>
                        </Link>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-6 py-8">
                    {/* Error Display */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
                            {error}
                        </div>
                    )}

                    {/* Main Content */}
                    {!currentJob ? (
                        <>
                            {/* Upload Area */}
                            <UploadDropzone
                                onFileSelect={handleFileSelect}
                                selectedFile={selectedFile}
                                isUploading={isUploading}
                            />

                            {/* Config Panel (shows when file selected) */}
                            {selectedFile && (
                                <UploadConfigPanel
                                    config={config}
                                    onConfigChange={setConfig}
                                    onStartProcessing={handleStartProcessing}
                                    isUploading={isUploading}
                                />
                            )}
                        </>
                    ) : isProcessing ? (
                        /* Processing Progress */
                        <ProcessingProgress job={currentJob} />
                    ) : isComplete ? (
                        /* Results Viewer */
                        <ResultsViewer
                            job={currentJob}
                            onDownloadSrt={(type) => downloadResult('srt', type)}
                            onDownloadTxt={(type) => downloadResult('txt', type)}
                            ttsAudioUrl={getTtsAudioUrl()}
                            onNewUpload={handleNewUpload}
                        />
                    ) : (
                        /* Error State - show progress with error */
                        <>
                            <ProcessingProgress job={currentJob} />
                            <div className="mt-4 flex justify-center">
                                <Button onClick={handleNewUpload} variant="outline" className="gap-2">
                                    <ArrowLeft className="w-4 h-4" />
                                    Try Again
                                </Button>
                            </div>
                        </>
                    )}
                </main>
            </div>
        </div>
    );
}
