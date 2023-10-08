//Multi select
//Steam support
//Add start game animation

const gamesListElem = document.getElementsByClassName("games-list")[0];
const headerElem = document.getElementsByClassName("header")[0];
const searchElem = document.getElementsByClassName("search")[0];
const resultsElem = document.getElementsByClassName("number-of-results")[0];

let IGDBAuth;
let IGDBGames;

let steamAuth = "0C28F1769854654DF2A7ABFA53CB3472";
let steamGames;

let searched = [];

const defaultSettings = {
  path: "",
};

let games = [];

let settings;
let removedGames;
let ids;
let favorites;

start();
async function start() {
  document.getElementsByClassName("version")[0].innerText = "v" + await electron.getVersion();

  IGDBAuth = req("https://id.twitch.tv/oauth2/token?client_id=vuis5sdu5hhavo74a4xu3jc1v8gojs&client_secret=nfvhlpqfhdmaqu39knodo1l52wba2o&grant_type=client_credentials", "POST");
  //steamAuth = files.steamAuth(steamAuth);
  settings = files.loadJSON("settings");
  removedGames = files.loadJSON("removed-games");
  ids = files.loadJSON("ids");
  favorites = files.loadJSON("favorites");
  
  [IGDBAuth, settings, removedGames, ids, favorites, steamAuth] = await Promise.all([IGDBAuth, settings, removedGames, ids, favorites, steamAuth]);
  IGDBAuth = IGDBAuth["access_token"];
  
  settings = settings.a != 123? settings : defaultSettings;
  removedGames = (removedGames.a != 123 && removedGames.v == 1)? removedGames : {v: 1, games: []};
  ids = ids.a != 123? ids : {};
  favorites = (favorites.a != 123 && favorites.v == 1)? favorites : {v: 1, games: []};
  
  main();
}

async function main() {
  gamesListElem.replaceChildren();
  headerElem.replaceChildren();
  games = [];

  let dir;
  try {
    dir = await files.getFiles(settings.path);
  } catch {
    let elem = createElem(`
    <div class="center-box">
      You need to select a folder with all your games as shortcuts inside. Do not use your steamlibrary as it contains folders with exes instead of just shortcuts, I suggest the desktop.
      <button>Select Folder</button>
    </div>
    `, gamesListElem);

    elem.getElementsByTagName("button")[0].addEventListener("click", async e => {
      let res = await files.selectDirs();
      settings.path = res[0];
      files.saveJSON("settings", settings);
      gamesListElem.replaceChildren();
      main();
    });

    return;
  }

  await readGames(dir);
  
  let neededIDs = games.filter(e=>e.id == undefined);
  if (neededIDs.length > 0)
    await getIDs(neededIDs);

  games.filter(e=>e.id == undefined).forEach(game=>{
    game.id = 8675309;
    ids[game.name] = 8675309;
  });
  files.saveJSON("ids", ids);

  IGDBGames = await getGames();

  let createdGenres = {};
  createElem(`
  <button class="genre-button" onclick="toggleGenre(this)">Removed</button>
  <button class="genre-button last-specific" onclick="toggleGenre(this)">Favorites</button>
  `, headerElem);
  IGDBGames.forEach((game, i) => {
    if (!game.genres) return;
    game.genres.forEach((genre) => {
      if (createdGenres[genre.name]) return;
      createdGenres[genre.name] = true;
      
      createElem(`
      <button class="genre-button" onclick="toggleGenre(this)">${genre.name}</button>
      `, headerElem);
    });
  });
  drawGameCards();
}

function reload() {
  gamesListElem.replaceChildren();
  headerElem.replaceChildren();
  start();
}
document.addEventListener("keydown", e => {
  if (e.key == "F5" || (e.ctrlKey && e.key == "r")) reload();
});

async function readGames(dir) {
  games = [];
  for (let i in dir) {
    let file = dir[i];
    let name = dir[i].split("");
    let ending = name.splice(-4).join("");
    if (ending != ".lnk" && ending != ".url") continue;

    name = name.join("");

    let elem = createElem(`
    <div class="game">
    </div>
    `, gamesListElem);

    let id;
    if (ids[name]) {
      id = parseInt(ids[name]);
    }

    games.push({id, elem, name, path: settings.path + "\\" + file});
  }
}

function resize() {
  gamesListElem.style.setProperty("--columns", Math.floor(pixelsToRem(window.innerWidth) / 17));
}
window.addEventListener("resize", resize);
resize();

document.addEventListener("keydown", e => {
  if (e.key == "F12") electron.openDevTools();
});

