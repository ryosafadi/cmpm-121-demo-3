import leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./leafletWorkaround.ts";

const APP_NAME = "Geocoin Carrier";

document.title = APP_NAME;

const controlPanel = document.querySelector<HTMLDivElement>("#controlPanel")!;

const starterButton = document.createElement("button");
starterButton.innerHTML = "test";
controlPanel.append(starterButton);

starterButton.addEventListener("click", () => {
  alert("button clicked!");
});

const INITIAL_LOCATION = leaflet.latLng(36.98949379578401, -122.06277128548504);

const GAMEPLAY_ZOOM_LEVEL = 19;

const map = leaflet.map(document.getElementById("map")!, {
  center: INITIAL_LOCATION,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);
