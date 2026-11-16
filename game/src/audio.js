// HUSH — Echoes Below. Every sound is synthesized with WebAudio:
// no audio files, no network. The synth is part of the game design —
// the sonar ping, the footsteps and the heartbeat all tell the player
// what the dark is doing.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.heartTimer = 0;
    this.heartRate = 0; // beats per second, 0 = calm
  }

  // Browsers only allow audio after a user gesture; call on key/click.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
    } catch (_e) {
      this.ctx = null;
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    return this.muted;
  }

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  // A short sine blip that slides in pitch, with an exponential decay.
  blip(freqFrom, freqTo, dur, vol, type = 'sine') {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // Filtered noise burst: footsteps, splashes, the catch thud.
  noise(dur, vol, filterFreq, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t = this.now();
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // The sonar ping: a bright 880 -> 220 Hz sweep with a faint echo.
  ping() {
    this.blip(920, 210, 0.9, 0.5);
    this.blip(1380, 320, 0.5, 0.12);
  }

  // A footstep: quiet when drifting, louder and lower when dashing.
  footstep(loud) {
    if (loud) this.noise(0.09, 0.22, 420);
    else this.noise(0.06, 0.08, 900);
  }

  // Pearl pickup: a small rising arpeggio.
  pearl() {
    this.blip(660, 660, 0.09, 0.22, 'triangle');
    setTimeout(() => this.blip(880, 880, 0.09, 0.22, 'triangle'), 70);
    setTimeout(() => this.blip(1320, 1320, 0.16, 0.2, 'triangle'), 140);
  }

  // The chime stone: a clear bell that rings three times.
  chime() {
    this.blip(1568, 1568, 0.7, 0.3, 'sine');
    this.blip(2093, 2093, 0.5, 0.12, 'sine');
  }

  // Being caught: a low thud plus a dissonant sting.
  caught() {
    this.noise(0.25, 0.5, 180);
    this.blip(110, 55, 0.5, 0.4, 'sawtooth');
    this.blip(116, 58, 0.5, 0.3, 'sawtooth');
  }

  // The gate opening: a warm major chord, one note at a time.
  gateOpen() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, f, 0.55, 0.2, 'triangle'), i * 90);
    });
  }

  levelClear() {
    const notes = [392, 523, 659, 784, 1047];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, f, 0.4, 0.2, 'triangle'), i * 80);
    });
  }

  gameOver() {
    const notes = [392, 370, 349, 311];
    notes.forEach((f, i) => {
      setTimeout(() => this.blip(f, f * 0.94, 0.6, 0.22, 'sine'), i * 160);
    });
  }

  // Heartbeat: two low thumps. Call every frame with dt and a danger
  // level 0..1 (1 = an enemy is hunting you); the beat quickens.
  updateHeartbeat(dt, danger) {
    if (!this.ctx || this.muted) return;
    const target = danger > 0 ? 0.9 + danger * 1.1 : 0;
    this.heartRate += (target - this.heartRate) * Math.min(1, dt * 2);
    if (this.heartRate < 0.15) return;
    this.heartTimer -= dt;
    if (this.heartTimer <= 0) {
      this.heartTimer = 1 / this.heartRate;
      this.blip(64, 40, 0.14, 0.5, 'sine');
      setTimeout(() => this.blip(58, 38, 0.12, 0.35, 'sine'), 140);
    }
  }
}
