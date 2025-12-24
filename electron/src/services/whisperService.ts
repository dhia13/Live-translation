import { app } from 'electron';
import path from 'path';
// Import the interfaces directly as types
import { WhisperAddon, WhisperParams } from '../types/whisper-addon';

export class WhisperService {
    private addon: WhisperAddon;

    constructor() {
        const isDev = !app.isPackaged;

        // Use process.resourcesPath for production (asarUnpack handles this)
        const addonPath = isDev
            ? path.join(process.cwd(), 'electron/bin/whisper-addon.node')
            : path.join(process.resourcesPath, 'bin/whisper-addon.node');

        // Cast the required module to our WhisperAddon interface
        this.addon = require(addonPath) as WhisperAddon;
    }

    async translateFrenchToEnglish(audioBuffer: Buffer, modelPath: string): Promise<string> {
        const params: WhisperParams = {
            model: modelPath,
            buffer: audioBuffer,
            language: 'fr',
            translate: true,
            threads: 4
        };

        return new Promise((resolve, reject) => {
            this.addon.whisper_transcribe(params, (err, result) => {
                if (err) return reject(err);
                resolve(result.text.trim());
            });
        });
    }
}