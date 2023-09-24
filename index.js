const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('node:path');
const Fuse = require('fuse.js');

if (handleSquirrelEvent()) {
  return;
}

//if (require('electron-squirrel-startup')) app.quit();


app.whenReady().then(() => {
  createWindow();
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function createWindow() {
  let window = new BrowserWindow({
    width: 800,
    height: 800,
    title: "Nolshub",
    titleBarStyle: 'hidden',
    titleBarOverlay: {
        color: '#ffffff03',
        symbolColor: '#fff',
        height: 32
    },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
    show: false,
    sandbox: false,
  });
  window.maximize();
  window.removeMenu();
  
  window.loadFile("pages/home/index.html");
//  window.webContents.openDevTools()

  ipcMain.handle('read-directory', async (event, directoryPath) => {
    try {
      const files = await fs.readdir(directoryPath);
      return files;
    } catch (error) {
      console.error('Error reading directory:', error);
      throw error;
    }
  });
  ipcMain.handle('read', async (event, directoryPath) => {
    try {
      const file = await fs.readFile(directoryPath, {encoding: "utf8"});
      return file;
    } catch (error) {
      console.error('Error reading file:', error);
      throw error;
    }
  });
  ipcMain.handle('write', async (event, directoryPath, data) => {
    try {
      await fs.writeFile(directoryPath, data, {encoding: "utf8"});
      return;
    } catch (error) {
      console.error('Error writing file:', error);
      throw error;
    }
  });
  ipcMain.handle('get-userdata', (event) => {
    return app.getPath('userData');
  });

  ipcMain.handle('open-file', (event, path) => {
    shell.openExternal(path);
  });

  ipcMain.handle('select-dirs', async (event) => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openDirectory']
    });
    return result.filePaths;
  });

  ipcMain.handle('open-dev-tools', (event) => {
    window.webContents.openDevTools();
  });

  ipcMain.handle('search', (event, list, query) => {
    let fuse = new Fuse(JSON.parse(list), {
      keys: ["name"],
    });
    return fuse.search(query);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}










function handleSquirrelEvent() {
  if (process.argv.length === 1) {
    return false;
  }

  const ChildProcess = require('child_process');
  const path = require('path');

  const appFolder = path.resolve(process.execPath, '..');
  const rootAtomFolder = path.resolve(appFolder, '..');
  const updateDotExe = path.resolve(path.join(rootAtomFolder, 'Update.exe'));
  const exeName = path.basename(process.execPath);

  const spawn = function(command, args) {
    let spawnedProcess, error;

    try {
      spawnedProcess = ChildProcess.spawn(command, args, {detached: true});
    } catch (error) {}

    return spawnedProcess;
  };

  const spawnUpdate = function(args) {
    return spawn(updateDotExe, args);
  };

  const squirrelEvent = process.argv[1];
  switch (squirrelEvent) {
    case '--squirrel-install':
    case '--squirrel-updated':
      spawnUpdate(['--createShortcut', "Nolshub.exe"]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-uninstall':
      spawnUpdate(['--removeShortcut', "Nolshub.exe"]);

      setTimeout(app.quit, 1000);
      return true;

    case '--squirrel-obsolete':
      app.quit();
      return true;
  }
};