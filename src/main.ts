// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";
import luck from "./luck.ts";
import { Board } from "./board.ts";

const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

interface Location {
  latitude: number;
  longitude: number;
}

interface Cell {
  i: number;
  j: number;
}

interface Coin {
  cell: Cell;
  serial: number;
}

interface CacheMemento {
  cell: Cell;
  bounds: leaflet.LatLngBounds;
  coins: Coin[];
}

class Cache {
  cell: Cell;
  key: string;
  bounds: leaflet.LatLngBounds;
  coins: Coin[];

  constructor(cell: Cell, bounds: leaflet.LatLngBounds) {
    this.cell = cell;
    this.key = `${cell.i},${cell.j}`;
    this.bounds = bounds;
    this.coins = [];
  }
}

class CacheMementoManager {
  static save(cache: Cache): string {
    const memento: CacheMemento = {
      cell: cache.cell,
      bounds: cache.bounds,
      coins: cache.coins,
    };
    return JSON.stringify(memento);
  }

  static load(cache: Cache, memento: string): void {
    const data: CacheMemento = JSON.parse(memento);
    cache.cell = data.cell;
    cache.bounds = data.bounds;
    cache.coins = data.coins;
  }
}

const OAKES_CLASSROOM = {
  latitude: 36.98949379578401,
  longitude: -122.06277128548504,
};

const TILE_DEGREES = 1e-4;
const TILE_VISIBILITY_RADIUS = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

const bus = new EventTarget();

let playerLocation: Location = loadLocation() || OAKES_CLASSROOM;
const playerCoins: Coin[] = loadCoins();
const activeCacheZones: leaflet.Rectangle[] = [];
const cacheMementos: Map<string, string> = new Map(loadCacheData());
let polyline: leaflet.Polyline | null = null;
let path: leaflet.LatLng[] = [
  leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
];
let watchId: number | null = null;
let isWatching = false;

const controlPanel = document.querySelector<HTMLDivElement>("#controlPanel")!;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "0 Coins in Inventory";

reloadCoins();

function collect(cache: Cache) {
  playerCoins.push(cache.coins.pop()!);
  bus.dispatchEvent(new CustomEvent("coins-changed", { detail: cache }));
}

function deposit(cache: Cache) {
  cache.coins.push(playerCoins.pop()!);
  bus.dispatchEvent(new CustomEvent("coins-changed", { detail: cache }));
}

bus.addEventListener(
  "coins-changed",
  ((e: CustomEvent) => {
    const cache = e.detail;
    cacheMementos.set(cache.key, CacheMementoManager.save(cache));
    reloadCoins();
    saveGame();
  }) as EventListener,
);

function movePlayer(destination: Location) {
  playerLocation = destination;
  bus.dispatchEvent(new Event("player-moved"));
}

bus.addEventListener("player-moved", () => {
  path.push(leaflet.latLng(playerLocation.latitude, playerLocation.longitude));

  polyline?.removeFrom(map);
  polyline = leaflet.polyline(path, {
    color: "blue",
    weight: 3,
    opacity: 0.7,
  }).addTo(map);

  clearCacheZones();
  playerMarker.setLatLng(
    leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
  );
  map.setView(playerMarker.getLatLng());
  drawCaches();

  saveGame();
});

const movementButtons = [
  { direction: "⬆️", latitude: TILE_DEGREES, longitude: 0 },
  { direction: "⬇️", latitude: -TILE_DEGREES, longitude: 0 },
  { direction: "⬅️", latitude: 0, longitude: -TILE_DEGREES },
  { direction: "➡️", latitude: 0, longitude: TILE_DEGREES },
];

movementButtons.forEach(({ direction, latitude, longitude }) => {
  const button = document.createElement("button");
  button.innerHTML = direction;

  button.addEventListener("click", () => {
    const destination: Location = {
      latitude: playerLocation.latitude + latitude,
      longitude: playerLocation.longitude + longitude,
    };
    movePlayer(destination);
  });

  controlPanel.append(button);
});

const geolocationButton = document.createElement("button");
geolocationButton.innerHTML = "🌐";
geolocationButton.addEventListener("click", () => {
  if (!isWatching) {
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const destination: Location = { latitude, longitude };

        movePlayer(destination);
      },
      (error) => {
        console.error("Geolocation error:", error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 10000,
      },
    );

    geolocationButton.innerHTML = "🛑 Stop Tracking";
    isWatching = true;
  } else {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }

    geolocationButton.innerHTML = "🌐";
    isWatching = false;
  }
});
controlPanel.append(geolocationButton);

