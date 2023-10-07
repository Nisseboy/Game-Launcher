const { contextBridge, ipcRenderer, app } = require('electron');

let dataPath;

contextBridge.exposeInMainWorld('files', {
  getFiles,
  readFile,
  writeFile,
  loadJSON,
  saveJSON,
  selectDirs,

  openFile,

  steamAuth,
});
contextBridge.exposeInMainWorld('search', {
  fuzzy: search
});
contextBridge.exposeInMainWorld('electron', {
  openDevTools,
  getVersion,
});

async function getFiles (path) {
  try {
    const files = await ipcRenderer.invoke('read-directory', path);
    return files;
  } catch (error) {
    console.error('Error reading directory:', error);
    throw error;
  }
}
async function readFile(path) {
  try {
    const file = await ipcRenderer.invoke('read', path);
    return file;
  } catch (error) {
    console.error('Error reading file:', error);
    return "{\"a\": \"123\"}";
  }
}
async function writeFile(path, data) {
  try {
    await ipcRenderer.invoke('write', path, data);
    return;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
}
async function loadJSON(name) {
  dataPath = await ipcRenderer.invoke('get-userdata');
  res = await readFile(dataPath + `/${name}.json`);
  return JSON.parse(res);
}
async function saveJSON(name, data) {
  dataPath = await ipcRenderer.invoke('get-userdata');
  await writeFile(dataPath + `/${name}.json`, JSON.stringify(data));
}

async function openFile(path) {
  await ipcRenderer.invoke('open-file', path);
  return;
}
function openDevTools() {
  ipcRenderer.invoke('open-dev-tools');
}
function getVersion() {
  return ipcRenderer.invoke('get-version');
}

async function selectDirs() {
  let res = await ipcRenderer.invoke('select-dirs');
  return res;
}

async function search(list, query) {
  let res = await ipcRenderer.invoke('search', JSON.stringify(list), query);
  return res;
}

function steamAuth(id) {
  return ipcRenderer.invoke('steam-auth', id);
}