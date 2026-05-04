const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require("electron");
const net  = require("net");
const path = require("path");

const ROOT = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");

let win, tray, PORT;

// ── Find a free port ────────────────────────────────────────────────────────
function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

// ── Start Express server in-process ────────────────────────────────────────
function startServer(port) {
  const { start } = require(path.join(ROOT, "server.js"));
  return start(port);
}

// ── Build tray icon from embedded data (no external file needed) ────────────
function makeTrayIcon() {
  // 16×16 magenta-on-dark "M" icon encoded as PNG data URL
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/" +
    "9hAAAAAXNSR0IArs4c6QAAAARnQU5ErkJggg==";
  try {
    const img = nativeImage.createFromPath(path.join(ROOT, "assets", "icon.png"));
    if (!img.isEmpty()) return img;
  } catch (_) {}
  return nativeImage.createFromDataURL(dataUrl);
}

// ── System tray ─────────────────────────────────────────────────────────────
function createTray() {
  tray = new Tray(makeTrayIcon());
  tray.setToolTip("MIA");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Åbn MIA",   click: showWindow },
    { type: "separator" },
    { label: "Afslut",    click: quitApp },
  ]));
  tray.on("click", showWindow);
}

function showWindow() {
  if (!win) return createChatWindow();
  win.isVisible() ? win.focus() : win.show();
}

function quitApp() {
  app.isQuitting = true;
  app.quit();
}

// ── Chat window ─────────────────────────────────────────────────────────────
function createChatWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 360,
    minHeight: 640,
    title: "MIA",
    autoHideMenuBar: true,
    backgroundColor: "#0d0d0d",
    icon: path.join(ROOT, "assets", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${PORT}`);

  // Minimise to tray instead of closing
  win.on("close", e => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
      tray.displayBalloon({
        iconType: "none",
        title: "MIA kører stadig",
        content: "Klik på ikonet i systembakken for at åbne MIA igen.",
      });
    }
  });

  win.on("closed", () => { win = null; });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

// ── Boot ─────────────────────────────────────────────────────────────────────
app.isQuitting = false;

app.whenReady().then(async () => {
  try {
    PORT = await findFreePort();
    await startServer(PORT);
  } catch (err) {
    dialog.showErrorBox("MIA kunne ikke starte", `Serverfejl:\n${err.message}`);
    app.quit();
    return;
  }

  createTray();
  createChatWindow();
});

// Keep running in tray when all windows are closed
app.on("window-all-closed", () => {});
app.on("before-quit", () => { app.isQuitting = true; });
app.on("activate", showWindow); // macOS dock click
