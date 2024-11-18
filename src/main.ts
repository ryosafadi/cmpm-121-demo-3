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

interface Momento<T> {
  toMomento(): T;
  fromMomento(momento: T): void;
}

class Cache implements Momento<string> {
  cell: Cell;
  bounds: leaflet.LatLngBounds;
  coins: Coin[];

  constructor(cell: Cell, bounds: leaflet.LatLngBounds) {
    this.cell = cell;
    this.bounds = bounds;
    this.coins = [];
  }

  toMomento() {
    const data = {
      cell: this.cell,
      bounds: this.bounds,
      coins: this.coins,
    };

    return JSON.stringify(data);
  }

  fromMomento(momento: string) {
    const data = JSON.parse(momento);
    this.cell = data.cell;
    this.bounds = data.bounds;
    this.coins = data.coins;
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

let playerLocation: Location = OAKES_CLASSROOM;
const playerCoins: Coin[] = [];
const activeCacheZones: leaflet.Rectangle[] = [];

const controlPanel = document.querySelector<HTMLDivElement>("#controlPanel")!;
const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "0 Coins in Inventory";

function collect(cache: Cache) {
  playerCoins.push(cache.coins.pop()!);
  bus.dispatchEvent(new Event("coins-changed"));
}

function deposit(cache: Cache) {
  cache.coins.push(playerCoins.pop()!);
  bus.dispatchEvent(new Event("coins-changed"));
}

bus.addEventListener("coins-changed", () => {
  reloadCoins();
});

function movePlayer(destination: Location) {
  playerLocation = destination;
  bus.dispatchEvent(new Event("player-moved"));
}

bus.addEventListener("player-moved", () => {
  clearCacheZones();
  playerMarker.setLatLng(
    leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
  );
  map.setView(playerMarker.getLatLng());
  drawCaches();
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

  const key = `${cell.i},${cell.j}`;
  const initialCoins = Math.floor(luck([key, "initialValue"].toString()) * 10);

  const cache = new Cache(cell, bounds);

  for (let s = 0; s <= initialCoins; s++) {
    const coin: Coin = {
      cell: cell,
      serial: s,
    };

    cache.coins.push(coin);
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
    coinList.appendChild(listItem);
  });

  statusPanel.appendChild(coinList);
}