const resetButton = document.createElement("button");
resetButton.innerHTML = "🚮";
resetButton.addEventListener("click", () => {
  reset();
});
controlPanel.append(resetButton);

const map = leaflet.map(document.getElementById("map")!, {
  center: leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
  zoom: 19,
  minZoom: 19,
  maxZoom: 19,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const playerMarker = leaflet.marker(
  leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
);
playerMarker.bindTooltip("Your Location");
playerMarker.addTo(map);

const board = new Board(TILE_DEGREES, TILE_VISIBILITY_RADIUS);

drawCaches();

function spawnCache(cell: Cell) {
  const bounds = board.getCellBounds(cell);
  const cacheZone = leaflet.rectangle(bounds, { color: "black" });
  cacheZone.addTo(map);
  activeCacheZones.push(cacheZone);

  const cache = new Cache(cell, bounds);

  const key = `${cell.i},${cell.j}`;
  const memento = cacheMementos.get(key);

  if (memento) {
    CacheMementoManager.load(cache, memento);
  } else {
    const initialCoins = Math.floor(
      luck([key, "initialValue"].toString()) * 10,
    );

    for (let s = 0; s <= initialCoins; s++) {
      const coin: Coin = {
        cell: cell,
        serial: s,
      };

      cache.coins.push(coin);
    }

    cacheMementos.set(key, CacheMementoManager.save(cache));
  }

  cacheZone.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${key}". It has <span id="value">${cache.coins.length}</span> coins.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (cache.coins.length > 0) {
          collect(cache);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .coins.length.toString();
        }
      });

    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerCoins.length > 0) {
          deposit(cache);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .coins.length.toString();
        }
      });

    return popupDiv;
  });
}

function drawCaches() {
  const nearbyCells = board.getCellsNearPoint(
    leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
  );

  nearbyCells.forEach((cell) => {
    const key = `${cell.i},${cell.j}`;
    if (luck(key) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(cell);
    }
  });
}

function clearCacheZones() {
  activeCacheZones.forEach((zone) => {
    zone.removeFrom(map);
  });
  activeCacheZones.length = 0;
}

function reloadCoins() {
  statusPanel.innerHTML = `${playerCoins.length} Coins in Inventory`;

  const coinList = document.createElement("ul");

  playerCoins.forEach((coin) => {
    const listItem = document.createElement("li");
    listItem.textContent = `🪙${coin.cell.i}:${coin.cell.j}#${coin.serial}`;

    listItem.addEventListener("click", () => {
      const coinLatitude = coin.cell.i * TILE_DEGREES;
      const coinLongitude = coin.cell.j * TILE_DEGREES;

      map.setView(leaflet.latLng(coinLatitude, coinLongitude));
    });
    listItem.style.cursor = "pointer";

    coinList.appendChild(listItem);
  });

  statusPanel.appendChild(coinList);
}

function saveGame() {
  localStorage.setItem("playerLocation", JSON.stringify(playerLocation));
  localStorage.setItem("playerCoins", JSON.stringify(playerCoins));
  localStorage.setItem("cacheMementos", JSON.stringify([...cacheMementos]));
}

function loadLocation(): Location | null {
  const savedLocation = localStorage.getItem("playerLocation");
  return savedLocation ? JSON.parse(savedLocation) : null;
}

function loadCoins() {
  const savedCoins = localStorage.getItem("playerCoins");
  return savedCoins ? JSON.parse(savedCoins) : [];
}

function loadCacheData(): Map<string, string> {
  const savedCacheData = localStorage.getItem("cacheMementos");
  if (!savedCacheData) return new Map();

  try {
    const entries = JSON.parse(savedCacheData);
    return new Map(entries);
  } catch (error) {
    console.error("Failed to parse cache data:", error);
    return new Map();
  }
}

function reset() {
  const confirm = prompt('Type "yes" if you would like to reset the game.');

  if (confirm?.toLowerCase() === "yes") {
    localStorage.removeItem("playerLocation");
    localStorage.removeItem("playerCoins");
    localStorage.removeItem("cacheMementos");

    playerLocation = OAKES_CLASSROOM;
    playerMarker.setLatLng(
      leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
    );
    map.setView(playerMarker.getLatLng());

    clearCacheZones();

    playerCoins.length = 0;
    cacheMementos.clear();

    path = [leaflet.latLng(playerLocation.latitude, playerLocation.longitude)];
    polyline?.removeFrom(map);

    reloadCoins();
    drawCaches();
  }
}
