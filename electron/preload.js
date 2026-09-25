const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("jarvis", {
  // SHOW WINDOW
  showWindow: () => {
    ipcRenderer.send("show-window");
  },

  // PAUSE J.A.R.V.I.S
  pause: () => {
    ipcRenderer.send("jarvis-pause");
  },

  // RESUME J.A.R.V.I.S
  resume: () => {
    ipcRenderer.send("jarvis-resume");
  },

  // TOGGLE LISTENING
  toggleListening: () => {
    ipcRenderer.send("toggle-jarvis-listening");
  },

  // GLOBAL TOGGLE
  onToggleListening: (callback) => {
    const handler = () => {
      callback();
    };

    ipcRenderer.on("toggle-listening", handler);

    return () => {
      ipcRenderer.removeListener("toggle-listening", handler);
    };
  },

  // J.A.R.V.I.S STATE
  onState: (callback) => {
    const handler = (event, data) => {
      callback(data);
    };

    ipcRenderer.on("jarvis-state", handler);

    return () => {
      ipcRenderer.removeListener("jarvis-state", handler);
    };
  },
});