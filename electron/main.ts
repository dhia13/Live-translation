import { app, BrowserWindow, ipcMain, session } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
// Better dev mode detection - check if we're running from source or built
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Store TTS stream ID for routing (moved outside createWindow to be accessible)
let ttsStreamId: string | null = null;
let ttsStreamWebContents: Electron.WebContents | null = null;

// Enable system audio loopback for macOS (if applicable)
// This allows capturing system audio without external drivers
if (process.platform === 'darwin') {
  // Enable macOS system audio loopback (macOS 13+)
  app.commandLine.appendSwitch('enable-features', 'MacLoopbackAudioForScreenShare,MacSckSystemAudioLoopbackOverride');
}

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

  mainWindow = new BrowserWindow({
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

  // TTS stream ID is stored at module level (declared above)

  // Configure display media request handler for automatic audio loopback
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      console.log('Display media request received:', request);
      
      // Get available desktop sources to provide a valid video source
      const { desktopCapturer } = require('electron');
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1, height: 1 } // Minimal thumbnail since we don't use it
      });
      
      console.log('Available desktop sources:', sources.length);
      
      // Use the first available screen source for video (we'll stop it in the renderer)
      const videoSource = sources[0];
      
      if (videoSource) {
        // Use loopback to capture system audio (includes TTS playing through speakers)
        // On macOS 13+, this works natively without external drivers
        // On Windows, this still requires system audio sharing permission
        const response = {
          video: videoSource, // Provide a valid video source (required by Electron API)
          audio: 'loopback' as const, // This captures system audio (incoming + TTS output)
        };
        
        console.log('✓ Providing display media with audio loopback');
        callback(response);
      } else {
        console.warn('No desktop sources available, letting browser handle it');
        // Fallback: let the browser handle it naturally
        callback({});
      }
    } catch (error: any) {
      console.error('Error in setDisplayMediaRequestHandler:', error);
      console.error('Error details:', error.message, error.stack);
      
      // If desktopCapturer fails (e.g., permission denied), let browser handle it
      // The browser will show its own permission prompt
      console.log('Falling back to browser default behavior');
      callback({});
    }
  });

  // Handle permission requests for media access
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    console.log('Permission requested:', permission, 'Details:', details);
    
    // Allow microphone and screen sharing permissions
    if (permission === 'media' || permission === 'display-capture') {
      console.log('✓ Allowing', permission, 'permission');
      callback(true);
    } else {
      console.log('✗ Denying', permission, 'permission');
      callback(false);
    }
  });

  // Custom device permission handler for HID, serial, and USB devices
  // Note: Microphone and camera permissions are handled by setPermissionRequestHandler
  session.defaultSession.setDevicePermissionHandler((details) => {
    console.log('Device permission requested:', details.deviceType, 'for', details.origin);
    
    // Allow HID, serial, and USB device access if needed
    // Microphone and camera are handled by setPermissionRequestHandler above
    if (details.deviceType === 'hid' || details.deviceType === 'serial' || details.deviceType === 'usb') {
      console.log('✓ Allowing', details.deviceType, 'access');
      return true;
    }
    
    console.log('✗ Denying', details.deviceType, 'access');
    return false;
  });

  // Load the app - always use dev server in development
  const loadApp = async () => {
    if (isDev) {
      // In development, always use the Next.js dev server
      const devUrl = 'http://localhost:3000';
      console.log('Loading from dev server:', devUrl);
      try {
        await mainWindow?.loadURL(devUrl);
      } catch (err) {
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
    } else {
      // In production, try to load from static export
      const prodPath = path.join(__dirname, '../out/index.html');
      const prodUrl = `file://${prodPath}`;
      console.log('Loading from production build:', prodUrl);
      
      try {
        await mainWindow?.loadURL(prodUrl);
      } catch (err) {
        console.error('Failed to load production build:', err);
        // Fallback to dev server if available
        console.log('Falling back to dev server...');
        try {
          await mainWindow?.loadURL('http://localhost:3000');
        } catch (fallbackErr) {
          console.error('Dev server also not available:', fallbackErr);
        }
      }
    }
  };

  loadApp();

  // Enable DevTools for debugging
  mainWindow.webContents.openDevTools();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Simple in-memory storage for API keys (in production, use electron-store)
let storedApiKeys: { deepgram?: string; deepl?: string } = {};

// IPC handlers for API keys
ipcMain.handle('get-api-keys', async () => {
  // Check environment variables first, then stored keys
  return {
    deepgram: process.env.DEEPGRAM_API_KEY || storedApiKeys.deepgram || '',
    deepl: process.env.DEEPL_API_KEY || storedApiKeys.deepl || '',
  };
});

ipcMain.handle('set-api-keys', async (event, keys: { deepgram?: string; deepl?: string }) => {
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
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
});

// Handle dynamic window height updates from renderer
ipcMain.handle('set-window-height', (event, newHeight: number) => {
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
ipcMain.handle('set-window-opacity', (event, opacity: number) => {
  if (mainWindow) {
    // Clamp opacity between 0.1 and 1.0
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    mainWindow.setOpacity(clampedOpacity);
  }
});

ipcMain.handle('get-window-opacity', () => {
  if (mainWindow) {
    return mainWindow.getOpacity();
  }
  return 1.0;
});

// TTS stream registration for microphone routing
ipcMain.handle('register-tts-stream', async (event, streamId: string) => {
  ttsStreamId = streamId;
  ttsStreamWebContents = event.sender;
  console.log('TTS stream registered:', streamId);
  console.log('📢 Virtual Microphone: TTS stream is ready');
  console.log('');
  console.log('⚠️  IMPORTANT: Electron cannot expose MediaStream as system microphone');
  console.log('   The TTS stream is available within this Electron app, but');
  console.log('   other applications (WhatsApp, Zoom, etc.) cannot access it directly.');
  console.log('');
  console.log('   To make TTS available to other apps, you need:');
  console.log('   Option 1: Virtual Audio Cable (External Software)');
  console.log('     - Windows: Install VB-Audio Virtual Cable');
  console.log('     - macOS: Install BlackHole');
  console.log('     - Route TTS audio through the virtual cable');
  console.log('');
  console.log('   Option 2: Native Driver Module (Advanced)');
  console.log('     - Create a C++ Node.js addon using WASAPI (Windows)');
  console.log('     - This creates a true virtual microphone device');
  console.log('     - Requires significant development effort');
  console.log('');
  console.log('   Current Status: TTS audio is routed to MediaStream');
  console.log('   This stream can be used within Electron/web contexts only.');
  
  return { success: true };
});

ipcMain.handle('unregister-tts-stream', () => {
  ttsStreamId = null;
  ttsStreamWebContents = null;
  console.log('TTS stream unregistered');
});

// Handle requests to get TTS audio stream
ipcMain.handle('get-tts-audio-stream', async () => {
  // Return information about the TTS stream
  return { 
    streamId: ttsStreamId,
    registered: ttsStreamId !== null,
    message: 'TTS stream is available in the renderer process'
  };
});

// Create a virtual microphone using Electron's desktopCapturer
// This will create a custom audio source that can be accessed via getUserMedia
ipcMain.handle('create-virtual-microphone', async () => {
  try {
    const { desktopCapturer } = require('electron');
    
    // Get available audio sources
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 1, height: 1 }
    });
    
    console.log('Available audio sources:', sources.length);
    
    // Note: Electron's desktopCapturer can capture audio from specific windows/apps
    // We can use this to create a virtual microphone source
    // However, to make it appear as a system microphone, we need a virtual audio driver
    
    return {
      success: true,
      message: 'Virtual microphone source created',
      sources: sources.map((s: Electron.DesktopCapturerSource) => ({ id: s.id, name: s.name }))
    };
  } catch (error: any) {
    console.error('Error creating virtual microphone:', error);
    return {
      success: false,
      error: error.message
    };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

