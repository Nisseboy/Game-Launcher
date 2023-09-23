const { contextBridge, ipcRenderer, app } = require('electron');

let dataPath;

contextBridge.exposeInMainWorld('files', {
  getFiles,
  readFile,
  writeFile,
  loadJSON,
  saveJSON,

  openFile
});
contextBridge.exposeInMainWorld('search', {
  fuzzy: search
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

async function search(list, query) {
  let res = await ipcRenderer.invoke('search', JSON.stringify(list), query);
  return res;
}