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
const path = __importStar(require("path"));
let mainWindow = null;
// Better dev mode detection - check if we're running from source or built
const isDev = process.env.NODE_ENV === 'development' || !electron_1.app.isPackaged;
function createWindow() {
    // Get screen dimensions
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    // Determine preload path
    const preloadPath = path.join(__dirname, 'preload.js');
    // Calculate window height - should accommodate subtitle area + modal if needed
    // Subtitle area is ~140px, modal can be up to ~400px, so we'll use a larger default
    const windowHeight = Math.max(140, 500); // At least subtitle height, but allow for modal
    const maxWidth = Math.floor(width * 0.7); // 70% of screen width
    mainWindow = new electron_1.BrowserWindow({
        width: maxWidth,
        height: windowHeight,
        x: (width - maxWidth) / 2, // Center horizontally
        y: height - windowHeight, // Position at bottom of screen
        minWidth: 400,
        maxWidth: maxWidth, // Limit to 70% of screen - enforced in Electron
        minHeight: 140, // Minimum height for subtitle area
        transparent: true, // Transparent window
        frame: false, // Remove title bar/header
        hasShadow: false, // No shadow for transparent windows
        alwaysOnTop: true,
        skipTaskbar: false,
        resizable: true, // Enable resizing from borders
        movable: true, // Enable moving
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            webSecurity: false, // Required for mediaDevices access
        },
    });
    // Configure display media request handler for automatic audio loopback
    electron_1.session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        // Automatically grant audio loopback permissions
        callback({
            audio: 'loopback', // This captures system audio
            video: undefined, // No video, audio only
        });
    });
    // Load the app - always use dev server in development
    const loadApp = async () => {
        if (isDev) {
            // In development, always use the Next.js dev server
            const devUrl = 'http://localhost:3000';
            console.log('Loading from dev server:', devUrl);
            try {
                await mainWindow?.loadURL(devUrl);
            }
            catch (err) {
                console.error('Failed to load dev server. Make sure Next.js is running:', err);
                // Show error in window
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
            // In production, try to load from static export
            const prodPath = path.join(__dirname, '../out/index.html');
            const prodUrl = `file://${prodPath}`;
            console.log('Loading from production build:', prodUrl);
            try {
                await mainWindow?.loadURL(prodUrl);
            }
            catch (err) {
                console.error('Failed to load production build:', err);
                // Fallback to dev server if available
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
    // DevTools disabled - don't open automatically
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Simple in-memory storage for API keys (in production, use electron-store)
let storedApiKeys = {};
// IPC handlers for API keys
electron_1.ipcMain.handle('get-api-keys', async () => {
    // Check environment variables first, then stored keys
    return {
        deepgram: process.env.DEEPGRAM_API_KEY || storedApiKeys.deepgram || '',
        deepl: process.env.DEEPL_API_KEY || storedApiKeys.deepl || '',
    };
});
electron_1.ipcMain.handle('set-api-keys', async (event, keys) => {
    // Store API keys in memory (persists for the session)
    // In production, you should use electron-store for persistent storage
    if (keys.deepgram !== undefined) {
        storedApiKeys.deepgram = keys.deepgram;
        process.env.DEEPGRAM_API_KEY = keys.deepgram;
    }
    if (keys.deepl !== undefined) {
        storedApiKeys.deepl = keys.deepl;
        process.env.DEEPL_API_KEY = keys.deepl;
    }
    return { success: true };
});
// Window control handlers
electron_1.ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize();
});
electron_1.ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
        mainWindow.unmaximize();
    }
    else {
        mainWindow?.maximize();
    }
});
electron_1.ipcMain.handle('window-close', () => {
    mainWindow?.close();
});
// Handle dynamic window height updates from renderer
electron_1.ipcMain.handle('set-window-height', (event, newHeight) => {
    if (mainWindow) {
        const currentBounds = mainWindow.getBounds();
        const screenHeight = require('electron').screen.getPrimaryDisplay().workAreaSize.height;
        const minHeight = 140;
        const maxHeight = screenHeight - 50; // Leave some margin from top
        // Clamp height between min and max
        const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
        // Only update height, preserve current position
        mainWindow.setBounds({
            ...currentBounds,
            height: clampedHeight,
            // Don't change Y position - let user control window position
        });
    }
});
// Handle window opacity changes
electron_1.ipcMain.handle('set-window-opacity', (event, opacity) => {
    if (mainWindow) {
        // Clamp opacity between 0.1 and 1.0
        const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
        mainWindow.setOpacity(clampedOpacity);
    }
});
electron_1.ipcMain.handle('get-window-opacity', () => {
    if (mainWindow) {
        return mainWindow.getOpacity();
    }
    return 1.0;
});
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
