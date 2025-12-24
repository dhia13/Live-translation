"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const whisperService_1 = require("./services/whisperService");
let mainWindow = null;
let whisperService;
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path_1.default.join(__dirname, '../../out/index.html'));
    }
}
electron_1.app.whenReady().then(() => {
    whisperService = new whisperService_1.WhisperService();
    createWindow();
    setupIPC();
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
function setupIPC() {
    console.log('Setting up IPC handlers...');
    // File selection
    electron_1.ipcMain.handle('select-audio-file', async () => {
        console.log('select-audio-file handler called');
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: [
                { name: 'Audio', extensions: ['mp3', 'wav', 'mp4', 'm4a', 'ogg', 'flac'] }
            ]
        });
        console.log('Dialog result:', result);
        return result.canceled ? null : result.filePaths[0];
    });
    // File transcription
    electron_1.ipcMain.handle('transcribe-audio', async (event, audioPath) => {
        console.log('transcribe-audio handler called with:', audioPath);
        try {
            const result = await whisperService.transcribe(audioPath);
            console.log('Transcription successful:', result);
            return { success: true, ...result };
        }
        catch (error) {
            console.error('Transcription error:', error);
            return { success: false, error: error.message };
        }
    });
    // Start live caption
    electron_1.ipcMain.handle('start-live-caption', async (event) => {
        console.log('start-live-caption handler called');
        if (whisperService.isRunning()) {
            return { success: false, error: 'Already running' };
        }
        try {
            // Start live transcription with callbacks
            whisperService.startLiveCaption(
            // Partial text callback
            (text) => {
                event.sender.send('caption-partial', { text });
            }, 
            // Final text callback
            (segment) => {
                event.sender.send('caption-final', segment);
            }, 
            // Status callback
            (status) => {
                event.sender.send('caption-status', { status });
            }).catch(err => {
                console.error('Live caption error:', err);
                event.sender.send('caption-error', { error: err.message });
            });
            return { success: true };
        }
        catch (error) {
            console.error('Failed to start live caption:', error);
            return { success: false, error: error.message };
        }
    });
    // Stop live caption
    electron_1.ipcMain.handle('stop-live-caption', async () => {
        console.log('stop-live-caption handler called');
        whisperService.stop();
        return { success: true };
    });
    console.log('IPC handlers registered');
}
