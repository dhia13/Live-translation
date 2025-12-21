"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    getApiKeys: () => electron_1.ipcRenderer.invoke('get-api-keys'),
    setApiKeys: (keys) => electron_1.ipcRenderer.invoke('set-api-keys', keys),
    minimizeWindow: () => electron_1.ipcRenderer.invoke('window-minimize'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('window-maximize'),
    closeWindow: () => electron_1.ipcRenderer.invoke('window-close'),
    setWindowHeight: (height) => electron_1.ipcRenderer.invoke('set-window-height', height),
    setWindowOpacity: (opacity) => electron_1.ipcRenderer.invoke('set-window-opacity', opacity),
    getWindowOpacity: () => electron_1.ipcRenderer.invoke('get-window-opacity'),
});
