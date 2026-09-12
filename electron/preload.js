const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("edith", {
  // SHOW WINDOW
  showWindow: () => {
    ipcRenderer.send("show-window");
  },

  // PAUSE EDITH
  pauseEDITH: () => {
    ipcRenderer.send("edith-pause");
  },

  // RESUME EDITH
  resumeEDITH: () => {
    ipcRenderer.send("edith-resume");
  },

  // TOGGLE LISTENING
  toggleListening: () => {
    ipcRenderer.send("toggle-edith-listening");
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

  // EDITH STATE
  onEDITHState: (callback) => {
    const handler = (event, data) => {
      callback(data);
    };

    ipcRenderer.on("edith-state", handler);

    return () => {
      ipcRenderer.removeListener("edith-state", handler);
    };
  },
});