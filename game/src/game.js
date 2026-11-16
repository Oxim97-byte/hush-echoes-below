// HUSH — Echoes Below. The game itself: states, the diver, the pearls,
// the gate, the chimes, the score. Everything the other systems do
// (sound, sight, hunting) meets here.
import {
  VIEW_W,
  VIEW_H,
  TILE,
  COLS,
  ROWS,
  PLAYER_RADIUS,
  WALK_SPEED,
  DASH_SPEED,
  DASH_NOISE,
  WALK_NOISE,
  STEP_INTERVAL,
  MAX_HEARTS,
  CATCH_INVULN,
  PING_LOUDNESS,
  PING_RADIUS,
  PING_RING_SPEED,
  CHIME_LOUDNESS,
  CHIME_PULSES,
  CHIME_PULSE_GAP,
  SUSPICION_TIME,
  PEARLS_BASE,
  PEARLS_CAP,
  CHIMES_BASE,
  LEVEL_SEED,
  PEARL_SCORE,
  GOLDEN_PEARL_SCORE,
  SILENT_BONUS,
  STREAK_MAX_MULT,
  LEVEL_CLEAR_SCORE,
} from './config.js';
import { World } from './world.js';
import { SoundField } from './soundfield.js';
import { Enemy, spawnEnemies, moveCircle } from './enemies.js';
import { SilentStreak } from './combo.js';
import { makeRng } from './rng.js';

export class Game {
  constructor(audio) {
    this.audio = audio;
    this.state = 'title'; // title | play | clear | over | paused
    this.level = 1;
    this.score = 0;
    this.best = 0;
    try {
      this.best = Number(window.localStorage.getItem('hush-best') || 0) || 0;
    } catch (_e) {
      this.best = 0;
    }
    this.time = 0; // seconds inside the current run
    this.levelTime = 0;
    this.levelStartScore = 0;
    this.pausedFrom = null;
    this.flash = 0; // red flash on catch, 0..1
    this.shake = 0; // screen shake trauma, 0..1
    this.noiseLevel = 0; // what the HUD noise meter shows
    this.noiseDecay = 0;
    this.message = null; // {text, sub, time} centre-screen toast
    this.messageTimer = 0;
    this.demo = null;
    this.demoTimer = 0;
    this.rings = []; // visible sonar rings: {x, y, r, maxR, life}
    this.particles = [];
    this.floaters = []; // rising score popups: {x, y, text, color, life, maxLife}
    this.combo = new SilentStreak(STREAK_MAX_MULT);
    this.chimeStones = []; // travelling stones: {x, y, tx, ty, pulses, timer}
    this.loadLevel(1, LEVEL_SEED(1));
    this.resetRun();
    this.readDemoParams();
    this.applyDemo();
  }

  // --- level setup -------------------------------------------------
  loadLevel(level, seed) {
    this.level = level;
    this.world = new World(seed);
    this.sound = new SoundField(this.world);
    this.rng = makeRng(seed ^ 0x9e3779b9);
    // Spawn: a random open tile with room around it.
    const useTile = this.world.randomOpenTile();
    const sc = this.world.tileCenter(useTile.x, useTile.y);
    this.spawnTile = useTile;
    this.player = {
      x: sc.x,
      y: sc.y,
      radius: PLAYER_RADIUS,
      angle: -Math.PI / 2,
      moving: false,
      dashing: false,
      invuln: 0,
      stepTimer: 0,
    };
    // Pearls: scattered far from the spawn so the diver must cross the cave.
    const pearlCount = Math.min(PEARLS_BASE + (level - 1), PEARLS_CAP);
    this.pearls = [];
    const used = new Set([useTile.y * 40 + useTile.x]);
    for (let i = 0; i < pearlCount; i++) {
      let tile = this.world.randomOpenFar(useTile.x, useTile.y, 8);
      let guard = 0;
      while (used.has(tile.y * 40 + tile.x) && guard++ < 20) {
        tile = this.world.randomOpenFar(useTile.x, useTile.y, 8);
      }
      used.add(tile.y * 40 + tile.x);
      const c = this.world.tileCenter(tile.x, tile.y);
      this.pearls.push({ x: c.x, y: c.y, taken: false, golden: false, bob: this.rng.range(0, 6.28) });
    }
    this.pearlsTotal = pearlCount;
    // One golden pearl per level: the farthest from the spawn — the
    // hardest to reach, the richest to take.
    let golden = this.pearls[0];
    let goldenD = -1;
    for (const p of this.pearls) {
      const d = Math.hypot(p.x - sc.x, p.y - sc.y);
      if (d > goldenD) {
        goldenD = d;
        golden = p;
      }
    }
    if (golden) golden.golden = true;
    // The gate waits at the open tile farthest from the spawn.
    const far = this.world.farthestFrom(useTile.x, useTile.y);
    const gc = this.world.tileCenter(far.x, far.y);
    this.gate = { x: gc.x, y: gc.y, open: false };
    this.enemies = spawnEnemies(level, this.world, this.rng, useTile);
    this.chimes = CHIMES_BASE + Math.floor((level - 1) / 2);
    this.levelTime = 0;
    this.levelStartScore = this.score;
    this.rings = [];
    this.chimeStones = [];
    this.particles = [];
    this.floaters = [];
    this.combo.reset();
  }

