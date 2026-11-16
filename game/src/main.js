// HUSH — Echoes Below. Boot: canvas, game, input, renderer, loop.
// A fixed-step update (60 Hz accumulator) keeps the simulation stable
// on any display; rendering follows the display's own refresh.
import { VIEW_W, VIEW_H } from './config.js';
import { Game } from './game.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { SoundEngine } from './audio.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const audio = new SoundEngine();
const game = new Game(audio);
const input = new Input(canvas);
const renderer = new Renderer(canvas, game);

// For play-testing and screenshots: window.__hush exposes the live game.
window.__hush = { game, input, audio, renderer };

const STEP = 1 / 60;
let last = performance.now();
let acc = 0;

function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25; // tab was hidden; do not spiral
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard < 5) {
    game.update(STEP, input);
    acc -= STEP;
    guard++;
  }
  if (guard === 5) acc = 0;
  input.endFrame();
  renderer.draw(Math.min(dt, 0.05));
  requestAnimationFrame(frame);
}

// First gesture unlocks audio on every browser.
window.addEventListener('pointerdown', () => audio.ensure(), { once: true });
window.addEventListener('keydown', () => audio.ensure(), { once: true });

// Leaving the tab mid-dive pauses the game instead of killing the diver.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'play') {
    game.pausedFrom = 'play';
    game.state = 'paused';
  }
});

requestAnimationFrame(frame);
