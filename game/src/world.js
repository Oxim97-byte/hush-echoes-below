// HUSH — Echoes Below. The cave: one screen of flooded rock, grown by
// cellular automata, then repaired so every open tile is reachable.
// A level is fully determined by its seed.
import { COLS, ROWS, TILE } from './config.js';
import { makeRng } from './rng.js';

export const WALL = 1;
export const OPEN = 0;

function index(x, y) {
  return y * COLS + x;
}

// Count wall neighbours (out of bounds counts as wall: the cave is sealed).
function wallNeighbours(grid, x, y) {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) n++;
      else if (grid[index(nx, ny)] === WALL) n++;
    }
  }
  return n;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.rng = makeRng(seed);
    this.grid = new Uint8Array(COLS * ROWS);
    this.generate();
  }

  generate() {
    const rng = this.rng;
    // Random soup, denser near the edges is unnecessary: the border is
    // forced wall afterwards.
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const border = x === 0 || y === 0 || x === COLS - 1 || y === ROWS - 1;
        this.grid[index(x, y)] = border || rng.chance(0.44) ? WALL : OPEN;
      }
    }
    // Smooth: a tile becomes wall when crowded, open when lonely.
    // Five passes carve the soup into caverns with pillars and bays.
    for (let pass = 0; pass < 5; pass++) {
      const next = new Uint8Array(this.grid);
      for (let y = 1; y < ROWS - 1; y++) {
        for (let x = 1; x < COLS - 1; x++) {
          const n = wallNeighbours(this.grid, x, y);
          if (this.grid[index(x, y)] === WALL) next[index(x, y)] = n >= 4 ? WALL : OPEN;
          else next[index(x, y)] = n >= 5 ? WALL : OPEN;
        }
      }
      this.grid = next;
    }
    // Keep only the largest connected open region: flood-fill from a
    // random open tile, wall off every pocket the fill never reaches.
    // This guarantees the player, the pearls and the gate can all meet.
    let start = -1;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === OPEN) {
        start = i;
        break;
      }
    }
    const seen = new Uint8Array(COLS * ROWS);
    const stack = [start];
    seen[start] = 1;
    const region = [];
    while (stack.length > 0) {
      const cur = stack.pop();
      region.push(cur);
      const cx = cur % COLS;
      const cy = Math.floor(cur / COLS);
      const neighbours = [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ];
      for (const [nx, ny] of neighbours) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = index(nx, ny);
        if (!seen[ni] && this.grid[ni] === OPEN) {
          seen[ni] = 1;
          stack.push(ni);
        }
      }
    }
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === OPEN && !seen[i]) this.grid[i] = WALL;
    }
    this.openTiles = region;
    // A wall tile is "edged" when it touches open water: the renderer
    // draws a faint rim on those so the cave reads in the dark.
    this.edge = new Uint8Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (this.grid[index(x, y)] !== WALL) continue;
        this.edge[index(x, y)] = wallNeighbours(this.grid, x, y) < 8 ? 1 : 0;
      }
    }
  }

  isWall(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return true;
    return this.grid[index(tx, ty)] === WALL;
  }

  isWallAtPx(px, py) {
    return this.isWall(Math.floor(px / TILE), Math.floor(py / TILE));
  }

  // The open tile nearest (sx, sy): every placement query must start
  // from open water, never from inside a wall — a BFS that starts in
  // a wall pocket goes nowhere and collapses every placement onto
  // that one tile.
  nearestOpenTile(sx, sy) {
    let best = this.openTiles[0];
    let bestD = Infinity;
    for (const t of this.openTiles) {
      const d = Math.abs((t % COLS) - sx) + Math.abs(Math.floor(t / COLS) - sy);
      if (d < bestD) {
        bestD = d;
        best = t;
      }
    }
    return { x: best % COLS, y: Math.floor(best / COLS) };
  }

  // A random open tile, uniform over the cave.
  randomOpenTile() {
    const t = this.rng.pick(this.openTiles);
    return { x: t % COLS, y: Math.floor(t / COLS) };
  }

  // Breadth-first distances from an open tile, over open tiles only.
  distancesFrom(sx, sy) {
    const start = this.nearestOpenTile(sx, sy);
    const dist = new Int32Array(COLS * ROWS).fill(-1);
    const queue = [index(start.x, start.y)];
    dist[index(start.x, start.y)] = 0;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      const cx = cur % COLS;
      const cy = Math.floor(cur / COLS);
      for (const [nx, ny] of [
        [cx + 1, cy],
        [cx - 1, cy],
        [cx, cy + 1],
        [cx, cy - 1],
      ]) {
        if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
        const ni = index(nx, ny);
        if (dist[ni] === -1 && this.grid[ni] === OPEN) {
          dist[ni] = dist[cur] + 1;
          queue.push(ni);
        }
      }
    }
    return { start, dist };
  }

  // The open tile farthest (by grid steps) from a starting tile.
  farthestFrom(sx, sy) {
    const { start, dist } = this.distancesFrom(sx, sy);
    let best = index(start.x, start.y);
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] > dist[best]) best = i;
    }
    return { x: best % COLS, y: Math.floor(best / COLS), dist: dist[best] };
  }

  // A random open tile at least `minDist` grid steps from (sx, sy).
  randomOpenFar(sx, sy, minDist) {
    const { start, dist } = this.distancesFrom(sx, sy);
    const candidates = [];
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === OPEN && dist[i] >= minDist) candidates.push(i);
    }
    if (candidates.length > 0) {
      const chosen = this.rng.pick(candidates);
      return { x: chosen % COLS, y: Math.floor(chosen / COLS) };
    }
    const far = this.farthestFrom(start.x, start.y);
    return { x: far.x, y: far.y };
  }

  tileCenter(tx, ty) {
    return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
  }
}
