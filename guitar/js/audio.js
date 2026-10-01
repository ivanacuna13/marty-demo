// The coach's EARS: microphone capture, pitch (YIN), chroma (chord recognition), level, and sample-accurate onsets (AudioWorklet).
import { freqToMidi, recognize, normalize } from './theory.js';

const ONSET_WORKLET = `
class OnsetProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.hop = 128; this.avg = 0.0005; this.prev = 0; this.hold = 0; this.th = 2.2; this.floor = 0.0008;
    this.port.onmessage = e => { if (e.data.sensitivity) { this.th = 3.4 - e.data.sensitivity * 2.2; } if (e.data.floor) this.floor = e.data.floor; }; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]; if (!ch) return true;
    let e = 0; for (let i = 0; i < ch.length; i++) e += ch[i] * ch[i]; e /= ch.length;
    const t = currentTime;
    if (this.hold > 0) this.hold -= ch.length / sampleRate;
    else if (e > this.floor && e > this.avg * this.th && e > this.prev * 1.25) {
      let k = 0; while (k < ch.length && ch[k] * ch[k] < e * 0.5) k++;
      this.port.postMessage({ t: t + k / sampleRate, e });
      this.hold = 0.07;
    }
    this.avg = this.avg * 0.985 + e * 0.015; this.prev = e;
    return true;
  }
}
registerProcessor('onset-processor', OnsetProcessor);`;

export class Ears extends EventTarget {
  constructor() {
    super();
    this.ctx = null; this.running = false; this.listeners = new Set();
    this.pitch = null; this.level = 0; this.chroma = new Float32Array(12); this.chord = null;
    this.sensitivity = 0.6; this.gateDb = -52;
  }
  async ensureContext() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return this.ctx;
  }
  async start() {
    if (this.running) return true;
    await this.ensureContext();
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.attach(src);
    return true;
  }
  // Attach any source node (mic, or an <audio> element for the Song Decoder's live mode)
  attach(src) {
    const ctx = this.ctx;
    this.src = src;
    this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 8192; this.analyser.smoothingTimeConstant = 0.25;
    src.connect(this.analyser);
    this.timeBuf = new Float32Array(4096); this.freqBuf = new Float32Array(this.analyser.frequencyBinCount);
    this.running = true;
    this._setupOnsets(src).catch(() => {});
    const loop = () => { if (!this.running) return; this._analyze(); this._raf = requestAnimationFrame(loop); };
    loop();
  }
  async _setupOnsets(src) {
    if (!this.ctx.audioWorklet) return;
    if (!this._workletLoaded) {
      const url = URL.createObjectURL(new Blob([ONSET_WORKLET], { type: 'application/javascript' }));
      await this.ctx.audioWorklet.addModule(url); this._workletLoaded = true;
    }
    this.onsetNode = new AudioWorkletNode(this.ctx, 'onset-processor');
    this.onsetNode.port.postMessage({ sensitivity: this.sensitivity });
    this.onsetNode.port.onmessage = e => this.dispatchEvent(new CustomEvent('onset', { detail: e.data }));
    src.connect(this.onsetNode);
    // Worklet must be pulled by the graph; route through a muted gain.
    const mute = this.ctx.createGain(); mute.gain.value = 0; this.onsetNode.connect(mute); mute.connect(this.ctx.destination);
  }
  setSensitivity(v) { this.sensitivity = v; this.onsetNode?.port.postMessage({ sensitivity: v }); }
  stop() {
    this.running = false; cancelAnimationFrame(this._raf);
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    try { this.src?.disconnect(); } catch (e) {}
  }
  _analyze() {
    const a = this.analyser, sr = this.ctx.sampleRate;
    a.getFloatTimeDomainData(this.timeBuf);
    let rms = 0; for (const x of this.timeBuf) rms += x * x; rms = Math.sqrt(rms / this.timeBuf.length);
    this.level = rms; this.db = 20 * Math.log10(rms + 1e-9);
    const gated = this.db < this.gateDb;
    // Pitch
    const f = gated ? -1 : yin(this.timeBuf, sr);
    if (f > 60 && f < 1400) {
      const midi = freqToMidi(f);
      this.pitch = { freq: f, midi, cents: (midi - Math.round(midi)) * 100, note: Math.round(midi), t: performance.now() };
    } else this.pitch = null;
    // Chroma
    a.getFloatFrequencyData(this.freqBuf);
    if (!gated) {
      this.chroma = chromaFromSpectrum(this.freqBuf, sr, a.fftSize);
      this.chord = recognize(this.chroma);
    } else { this.chord = null; }
    this.dispatchEvent(new CustomEvent('frame', { detail: this }));
  }
  // Match the live chroma against a target chord: returns 0..1 similarity vs the best competing chord.
  matchChord(sym, candidates) {
    if (!this.chord || this.db < this.gateDb) return { ok: false, score: 0 };
    const pool = candidates ? [...new Set([sym, ...candidates])] : null;
    const r = pool ? recognize(this.chroma, pool) : this.chord;
    const target = recognize(this.chroma, [sym]);
    return { ok: r?.name === sym && target.score > 0.72, score: target.score, heard: r?.name };
  }
}

