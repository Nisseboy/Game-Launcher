const gamesListElem = document.getElementsByClassName("games-list")[0];
const headerElem = document.getElementsByClassName("header")[0];
const searchElem = document.getElementsByClassName("search")[0];

let auth;
let IGDBGames;

let searched = [];

const defaultSettings = {
  path: "",
};

let games = [];
let settings;
let alternateNames;
let gamePaths;

main();

async function main() {
  auth = req("https://id.twitch.tv/oauth2/token?client_id=vuis5sdu5hhavo74a4xu3jc1v8gojs&client_secret=nfvhlpqfhdmaqu39knodo1l52wba2o&grant_type=client_credentials", "POST");
  settings = files.loadJSON("settings");
  alternateNames = files.loadJSON("alternate-names");
  gamePaths = files.loadJSON("gamepaths");

  [auth, settings, alternateNames, gamePaths] = await Promise.all([auth, settings, alternateNames, gamePaths]);
  auth = auth["access_token"];

  settings = settings.a != 123? settings : defaultSettings;
  alternateNames = alternateNames.a != 123? alternateNames : {};
  gamePaths = gamePaths.a != 123? gamePaths : [];

  if (settings.path == "") {
    
    return;
  }
  let dir = await files.getFiles(settings.path);

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

    games.push({name: alternateNames[name] || name, elem: elem, path: "C:/Users/AMD/Desktop/" + file});
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

  alternateNames[e.dataset.old] = e.dataset.new;
  files.saveJSON("alternate-names", alternateNames);

  drawGameCard(game);
}
async function openApp(e) {
  files.openFile(e.dataset.path);
}

function toggleGenre(elem) {
  elem.classList.toggle("active");
  drawGameCards();
}

async function drawGameCards() {
  games.forEach((game, i) => {
    drawGameCard(game);
  });
}

async function drawGameCard(game) {
  let gameInfo = IGDBGames.find(e=>e.name==game.name);

  game.elem?.remove();

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

  if (gameInfo != undefined) {
    createElem(`
    <img src="https://images.igdb.com/igdb/image/upload/t_cover_big/${gameInfo.cover["image_id"]}.png">
    <div class="game-overlay">
      <div class="name">${game.name}</div>
      <div class="genre-list">
        ${gameInfo.genres?.map(e=>{return `<div>${e.name}</div>`}).join("")}
      </div>
      <button class="play" onclick="openApp(this)" data-path="${game.path}">PLAY</button>
    </div>
    `, game.elem);
  } else {
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