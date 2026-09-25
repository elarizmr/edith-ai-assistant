const {
  app,
  BrowserWindow,
  globalShortcut,
  Tray,
  Menu,
  ipcMain,
} = require("electron");

const path = require("path");

let mainWindow = null;
let tray = null;

// ------------------------------------
// CREATE J.A.R.V.I.S WINDOW
// ------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,

    minWidth: 600,
    minHeight: 500,

    // App start olanda görünməsin
    show: false,

    // NORMAL MACOS WINDOW
    frame: true,
    titleBarStyle: "default",

    title: "J.A.R.V.I.S",

    resizable: true,
    maximizable: true,
    minimizable: true,
    closable: true,

    // Başqa pəncərələrin üstünə çıxmasın
    alwaysOnTop: false,

    backgroundColor: "#02050c",

    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,

      preload: path.join(__dirname, "preload.js"),

      // Wake-word / background listener üçün
      backgroundThrottling: false,
    },
  });

  // ------------------------------------
  // LOAD NEXT.JS
  // ------------------------------------

  mainWindow.loadURL("http://localhost:3000");

  // ------------------------------------
  // WINDOW READY
  // ------------------------------------

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // ------------------------------------
  // NORMAL MACOS CLOSE
  // ------------------------------------
  //
  // IMPORTANT:
  // Burada preventDefault() YOXDUR.
  //
  // Ona görə:
  // 🔴 = həqiqətən window-u bağlayır.
  //

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ------------------------------------
// SHOW / FOCUS J.A.R.V.I.S
// ------------------------------------

function showAndFocusWindow() {
  if (!mainWindow) {
    createWindow();
  }

  if (!mainWindow) return;

  // Minimized-dirsə restore et
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  // Gizlidirsə göstər
  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  // macOS-da app-i aktiv et
  if (process.platform === "darwin") {
    app.focus({ steal: true });
  }

  mainWindow.focus();
}

// ------------------------------------
// APP READY
// ------------------------------------

app.whenReady().then(() => {
  createWindow();

  // ----------------------------------
  // START J.A.R.V.I.S WITH macOS
  // ----------------------------------

  app.setLoginItemSettings({
    openAtLogin: true,
    openAsHidden: true,
  });

  // ----------------------------------
  // GLOBAL SHORTCUT
  // Cmd + Shift + E
  // ----------------------------------

  globalShortcut.register(
    "CommandOrControl+Shift+E",
    () => {
      showAndFocusWindow();

      if (mainWindow) {
        mainWindow.webContents.send("toggle-listening");
      }
    }
  );

  // ----------------------------------
  // QUIT SHORTCUT
  // Cmd + Q
  // ----------------------------------

  globalShortcut.register(
    "CommandOrControl+Q",
    () => {
      app.isQuiting = true;
      app.quit();
    }
  );

  // ----------------------------------
  // SHOW WINDOW
  // ----------------------------------

  ipcMain.on("show-window", () => {
    showAndFocusWindow();
  });

  // ----------------------------------
  // PAUSE J.A.R.V.I.S
  // ----------------------------------

  ipcMain.on("jarvis-pause", () => {
    console.log("J.A.R.V.I.S PAUSED");

    if (mainWindow) {
      mainWindow.webContents.send("jarvis-state", {
        state: "paused",
      });
    }
  });

  // ----------------------------------
  // RESUME J.A.R.V.I.S
  // ----------------------------------

  ipcMain.on("jarvis-resume", () => {
    console.log("J.A.R.V.I.S RESUMED");

    if (mainWindow) {
      mainWindow.webContents.send("jarvis-state", {
        state: "running",
      });
    }
  });

  // ----------------------------------
  // TOGGLE LISTENING
  // ----------------------------------

  ipcMain.on("toggle-jarvis-listening", () => {
    if (!mainWindow) return;

    mainWindow.webContents.send("toggle-listening");
  });

  // ----------------------------------
  // TRAY
  // ----------------------------------

  const iconPath = path.join(__dirname, "trayIcon.png");

  tray = new Tray(iconPath);

  tray.setToolTip("J.A.R.V.I.S");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show J.A.R.V.I.S",

      click: () => {
        showAndFocusWindow();
      },
    },

    {
      label: "Hide J.A.R.V.I.S",

      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
    },

    {
      type: "separator",
    },

    {
      label: "Pause J.A.R.V.I.S",

      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("jarvis-state", {
            state: "paused",
          });
        }
      },
    },

    {
      label: "Resume J.A.R.V.I.S",

      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("jarvis-state", {
            state: "running",
          });
        }
      },
    },

    {
      type: "separator",
    },

    {
      label: "Quit",

      click: () => {
        app.isQuiting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // ----------------------------------
  // TRAY DOUBLE CLICK
  // ----------------------------------

  tray.on("double-click", () => {
    showAndFocusWindow();
  });
});

// ------------------------------------
// ACTIVATE - macOS
// ------------------------------------

app.on("activate", () => {
  showAndFocusWindow();
});

// ------------------------------------
// ALL WINDOWS CLOSED
// ------------------------------------

app.on("window-all-closed", () => {
  // macOS-da tray/background app kimi qala bilər
  if (process.platform === "darwin") {
    return;
  }

  if (app.isQuiting) {
    app.quit();
  }
});

// ------------------------------------
// BEFORE QUIT
// ------------------------------------

app.on("before-quit", () => {
  app.isQuiting = true;
});

// ------------------------------------
// WILL QUIT
// ------------------------------------

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});