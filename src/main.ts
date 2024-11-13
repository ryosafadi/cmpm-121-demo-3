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
  readonly i: number;
  readonly j: number;
}

interface Cache {
  points: number;
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
let playerPoints: number = 0;

const statusPanel = document.querySelector<HTMLDivElement>("#statusPanel")!;
statusPanel.innerHTML = "0 Points";

function collect(cache: Cache) {
  playerPoints++;
  cache.points--;
  bus.dispatchEvent(new Event("points-changed"));
}

function deposit(cache: Cache) {
  playerPoints--;
  cache.points++;
  bus.dispatchEvent(new Event("points-changed"));
}

bus.addEventListener("points-changed", () => {
  statusPanel.innerHTML = `${playerPoints} Points`;
});

function _movePlayer(destination: Location) {
  playerLocation = destination;
  bus.dispatchEvent(new Event("player-moved"));
}

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

bus.addEventListener("player-moved", () => {
  playerMarker.setLatLng(
    leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
  );
});

const board = new Board(TILE_DEGREES, TILE_VISIBILITY_RADIUS);

function spawnCache(cell: Cell) {
  const bounds = board.getCellBounds(cell);
  const cacheZone = leaflet.rectangle(bounds, { color: "black" });
  cacheZone.addTo(map);

  const key = `${cell.i},${cell.j}`;
  const pointValue = Math.floor(luck([key, "initialValue"].toString()) * 100);

  const cache: Cache = {
    points: pointValue,
  };

  cacheZone.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${key}". It has value <span id="value">${cache.points}</span>.</div>
      <button id="collect">Collect</button>
      <button id="deposit">Deposit</button>`;

    popupDiv
      .querySelector<HTMLButtonElement>("#collect")!
      .addEventListener("click", () => {
        if (cache.points > 0) {
          collect(cache);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .points.toString();
        }
      });

    popupDiv
      .querySelector<HTMLButtonElement>("#deposit")!
      .addEventListener("click", () => {
        if (playerPoints > 0) {
          deposit(cache);
          popupDiv.querySelector<HTMLSpanElement>("#value")!.innerHTML = cache
            .points.toString();
        }
      });

    return popupDiv;
  });
}

const nearbyCells = board.getCellsNearPoint(
  leaflet.latLng(playerLocation.latitude, playerLocation.longitude),
);

nearbyCells.forEach((cell) => {
  const key = `${cell.i},${cell.j}`;
  if (luck(key) < CACHE_SPAWN_PROBABILITY) {
    spawnCache(cell);
  }
});
