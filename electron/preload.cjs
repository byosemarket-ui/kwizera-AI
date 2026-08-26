"use strict";

const { contextBridge, ipcRenderer } = require("electron");

/**
 * Minimal secure bridge — no arbitrary shell/exec exposure.
 */
contextBridge.exposeInMainWorld("kwizeraDesktop", {
  getAppInfo: () => ipcRenderer.invoke("app:getInfo"),
  getMachineStatus: () => ipcRenderer.invoke("app:getMachineStatus"),
  getLocalServiceStatus: () => ipcRenderer.invoke("app:getLocalServiceStatus"),
  restartApplication: () => ipcRenderer.invoke("app:restart"),
  openLogs: () => ipcRenderer.invoke("app:openLogs"),
  retryStartup: () => ipcRenderer.invoke("app:retryStartup"),
  closeApplication: () => ipcRenderer.invoke("app:close"),
  openProductImages: () => ipcRenderer.invoke("dialog:openProductImages"),
  openProductImageFolder: () => ipcRenderer.invoke("dialog:openProductImageFolder"),
  onStartupUpdate: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("startup:update", listener);
    return () => ipcRenderer.removeListener("startup:update", listener);
  },
  onStartupFailed: (handler) => {
    const listener = (_event, payload) => handler(payload);
    ipcRenderer.on("startup:failed", listener);
    return () => ipcRenderer.removeListener("startup:failed", listener);
  },
});