async function searchEvent(e) {
  let res = await search.fuzzy(games, e.target.value);
  searched = res.map((e, i) => {
    return e.item.name;
  });

  searched.forEach((elem, i) => {
    games.push(games.splice(games.findIndex(e=>e.name == elem), 1)[0]);
  })

  if (e.target.value == "") games.sort((a, b) => {
    let x = a.name.toUpperCase();
    let y = b.name.toUpperCase();
    if (x > y) {
      return 1;
    }
    if (x < y) {
      return -1;
    }
    return 0;
  });

  drawGameCards();
}
searchElem.addEventListener("input", searchEvent);

async function cardOptionClick(e) {
  let game = games.find(game=>game.name == e.dataset.old);
  game.id = e.dataset.new;
  becomeSpinner(game.elem);

  res = await IGDBreq("games", "POST", `
    fields id,cover.image_id,genres.name,name,summary,url,videos.video_id,first_release_date;
    where id = ${game.id};
    limit 1;
  `);
  IGDBGames.push(res[0]);
  ids[game.name] = e.dataset.new;
  files.saveJSON("ids", ids);

  decomeSpinner(game.elem);

  drawGameCard(game);
}
async function openApp(e) {
  files.openFile(e.dataset.path);
}

function toggleGenre(elem) {
  elem.classList.toggle("active");
  drawGameCards();
}

function removeGame(e) {
  let index = removedGames.games.findIndex(game=>game == e.dataset.path);
  let game = games.find(game=>game.path == e.dataset.path);
  game.elem.remove();
  if (index != -1) {
    removedGames.games.splice(index, 1);
  } else {
    removedGames.games.push(game.path);
  }

  files.saveJSON("removed-games", removedGames);
}

function favorite(e, drawFavorites = false) {
  let index = favorites.games.findIndex(game=>game == e.dataset.path);
  let game = games.find(game=>game.path == e.dataset.path);
  
  e.classList.toggle("filled", index == -1);
  if (index != -1) {
    favorites.games.splice(index, 1);
    if (drawFavorites) game.elem?.remove();
  } else {
    favorites.games.push(game.path);
  }

  files.saveJSON("favorites", favorites);
}

async function drawGameCards() {
  gamesListElem.replaceChildren();
  games.forEach((game, i) => {
    drawGameCard(game);
  });
  resultsElem.innerText = `Showing ${gamesListElem.children.length}/${games.length} Results`;
}

async function drawGameCard(game) {
  let gameInfo = IGDBGames.find(e=>e.id==game.id);

  let activeGenres = Array.from(document.getElementsByClassName("genre-button")).filter(elem=>elem.classList.contains("active")).map(elem=>elem.innerText);

  let drawRemoved = activeGenres.includes("Removed");
  let isRemoved = drawRemoved != removedGames.games.includes(game.path);
  let drawFavorites = activeGenres.includes("Favorites");
  let isFavorite = favorites.games.includes(game.path);

  let draw = activeGenres.length == 0 + drawRemoved + drawFavorites;

  gameInfo?.genres?.forEach(elem => {
    if (activeGenres.includes(elem.name)) draw = true;
  });

  if (isRemoved) draw = false;
  if (drawFavorites && !isFavorite) draw = false;
  
  if (!draw) return;
  if (!searched.includes(game.name) && searchElem.value != "") return;

  let data = `data-path="${game.path}"`;
  let removeButton = (isRemoved != drawRemoved) ? `
  <span class="material-symbols-outlined restore-game" onclick="removeGame(this)" ${data}>check</span>
  ` : `
  <span class="material-symbols-outlined remove-game" onclick="removeGame(this)" ${data}>close</span>
  `;

  let playButton = `
  <button class="play" onclick="openApp(this)" data-path="${game.path}">PLAY</button>
  `;

  let favoriteButton = `
  <span class="material-symbols-outlined favorite${isFavorite?" filled" : ""}" onclick="favorite(this, ${drawFavorites})" ${data}>favorite</span>
  `;

  if (game.elem.parentNode == null) {
    game.elem = createElem(`
    <div class="game">
    </div>
    `, gamesListElem);
  } else {
    let old = game.elem;
    game.elem = document.createElement("div");
    game.elem.className = "game";
    old.replaceWith(game.elem);
  }

  if (gameInfo != undefined) {
    let date = new Date(gameInfo["first_release_date"] * 1000);
    let elem = createElem(`
    <img src="https://images.igdb.com/igdb/image/upload/t_cover_big/${gameInfo.cover["image_id"]}.png">
    <div class="game-overlay">
      <div class="name">${game.name}</div>
      <div class="date">${`${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()]} ${date.getFullYear()}`}</div>
      <div class="genre-list">
        ${gameInfo.genres?.map(e=>{return `<div>${e.name}</div>`}).join("")}
      </div>
      <div class="desc">${gameInfo.summary}</div>
      ${playButton}
      <a class="material-symbols-outlined open-link" href="${gameInfo.url}" target="_blank">open_in_new</a>
      <span class="material-symbols-outlined swap-game">swap_horiz</span>
      ${removeButton}
      ${favoriteButton}
    </div>
    `, game.elem);

    elem.getElementsByClassName("swap-game")[0].addEventListener("click", async e => {
      game.id = undefined;
      await drawGameCard(game);
    });
  } else {
    becomeSpinner(game.elem);
    let possibleGames = await IGDBreq("games", "POST", `
      search "${game.name}";
      fields id,name,cover.image_id;
      limit 8;
    `);
    decomeSpinner(game.elem);
    
    createElem(`
    <div class="game-overlay">
      <div class="name">${game.name}</div>
      <div class="which-version">Which version do you have?</div>
      <div class="possible-games">${
        possibleGames.map(e=>{
          return `
            <div class="possible-game" onclick="cardOptionClick(this)" data-new="${e.id}" data-old="${game.name}">
              ${e.cover?`<img src="https://images.igdb.com/igdb/image/upload/t_thumb/${e.cover["image_id"]}.png"></img>`:"<div></div>"}
              ${e.name}
            </div>
          `;
        }).join("")
      }</div>
      ${playButton}
      ${removeButton}
      ${favoriteButton}
    </div>
    `, game.elem);
  }

  return game.elem;
}