  resetRun() {
    this.score = 0;
    this.hearts = MAX_HEARTS;
    this.time = 0;
    this.state = 'title';
    this.flash = 0;
    this.shake = 0;
    this.message = null;
    this.combo.reset();
  }

  // --- demo states for screenshots: ?demo=title|play|hunt|clear|over ---
  // The same game code renders them; the demo only sets the state up.
  readDemoParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      this.demo = params.get('demo');
      const seed = Number(params.get('seed') || 0);
      if (seed) this.demoSeed = seed;
    } catch (_e) {
      this.demo = null;
    }
  }

  applyDemo() {
    if (!this.demo) return;
    const seed = this.demoSeed || 7;
    this.loadLevel(1, seed);
    this.resetRun();
    if (this.demo === 'title') {
      this.state = 'title';
      this.demoTimer = 0;
      // A ping already out when the shot is taken: the cave shows
      // through the menu instead of flat black.
      this.emitPing(VIEW_W / 2, VIEW_H * 0.62, true);
    } else if (this.demo === 'play') {
      this.state = 'play';
      // A vista near the middle of the screen, with the most open water
      // around it, so the cover shot is a real cavern at a glance — not
      // a corner pocket with three quarters of black frame.
      let vista = this.spawnTile;
      let vistaScore = -1;
      for (const t of this.world.openTiles) {
        const tx = t % COLS;
        const ty = Math.floor(t / COLS);
        let open = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (!this.world.isWall(tx + dx, ty + dy)) open++;
          }
        }
        if (open > vistaScore) vistaScore = open;
      }
      let vistaCenter = Infinity;
      for (const t of this.world.openTiles) {
        const tx = t % COLS;
        const ty = Math.floor(t / COLS);
        let open = 0;
        for (let dy = -3; dy <= 3; dy++) {
          for (let dx = -3; dx <= 3; dx++) {
            if (!this.world.isWall(tx + dx, ty + dy)) open++;
          }
        }
        if (open < vistaScore - 4) continue;
        const centerD = Math.abs(tx - COLS / 2) + Math.abs(ty - ROWS / 2);
        if (centerD < vistaCenter) {
          vistaCenter = centerD;
          vista = { x: tx, y: ty };
        }
      }
      const vc = this.world.tileCenter(vista.x, vista.y);
      this.player.x = vc.x;
      this.player.y = vc.y;
      // The dive is already in progress: one pearl taken silently, the
      // streak at x2, score to match — the cover reads as a game being
      // played, not a game at zero. The golden pearl is moved to the
      // nearest one still out there, so the cover shows the gold.
      this.pearls.forEach((p) => {
        p.golden = false;
      });
      let nearestGolden = null;
      let nearestD = Infinity;
      for (const p of this.pearls) {
        if (p.taken) continue;
        const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
        if (d < nearestD) {
          nearestD = d;
          nearestGolden = p;
        }
      }
      if (nearestGolden) nearestGolden.golden = true;
      const staged = this.pearls.find((p) => !p.taken && !p.golden) || this.pearls[0];
      staged.taken = true;
      this.score = this.combo.onSilentPearl(PEARL_SCORE, SILENT_BONUS);
      // One hunter closes in, already suspicious: put it seven tiles
      // off, inside the ping's reach, so its body and eyes show in the
      // lit water instead of hiding in the dark like the rest.
      const near = this.enemies[0];
      const ptx = Math.floor(this.player.x / TILE);
      const pty = Math.floor(this.player.y / TILE);
      const { dist } = this.world.distancesFrom(ptx, pty);
      let spot = -1;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= 7 && dist[i] <= 8) {
          spot = i;
          break;
        }
      }
      if (spot >= 0) {
        const c = this.world.tileCenter(spot % COLS, Math.floor(spot / COLS));
        near.x = c.x;
        near.y = c.y;
      }
      near.state = 'suspicious';
      near.targetX = this.player.x;
      near.targetY = this.player.y;
      near.searchTimer = SUSPICION_TIME;
      // The rest of the hunters stay far off: they will hear the ping
      // and converge, but none reaches the diver before the shot.
      for (const e of this.enemies.slice(1)) {
        const tile = this.world.randomOpenFar(vista.x, vista.y, 16);
        const c = this.world.tileCenter(tile.x, tile.y);
        e.x = c.x;
        e.y = c.y;
        e.state = 'patrol';
      }
      // A ping just fired, and a chime stone already ringing by the
      // golden pearl: rings on the water, cave half-revealed.
      this.emitPing(this.player.x, this.player.y, true);
      // The demo ping is light only: clear its sound so the hunters
      // stay suspicious instead of hunting through the long setup
      // wait. The fresh ping before the shot still rings the bell.
      this.sound.events.length = 0;
      const nearPearl =
        this.pearls.find((p) => p.golden && !p.taken) || this.pearls.find((p) => !p.taken);
      if (nearPearl) this.throwChime(nearPearl.x, nearPearl.y);
    } else if (this.demo === 'hunt') {
      this.state = 'play';
      this.emitPing(this.player.x, this.player.y, true);
      // A listener closes in, already hunting: put it on an open tile
      // a few steps from the diver so it is visible, not in a wall.
      const hunter = this.enemies.find((e) => e.kind === 'listener') || this.enemies[0];
      const ptx = Math.floor(this.player.x / TILE);
      const pty = Math.floor(this.player.y / TILE);
      const { dist } = this.world.distancesFrom(ptx, pty);
      let spot = -1;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] >= 4 && dist[i] <= 6) {
          spot = i;
          break;
        }
      }
      if (spot >= 0) {
        const c = this.world.tileCenter(spot % COLS, Math.floor(spot / COLS));
        hunter.x = c.x;
        hunter.y = c.y;
      }
      hunter.state = 'hunt';
      hunter.targetX = this.player.x;
      hunter.targetY = this.player.y;
      this.hearts = 2;
      this.score = 340;
      this.pearls[0].taken = true;
    } else if (this.demo === 'clear') {
      this.state = 'clear';
      this.score = 1250;
      this.clearBonus = { time: 320, hearts: 300, silent: 150 };
      this.pearls.forEach((p) => {
        p.taken = true;
      });
      this.gate.open = true;
    } else if (this.demo === 'over') {
      this.state = 'over';
      this.hearts = 0;
      this.score = 860;
      this.flash = 0.4;
    }
  }

  // --- actions -----------------------------------------------------
  emitPing(x, y, silent = false) {
    this.sound.emit(x, y, PING_LOUDNESS, 'ping');
    this.rings.push({ x, y, r: 12, maxR: PING_RADIUS, life: 1 });
    if (!silent) this.audio.ping();
    this.noiseLevel = Math.max(this.noiseLevel, PING_LOUDNESS);
  }

  throwChime(tx, ty) {
    if (this.chimes <= 0 || this.state !== 'play') return;
    this.chimes--;
    this.chimeStones.push({
      x: this.player.x,
      y: this.player.y,
      tx,
      ty,
      pulses: CHIME_PULSES,
      timer: 0,
      travelled: 0,
    });
    this.audio.chime();
  }

  showMessage(text, sub = '', dur = 2.4) {
    this.message = { text, sub };
    this.messageTimer = dur;
  }

  onCaught(enemy) {
    if (this.state !== 'play') return;
    this.hearts--;
    this.player.invuln = CATCH_INVULN;
    this.flash = 1;
    this.shake = 1;
    this.audio.caught();
    // The catch itself is loud: every hunter in the cave hears it.
    this.sound.emit(this.player.x, this.player.y, 12, 'alarm');
    this.burst(this.player.x, this.player.y, 26, '#ff5c7a');
    // Knock the diver away from the hunter.
    const dx = this.player.x - enemy.x;
    const dy = this.player.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    moveCircle(this.world, this.player, this.player.radius, (dx / d) * 46, (dy / d) * 46);
    if (this.hearts <= 0) {
      this.state = 'over';
      this.audio.gameOver();
      if (this.score > this.best) {
        this.best = this.score;
        try {
          window.localStorage.setItem('hush-best', String(this.best));
        } catch (_e) {}
      }
    } else {
      this.showMessage(this.hearts === 1 ? 'ONE HEART LEFT' : 'CAUGHT!', 'Ping to find your way out — quietly', 2);
    }
  }

  burst(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(30, 190);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: this.rng.range(0.4, 1.1),
        maxLife: 1.1,
        size: this.rng.range(1.5, 4),
        color,
      });
    }
  }

  // A rising score popup: feedback on every pickup, in world space.
  addFloater(x, y, text, color) {
    this.floaters.push({ x, y, text, color, life: 1.2, maxLife: 1.2 });
  }

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.y -= 42 * dt; // rises as it fades
    }
    this.floaters = this.floaters.filter((f) => f.life > 0);
  }

  // --- per-frame update --------------------------------------------
  update(dt, input) {
    this.demoTimer += dt;
    // Title screen: keep the water alive behind the menu.
    if (this.state === 'title') {
      this.updateAmbient(dt);
      if (input.wasPressed('Enter', ' ')) {
        this.audio.ensure();
        this.startRun();
      }
      return;
    }
    if (this.state === 'over' || this.state === 'clear') {
      this.updateAmbient(dt);
      if (input.wasPressed('r', 'Enter', ' ')) {
        this.audio.ensure();
        if (this.state === 'over') {
          this.loadLevel(1, LEVEL_SEED(1));
          this.resetRun();
          this.startRun();
        } else {
          this.nextLevel();
        }
      }
      return;
    }
    if (this.state === 'paused') {
      if (input.wasPressed('p', 'Escape')) this.state = this.pausedFrom || 'play';
      return;
    }
    // state === 'play'
    if (input.wasPressed('p', 'Escape')) {
      this.pausedFrom = 'play';
      this.state = 'paused';
      return;
    }
    if (input.wasPressed('m')) this.audio.toggleMute();
    if (input.wasPressed('r')) {
      this.loadLevel(this.level, LEVEL_SEED(this.level));
      return;
    }
    this.audio.ensure();
    this.time += dt;
    this.levelTime += dt;
    this.sound.update(dt);
    this.updateAmbient(dt);
    this.updatePlayer(dt, input);
    for (const enemy of this.enemies) enemy.update(dt, this);
    // The moment anything hunts, the silent streak is gone.
    if (this.anyHunt) this.combo.breakStreak();
    this.updateChimes(dt);
    this.updateParticles(dt);
    this.checkPearls();
    this.checkGate();
    const anyHunt = this.enemies.some((e) => e.state === 'hunt');
    this.audio.updateHeartbeat(dt, anyHunt ? 1 : this.enemies.some((e) => e.state === 'suspicious') ? 0.45 : 0);
    this.noiseLevel = Math.max(0, this.noiseLevel - dt * 5);
    this.flash = Math.max(0, this.flash - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.message = null;
    }
  }

  updateAmbient(dt) {
    this.updateFloaters(dt);
    // Sonar rings expand and fade; the memory they wrote fades too.
    for (const ring of this.rings) {
      ring.r += PING_RING_SPEED * dt;
      ring.life = Math.max(0, 1 - ring.r / ring.maxR);
    }
    this.rings = this.rings.filter((r) => r.life > 0);
    // Demo title screen: a slow, lonely ping every few seconds.
    if (this.state === 'title' && this.demoTimer > 2.2) {
      this.demoTimer = 0;
      const cx = VIEW_W / 2 + Math.sin(this.time * 0.3) * 120;
      this.emitPing(cx, VIEW_H * 0.62, true);
    }
  }

  updatePlayer(dt, input) {
    const p = this.player;
    p.invuln = Math.max(0, p.invuln - dt);
    const mv = input.moveVector();
    p.moving = mv.x !== 0 || mv.y !== 0;
    p.dashing = p.moving && input.dashing;
    const speed = p.dashing ? DASH_SPEED : WALK_SPEED;
    if (p.moving) {
      p.angle = Math.atan2(mv.y, mv.x);
      moveCircle(this.world, p, p.radius, mv.x * speed * dt, mv.y * speed * dt);
      // Footsteps: the sound of moving. Dash steps are loud.
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = STEP_INTERVAL * (p.dashing ? 0.7 : 1);
        const loud = p.dashing ? DASH_NOISE : WALK_NOISE;
        this.sound.emit(p.x, p.y, loud, p.dashing ? 'dash' : 'step');
        this.audio.footstep(p.dashing);
        this.noiseLevel = Math.max(this.noiseLevel, loud);
      }
    }
    // Ping: Space or left click. The mouse aims nothing — a ping is a
    // circle around the diver — but a click still fires one.
    if (input.wasPressed(' ', 'f') || input.mouseClicked) {
      this.emitPing(p.x, p.y);
    }
    // Chime: C or right click, thrown toward the mouse.
    if (input.wasPressed('c') || input.mouseRight) {
      this.throwChime(input.mouseX, input.mouseY);
    }
  }

  updateChimes(dt) {
    for (const stone of this.chimeStones) {
      const dx = stone.tx - stone.x;
      const dy = stone.ty - stone.y;
      const dist = Math.hypot(dx, dy);
      const step = 520 * dt;
      if (dist <= step) {
        stone.x = stone.tx;
        stone.y = stone.ty;
        stone.timer -= dt;
        if (stone.timer <= 0 && stone.pulses > 0) {
          stone.pulses--;
          stone.timer = CHIME_PULSE_GAP;
          this.sound.emit(stone.x, stone.y, CHIME_LOUDNESS, 'chime');
          this.rings.push({ x: stone.x, y: stone.y, r: 10, maxR: 220, life: 1 });
          this.noiseLevel = Math.max(this.noiseLevel, CHIME_LOUDNESS);
          if (stone.pulses > 0) this.audio.chime();
        }
      } else {
        stone.x += (dx / dist) * step;
        stone.y += (dy / dist) * step;
      }
    }
    this.chimeStones = this.chimeStones.filter((s) => s.pulses > 0);
  }

  updateParticles(dt) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 1 - dt * 2;
      pt.vy *= 1 - dt * 2;
      pt.life -= dt;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  checkPearls() {
    const p = this.player;
    for (const pearl of this.pearls) {
      if (pearl.taken) continue;
      const d = Math.hypot(pearl.x - p.x, pearl.y - p.y);
      if (d < 26) {
        pearl.taken = true;
        const silent = !this.enemies.some((e) => e.state === 'hunt');
        const base = pearl.golden ? GOLDEN_PEARL_SCORE : PEARL_SCORE;
        const gained = silent
          ? this.combo.onSilentPearl(base, SILENT_BONUS)
          : this.combo.onNoisyPearl(base);
        this.score += gained;
        this.audio.pearl();
        this.burst(pearl.x, pearl.y, 14, pearl.golden ? '#ffd76a' : '#8ef7ff');
        this.addFloater(
          pearl.x,
          pearl.y - 20,
          pearl.golden
            ? `+${gained} ★`
            : silent
              ? `+${gained} ×${this.combo.multiplier}`
              : `+${gained}`,
          pearl.golden ? '#ffd76a' : silent ? '#ffd76a' : '#8ef7ff',
        );
        const left = this.pearls.filter((q) => !q.taken).length;
        if (left === 0) {
          this.gate.open = true;
          this.audio.gateOpen();
          this.showMessage('THE GATE IS OPEN', 'Reach the green gate — quietly', 3);
        } else {
          this.showMessage(
            pearl.golden
              ? `GOLDEN PEARL +${gained}`
              : silent
                ? `PEARL +${gained} — SILENT ×${this.combo.multiplier}`
                : `PEARL +${gained}`,
            `${left} more to open the gate`,
            1.6,
          );
        }
      }
    }
  }

  checkGate() {
    if (!this.gate.open) return;
    const p = this.player;
    const d = Math.hypot(this.gate.x - p.x, this.gate.y - p.y);
    if (d < 34) {
      const timeBonus = Math.max(0, 500 - Math.floor(this.levelTime) * 5);
      const heartBonus = this.hearts * 150;
      const silentBonus = this.enemies.every((e) => e.state !== 'hunt') ? 150 : 0;
      this.clearBonus = { time: timeBonus, hearts: heartBonus, silent: silentBonus };
      this.score += LEVEL_CLEAR_SCORE + timeBonus + heartBonus + silentBonus;
      this.state = 'clear';
      this.audio.levelClear();
      this.burst(this.gate.x, this.gate.y, 40, '#b8ff9e');
    }
  }

  startRun() {
    this.state = 'play';
    this.showMessage('FIND THE PEARLS', 'SPACE ping · SHIFT dash · C chime · P pause', 3.2);
  }

  nextLevel() {
    const next = this.level + 1;
    this.loadLevel(next, LEVEL_SEED(next));
    this.state = 'play';
    this.showMessage(`LEVEL ${next}`, next >= 3 ? 'Something old has woken below' : 'The cave grows darker', 2.6);
  }

  get pearlsTaken() {
    return this.pearls.filter((p) => p.taken).length;
  }

  get anyHunt() {
    return this.enemies.some((e) => e.state === 'hunt');
  }
}
