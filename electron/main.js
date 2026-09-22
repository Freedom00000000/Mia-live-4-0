const { app, BrowserWindow, shell, dialog, Tray, Menu, nativeImage } = require("electron");
const path = require("path");

// app.getAppPath() resolves correctly in both dev and packaged builds
// (resources/app/ when asar:false, resources/app.asar when asar:true)
const ROOT = app.getAppPath();

let win, tray, PORT;

// ── Start Express server in-process ────────────────────────────────────────
function startServer(port) {
  const { start } = require(path.join(ROOT, "server.js"));
  return start(port);
}

// ── Build tray icon from embedded data (no external file needed) ────────────
function makeTrayIcon() {
  // 16×16 magenta-on-dark "M" icon encoded as PNG data URL
  const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGPk5eX9z0ABYKJEM1UMYIExLviuhwsabA7EqQFdHVYXICsiJI7TC+iKcRmKYQA+52OTx+oCmCKYrTAam+EEYwGX0wkagG4bLq/hdQFME75wIegFQoFKcUpkHPqZCQCffB/VBk4kNQAAAABJRU5ErkJggg==";
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
    icon: makeTrayIcon(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://127.0.0.1:${PORT}`);

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
    // A stable origin keeps localStorage (profile and user-entered keys) across launches.
    PORT = Number(process.env.MIA_PORT) || 43108;
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
