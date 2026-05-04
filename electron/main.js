const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const net = require("net");
const path = require("path");
const http = require("http");

const isDev = !app.isPackaged;
const ROOT = isDev ? path.join(__dirname, "..") : process.resourcesPath;

let win;
let serverProc;
let PORT;

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

function startServer(port) {
  const script = path.join(ROOT, "server.js");
  serverProc = spawn(process.execPath, [script], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  serverProc.stdout.on("data", d => console.log("[server]", d.toString().trim()));
  serverProc.stderr.on("data", d => console.warn("[server]", d.toString().trim()));
}

function waitReady(port, retries = 40) {
  return new Promise(resolve => {
    const tryIt = () => {
      http.get(`http://localhost:${port}/api/health`, r => {
        if (r.statusCode < 500) return resolve(true);
        retry();
      }).on("error", retry);
    };
    const retry = () => retries-- > 0 ? setTimeout(tryIt, 300) : resolve(false);
    tryIt();
  });
}

async function createWindow() {
  PORT = await findFreePort();
  startServer(PORT);
  const ready = await waitReady(PORT);

  if (!ready) {
    dialog.showErrorBox(
      "MIA kunne ikke starte",
      "Serveren svarede ikke inden for den tilladte tid.\nPrøv at genstarte appen."
    );
    app.quit();
    return;
  }

  win = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 360,
    minHeight: 640,
    title: "MIA",
    autoHideMenuBar: true,
    backgroundColor: "#0d0d0d",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadURL(`http://localhost:${PORT}`);
  win.on("closed", () => { win = null; });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function killServer() {
  if (serverProc) { serverProc.kill(); serverProc = null; }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { killServer(); if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", killServer);
