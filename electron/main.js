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
// CREATE EDITH WINDOW
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

    title: "E.D.I.T.H.",

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
// SHOW / FOCUS EDITH
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
  // START EDITH WITH macOS
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
  // PAUSE EDITH
  // ----------------------------------

  ipcMain.on("edith-pause", () => {
    console.log("E.D.I.T.H. PAUSED");

    if (mainWindow) {
      mainWindow.webContents.send("edith-state", {
        state: "paused",
      });
    }
  });

  // ----------------------------------
  // RESUME EDITH
  // ----------------------------------

  ipcMain.on("edith-resume", () => {
    console.log("E.D.I.T.H. RESUMED");

    if (mainWindow) {
      mainWindow.webContents.send("edith-state", {
        state: "running",
      });
    }
  });

  // ----------------------------------
  // TOGGLE LISTENING
  // ----------------------------------

  ipcMain.on("toggle-edith-listening", () => {
    if (!mainWindow) return;

    mainWindow.webContents.send("toggle-listening");
  });

  // ----------------------------------
  // TRAY
  // ----------------------------------

  const iconPath = path.join(__dirname, "trayIcon.png");

  tray = new Tray(iconPath);

  tray.setToolTip("E.D.I.T.H.");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show EDITH",

      click: () => {
        showAndFocusWindow();
      },
    },

    {
      label: "Hide EDITH",

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
      label: "Pause EDITH",

      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("edith-state", {
            state: "paused",
          });
        }
      },
    },

    {
      label: "Resume EDITH",

      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send("edith-state", {
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