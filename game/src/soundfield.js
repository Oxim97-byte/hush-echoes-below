// HUSH — Echoes Below. The acoustic model: the game's one original
// simulation. Sound is an event with a loudness; it travels in a
// straight line, losing strength with distance and much more when a
// wall stands between source and ear. Enemies never see the player —
// they only hear. That is why a ping is both a flashlight and a dinner
// bell, and why a chime stone is a weapon.
import { DIST_DECAY, WALL_LOSS } from './config.js';

export class SoundField {
  constructor(world) {
    this.world = world;
    // Recent events, newest last: {x, y, loudness, kind, time}.
    // Enemies read these; the renderer draws the visible rings from
    // the same list, so what you see is what they hear.
    this.events = [];
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    // Events older than 8 seconds stop mattering to anyone.
    while (this.events.length > 0 && this.time - this.events[0].time > 8) {
      this.events.shift();
    }
  }

  emit(x, y, loudness, kind) {
    this.events.push({ x, y, loudness, kind, time: this.time });
    return this.events[this.events.length - 1];
  }

  // How many wall tiles does the straight line from (x0,y0) to
  // (x1,y1) cross? Sampled every 8px — cheap and smooth enough for
  // hearing, where a wall either blocks or it does not.
  wallsBetween(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(dist / 8));
    let walls = 0;
    let wasWall = false;
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const wall = this.world.isWallAtPx(x0 + dx * t, y0 + dy * t);
      if (wall && !wasWall) walls++;
      wasWall = wall;
    }
    return walls;
  }

  // Loudness of a sound event as heard at (x, y). Below zero the
  // sound never arrives.
  heardLoudness(event, x, y) {
    const dist = Math.hypot(event.x - x, event.y - y);
    const walls = this.wallsBetween(event.x, event.y, x, y);
    return event.loudness - dist * DIST_DECAY - walls * WALL_LOSS;
  }

  // The loudest recent event an ear at (x, y) can hear above its
  // threshold, or null. Only events of kinds the ear cares about.
  loudestHeard(x, y, threshold, kinds = null) {
    let best = null;
    let bestLevel = threshold;
    for (const ev of this.events) {
      if (kinds && !kinds.includes(ev.kind)) continue;
      const level = this.heardLoudness(ev, x, y);
      if (level > bestLevel) {
        bestLevel = level;
        best = ev;
      }
    }
    return best;
  }
}
