// HUSH — Echoes Below. The hunters are blind: they steer by the sound
// field alone. Each has a hearing threshold and a temperament, and a
// four-state mind: patrol, suspicious, hunt, search. A decoy chime is
// just another loud event to them — they cannot tell a stone from a
// diver, which is the whole strategy of the game.
import {
  TILE,
  ENEMY_SPEED,
  ENEMY_HUNT_SPEED,
  HEARING,
  SUSPICION_TIME,
  CATCH_RADIUS,
  COLORS,
} from './config.js';

// Move a circle against the cave walls, sliding along them instead of
// sticking: try x, then y, so corners do not trap the swimmer.
export function moveCircle(world, pos, radius, dx, dy) {
  const nx = pos.x + dx;
  if (!circleHitsWall(world, nx, pos.y, radius)) pos.x = nx;
  const ny = pos.y + dy;
  if (!circleHitsWall(world, pos.x, ny, radius)) pos.y = ny;
}

export function circleHitsWall(world, x, y, radius) {
  const x0 = Math.floor((x - radius) / TILE);
  const x1 = Math.floor((x + radius) / TILE);
  const y0 = Math.floor((y - radius) / TILE);
  const y1 = Math.floor((y + radius) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!world.isWall(tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      const ddx = x - cx;
      const ddy = y - cy;
      if (ddx * ddx + ddy * ddy < radius * radius) return true;
    }
  }
  return false;
}

let nextId = 1;

export class Enemy {
  constructor(kind, x, y, rng) {
    this.id = nextId++;
    this.kind = kind; // 'listener' | 'darter' | 'sleeper'
    this.x = x;
    this.y = y;
    this.radius = kind === 'darter' ? 12 : 15;
    this.hearing = HEARING[kind];
    this.state = kind === 'sleeper' ? 'sleeping' : 'patrol';
    this.angle = rng.range(0, Math.PI * 2); // facing, for the eyes
    this.targetX = x;
    this.targetY = y;
    this.waitTimer = rng.range(0.5, 2.5);
    this.searchTimer = 0;
    this.wanderSeed = rng;
    this.tail = []; // trail of past positions, drawn as a fading tail
    this.tailTimer = 0;
    this.alertFlash = 0; // 1 just after noticing a sound
  }

  get color() {
    return COLORS[this.kind];
  }

  get speed() {
    const base = this.state === 'hunt' ? ENEMY_HUNT_SPEED[this.kind] : ENEMY_SPEED[this.kind];
    return this.state === 'search' ? base * 0.8 : base;
  }

  // Pick a nearby open-water waypoint to drift toward.
  pickWanderTarget(world) {
    const tx = Math.floor(this.x / TILE);
    const ty = Math.floor(this.y / TILE);
    for (let tries = 0; tries < 12; tries++) {
      const nx = tx + this.wanderSeed.int(-6, 6);
      const ny = ty + this.wanderSeed.int(-6, 6);
      if (!world.isWall(nx, ny)) {
        this.targetX = nx * TILE + TILE / 2;
        this.targetY = ny * TILE + TILE / 2;
        return;
      }
    }
    this.targetX = this.x;
    this.targetY = this.y;
  }