let IGDBReqQueue = [];
let IGDBNextReq = new Date().getTime();
async function IGDBreq(url, type = "GET", body = "") {
  return new Promise((resolve, reject) => {
    IGDBReqQueue.push(body);

    let time = new Date().getTime();
    
    setTimeout(async () => {
      if (!IGDBReqQueue.includes(body)) {
        reject();
        return;
      }
      IGDBReqQueue.splice(IGDBReqQueue.indexOf(body), 1);
      let res = await req("https://api.igdb.com/v4/" + url, type, body, {"Client-ID": "vuis5sdu5hhavo74a4xu3jc1v8gojs", "Authorization": "Bearer " + IGDBAuth});
      resolve(res);
    }, Math.max(IGDBNextReq - time, 0));

    IGDBNextReq = Math.max(IGDBNextReq + 250, time);
  });
}
function resetIGDB() {
  IGDBReqQueue = [];
  IGDBNextReq = new Date().getTime();
}

async function req(url, type = "GET", body = "", headers = []) {
  let res = await fetch(url, {
    method: type,
    body: body,
    headers: {
      "Content-type": "application/json; charset=UTF-8",
      ...headers
    }
  });
  res = await res.text();
  return JSON.parse(res);
}

async function getGames() {
  return await IGDBreq("games", "POST", `
    sort id asc;
    fields id,cover.image_id,genres.name,name,summary,url,videos.video_id,first_release_date;
    where ${games.filter(e=>e.id).map((e, i) => `${i!=0?" | ":""}id = ${e.id}`).join("")};
    limit ${games.length};
  `);
}
async function getIDs(games) {
  let res = await IGDBreq("games", "POST", `
    sort id asc;
    fields id,name;
    where ${games.map((e, i) => `${i!=0?" | ":""}name = "${e.name}"`).join("")};
    limit ${games.length + 50};
  `);

  games.forEach(e=>{
    e.id = res.find(ee=>e.name == ee.name)?.id;
    ids[e.name] = e.id;
  });
}

function createElem(text, parent = document.body) {
  parent.insertAdjacentHTML("beforeend", text);
  let elem = parent.lastElementChild;
  if (parent == document.body) elem.remove();
  return elem;
}

function pixelsToRem(pixels) {    
  return pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function resetPath() {
  settings.path = "";
  main();
}

function findInDisarray(arr, id, name, deeper = true) {
  let index = arr.findIndex(_id=>((deeper)?_id.id:_id)==id)
  if (index == -1) index = arr.findIndex(_name=>((deeper)?_name.name:_name)==name);
  return index;
}

function becomeSpinner(elem) {
  elem.replaceChildren(document.createElement("div"), document.createElement("div"));
  elem.classList.add("loading");
}
function decomeSpinner(elem) {
  elem.replaceChildren();
  elem.classList.remove("loading");
}