const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sportsApi', {
  status: () => ipcRenderer.invoke('sports:status'),
  saveKey: (key) => ipcRenderer.invoke('sports:save-key', key),
  clearKey: () => ipcRenderer.invoke('sports:clear-key'),
  saveOddsKey: (key) => ipcRenderer.invoke('sports:save-odds-key', key),
  clearOddsKey: () => ipcRenderer.invoke('sports:clear-odds-key'),
  sync: () => ipcRenderer.invoke('sports:sync')
});
