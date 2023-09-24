const gamesListElem = document.getElementsByClassName("games-list")[0];
const headerElem = document.getElementsByClassName("header")[0];
const searchElem = document.getElementsByClassName("search")[0];
const resultsElem = document.getElementsByClassName("number-of-results")[0];

let auth;
let IGDBGames;

let searched = [];

const defaultSettings = {
  path: "",
};

let games = [];
let settings;
let alternateNames;
let removedGames;

start();
async function start() {
  auth = req("https://id.twitch.tv/oauth2/token?client_id=vuis5sdu5hhavo74a4xu3jc1v8gojs&client_secret=nfvhlpqfhdmaqu39knodo1l52wba2o&grant_type=client_credentials", "POST");
  settings = files.loadJSON("settings");
  alternateNames = files.loadJSON("alternate-names");
  removedGames = files.loadJSON("removed-games");
  
  [auth, settings, alternateNames, removedGames] = await Promise.all([auth, settings, alternateNames, removedGames]);
  auth = auth["access_token"];
  
  settings = settings.a != 123? settings : defaultSettings;
  alternateNames = alternateNames.a != 123? alternateNames : {};
  removedGames = removedGames.a != 123? removedGames : [];

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

  for (let i in dir) {
    let file = dir[i];
    let name = dir[i].split("");
    let ending = name.splice(-4).join("");
    if (ending != ".lnk" && ending != ".url") continue;

    name = name.join("");

    if (removedGames.includes(name)) continue;

    let elem = createElem(`
    <div class="game">
    </div>
    `, gamesListElem);

    games.push({name: alternateNames[name] || name, elem: elem, originalName: name, path: "C:/Users/AMD/Desktop/" + file});
  }

  IGDBGames = await getGames();

  let createdGenres = {};
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
  game.name = e.dataset.new;

  res = await IGDBreq("games", "POST", `
    fields id,cover.image_id,genres.name,name,summary,url,videos.video_id;
    where name = "${game.name}";
    limit 1;
  `);
  IGDBGames.push(res[0]);

  alternateNames[game.originalName] = e.dataset.new;
  files.saveJSON("alternate-names", alternateNames);

  game.elem.remove();

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
  let game = games.find(game=>game.name == e.dataset.game);
  games.splice(games.indexOf(game), 1);
  game.elem.remove();

  removedGames.push(game.originalName);
  files.saveJSON("removed-games", removedGames);
}

async function drawGameCards() {
  gamesListElem.replaceChildren();
  games.forEach((game, i) => {
    drawGameCard(game);
  });
  resultsElem.innerText = `Showing ${gamesListElem.children.length}/${games.length} Results`;
}

async function drawGameCard(game) {
  let gameInfo = IGDBGames.find(e=>e.name==game.name);

  let activeGenres = Array.from(document.getElementsByClassName("genre-button")).filter(elem=>elem.classList.contains("active")).map(elem=>elem.innerText);
  let draw = activeGenres.length == 0 ;
  gameInfo?.genres?.forEach(elem => {
    if (activeGenres.includes(elem.name)) draw = true;
  });

  if (!draw) return;
  if (!searched.includes(game.name) && searchElem.value != "") return;

  game.elem = createElem(`
  <div class="game">
  </div>
  `, gamesListElem);

  if (gameInfo != undefined && !game.swap) {
    let elem = createElem(`
    <img src="https://images.igdb.com/igdb/image/upload/t_cover_big/${gameInfo.cover["image_id"]}.png">
    <div class="game-overlay">
      <div class="name">${game.name}</div>
      <div class="genre-list">
        ${gameInfo.genres?.map(e=>{return `<div>${e.name}</div>`}).join("")}
      </div>
      <div class="desc">${gameInfo.summary}</div>
      <button class="play" onclick="openApp(this)" data-path="${game.path}">PLAY</button>
      <a class="material-symbols-outlined open-link" href="${gameInfo.url}" target="_blank">open_in_new</a>
      <span class="material-symbols-outlined swap-game">swap_horiz</span>
      <span class="material-symbols-outlined remove-game" onclick="removeGame(this)" data-game="${game.name}">close</span>
    </div>
    `, game.elem);

    elem.getElementsByClassName("swap-game")[0].addEventListener("click", e => {
      game.swap = true;
      game.name = game.originalName;
      drawGameCards();
    });
  } else {
    game.swap = false;

    let possibleGames = await IGDBreq("games", "POST", `
      search "${game.name}";
      fields id,name,cover.image_id;
      limit 8;
    `);
    
    createElem(`
    <div class="game-overlay">
      <div class="name">${game.name}</div>
      <div class="possible-games">${
        possibleGames.map(e=>{
          return `
            <div class="possible-game" onclick="cardOptionClick(this)" data-new="${e.name}" data-old="${game.name}">
              ${e.cover?`<img src="https://images.igdb.com/igdb/image/upload/t_thumb/${e.cover["image_id"]}.png"></img>`:"<div></div>"}
              ${e.name}
            </div>
          `;
        }).join("")
      }</div>
      <button class="play">PLAY</button>
      <span class="material-symbols-outlined remove-game" onclick="removeGame(this)" data-game="${game.name}">close</span>
    </div>
    `, game.elem);
  }
}

let IGDBReqQueue = [];
let IGDBNextReq = new Date().getTime();
async function IGDBreq(url, type = "GET", body = "") {
  return new Promise((resolve, reject) => {
    let time = new Date().getTime();
    
    setTimeout(async () => {
      let res = await req("https://api.igdb.com/v4/" + url, type, body, {"Client-ID": "vuis5sdu5hhavo74a4xu3jc1v8gojs", "Authorization": "Bearer " + auth});
      resolve(res);
    }, Math.max(IGDBNextReq - time, 0));

    IGDBNextReq = Math.max(IGDBNextReq + 250, time);
  });
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
    fields id,cover.image_id,genres.name,name,summary,url,videos.video_id;
    where ${games.map((e, i) => `${i!=0?" | ":""}name = "${e.name}"`).join("")};
    limit ${games.length + 50};
  `);
}


function createElem(text, parent = document.body) {
  parent.insertAdjacentHTML("beforeend", text);

  return parent.lastElementChild;
}

function pixelsToRem(pixels) {    
  return pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function resetPath() {
  settings.path = "";
  main();
}