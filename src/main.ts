// @deno-types="npm:@types/leaflet@^1.9.14"
import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

import luck from "./luck.ts";

const APP_NAME = "Geocoin Carrier";
document.title = APP_NAME;

interface Location {
  latitude: number;
  longitude: number;
}

interface Cache {
  points: number;
}

const OAKES_CLASSROOM = {
  latitude: 36.98949379578401,
  longitude: -122.06277128548504,
};

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

const TILE_DEGREES = 1e-4;

function spawnCache(i: number, j: number) {
  const origin = playerLocation;
  const bounds = leaflet.latLngBounds([
    [origin.latitude + i * TILE_DEGREES, origin.longitude + j * TILE_DEGREES],
    [
      origin.latitude + (i + 1) * TILE_DEGREES,
      origin.longitude + (j + 1) * TILE_DEGREES,
    ],
  ]);

  const cacheZone = leaflet.rectangle(bounds, { color: "black" });
  cacheZone.addTo(map);

  const pointValue = Math.floor(luck([i, j, "initialValue"].toString()) * 100);

  const cache: Cache = {
    points: pointValue,
  };

  cacheZone.bindPopup(() => {
    const popupDiv = document.createElement("div");
    popupDiv.innerHTML = `
      <div>There is a cache here at "${i},${j}". It has value <span id="value">${cache.points}</span>.</div>
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

const NEIGHBORHOOD_SIZE = 8;
const CACHE_SPAWN_PROBABILITY = 0.1;

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
  for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
    if (luck([i, j].toString()) < CACHE_SPAWN_PROBABILITY) {
      spawnCache(i, j);
    }
  }
}
