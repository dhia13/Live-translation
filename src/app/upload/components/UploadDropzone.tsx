'use client';
import { useCallback, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, FileVideo, X } from 'lucide-react';

interface UploadDropzoneProps {
    onFileSelect: (file: File | null) => void;
    selectedFile: File | null;
    isUploading: boolean;
}

const MAX_SIZE = 200 * 1024 * 1024; // 200MB
const ACCEPTED_EXTENSIONS = ['.mp3', '.wav', '.mp4', '.webm'];
const ACCEPTED_MIMES = ['audio/mpeg', 'audio/wav', 'audio/wave', 'video/mp4', 'video/webm'];

export default function UploadDropzone({ onFileSelect, selectedFile, isUploading }: UploadDropzoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [dragError, setDragError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const validateFile = (file: File): string | null => {
        // Check size
        if (file.size > MAX_SIZE) {
            return 'File is too large. Maximum size is 200MB.';
        }

        // Check type
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext) && !ACCEPTED_MIMES.includes(file.type)) {
            return 'Invalid file type. Supported: MP3, WAV, MP4, WebM';
        }

        return null;
    };

    const handleFile = useCallback((file: File) => {
        const error = validateFile(file);
        if (error) {
            setDragError(error);
            return;
        }
        setDragError(null);
        onFileSelect(file);
    }, [onFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleClick = useCallback(() => {
        inputRef.current?.click();
    }, []);

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(1)} KB`;
        }
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    const isAudio = selectedFile?.type.startsWith('audio');

    return (
        <Card className={`bg-zinc-900/50 border-2 border-dashed transition-colors ${
            isDragging ? 'border-violet-500 bg-violet-500/10' : 'border-zinc-700 hover:border-zinc-600'
        }`}>
            <CardContent className="p-8">
                <input
                    ref={inputRef}
                    type="file"
                    accept=".mp3,.wav,.mp4,.webm,audio/mpeg,audio/wav,video/mp4,video/webm"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={isUploading}
                />

                {!selectedFile ? (
                    <div
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={handleClick}
                        className={`flex flex-col items-center justify-center py-12 cursor-pointer ${
                            isDragging ? 'text-violet-400' : 'text-zinc-400'
                        }`}
                    >
                        <Upload className={`w-16 h-16 mb-4 ${isDragging ? 'text-violet-400' : 'text-zinc-600'}`} />
                        <p className="text-lg font-medium mb-2">
                            {isDragging ? 'Drop file here' : 'Drag & drop a file here'}
                        </p>
                        <p className="text-sm text-zinc-500">
                            or click to browse
                        </p>
                        <p className="text-xs text-zinc-600 mt-4">
                            Supported: MP3, WAV, MP4, WebM (max 200MB)
                        </p>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {isAudio ? (
                                <div className="w-12 h-12 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                                    <FileAudio className="w-6 h-6 text-violet-400" />
                                </div>
                            ) : (
                                <div className="w-12 h-12 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
                                    <FileVideo className="w-6 h-6 text-cyan-400" />
                                </div>
                            )}
                            <div>
                                <p className="font-medium text-zinc-100">{selectedFile.name}</p>
                                <p className="text-sm text-zinc-500">{formatFileSize(selectedFile.size)}</p>
                            </div>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                                e.stopPropagation();
                                onFileSelect(null);
                            }}
                            disabled={isUploading}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                )}

                {dragError && (
                    <p className="text-red-400 text-sm mt-4 text-center">{dragError}</p>
                )}
            </CardContent>
        </Card>
    );
}