// YIN pitch detector (de Cheveigné & Kawahara, 2002) with parabolic interpolation.
export function yin(buf, sr, threshold = 0.12) {
  const N = Math.floor(buf.length / 2);
  const d = new Float32Array(N);
  for (let tau = 1; tau < N; tau++) {
    let s = 0;
    for (let i = 0; i < N; i++) { const x = buf[i] - buf[i + tau]; s += x * x; }
    d[tau] = s;
  }
  // cumulative mean normalized difference
  let run = 0; d[0] = 1;
  for (let tau = 1; tau < N; tau++) { run += d[tau]; d[tau] = d[tau] * tau / (run || 1); }
  const minTau = Math.floor(sr / 1400), maxTau = Math.min(N - 1, Math.floor(sr / 60));
  let tau = -1;
  for (let t = minTau; t < maxTau; t++) {
    if (d[t] < threshold) { while (t + 1 < maxTau && d[t + 1] < d[t]) t++; tau = t; break; }
  }
  if (tau < 0) return -1;
  const x0 = d[tau - 1] ?? d[tau], x2 = d[tau + 1] ?? d[tau];
  const denom = 2 * (2 * d[tau] - x2 - x0);
  const better = denom ? tau + (x2 - x0) / denom : tau;
  return sr / better;
}

// Fold an FFT magnitude spectrum (dB) into a 12-bin pitch-class profile (65 Hz – 2.1 kHz, guitar range).
export function chromaFromSpectrum(db, sr, fftSize) {
  const c = new Float32Array(12);
  const binHz = sr / fftSize;
  const lo = Math.floor(65 / binHz), hi = Math.min(db.length - 1, Math.ceil(2100 / binHz));
  // spectral whitening: subtract a local mean so that loud low strings don't drown everything
  for (let k = lo; k <= hi; k++) {
    const mag = Math.pow(10, db[k] / 20);
    if (!(mag > 0)) continue;
    const prev = Math.pow(10, db[k - 1] / 20), next = Math.pow(10, db[k + 1] / 20);
    if (mag < prev || mag < next) continue; // peaks only
    const f = k * binHz;
    const midi = freqToMidi(f);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    const detune = Math.abs(midi - Math.round(midi));
    const w = Math.sqrt(mag) * (1 - detune) * (f < 400 ? 1 : 400 / f + 0.3);
    c[pc] += w;
  }
  return normalize(c);
}

