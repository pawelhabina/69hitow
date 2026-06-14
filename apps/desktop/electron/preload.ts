import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("beatGrid", {
  openAdminPanel: () => ipcRenderer.invoke("open-admin-panel"),
  openExternalUrl: (url: string) => ipcRenderer.invoke("open-external-url", url)
});
