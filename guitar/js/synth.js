// The coach's HANDS: a Karplus-Strong plucked-string synth (so Axel can play you any chord or note) and a sample-accurate metronome.
import { ears } from './audio.js';
import { midiToFreq, getShape, STANDARD } from './theory.js';

const cache = new Map();
function pluckBuffer(ctx, midi, dur = 2.6, bright = 0.5) {
  const key = midi + ':' + bright;
  if (cache.has(key)) return cache.get(key);
  const sr = ctx.sampleRate, f = midiToFreq(midi), N = Math.round(sr / f);
  const len = Math.floor(sr * dur), out = new Float32Array(len), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(Math.PI * i / N));
  // pre-filter the excitation (darker attack for lower brightness)
  for (let p = 0; p < 2 - bright * 2; p++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) * 0.5;
  const decay = 0.996 + Math.min(0.0035, 0.0009 * (64 - Math.min(64, midi - 30)) / 10);
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (idx + 1) % N;
    const v = ring[idx];
    out[i] = v;
    ring[idx] = decay * 0.5 * (v + ring[nxt]);
    idx = nxt;
  }
  // body resonance-ish: tiny pick-position comb + fade-out tail
  for (let i = len - 2000; i < len; i++) out[i] *= (len - i) / 2000;
  const buf = ctx.createBuffer(1, len, sr); buf.copyToChannel(out, 0);
  cache.set(key, buf);
  return buf;
}

let master = null;
async function out() {
  const ctx = await ears.ensureContext();
  if (!master) {
    master = ctx.createGain(); master.gain.value = 0.55;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
  }
  return ctx;
}
export function setVolume(v) { if (master) master.gain.value = v; }

export async function playNote(midi, { when = 0, vel = 0.8, dur = 2.6 } = {}) {
  const ctx = await out();
  const s = ctx.createBufferSource(); s.buffer = pluckBuffer(ctx, midi, dur);
  const g = ctx.createGain(); g.gain.value = vel;
  s.connect(g); g.connect(master);
  s.start(when || ctx.currentTime);
  return s;
}

// Strum a chord shape. dir: 'D' (low->high) or 'U' (high->low); spread in seconds between strings.
export async function strum(sym, { when = 0, dir = 'D', vel = 0.7, spread = 0.018, muted = false, capo = 0 } = {}) {
  const ctx = await out();
  const shape = typeof sym === 'string' ? getShape(sym) : sym;
  if (!shape) return;
  const t0 = when || ctx.currentTime + 0.01;
  const strings = shape.frets.map((f, i) => f < 0 ? null : STANDARD[i] + f + capo).map((m, i) => ({ m, i })).filter(x => x.m !== null);
  if (dir === 'U') strings.reverse();
  strings.forEach((x, k) => {
    const s = ctx.createBufferSource(); s.buffer = pluckBuffer(ctx, x.m, muted ? 0.25 : 2.4);
    const g = ctx.createGain(); g.gain.value = vel * (dir === 'U' ? 0.7 : 1) * (1 - k * 0.04);
    if (muted) { g.gain.setValueAtTime(g.gain.value, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18); }
    s.connect(g); g.connect(master); s.start(t0 + k * spread);
  });
}

// Arpeggiate (fingerpicking preview): bass then strings in order.
export async function arpeggio(sym, { when = 0, step = 0.22, order = null, capo = 0 } = {}) {
  const ctx = await out();
  const shape = getShape(sym); if (!shape) return;
  const t0 = when || ctx.currentTime + 0.02;
  const played = shape.frets.map((f, i) => f < 0 ? null : i).filter(i => i !== null);
  const seq = order || [played[0], 3, 4, 5, 4, 3].filter(i => shape.frets[i] >= 0);
  seq.forEach((i, k) => playNote(STANDARD[i] + shape.frets[i] + capo, { when: t0 + k * step, vel: k === 0 ? 0.9 : 0.6 }));
}

// --- Metronome with lookahead scheduling (Chris Wilson "A Tale of Two Clocks" pattern) ---
export class Metronome extends EventTarget {
  constructor() { super(); this.bpm = 80; this.beatsPerBar = 4; this.sub = 1; this.running = false; this.volume = 0.6; this.accent = true; }
  async start(bpm = this.bpm) {
    const ctx = await out();
    this.ctx = ctx; this.bpm = bpm; this.running = true;
    this.nextTime = ctx.currentTime + 0.12; this.beat = 0; this.startTime = this.nextTime;
    clearInterval(this._iv);
    this._iv = setInterval(() => this._schedule(), 25);
    this.dispatchEvent(new CustomEvent('start', { detail: { t: this.startTime } }));
  }
  stop() { this.running = false; clearInterval(this._iv); this.dispatchEvent(new Event('stop')); }
  setBpm(b) { this.bpm = Math.max(30, Math.min(240, Math.round(b))); this.dispatchEvent(new CustomEvent('bpm', { detail: this.bpm })); }
  get spb() { return 60 / this.bpm; }
  _schedule() {
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const beatInBar = this.beat % this.beatsPerBar;
      if (this.volume > 0) this._click(this.nextTime, beatInBar === 0 && this.accent);
      const detail = { t: this.nextTime, beat: this.beat, beatInBar, bar: Math.floor(this.beat / this.beatsPerBar) };
      this.dispatchEvent(new CustomEvent('schedule', { detail }));
      const delay = Math.max(0, (this.nextTime - this.ctx.currentTime) * 1000);
      setTimeout(() => this.running && this.dispatchEvent(new CustomEvent('beat', { detail })), delay);
      this.nextTime += this.spb; this.beat++;
    }
  }
  _click(t, accent) {
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.frequency.value = accent ? 1760 : 1175; o.type = 'square';
    g.gain.setValueAtTime(this.volume * (accent ? 0.35 : 0.22), t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    o.connect(g); g.connect(this.ctx.destination); o.start(t); o.stop(t + 0.04);
  }
  // Nearest grid position for a time (used to grade strums). Returns offset in ms (negative = early).
  grade(t, subdivision = 2) {
    const step = this.spb / subdivision;
    const n = Math.round((t - this.startTime) / step);
    return { slot: n, offsetMs: (t - (this.startTime + n * step)) * 1000 };
  }
}
export const metronome = new Metronome();