  update(dt, game) {
    const { sound, player, world } = game;
    this.alertFlash = Math.max(0, this.alertFlash - dt * 2);
    this.tailTimer -= dt;
    if (this.tailTimer <= 0) {
      this.tailTimer = 0.09;
      this.tail.push({ x: this.x, y: this.y, life: 1 });
      if (this.tail.length > 14) this.tail.shift();
    }
    for (const t of this.tail) t.life -= dt * 1.4;
    this.tail = this.tail.filter((t) => t.life > 0);

    // --- hearing: the only sense. A loud event above threshold is a
    // place to investigate; the player's own position is never known
    // unless a sound just came from it.
    if (this.state !== 'sleeping') {
      const heard = sound.loudestHeard(this.x, this.y, this.hearing, [
        'ping',
        'step',
        'chime',
        'dash',
        'alarm',
      ]);
      if (heard) {
        const distToPlayer = Math.hypot(player.x - heard.x, player.y - heard.y);
        const fromPlayer = heard.kind !== 'chime' && distToPlayer < 30;
        if (fromPlayer && heard.loudness >= this.hearing + 2) {
          // A sound from the diver's own body, loud and close: hunt.
          this.state = 'hunt';
          this.targetX = player.x;
          this.targetY = player.y;
          this.alertFlash = 1;
        } else {
          // Any other loud sound: go look, carefully.
          if (this.state !== 'hunt') {
            this.state = 'suspicious';
            this.targetX = heard.x;
            this.targetY = heard.y;
            this.searchTimer = SUSPICION_TIME;
            this.alertFlash = 1;
          }
        }
      }
    } else {
      // Sleepers wake only to a truly loud noise nearby.
      const heard = sound.loudestHeard(this.x, this.y, this.hearing + 1.5, [
        'ping',
        'dash',
        'chime',
        'alarm',
      ]);
      if (heard) {
        this.state = 'hunt';
        this.targetX = player.x;
        this.targetY = player.y;
        this.alertFlash = 1;
      }
    }

    // --- steering by state ---
    let tx = this.targetX;
    let ty = this.targetY;
    if (this.state === 'patrol') {
      this.waitTimer -= dt;
      if (this.waitTimer <= 0) {
        this.pickWanderTarget(world);
        this.waitTimer = this.wanderSeed.range(1.5, 4);
      }
    } else if (this.state === 'suspicious') {
      this.searchTimer -= dt;
      if (Math.hypot(tx - this.x, ty - this.y) < 14 || this.searchTimer <= 0) {
        this.state = 'search';
        this.searchTimer = SUSPICION_TIME;
        this.pickWanderTarget(world);
      }
    } else if (this.state === 'search') {
      this.searchTimer -= dt;
      if (Math.hypot(tx - this.x, ty - this.y) < 14) this.pickWanderTarget(world);
      if (this.searchTimer <= 0) {
        this.state = 'patrol';
        this.waitTimer = 1;
      }
    } else if (this.state === 'hunt') {
      // While hunting, keep listening: a fresh loud sound re-aims the
      // hunt, and silence lets the trail go cold after a while.
      const heard = sound.loudestHeard(this.x, this.y, this.hearing, ['ping', 'step', 'dash']);
      if (heard && Math.hypot(player.x - heard.x, player.y - heard.y) < 40) {
        this.targetX = player.x;
        this.targetY = player.y;
        tx = this.targetX;
        ty = this.targetY;
        this.searchTimer = SUSPICION_TIME;
      } else {
        this.searchTimer -= dt;
        if (this.searchTimer <= 0) {
          this.state = 'search';
          this.searchTimer = SUSPICION_TIME;
          this.pickWanderTarget(world);
        }
      }
      tx = this.targetX;
      ty = this.targetY;
    }

    // --- move toward the target, sliding on walls ---
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 4) {
      const step = (this.speed * dt) / dist;
      const mx = dx * step;
      const my = dy * step;
      moveCircle(world, this, this.radius, mx, my);
      this.angle = Math.atan2(my, mx);
    }

    // --- the catch ---
    if (game.state === 'play' && player.invuln <= 0) {
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d < CATCH_RADIUS + player.radius) {
        game.onCaught(this);
      }
    }
  }
}

// Level composition: more hunters, and meaner ones, as levels deepen.
export function spawnEnemies(level, world, rng, spawnTile) {
  const count = Math.min(2 + level, 7);
  const kinds = [];
  for (let i = 0; i < count; i++) {
    if (i === 0) kinds.push('listener');
    else if (level >= 2 && i === 1) kinds.push('darter');
    else if (level >= 3 && i === 2) kinds.push('sleeper');
    else kinds.push(rng.pick(['listener', 'listener', 'darter']));
  }
  const enemies = [];
  for (const kind of kinds) {
    const tile = world.randomOpenFar(spawnTile.x, spawnTile.y, 10);
    const c = world.tileCenter(tile.x, tile.y);
    enemies.push(new Enemy(kind, c.x, c.y, rng));
  }
  return enemies;
}
