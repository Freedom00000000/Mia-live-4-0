const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("miaSpeech", {
  available: process.platform === "win32",
  speak: text => ipcRenderer.invoke("mia:speak", text),
  stop: () => ipcRenderer.send("mia:stop-speech")
});
