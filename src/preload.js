const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sportsApi', {
  status: () => ipcRenderer.invoke('sports:status'),
  saveKey: (key) => ipcRenderer.invoke('sports:save-key', key),
  clearKey: () => ipcRenderer.invoke('sports:clear-key'),
  sync: () => ipcRenderer.invoke('sports:sync')
});
