import { ChildProcess, spawn } from 'child_process';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { io, Socket } from 'socket.io-client';

interface TranscriptionResult {
    text: string;
    language: string;
}

interface TranscriptionSegment {
    text: string;
    start: number;
    end: number;
    confidence?: number;
}

export class WhisperService {
    private modelPath: string;
    private whisperExePath: string;
    private pythonPath: string;
    private pythonServerPath: string;
    private dllPath: string;
    private whisperProcess: ChildProcess | null = null;
    private socketIOServer: ChildProcess | null = null;
    private socketClient: Socket | null = null;
    private isLiveMode: boolean = false;

    constructor() {
        const isDev = !app.isPackaged;
        const basePath = isDev ? process.cwd() : process.resourcesPath;

        // Paths for whisper-cli (file transcription)
        this.dllPath = path.join(basePath, 'native', 'ddl');
        this.whisperExePath = path.join(this.dllPath, 'whisper-cli.exe');
        this.modelPath = path.join(basePath, 'resources', 'models', 'ggml-base.bin');

        // Paths for Python Socket.IO server
        this.pythonPath = path.join(basePath, 'python-backend', 'venv', 'Scripts', 'python.exe');
        this.pythonServerPath = path.join(basePath, 'python-backend', 'whisper_socketio_server.py');

        // Add DLL directory to PATH
        if (process.platform === 'win32') {
            process.env.PATH = `${this.dllPath};${process.env.PATH}`;
        }

        console.log('Whisper Service initialized:', {
            whisperCli: this.whisperExePath,
            model: this.modelPath,
            python: this.pythonPath,
            server: this.pythonServerPath,
            pythonExists: fs.existsSync(this.pythonPath),
            serverExists: fs.existsSync(this.pythonServerPath)
        });
    }

    /**
     * Transcribe an audio file (existing functionality)
     */
    async transcribe(audioPath: string): Promise<TranscriptionResult> {
        console.log('Starting file transcription for:', audioPath);

        return new Promise((resolve, reject) => {
            const args = [
                '-m', this.modelPath,
                '-f', audioPath,
                '-t', '4',
                '-np',
                '-nt'
            ];

            let output = '';
            let errorOutput = '';

            this.whisperProcess = spawn(this.whisperExePath, args, {
                env: { ...process.env },
                windowsHide: true,
            });

            this.whisperProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });

            this.whisperProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });

            this.whisperProcess.on('close', (code) => {
                if (code === 0) {
                    const text = this.parseOutput(output);
                    resolve({ text, language: 'en' });
                } else {
                    reject(new Error(errorOutput || 'Transcription failed'));
                }
            });

            this.whisperProcess.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Start live transcription using Socket.IO streaming
     */
    async startLiveCaption(
        onPartialText: (text: string) => void,
        onFinalText: (segment: TranscriptionSegment) => void,
        onStatus: (status: string) => void
    ): Promise<void> {
        console.log('Starting Socket.IO-based live caption...');
        this.isLiveMode = true;

        // DON'T start the server - assume it's already running
        // Just connect to it
        return this.connectToSocketIOServer(onPartialText, onFinalText, onStatus);
    }

    /**
     * Connect to Socket.IO server and handle audio streaming
     */
    private async connectToSocketIOServer(
        onPartialText: (text: string) => void,
        onFinalText: (segment: any) => void,
        onStatus: (status: string) => void
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            console.log('Connecting to Socket.IO server...');

            this.socketClient = io('http://127.0.0.1:5000', {
                transports: ['websocket'],
                reconnection: true
            });

            this.socketClient.on('connect', () => {
                console.log('Connected to Socket.IO server');
                onStatus('connected');

                // Tell server to start listening
                this.socketClient?.emit('start_listening');

                // Start capturing and streaming audio
                this.startAudioStreaming();
            });

            this.socketClient.on('transcription', (data: any) => {
                console.log('Transcription received:', data);
                onFinalText({
                    text: data.text,
                    start: 0,
                    end: 0,
                    confidence: null
                });
                onPartialText(data.text);
            });

            this.socketClient.on('status', (data: any) => {
                console.log('Status:', data.message);
                onStatus(data.message);
            });

            this.socketClient.on('error', (data: any) => {
                console.error('Server error:', data.message);
                reject(new Error(data.message));
            });

            this.socketClient.on('disconnect', () => {
                console.log('Disconnected from Socket.IO server');
                this.isLiveMode = false;
                resolve();
            });

            this.socketClient.on('connect_error', (err: Error) => {
                console.error('Connection error:', err);
                reject(err);
            });
        });
    }

    /**
     * Capture audio from microphone and stream to Socket.IO server
     */
    private startAudioStreaming() {
        console.log('Note: Microphone capture not yet implemented');
        console.log('Server is running and connected, but no audio is being sent yet');

        // TODO: Implement actual microphone capture
        // For now, the connection is established but no audio flows
    }


    /**
     * Stop any running transcription
     */
    stop() {
        console.log('Stopping whisper service...');

        // Stop Socket.IO client
        if (this.socketClient) {
            this.socketClient.emit('stop_listening');
            this.socketClient.disconnect();
            this.socketClient = null;
        }

        // Don't kill the server - let it keep running

        // Stop whisper-cli process (for file transcription)
        if (this.whisperProcess) {
            this.whisperProcess.kill('SIGTERM');
            this.whisperProcess = null;
        }

        this.isLiveMode = false;
    }

    isRunning(): boolean {
        return this.isLiveMode;
    }

    private parseOutput(output: string): string {
        const lines = output.split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed &&
                    !trimmed.startsWith('[') &&
                    !trimmed.includes('whisper_') &&
                    !trimmed.includes('system_info') &&
                    !trimmed.includes('loading model');
            })
            .map(line => line.trim());

        return lines.join(' ').trim();
    }
}