import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";

const ADMIN_PANEL_URL = import.meta.env.VITE_ADMIN_PANEL_URL ?? process.env.VITE_ADMIN_PANEL_URL ?? "http://localhost:5174";

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#040817",
    title: "69hitow",
    webPreferences: {
      preload: join(__dirname, "../preload/preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

ipcMain.handle("open-admin-panel", async () => {
  try {
    const url = new URL(ADMIN_PANEL_URL);
    if (!["http:", "https:"].includes(url.protocol)) return false;
    await shell.openExternal(url.toString());
    return true;
  } catch {
    return false;
  }
});

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
