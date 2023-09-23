const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('fs').promises;
const path = require('node:path');
const Fuse = require('fuse.js');

if (require('electron-squirrel-startup')) app.quit();

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
  window.webContents.openDevTools()

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

  ipcMain.handle('search', (event, list, query) => {
    let fuse = new Fuse(JSON.parse(list), {
      keys: ["name"],
    });
    return fuse.search(query);
  });
}