// Offline analysis of a decoded AudioBuffer: melody (YIN), chroma per frame, onsets, tempo. Used by the Song Decoder.
export async function analyzeBuffer(buffer, { onProgress, hop = 1024, frame = 4096 } = {}) {
  const sr = buffer.sampleRate;
  const ch0 = buffer.getChannelData(0), ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
  const mono = new Float32Array(ch0.length);
  for (let i = 0; i < ch0.length; i++) mono[i] = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
  const frames = [];
  const win = hann(frame);
  const re = new Float32Array(frame), im = new Float32Array(frame);
  const db = new Float32Array(frame / 2);
  let prevSpec = null;
  const total = Math.floor((mono.length - frame) / hop);
  for (let n = 0; n < total; n++) {
    const off = n * hop;
    const seg = mono.subarray(off, off + frame);
    let rms = 0; for (const x of seg) rms += x * x; rms = Math.sqrt(rms / frame);
    const f0 = rms > 0.01 ? yin(seg.subarray(0, 2048 + 1024), sr, 0.15) : -1;
    for (let i = 0; i < frame; i++) { re[i] = seg[i] * win[i]; im[i] = 0; }
    fft(re, im);
    let flux = 0;
    const spec = new Float32Array(frame / 2);
    for (let k = 0; k < frame / 2; k++) { const m = Math.hypot(re[k], im[k]); spec[k] = m; db[k] = 20 * Math.log10(m + 1e-9); if (prevSpec) flux += Math.max(0, m - prevSpec[k]); }
    prevSpec = spec;
    frames.push({ t: off / sr, rms, f0, chroma: rms > 0.004 ? chromaFromSpectrum(db, sr, frame) : null, flux });
    if (n % 200 === 0) { onProgress?.(n / total); await new Promise(r => setTimeout(r, 0)); }
  }
  onProgress?.(1);
  return { frames, sr, hop, duration: buffer.duration, tempo: estimateTempo(frames, sr / hop) };
}

function estimateTempo(frames, fps) {
  const flux = frames.map(f => f.flux);
  const mean = flux.reduce((a, b) => a + b, 0) / (flux.length || 1);
  const x = flux.map(v => Math.max(0, v - mean));
  let best = { bpm: 100, s: -1 };
  for (let bpm = 60; bpm <= 180; bpm += 1) {
    const lag = Math.round(fps * 60 / bpm);
    let s = 0; for (let i = lag; i < x.length; i++) s += x[i] * x[i - lag];
    s /= (x.length - lag) || 1;
    // gentle preference for the 80–130 range where most songs sit
    s *= 1 - Math.abs(bpm - 105) / 400;
    if (s > best.s) best = { bpm, s };
  }
  return best.bpm;
}

// Turn per-frame f0 into note events.
export function framesToNotes(frames, minDur = 0.09) {
  const notes = []; let cur = null;
  for (const f of frames) {
    const m = f.f0 > 70 && f.f0 < 1400 ? Math.round(freqToMidi(f.f0)) : null;
    if (cur && m === cur.midi) { cur.end = f.t; continue; }
    if (cur && cur.end - cur.start >= minDur) notes.push(cur);
    cur = m ? { midi: m, start: f.t, end: f.t } : null;
  }
  if (cur && cur.end - cur.start >= minDur) notes.push(cur);
  // merge octave-glitch neighbors (common YIN error)
  return notes.filter((n, i) => !(i > 0 && i < notes.length - 1 && n.end - n.start < 0.12 && Math.abs(n.midi - notes[i - 1].midi) === 12 && notes[i + 1].midi === notes[i - 1].midi));
}

// Chord per beat: average chroma across each beat, recognize, then merge repeats.
export function framesToChords(frames, bpm, { beatsPerChord = 2, candidates = null } = {}) {
  const spb = 60 / bpm * beatsPerChord;
  const out = [];
  const dur = frames.length ? frames[frames.length - 1].t : 0;
  for (let t = 0; t < dur; t += spb) {
    const acc = new Float32Array(12); let n = 0;
    for (const f of frames) if (f.t >= t && f.t < t + spb && f.chroma) { for (let i = 0; i < 12; i++) acc[i] += f.chroma[i]; n++; }
    if (n < 2) { out.push({ t, name: null }); continue; }
    const r = recognize(acc, candidates);
    out.push({ t, name: r && r.score > 0.62 ? r.name : null, score: r?.score });
  }
  const merged = [];
  out.forEach(c => { const last = merged[merged.length - 1]; if (last && last.name === c.name) last.end = c.t + spb; else merged.push({ ...c, end: c.t + spb }); });
  return merged;
}

function hann(n) { const w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1)); return w; }
// In-place radix-2 FFT
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ar = re[i + j], ai = im[i + j];
        const br = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci, bi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ar + br; im[i + j] = ai + bi; re[i + j + len / 2] = ar - br; im[i + j + len / 2] = ai - bi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}

export const ears = new Ears();
