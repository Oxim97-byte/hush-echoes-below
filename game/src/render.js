// HUSH — Echoes Below. The look: a cave drawn in full, then buried in
// darkness, then lit again only where light has been. Three canvases:
// the scene (everything, bright), the memory (where sonar has been,
// fading), and the mask (darkness with holes punched in it). What the
// player sees is scene-through-mask, plus the few things that glow in
// the dark on their own: hunters' eyes, the diver's lamp.
import { VIEW_W, VIEW_H, TILE, COLS, ROWS, COLORS, MEMORY_FADE } from './config.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export class Renderer {
  constructor(canvas, game) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.game = game;
    this.scene = makeCanvas(VIEW_W, VIEW_H);
    this.sceneCtx = this.scene.getContext('2d');
    this.memory = makeCanvas(VIEW_W, VIEW_H);
    this.memoryCtx = this.memory.getContext('2d');
    this.mask = makeCanvas(VIEW_W, VIEW_H);
    this.maskCtx = this.mask.getContext('2d');
    this.caveCache = null; // static floor + walls, repainted per level
    this.caveWorld = null;
    this.t = 0;
  }

  // The cave itself never changes within a level: paint its floor and
  // walls once and blit the result every frame instead of filling a
  // thousand tiles at 60 Hz.
  buildCaveCache() {
    const g = this.game;
    const cache = makeCanvas(VIEW_W, VIEW_H);
    const c = cache.getContext('2d');
    c.fillStyle = '#0a1826';
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (g.world.grid[y * COLS + x] === 1) continue;
        c.fillStyle = (x + y) % 2 === 0 ? '#102736' : '#132c3e';
        c.fillRect(x * TILE, y * TILE, TILE, TILE);
      }
    }
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (g.world.grid[y * COLS + x] !== 1) continue;
        c.fillStyle = COLORS.wall;
        c.fillRect(x * TILE, y * TILE, TILE, TILE);
        if (g.world.edge[y * COLS + x]) {
          c.strokeStyle = COLORS.wallEdge;
          c.lineWidth = 2;
          c.strokeRect(x * TILE + 1, y * TILE + 1, TILE - 2, TILE - 2);
        }
      }
    }
    this.caveCache = cache;
    this.caveWorld = g.world;
  }

  // Stamp light into the memory layer: a ring paints the band it just
  // crossed; the lantern paints a soft pool around the diver.
  stampMemory(dt) {
    const g = this.game;
    const mc = this.memoryCtx;
    // Fade what was remembered.
    mc.globalCompositeOperation = 'destination-out';
    mc.fillStyle = `rgba(0,0,0,${Math.min(1, MEMORY_FADE * dt)})`;
    mc.fillRect(0, 0, VIEW_W, VIEW_H);
    mc.globalCompositeOperation = 'source-over';
    for (const ring of g.rings) {
      mc.beginPath();
      mc.strokeStyle = `rgba(255,255,255,${0.85 * ring.life})`;
      mc.lineWidth = 46;
      mc.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      mc.stroke();
    }
    if (g.state === 'play' || g.state === 'paused') {
      const grad = mc.createRadialGradient(g.player.x, g.player.y, 4, g.player.x, g.player.y, 135);
      grad.addColorStop(0, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      mc.fillStyle = grad;
      mc.beginPath();
      mc.arc(g.player.x, g.player.y, 135, 0, Math.PI * 2);
      mc.fill();
    }
  }

  draw(dt) {
    const g = this.game;
    this.t += dt;
    this.stampMemory(dt);
    const shakeX = g.shake > 0 ? (Math.random() * 2 - 1) * g.shake * 7 : 0;
    const shakeY = g.shake > 0 ? (Math.random() * 2 - 1) * g.shake * 7 : 0;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(shakeX, shakeY);
    this.drawScene(dt);
    this.drawMask();
    ctx.drawImage(this.scene, 0, 0);
    ctx.drawImage(this.mask, 0, 0);
    this.drawGlowInDark(dt);
    this.drawParticles();
    this.drawFloaters();
    ctx.restore();
    // Red flash on catch, drawn over everything.
    if (g.flash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${g.flash * 0.28})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    this.drawVignette();
    this.drawHud();
    this.drawOverlays(dt);
  }

  // --- the bright scene, before darkness ---
  drawScene(dt) {
    const g = this.game;
    const c = this.sceneCtx;
    if (this.caveWorld !== g.world) this.buildCaveCache();
    c.drawImage(this.caveCache, 0, 0);
    // Pearls: bright cyan orbs with a halo, bobbing gently. The one
    // golden pearl per level glows gold, bigger, with a ring.
    for (const pearl of g.pearls) {
      if (pearl.taken) continue;
      const bob = Math.sin(this.t * 2 + pearl.bob) * 3;
      const pulse = 0.75 + Math.sin(this.t * 3 + pearl.bob) * 0.25;
      const haloR = pearl.golden ? 34 : 26;
      const coreR = pearl.golden ? 6 : 5;
      const glow = pearl.golden ? '255,215,106' : '142,247,255';
      const grad = c.createRadialGradient(pearl.x, pearl.y + bob, 1, pearl.x, pearl.y + bob, haloR);
      grad.addColorStop(0, `rgba(${glow},${0.85 * pulse})`);
      grad.addColorStop(0.4, `rgba(${glow},${0.25 * pulse})`);
      grad.addColorStop(1, `rgba(${glow},0)`);
      c.fillStyle = grad;
      c.beginPath();
      c.arc(pearl.x, pearl.y + bob, haloR, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = pearl.golden ? '#fff3c4' : '#dffbff';
      c.beginPath();
      c.arc(pearl.x, pearl.y + bob, coreR, 0, Math.PI * 2);
      c.fill();
      if (pearl.golden) {
        c.strokeStyle = `rgba(255,215,106,${0.7 * pulse})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(pearl.x, pearl.y + bob, 11 + Math.sin(this.t * 3) * 1.5, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // The gate: a stone arch, green when open, dull iron when shut.
    const gate = g.gate;
    c.save();
    c.translate(gate.x, gate.y);
    c.strokeStyle = gate.open ? COLORS.gateOpen : '#5a6b52';
    c.lineWidth = 7;
    c.beginPath();
    c.arc(0, 6, 24, Math.PI, 0);
    c.stroke();
    c.beginPath();
    c.moveTo(-24, 6);
    c.lineTo(-24, 26);
    c.moveTo(24, 6);
    c.lineTo(24, 26);
    c.stroke();
    if (gate.open) {
      const grad = c.createRadialGradient(0, 6, 2, 0, 6, 44);
      grad.addColorStop(0, 'rgba(184,255,158,0.55)');
      grad.addColorStop(1, 'rgba(184,255,158,0)');
      c.fillStyle = grad;
      c.beginPath();
      c.arc(0, 6, 44, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    // Chime stones in flight: small ringing bells.
    for (const stone of g.chimeStones) {
      c.fillStyle = '#ffe9a8';
      c.beginPath();
      c.arc(stone.x, stone.y, 5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(255,233,168,0.6)';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(stone.x, stone.y, 9 + Math.sin(this.t * 10) * 2, 0, Math.PI * 2);
      c.stroke();
    }
    // Enemies: eel bodies with a fading tail, coloured by kind.
    for (const e of g.enemies) {
      for (let i = 0; i < e.tail.length; i++) {
        const seg = e.tail[i];
        c.fillStyle = e.color;
        c.globalAlpha = seg.life * 0.25;
        c.beginPath();
        c.arc(seg.x, seg.y, e.radius * (0.4 + seg.life * 0.4), 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      c.fillStyle = e.color;
      c.beginPath();
      c.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      c.fill();
      // A darker belly stripe so the body has direction.
      c.strokeStyle = 'rgba(0,0,0,0.35)';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(e.x - Math.cos(e.angle) * e.radius * 0.7, e.y - Math.sin(e.angle) * e.radius * 0.7);
      c.lineTo(e.x + Math.cos(e.angle) * e.radius * 0.7, e.y + Math.sin(e.angle) * e.radius * 0.7);
      c.stroke();
      if (e.state === 'sleeping') {
        // Sleeper: curled, dim, with three closed-eye slits.
        c.fillStyle = 'rgba(0,0,0,0.5)';
        for (let i = -1; i <= 1; i++) {
          c.fillRect(e.x - 6 + i * 0, e.y - 8 + i * 7, 12, 2);
        }
      }
    }
    // The diver: a warm lamp-body with a helmet dome and a light cone.
    const p = g.player;
    if (g.state === 'play' || g.state === 'paused') {
      const blink = p.invuln > 0 && Math.floor(this.t * 12) % 2 === 0;
      c.save();
      c.globalAlpha = blink ? 0.35 : 1;
      c.translate(p.x, p.y);
      c.rotate(p.angle);
      // Light cone ahead.
      const cone = c.createLinearGradient(0, 0, 120, 0);
      cone.addColorStop(0, 'rgba(255,233,168,0.35)');
      cone.addColorStop(1, 'rgba(255,233,168,0)');
      c.fillStyle = cone;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(120, -34);
      c.lineTo(120, 34);
      c.closePath();
      c.fill();
      c.restore();
      c.save();
      c.globalAlpha = blink ? 0.35 : 1;
      c.fillStyle = COLORS.player;
      c.beginPath();
      c.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = COLORS.playerCore;
      c.beginPath();
      c.arc(p.x, p.y, 6, 0, Math.PI * 2);
      c.fill();
      // Helmet visor: a dark slit facing the swim direction.
      c.fillStyle = '#20303e';
      c.beginPath();
      c.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 4, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
  }

  // --- darkness with holes ---
  drawMask() {
    const g = this.game;
    const m = this.maskCtx;
    m.globalCompositeOperation = 'source-over';
    m.clearRect(0, 0, VIEW_W, VIEW_H);
    m.fillStyle = 'rgba(2,5,10,0.965)';
    m.fillRect(0, 0, VIEW_W, VIEW_H);
    m.globalCompositeOperation = 'destination-out';
    // Memory: everything sonar ever revealed, still fading.
    m.drawImage(this.memory, 0, 0);
    // Lantern: a steady pool of light around the diver.
    if (g.state === 'play' || g.state === 'paused') {
      const grad = m.createRadialGradient(g.player.x, g.player.y, 8, g.player.x, g.player.y, 150);
      grad.addColorStop(0, 'rgba(255,255,255,0.95)');
      grad.addColorStop(0.55, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = grad;
      m.beginPath();
      m.arc(g.player.x, g.player.y, 150, 0, Math.PI * 2);
      m.fill();
    }
    // Expanding rings: a bright band that reveals as it travels.
    for (const ring of g.rings) {
      m.strokeStyle = `rgba(255,255,255,${1.0 * ring.life})`;
      m.lineWidth = 40;
      m.beginPath();
      m.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      m.stroke();
    }
    // Pearls shimmer through the dark so the hunt stays fair; the
    // golden one shines farther.
    for (const pearl of g.pearls) {
      if (pearl.taken) continue;
      const shimmerR = pearl.golden ? 64 : 52;
      const shimmerA = pearl.golden ? 0.7 : 0.5;
      const grad = m.createRadialGradient(pearl.x, pearl.y, 2, pearl.x, pearl.y, shimmerR);
      grad.addColorStop(0, `rgba(255,255,255,${shimmerA})`);
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = grad;
      m.beginPath();
      m.arc(pearl.x, pearl.y, shimmerR, 0, Math.PI * 2);
      m.fill();
    }
    // The open gate calls the diver home.
    if (g.gate.open) {
      const grad = m.createRadialGradient(g.gate.x, g.gate.y, 4, g.gate.x, g.gate.y, 150);
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      m.fillStyle = grad;
      m.beginPath();
      m.arc(g.gate.x, g.gate.y, 150, 0, Math.PI * 2);
      m.fill();
    }
    m.globalCompositeOperation = 'source-over';
  }

  // Things that shine in the dark itself: hunters' eyes, the lamp halo.
  drawGlowInDark(dt) {
    const g = this.game;
    const c = this.ctx;
    if (g.state !== 'play' && g.state !== 'paused') return;
    for (const e of g.enemies) {
      if (e.state === 'sleeping') continue;
      const blink = Math.sin(this.t * 2 + e.id) * 0.5 + 0.5;
      const ex = Math.cos(e.angle);
      const ey = Math.sin(e.angle);
      const px = -ey;
      const py = ex;
      c.fillStyle = e.state === 'hunt' ? '#ff2e2e' : e.color;
      c.globalAlpha = 0.55 + blink * 0.45;
      for (const s of [-1, 1]) {
        c.beginPath();
        c.arc(e.x + ex * 7 + px * 5 * s, e.y + ey * 7 + py * 5 * s, 2.6, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      if (e.alertFlash > 0) {
        c.strokeStyle = `rgba(255,60,60,${e.alertFlash})`;
        c.lineWidth = 2;
        c.beginPath();
        c.arc(e.x, e.y, e.radius + 8 + (1 - e.alertFlash) * 10, 0, Math.PI * 2);
        c.stroke();
      }
    }
    // Lamp halo, additive, over the mask.
    const p = g.player;
    const halo = c.createRadialGradient(p.x, p.y, 4, p.x, p.y, 90);
    halo.addColorStop(0, 'rgba(255,233,168,0.20)');
    halo.addColorStop(1, 'rgba(255,233,168,0)');
    c.fillStyle = halo;
    c.beginPath();
    c.arc(p.x, p.y, 90, 0, Math.PI * 2);
    c.fill();
  }

  drawParticles() {
    const c = this.ctx;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (const pt of this.game.particles) {
      c.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      c.fillStyle = pt.color;
      c.beginPath();
      c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  // Rising score popups: the number a pickup just paid, in world space.
  drawFloaters() {
    const c = this.ctx;
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 21px system-ui, sans-serif';
    for (const f of this.game.floaters) {
      c.globalAlpha = Math.max(0, Math.min(1, f.life / f.maxLife));
      c.fillStyle = f.color;
      c.fillText(f.text, f.x, f.y);
    }
    c.restore();
  }

  drawVignette() {
    const c = this.ctx;
    const grad = c.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.42,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    c.fillStyle = grad;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // --- HUD ---
  drawHud() {
    const g = this.game;
    const c = this.ctx;
    if (g.state !== 'play' && g.state !== 'paused') return;
    c.save();
    c.textBaseline = 'middle';
    // Top bar.
    c.fillStyle = 'rgba(2,6,10,0.55)';
    c.fillRect(0, 0, VIEW_W, 52);
    c.fillStyle = COLORS.hud;
    c.font = '600 20px system-ui, sans-serif';
    // Hearts.
    let hx = 24;
    for (let i = 0; i < 3; i++) {
      c.fillStyle = i < g.hearts ? '#ff5c7a' : 'rgba(255,92,122,0.22)';
      c.beginPath();
      c.arc(hx + 6, 26, 7, 0, Math.PI * 2);
      c.arc(hx + 18, 26, 7, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.moveTo(hx, 30);
      c.lineTo(hx + 24, 30);
      c.lineTo(hx + 12, 44);
      c.closePath();
      c.fill();
      hx += 34;
    }
    c.fillStyle = COLORS.hud;
    c.font = '600 20px system-ui, sans-serif';
    c.fillText(`◆ ${g.pearlsTaken}/${g.pearlsTotal} pearls`, 140, 27);
    c.fillText(`◉ ${g.chimes} chimes`, 300, 27);
    c.fillText(`LEVEL ${g.level}`, 460, 27);
    if (g.combo.multiplier > 1) {
      c.fillStyle = '#ffd76a';
      c.fillText(`STREAK ×${g.combo.multiplier}`, 600, 27);
      c.fillStyle = COLORS.hud;
    }
    c.textAlign = 'right';
    c.fillText(`SCORE ${g.score}`, VIEW_W - 24, 27);
    c.textAlign = 'left';
    // Noise meter, bottom left: how loud you have been.
    const mw = 220;
    const mh = 10;
    const mx = 24;
    const my = VIEW_H - 34;
    c.fillStyle = 'rgba(2,6,10,0.55)';
    c.fillRect(mx - 8, my - 22, mw + 16, 46);
    c.fillStyle = COLORS.dim;
    c.font = '600 12px system-ui, sans-serif';
    c.fillText('N O I S E', mx, my - 10);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    c.fillRect(mx, my, mw, mh);
    const level = Math.min(1, g.noiseLevel / 12);
    c.fillStyle = level > 0.66 ? '#ff4d4d' : level > 0.33 ? '#ffb84d' : '#7fe7d2';
    c.fillRect(mx, my, mw * level, mh);
    // Threshold ticks: what the hunters can hear.
    c.fillStyle = 'rgba(255,255,255,0.5)';
    c.fillRect(mx + mw * (1.5 / 12), my - 3, 1, mh + 6);
    c.fillRect(mx + mw * (4 / 12), my - 3, 1, mh + 6);
    c.fillRect(mx + mw * (7 / 12), my - 3, 1, mh + 6);
    // Controls reminder, bottom right.
    c.textAlign = 'right';
    c.fillStyle = COLORS.dim;
    c.font = '500 13px system-ui, sans-serif';
    c.fillText('WASD move · SHIFT dash · SPACE ping · C chime · P pause · M mute', VIEW_W - 24, VIEW_H - 22);
    c.textAlign = 'left';
    // Hunted warning.
    if (g.anyHunt) {
      const blink = Math.floor(this.t * 4) % 2 === 0;
      c.fillStyle = blink ? '#ff4d4d' : '#ff8a8a';
      c.font = '700 22px system-ui, sans-serif';
      c.textAlign = 'center';
      c.fillText('! HUNTED — THEY HEARD YOU !', VIEW_W / 2, 84);
      c.textAlign = 'left';
    }
    // Centre toast message.
    if (g.message) {
      const a = Math.min(1, g.messageTimer);
      c.globalAlpha = a;
      c.textAlign = 'center';
      c.fillStyle = '#eafaf2';
      c.font = '700 30px system-ui, sans-serif';
      c.fillText(g.message.text, VIEW_W / 2, VIEW_H - 110);
      if (g.message.sub) {
        c.fillStyle = COLORS.dim;
        c.font = '500 16px system-ui, sans-serif';
        c.fillText(g.message.sub, VIEW_W / 2, VIEW_H - 78);
      }
      c.textAlign = 'left';
      c.globalAlpha = 1;
    }
    c.restore();
  }

  // --- full-screen states ---
  drawOverlays(dt) {
    const g = this.game;
    const c = this.ctx;
    if (g.state === 'title') {
      c.fillStyle = 'rgba(2,5,10,0.45)';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.textAlign = 'center';
      c.fillStyle = '#eafaf2';
      c.font = '300 108px system-ui, sans-serif';
      c.fillText('H U S H', VIEW_W / 2, 250);
      c.fillStyle = '#7fe7d2';
      c.font = '500 26px system-ui, sans-serif';
      c.fillText('E C H O E S   B E L O W', VIEW_W / 2, 310);
      c.fillStyle = COLORS.hud;
      c.font = '400 19px system-ui, sans-serif';
      c.fillText('The cave is blind. It listens. So do you.', VIEW_W / 2, 372);
      c.fillStyle = COLORS.dim;
      c.font = '400 17px system-ui, sans-serif';
      c.fillText('Collect every pearl to open the gate — but every ping, step and dash', VIEW_W / 2, 430);
      c.fillText('is a sound, and the hunters come to sound.', VIEW_W / 2, 456);
      c.fillText('WASD / arrows — move      SHIFT — loud dash      SPACE — sonar ping', VIEW_W / 2, 500);
      c.fillText('C / right-click — throw a chime stone to mislead them', VIEW_W / 2, 526);
      const pulse = 0.6 + Math.sin(this.t * 3) * 0.4;
      c.fillStyle = `rgba(234,250,242,${pulse})`;
      c.font = '700 24px system-ui, sans-serif';
      c.fillText('— PRESS ENTER TO DIVE —', VIEW_W / 2, 600);
      if (g.best > 0) {
        c.fillStyle = COLORS.dim;
        c.font = '500 16px system-ui, sans-serif';
        c.fillText(`best dive: ${g.best}`, VIEW_W / 2, 648);
      }
      c.textAlign = 'left';
    } else if (g.state === 'clear') {
      c.fillStyle = 'rgba(2,8,6,0.6)';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.textAlign = 'center';
      c.fillStyle = '#d6ffb8';
      c.font = '700 64px system-ui, sans-serif';
      c.fillText('LEVEL CLEAR', VIEW_W / 2, 260);
      c.fillStyle = COLORS.hud;
      c.font = '500 22px system-ui, sans-serif';
      const b = g.clearBonus || { time: 0, hearts: 0, silent: 0 };
      c.fillText(`gate bonus  +250`, VIEW_W / 2, 340);
      c.fillText(`time bonus  +${b.time}`, VIEW_W / 2, 378);
      c.fillText(`hearts kept  +${b.hearts}`, VIEW_W / 2, 416);
      c.fillText(`silent cave  +${b.silent}`, VIEW_W / 2, 454);
      c.fillStyle = '#eafaf2';
      c.font = '700 30px system-ui, sans-serif';
      c.fillText(`SCORE  ${g.score}`, VIEW_W / 2, 520);
      const pulse = 0.6 + Math.sin(this.t * 3) * 0.4;
      c.fillStyle = `rgba(234,250,242,${pulse})`;
      c.font = '700 22px system-ui, sans-serif';
      c.fillText('— PRESS ENTER FOR THE NEXT LEVEL —', VIEW_W / 2, 600);
      c.textAlign = 'left';
    } else if (g.state === 'over') {
      c.fillStyle = 'rgba(8,2,4,0.62)';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.textAlign = 'center';
      c.fillStyle = '#ff5c7a';
      c.font = '700 64px system-ui, sans-serif';
      c.fillText('THE DARK KEEPS YOU', VIEW_W / 2, 280);
      c.fillStyle = COLORS.hud;
      c.font = '500 22px system-ui, sans-serif';
      c.fillText(`You reached level ${g.level} with ${g.score} points.`, VIEW_W / 2, 350);
      c.fillText(`Best dive: ${g.best}`, VIEW_W / 2, 388);
      c.fillStyle = COLORS.dim;
      c.font = '400 17px system-ui, sans-serif';
      c.fillText('The hunters heard every ping. Next time, spend your silence wisely.', VIEW_W / 2, 440);
      const pulse = 0.6 + Math.sin(this.t * 3) * 0.4;
      c.fillStyle = `rgba(234,250,242,${pulse})`;
      c.font = '700 22px system-ui, sans-serif';
      c.fillText('— PRESS R TO DIVE AGAIN —', VIEW_W / 2, 520);
      c.textAlign = 'left';
    } else if (g.state === 'paused') {
      c.fillStyle = 'rgba(2,5,10,0.6)';
      c.fillRect(0, 0, VIEW_W, VIEW_H);
      c.textAlign = 'center';
      c.fillStyle = '#eafaf2';
      c.font = '700 56px system-ui, sans-serif';
      c.fillText('PAUSED', VIEW_W / 2, 380);
      c.fillStyle = COLORS.dim;
      c.font = '400 18px system-ui, sans-serif';
      c.fillText('P — resume', VIEW_W / 2, 430);
      c.textAlign = 'left';
    }
  }
}
