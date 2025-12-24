"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const smart_whisper_1 = require("smart-whisper");
// --- ENVIRONMENT SETUP ---
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
// --- WHISPER PATHS ---
const modelPath = isDev
    ? path.join(process.cwd(), 'resources', 'models', 'ggml-base.bin')
    : path.join(process.resourcesPath, 'models', 'ggml-base.bin');
if (process.platform === 'win32') {
    const releasePath = path.join(process.cwd(), 'node_modules', 'smart-whisper', 'build', 'Release');
    process.env.PATH = `${releasePath};${process.env.PATH}`;
}
if (process.platform === 'win32') {
    // This tells OpenVINO/Intel runtimes to ignore the GPU device
    process.env.OPENVINO_DEVICE = 'CPU';
    // Optional: Force the backend to stay away from the GPU
    process.env.GGML_OPENCL_PLATFORM = '0';
}
// Whisper instance (loaded once, kept in memory)
let whisperInstance = null;
let isModelLoading = false;
let modelLoadPromise = null;
// Initialize Whisper model
async function initializeWhisper() {
    if (whisperInstance) {
        return; // Already loaded
    }
    if (isModelLoading && modelLoadPromise) {
        return modelLoadPromise; // Wait for ongoing load
    }
    isModelLoading = true;
    modelLoadPromise = (async () => {
        try {
            if (!fs.existsSync(modelPath)) {
                throw new Error(`Model not found at: ${modelPath}`);
            }
            console.log(`[Whisper] Loading model from: ${modelPath}`);
            whisperInstance = new smart_whisper_1.Whisper(modelPath, {
                gpu: false, // Turn this off for now to stop the crashing
                offload: 0
            });
            console.log(`[Whisper] Model loaded successfully!`);
        }
        catch (error) {
            console.error(`[Whisper] Failed to load model:`, error.message);
            throw error;
        }
        finally {
            isModelLoading = false;
        }
    })();
    return modelLoadPromise;
}
console.log("📂 Model path:", modelPath);
// --- WINDOW MANAGEMENT ---
let mainWindow = null;
if (process.platform === 'darwin') {
    electron_1.app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride');
}
function createWindow() {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const preloadPath = path.join(__dirname, 'preload.js');
    const windowHeight = Math.max(140, 500);
    const maxWidth = Math.floor(width * 0.7);
    mainWindow = new electron_1.BrowserWindow({
        width: maxWidth,
        height: windowHeight,
        x: (width - maxWidth) / 2,
        y: height - windowHeight,
        transparent: true,
        frame: true,
        hasShadow: false,
        alwaysOnTop: false,
        skipTaskbar: false,
        resizable: true,
        movable: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            webSecurity: false,
        },
    });
    // Configure display media request handler
    electron_1.session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
        try {
            console.log('Display media request received:', request);
            const { desktopCapturer } = require('electron');
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: 1, height: 1 }
            });
            console.log('Available desktop sources:', sources.length);
            const videoSource = sources[0];
            if (videoSource) {
                const response = {
                    video: videoSource,
                    audio: 'loopback',
                };
                console.log('✓ Providing display media with audio loopback');
                callback(response);
            }
            else {
                console.warn('No desktop sources available, letting browser handle it');
                callback({});
            }
        }
        catch (error) {
            console.error('Error in setDisplayMediaRequestHandler:', error);
            console.log('Falling back to browser default behavior');
            callback({});
        }
    });
    // Handle permission requests
    electron_1.session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
        console.log('Permission requested:', permission, 'Details:', details);
        if (permission === 'media' || permission === 'display-capture') {
            console.log('✓ Allowing', permission, 'permission');
            callback(true);
        }
        else {
            console.log('✗ Denying', permission, 'permission');
            callback(false);
        }
    });
    electron_1.session.defaultSession.setDevicePermissionHandler((details) => {
        console.log('Device permission requested:', details.deviceType, 'for', details.origin);
        if (details.deviceType === 'hid' || details.deviceType === 'serial' || details.deviceType === 'usb') {
            console.log('✓ Allowing', details.deviceType, 'access');
            return true;
        }
        console.log('✗ Denying', details.deviceType, 'access');
        return false;
    });
    // Load the app
    const loadApp = async () => {
        if (isDev) {
            const devUrl = 'http://localhost:3000';
            console.log('Loading from dev server:', devUrl);
            try {
                await mainWindow?.loadURL(devUrl);
            }
            catch (err) {
                console.error('Failed to load dev server. Make sure Next.js is running:', err);
                mainWindow?.webContents.executeJavaScript(`
          document.body.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; color: white; font-family: system-ui;">
            <div style="text-align: center;">
              <h1>Next.js Dev Server Not Running</h1>
              <p>Please run: npm run dev</p>
            </div>
          </div>';
        `);
            }
        }
        else {
            const prodPath = path.join(__dirname, '../out/index.html');
            const prodUrl = `file://${prodPath}`;
            console.log('Loading from production build:', prodUrl);
            try {
                await mainWindow?.loadURL(prodUrl);
            }
            catch (err) {
                console.error('Failed to load production build:', err);
                console.log('Falling back to dev server...');
                try {
                    await mainWindow?.loadURL('http://localhost:3000');
                }
                catch (fallbackErr) {
                    console.error('Dev server also not available:', fallbackErr);
                }
            }
        }
    };
    loadApp();
    mainWindow.webContents.openDevTools();
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// --- WHISPER INTEGRATION ---
// Main transcription function using smart-whisper
async function transcribeWithWhisper(audioData, options = {}) {
    try {
        // Ensure model is loaded
        if (!whisperInstance) {
            await initializeWhisper();
        }
        if (!whisperInstance) {
            throw new Error('Whisper model failed to load');
        }
        // Ensure audio is normalized to -1 to 1 range
        const normalizedAudio = new Float32Array(audioData.length);
        for (let i = 0; i < audioData.length; i++) {
            normalizedAudio[i] = Math.max(-1, Math.min(1, audioData[i]));
        }
        // Transcribe using smart-whisper
        // Inside transcribeWithWhisper
        const task = await whisperInstance.transcribe(normalizedAudio, {
            language: options.language || 'en',
            translate: options.translate || false,
            n_threads: 4, // You can safely use more threads on CPU
            format: 'simple',
            // DO NOT include openvino_device here
        });
        // Get the result (result is a promise that resolves to an array)
        const results = await task.result;
        // Extract text from results array (each result has a 'text' property)
        const transcription = results
            .map((r) => r.text)
            .join(' ')
            .trim();
        return transcription;
    }
    catch (error) {
        console.error('[Whisper] Transcription error:', error.message);
        throw error;
    }
}
// --- IPC HANDLERS ---
electron_1.ipcMain.handle('test-whisper-transcription', async (event) => {
    try {
        console.log("[Whisper Test] Starting...");
        if (!fs.existsSync(modelPath)) {
            return {
                success: false,
                error: `Model not found at: ${modelPath}`
            };
        }
        // Ensure model is loaded
        if (!whisperInstance) {
            await initializeWhisper();
        }
        if (!whisperInstance) {
            return {
                success: false,
                error: 'Failed to load Whisper model'
            };
        }
        const testAudio = new Float32Array(16000);
        const text = await transcribeWithWhisper(testAudio, { language: 'en' });
        return {
            success: true,
            text: text || '(silence detected)',
            message: 'Whisper is working!'
        };
    }
    catch (error) {
        console.error('[Whisper Test] Error:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
});
electron_1.ipcMain.handle('transcribe-with-whisper', async (event, audioData, options) => {
    try {
        const float32Array = audioData instanceof Float32Array
            ? audioData
            : audioData instanceof ArrayBuffer
                ? new Float32Array(audioData)
                : Array.isArray(audioData)
                    ? new Float32Array(audioData)
                    : new Float32Array(Object.values(audioData));
        if (float32Array.length === 0) {
            return { success: false, error: 'Empty audio data' };
        }
        console.log(`[Whisper] Transcribing ${float32Array.length} samples (${(float32Array.length / 16000).toFixed(1)}s)`);
        const text = await transcribeWithWhisper(float32Array, {
            language: options?.language || 'en',
            translate: options?.translate !== false,
            threads: 4
        });
        return { success: true, text: text };
    }
    catch (error) {
        console.error('🛑 Transcription failed:', error.message);
        return { success: false, error: error.message };
    }
});
// Streaming transcription with queue
let audioBufferAccumulator = new Float32Array(0);
const CHUNK_THRESHOLD = 16000 * 3;
let isTranscribing = false;
const transcriptionQueue = [];
async function processTranscriptionQueue() {
    if (isTranscribing || transcriptionQueue.length === 0) {
        return;
    }
    isTranscribing = true;
    const { buffer, event } = transcriptionQueue.shift();
    try {
        // Check if audio has actual signal (not just silence)
        const maxAmplitude = Math.max(...Array.from(buffer.map(Math.abs)));
        if (maxAmplitude < 0.01) {
            console.log('[Whisper] Skipping silent audio chunk');
            isTranscribing = false;
            processTranscriptionQueue(); // Process next in queue
            return;
        }
        console.log(`[Whisper] Processing queue item: ${buffer.length} samples (${(buffer.length / 16000).toFixed(1)}s), queue size: ${transcriptionQueue.length}`);
        const text = await transcribeWithWhisper(buffer, {
            language: 'en',
            translate: true
        });
        console.log(`[Whisper] Transcription result: "${text}"`);
        if (text && text.trim() && text.trim().toLowerCase() !== '[blank_audio]') {
            event.sender.send('whisper-text', text.trim());
        }
    }
    catch (error) {
        console.error("❌ Transcription Error:", error.message);
    }
    finally {
        isTranscribing = false;
        // Process next item in queue
        processTranscriptionQueue();
    }
}
electron_1.ipcMain.on('stream-audio-to-whisper', async (event, audioChunk) => {
    try {
        const newBuffer = new Float32Array(audioBufferAccumulator.length + audioChunk.length);
        newBuffer.set(audioBufferAccumulator);
        newBuffer.set(audioChunk, audioBufferAccumulator.length);
        audioBufferAccumulator = newBuffer;
        if (audioBufferAccumulator.length >= CHUNK_THRESHOLD) {
            const processingBuffer = audioBufferAccumulator;
            audioBufferAccumulator = new Float32Array(0);
            // Add to queue instead of processing immediately
            transcriptionQueue.push({ buffer: processingBuffer, event });
            processTranscriptionQueue();
        }
    }
    catch (error) {
        console.error("❌ Streaming Error:", error);
    }
});
// --- APP LIFECYCLE ---
electron_1.app.whenReady().then(async () => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
    // Initialize Whisper model on startup
    setTimeout(async () => {
        console.log("\n" + "=".repeat(70));
        console.log("🔍 Whisper Health Check");
        console.log("=".repeat(70));
        if (fs.existsSync(modelPath)) {
            console.log("✅ Model file found:", modelPath);
            try {
                await initializeWhisper();
                console.log("🚀 WHISPER READY - Model loaded in memory!");
                console.log("💡 Using smart-whisper Node.js bindings (no external process needed)");
            }
            catch (error) {
                console.error("❌ Failed to load Whisper model:", error.message);
                console.error("💡 Make sure the model file is valid");
            }
        }
        else {
            console.error("❌ Model file not found:", modelPath);
            console.error("💡 Download from: https://huggingface.co/ggerganov/whisper.cpp");
        }
        console.log("=".repeat(70) + "\n");
    }, 1500);
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
electron_1.app.on('before-quit', async () => {
    // Clean up Whisper instance
    if (whisperInstance) {
        try {
            console.log('[Whisper] Freeing model resources...');
            await whisperInstance.free();
            console.log('[Whisper] Model resources freed');
        }
        catch (error) {
            console.warn('[Whisper] Error freeing resources:', error.message);
        }
    }
});
