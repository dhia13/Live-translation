import { useState, useCallback, useRef, useEffect } from 'react';
import { ProcessingJob, UploadConfig } from '../types';

const API_BASE = 'http://127.0.0.1:5000';

interface UseFileUploadReturn {
    // State
    isUploading: boolean;
    uploadProgress: number;
    currentJob: ProcessingJob | null;
    error: string | null;

    // Actions
    uploadFile: (file: File, config: UploadConfig) => Promise<void>;
    cancelJob: () => void;
    downloadResult: (format: 'srt' | 'txt') => void;
    getTtsAudioUrl: () => string | null;
    clearJob: () => void;
}

export function useFileUpload(): UseFileUploadReturn {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentJob, setCurrentJob] = useState<ProcessingJob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const pollingInterval = useRef<NodeJS.Timeout | null>(null);
    const abortController = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollingInterval.current) {
                clearInterval(pollingInterval.current);
            }
            if (abortController.current) {
                abortController.current.abort();
            }
        };
    }, []);

    const startPolling = useCallback((jobId: string) => {
        // Clear any existing polling
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
        }

        const poll = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/jobs/${jobId}`);
                if (!response.ok) {
                    throw new Error('Failed to get job status');
                }

                const job: ProcessingJob = await response.json();
                setCurrentJob(job);

                // Stop polling if job is complete or errored
                if (job.status === 'complete' || job.status === 'error') {
                    if (pollingInterval.current) {
                        clearInterval(pollingInterval.current);
                        pollingInterval.current = null;
                    }

                    if (job.status === 'error') {
                        setError(job.error_message || 'Processing failed');
                    }
                }
            } catch (err) {
                console.error('Polling error:', err);
            }
        };

        // Poll immediately, then every second
        poll();
        pollingInterval.current = setInterval(poll, 1000);
    }, []);

    const uploadFile = useCallback(async (file: File, config: UploadConfig) => {
        setIsUploading(true);
        setUploadProgress(0);
        setError(null);
        setCurrentJob(null);

        abortController.current = new AbortController();

        const formData = new FormData();
        formData.append('file', file);
        formData.append('mode', config.mode);
        formData.append('source_language', config.sourceLanguage || '');
        formData.append('target_language', config.targetLanguage || '');
        formData.append('tts_voice', config.ttsVoice);
        formData.append('tts_speed', config.ttsSpeed.toString());

        try {
            const response = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                body: formData,
                signal: abortController.current.signal,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Upload failed');
            }

            const data = await response.json();
            setUploadProgress(100);

            // Start polling for job status
            startPolling(data.job_id);

        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                setError('Upload cancelled');
            } else {
                setError(err instanceof Error ? err.message : 'Upload failed');
            }
        } finally {
            setIsUploading(false);
        }
    }, [startPolling]);

    const cancelJob = useCallback(() => {
        // Abort upload if in progress
        if (abortController.current) {
            abortController.current.abort();
        }

        // Stop polling
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }

        // Delete job on server if exists
        if (currentJob) {
            fetch(`${API_BASE}/api/jobs/${currentJob.job_id}`, {
                method: 'DELETE',
            }).catch(console.error);
        }

        setCurrentJob(null);
        setIsUploading(false);
        setError(null);
    }, [currentJob]);

    const downloadResult = useCallback((format: 'srt' | 'txt', type: 'original' | 'translated' = 'translated') => {
        if (!currentJob || currentJob.status !== 'complete') {
            return;
        }

        const url = `${API_BASE}/api/jobs/${currentJob.job_id}/download/${format}?type=${type}`;
        window.open(url, '_blank');
    }, [currentJob]);

    const getTtsAudioUrl = useCallback(() => {
        if (!currentJob || !currentJob.has_tts_audio) {
            return null;
        }
        return `${API_BASE}/api/jobs/${currentJob.job_id}/tts-audio`;
    }, [currentJob]);

    const clearJob = useCallback(() => {
        // Stop polling
        if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
            pollingInterval.current = null;
        }

        // Delete job on server
        if (currentJob) {
            fetch(`${API_BASE}/api/jobs/${currentJob.job_id}`, {
                method: 'DELETE',
            }).catch(console.error);
        }

        setCurrentJob(null);
        setError(null);
        setUploadProgress(0);
    }, [currentJob]);

    return {
        isUploading,
        uploadProgress,
        currentJob,
        error,
        uploadFile,
        cancelJob,
        downloadResult,
        getTtsAudioUrl,
        clearJob,
    };
}
