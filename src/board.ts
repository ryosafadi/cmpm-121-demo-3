import leaflet from "leaflet";

interface Cell {
  readonly i: number;
  readonly j: number;
}

export class Board {
  readonly tileWidth: number;
  readonly tileVisibilityRadius: number;

  private readonly knownCells: Map<string, Cell>;

  constructor(tileWidth: number, tileVisibilityRadius: number) {
    this.tileWidth = tileWidth;
    this.tileVisibilityRadius = tileVisibilityRadius;

    this.knownCells = new Map<string, Cell>();
  }

  private getCanonicalCell(cell: Cell): Cell {
    const { i, j } = cell;
    const key = [i, j].toString();

    if (!this.knownCells.has(key)) {
      this.knownCells.set(key, cell);
    }

    return this.knownCells.get(key)!;
  }

  getCellForPoint(point: leaflet.LatLng): Cell {
    const i = Math.floor(point.lat / this.tileWidth);
    const j = Math.floor(point.lng / this.tileWidth);

    return this.getCanonicalCell({ i, j });
  }

  getCellBounds(cell: Cell): leaflet.LatLngBounds {
    const { i, j } = cell;
    const latMin = i * this.tileWidth;
    const latMax = (i + 1) * this.tileWidth;
    const lngMin = j * this.tileWidth;
    const lngMax = (j + 1) * this.tileWidth;

    return new leaflet.LatLngBounds(
      new leaflet.LatLng(latMin, lngMin),
      new leaflet.LatLng(latMax, lngMax),
    );
  }

  getCellsNearPoint(point: leaflet.LatLng): Cell[] {
    const resultCells: Cell[] = [];
    const originCell = this.getCellForPoint(point);
    const { i: originI, j: originJ } = originCell;

    for (
      let di = -this.tileVisibilityRadius;
      di <= this.tileVisibilityRadius;
      di++
    ) {
      for (
        let dj = -this.tileVisibilityRadius;
        dj <= this.tileVisibilityRadius;
        dj++
      ) {
        const cell = this.getCanonicalCell({
          i: originI + di,
          j: originJ + dj,
        });
        resultCells.push(cell);
      }
    }

    return resultCells;
  }
}
