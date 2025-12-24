import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { WhisperService } from './services/whisperService';

let mainWindow: BrowserWindow | null = null;
let whisperService: WhisperService;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../out/index.html'));
  }
}

app.whenReady().then(() => {
  whisperService = new WhisperService();
  createWindow();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function setupIPC() {
  console.log('Setting up IPC handlers...');

  // File selection
  ipcMain.handle('select-audio-file', async () => {
    console.log('select-audio-file handler called');
    const result = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['mp3', 'wav', 'mp4', 'm4a', 'ogg', 'flac'] }
      ]
    });
    console.log('Dialog result:', result);
    return result.canceled ? null : result.filePaths[0];
  });

  // File transcription
  ipcMain.handle('transcribe-audio', async (event, audioPath: string) => {
    console.log('transcribe-audio handler called with:', audioPath);
    try {
      const result = await whisperService.transcribe(audioPath);
      console.log('Transcription successful:', result);
      return { success: true, ...result };
    } catch (error: any) {
      console.error('Transcription error:', error);
      return { success: false, error: error.message };
    }
  });

  // Start live caption
  ipcMain.handle('start-live-caption', async (event) => {
    console.log('start-live-caption handler called');

    if (whisperService.isRunning()) {
      return { success: false, error: 'Already running' };
    }

    try {
      // Start live transcription with callbacks
      whisperService.startLiveCaption(
        // Partial text callback
        (text: string) => {
          event.sender.send('caption-partial', { text });
        },
        // Final text callback
        (segment: any) => {
          event.sender.send('caption-final', segment);
        },
        // Status callback
        (status: string) => {
          event.sender.send('caption-status', { status });
        }
      ).catch(err => {
        console.error('Live caption error:', err);
        event.sender.send('caption-error', { error: err.message });
      });

      return { success: true };
    } catch (error: any) {
      console.error('Failed to start live caption:', error);
      return { success: false, error: error.message };
    }
  });

  // Stop live caption
  ipcMain.handle('stop-live-caption', async () => {
    console.log('stop-live-caption handler called');
    whisperService.stop();
    return { success: true };
  });

  console.log('IPC handlers registered');
}