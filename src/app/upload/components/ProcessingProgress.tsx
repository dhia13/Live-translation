'use client';
import { ProcessingJob } from '../../types';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, Circle, Loader2, XCircle } from 'lucide-react';

interface ProcessingProgressProps {
    job: ProcessingJob;
}

interface Step {
    status: string;
    label: string;
}

const ALL_STEPS: Step[] = [
    { status: 'extracting', label: 'Extracting Audio' },
    { status: 'transcribing', label: 'Transcribing' },
    { status: 'translating', label: 'Translating' },
    { status: 'synthesizing', label: 'Generating TTS' },
    { status: 'complete', label: 'Complete' },
];

export default function ProcessingProgress({ job }: ProcessingProgressProps) {
    // Filter steps based on processing mode
    const steps = ALL_STEPS.filter(step => {
        if (job.mode === 'transcribe' && ['translating', 'synthesizing'].includes(step.status)) {
            return false;
        }
        if (job.mode === 'transcribe_translate' && step.status === 'synthesizing') {
            return false;
        }
        return true;
    });

    const currentStepIndex = steps.findIndex(s => s.status === job.status);
    const isError = job.status === 'error';

    return (
        <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-6">
                {/* File info and progress bar */}
                <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-zinc-200">{job.filename}</span>
                        <span className="text-sm text-zinc-500">
                            {isError ? 'Error' : `${Math.round(job.progress * 100)}%`}
                        </span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-300 ${
                                isError
                                    ? 'bg-red-500'
                                    : 'bg-gradient-to-r from-violet-500 to-cyan-500'
                            }`}
                            style={{ width: `${job.progress * 100}%` }}
                        />
                    </div>
                    {job.audio_duration > 0 && (
                        <p className="text-xs text-zinc-500 mt-2">
                            Audio duration: {Math.floor(job.audio_duration / 60)}:{Math.floor(job.audio_duration % 60).toString().padStart(2, '0')}
                        </p>
                    )}
                </div>

                {/* Steps */}
                <div className="space-y-3">
                    {steps.map((step, index) => {
                        const stepIndex = steps.findIndex(s => s.status === step.status);
                        const isComplete = stepIndex < currentStepIndex || job.status === 'complete';
                        const isCurrent = step.status === job.status && job.status !== 'complete';
                        const isPending = stepIndex > currentStepIndex;

                        return (
                            <div key={step.status} className="flex items-center gap-3">
                                {isError && isCurrent ? (
                                    <XCircle className="w-5 h-5 text-red-400" />
                                ) : isComplete ? (
                                    <CheckCircle className="w-5 h-5 text-emerald-400" />
                                ) : isCurrent ? (
                                    <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
                                ) : (
                                    <Circle className="w-5 h-5 text-zinc-600" />
                                )}
                                <span className={`text-sm ${
                                    isComplete ? 'text-zinc-200' :
                                    isCurrent ? 'text-zinc-100 font-medium' :
                                    'text-zinc-600'
                                }`}>
                                    {step.label}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Error message */}
                {isError && job.error_message && (
                    <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                        <p className="text-sm text-red-400">{job.error_message}</p>
                    </div>
                )}

                {/* Processing segments count */}
                {job.segments.length > 0 && job.status !== 'complete' && (
                    <p className="text-xs text-zinc-500 mt-4">
                        Processed {job.segments.length} segments...
                    </p>
                )}
            </CardContent>
        </Card>
    );
}
