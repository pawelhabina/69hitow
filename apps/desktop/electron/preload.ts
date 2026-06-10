import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("beatGrid", {
  openAdminPanel: () => ipcRenderer.invoke("open-admin-panel")
});
