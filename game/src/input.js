// HUSH — Echoes Below. Keyboard + mouse, with edge-triggered actions
// (a key press fires once, holding it does not spam pings).
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed each frame
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseClicked = false; // left click edge
    this.mouseRight = false; // right click edge
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (!e.repeat) this.pressed.add(k);
      this.keys.add(k);
    };
    this._onKeyUp = (e) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      this.keys.delete(k);
    };
    this._onMouseMove = (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = ((e.clientX - r.left) / r.width) * canvas.width;
      this.mouseY = ((e.clientY - r.top) / r.height) * canvas.height;
    };
    this._onMouseDown = (e) => {
      this._onMouseMove(e);
      if (e.button === 0) this.mouseClicked = true;
      if (e.button === 2) this.mouseRight = true;
    };
    this._onContext = (e) => e.preventDefault();
    this._onBlur = () => {
      this.keys.clear();
      this.pressed.clear();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('contextmenu', this._onContext);
  }

  down(...names) {
    return names.some((n) => this.keys.has(n));
  }

  // True once on the frame the key went down; call after reading.
  wasPressed(...names) {
    return names.some((n) => this.pressed.has(n));
  }

  // Movement vector from WASD / arrows, normalized.
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('a', 'ArrowLeft')) x -= 1;
    if (this.down('d', 'ArrowRight')) x += 1;
    if (this.down('w', 'ArrowUp')) y -= 1;
    if (this.down('s', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.sqrt(2);
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  get dashing() {
    return this.down('Shift');
  }

  // Clear all edge triggers at the end of a frame.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.mouseRight = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('contextmenu', this._onContext);
  }
}
