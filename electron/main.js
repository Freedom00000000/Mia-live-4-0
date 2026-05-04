const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");

const isDev = !app.isPackaged;
const ROOT = isDev ? path.join(__dirname, "..") : process.resourcesPath;

let win;
let serverProc;

function startServer() {
  return new Promise(resolve => {
    const script = path.join(ROOT, "server.js");
    serverProc = spawn(process.execPath, [script], {
      cwd: ROOT,
      env: { ...process.env, PORT: "3000" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    serverProc.stdout.on("data", d => {
      const line = d.toString().trim();
      console.log("[server]", line);
      if (line.includes("kører på")) resolve();
    });
    serverProc.stderr.on("data", d => console.warn("[server]", d.toString().trim()));
    serverProc.on("exit", () => resolve()); // resolve even if server exits early
    setTimeout(resolve, 6000);             // failsafe timeout
  });
}

function waitReady(retries = 30) {
  return new Promise(resolve => {
    const tryIt = () => {
      http.get("http://localhost:3000/api/health", r => {
        if (r.statusCode < 500) return resolve(true);
        retry();
      }).on("error", retry);
    };
    const retry = () => retries-- > 0 ? setTimeout(tryIt, 300) : resolve(false);
    tryIt();
  });
}

async function createWindow() {
  await startServer();
  await waitReady();

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

  win.loadURL("http://localhost:3000");
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
