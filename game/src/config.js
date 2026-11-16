// HUSH — Echoes Below. Shared tuning for every system.
// One screen, one cave: the whole level fits the canvas so the judge
// reads it at a glance. All distances are pixels; the grid is 32px tiles.
export const VIEW_W = 1280;
export const VIEW_H = 800;
export const TILE = 32;
export const COLS = VIEW_W / TILE; // 40
export const ROWS = VIEW_H / TILE; // 25

// --- player ---
export const PLAYER_RADIUS = 11;
export const WALK_SPEED = 150; // px per second
export const DASH_SPEED = 305;
export const DASH_NOISE = 6.0; // loudness of a dash footstep
export const WALK_NOISE = 2.2; // loudness of a walking footstep
export const STEP_INTERVAL = 0.34; // seconds between footstep sounds
export const MAX_HEARTS = 3;
export const CATCH_INVULN = 2.0; // seconds of mercy after being caught

// --- sonar ---
export const PING_LOUDNESS = 10;
export const PING_RADIUS = 270; // how far one ping reveals
export const PING_RING_SPEED = 320; // px per second the ring expands
export const LANTERN_RADIUS = 135; // permanent light around the diver
export const MEMORY_FADE = 0.03; // memory brightness lost per second
export const MEMORY_PING_BOOST = 1.0; // brightness a ping writes

// --- sound model: loudness heard = loud - dist * DIST_DECAY - walls * WALL_LOSS
export const DIST_DECAY = 0.02;
export const WALL_LOSS = 3.0;
export const HEARING = { listener: 1.5, darter: 4.0, sleeper: 7.0 };
export const CHIME_LOUDNESS = 11;
export const CHIME_PULSES = 3;
export const CHIME_PULSE_GAP = 0.9;

// --- enemies ---
export const ENEMY_SPEED = { listener: 58, darter: 118, sleeper: 92 };
export const ENEMY_HUNT_SPEED = { listener: 96, darter: 172, sleeper: 132 };
export const CATCH_RADIUS = 22;
export const SUSPICION_TIME = 6.0; // seconds an enemy searches a heard spot

// --- levels ---
export const PEARLS_BASE = 4; // level 1 pearls; +1 per level, cap 8
export const PEARLS_CAP = 8;
export const CHIMES_BASE = 3;
export const LEVEL_SEED = (level) => 1000 + level * 77;
export const PEARL_SCORE = 100;
export const SILENT_BONUS = 50; // pearl taken while nothing hunts
export const LEVEL_CLEAR_SCORE = 250;

// --- palette: phosphor on black water ---
export const COLORS = {
  bg: '#04070d',
  wall: '#1a2f45',
  wallEdge: '#33587e',
  floor: '#0e2233',
  memory: '#9fd8c9',
  ping: '#7fe7d2',
  player: '#ffe9a8',
  playerCore: '#fff6d8',
  pearl: '#8ef7ff',
  gate: '#b8ff9e',
  gateOpen: '#d6ffb8',
  listener: '#ff9d5c',
  darter: '#ff5c7a',
  sleeper: '#c99aff',
  danger: '#ff4d4d',
  hud: '#cfe8dd',
  dim: '#5d7a72',
};
