// The coach's EYES: MediaPipe HandLandmarker in the browser. Fretting-hand posture, strumming-hand motion tracking, and hands-free gestures.
// Live camera on the open web; inside a Claude artifact (no camera) the same pipeline watches an uploaded video, with the engine shipped as local files.
import { IS_ARTIFACT } from './platform.js';
const LOCAL = n => new URL('../mp/' + n, import.meta.url).href;
const TASKS = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// Landmark indexes
const WRIST = 0, THUMB_TIP = 4, THUMB_IP = 3;
const FINGERS = { index: [5, 6, 7, 8], middle: [9, 10, 11, 12], ring: [13, 14, 15, 16], pinky: [17, 18, 19, 20] };
const CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];

function angle(a, b, c) {
  const v1 = [a.x - b.x, a.y - b.y, (a.z - b.z)], v2 = [c.x - b.x, c.y - b.y, (c.z - b.z)];
  const d = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2];
  const m = Math.hypot(...v1) * Math.hypot(...v2) || 1;
  return Math.acos(Math.max(-1, Math.min(1, d / m))) * 180 / Math.PI;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export class Eyes extends EventTarget {
  constructor() {
    super();
    this.running = false; this.leftHanded = false; this.mirror = true;
    this.fret = null; this.strum = null; this.trail = []; this.strumEvents = []; this.posture = null;
    this._lastGesture = 0; this._dirY = 0; this._extreme = null;
  }
  async loadModel() {
    if (this.landmarker) return;
    this.dispatchEvent(new CustomEvent('status', { detail: 'Loading hand-tracking model…' }));
    let HandLandmarker, fileset, base;
    if (IS_ARTIFACT) {
      ({ HandLandmarker } = await import(LOCAL('vision_bundle.mjs')));
      fileset = { wasmLoaderPath: LOCAL('vision_wasm_internal.js'), wasmBinaryPath: LOCAL('vision_wasm_internal.wasm') };
      // The model ships base64-encoded as text (artifacts only serve web file types).
      const b64 = await (await fetch(LOCAL('hand_landmarker.b64.txt'))).text();
      const bin = atob(b64.trim()); const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      base = { modelAssetBuffer: bytes };
    } else {
      let FilesetResolver;
      ({ FilesetResolver, HandLandmarker } = await import(TASKS + '/vision_bundle.mjs'));
      fileset = await FilesetResolver.forVisionTasks(TASKS + '/wasm');
      base = { modelAssetPath: MODEL };
    }
    const opts = { baseOptions: { ...base, delegate: 'GPU' }, runningMode: 'VIDEO', numHands: 2, minHandDetectionConfidence: 0.5, minTrackingConfidence: 0.5 };
    try { this.landmarker = await HandLandmarker.createFromOptions(fileset, opts); }
    catch (e) { opts.baseOptions.delegate = 'CPU'; this.landmarker = await HandLandmarker.createFromOptions(fileset, opts); }
  }
  async start(videoEl, canvasEl) {
    this.video = videoEl; this.canvas = canvasEl; this.g = canvasEl.getContext('2d');
    if (!this.stream) {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' }, audio: false });
    }
    videoEl.srcObject = this.stream; videoEl.muted = true; videoEl.playsInline = true; await videoEl.play();
    await this.loadModel();
    this._loop();
  }
  // Watch a recorded video instead of the camera (the video element already has its src and is played by the caller).
  async watchFile(videoEl, canvasEl) {
    this.video = videoEl; this.canvas = canvasEl; this.g = canvasEl.getContext('2d'); this.fromFile = true;
    this.trail = []; this.strumEvents = [];
    await this.loadModel();
    this._loop();
  }
  _loop() {
    cancelAnimationFrame(this._raf);
    this.running = true;
    this.dispatchEvent(new CustomEvent('status', { detail: 'Eyes on. I can see you.' }));
    const loop = () => { if (!this.running) return; this._frame(); this._raf = requestAnimationFrame(loop); };
    loop();
  }
  stop() {
    this.running = false; this.fromFile = false; cancelAnimationFrame(this._raf);
    this.stream?.getTracks().forEach(t => t.stop()); this.stream = null;
    if (this.video && this.video.srcObject) this.video.srcObject = null;
  }
  // Re-attach to a new <video>/<canvas> pair (views change) without reloading the model.
  async moveTo(videoEl, canvasEl) {
    if (!this.running) return this.start(videoEl, canvasEl);
    this.video = videoEl; this.canvas = canvasEl; this.g = canvasEl.getContext('2d');
    videoEl.srcObject = this.stream; videoEl.muted = true; videoEl.playsInline = true; await videoEl.play().catch(() => {});
  }
  _frame() {
    const v = this.video;
    if (!v || v.readyState < 2 || (this.fromFile && v.paused)) return;
    const now = performance.now();
    if (now === this._lastTs) return; this._lastTs = now;
    if (v.videoWidth === 0) return;
    const res = this.landmarker.detectForVideo(v, now);
    const hands = (res.landmarks || []).map((lm, i) => ({ lm, side: res.handedness?.[i]?.[0]?.categoryName }));
    this._assignHands(hands);
    this._postureCheck();
    this._strumTrack(now);
    this._gestures(now, hands);
    this._draw(hands);
    this.dispatchEvent(new CustomEvent('frame', { detail: this }));
  }
  // Guitar neck points toward the player's left (right-handed players) => in a raw (unmirrored) selfie frame that is image-right.
  _assignHands(hands) {
    this.fret = null; this.strum = null;
    if (!hands.length) return;
    const cx = h => h.lm.reduce((s, p) => s + p.x, 0) / h.lm.length;
    const sorted = [...hands].sort((a, b) => cx(a) - cx(b));
    const neckSideIsRight = !this.leftHanded;
    if (hands.length === 2) {
      this.fret = neckSideIsRight ? sorted[1] : sorted[0];
      this.strum = neckSideIsRight ? sorted[0] : sorted[1];
    } else {
      const h = sorted[0]; const x = cx(h);
      if ((x > 0.5) === neckSideIsRight) this.fret = h; else this.strum = h;
    }
  }
  _postureCheck() {
    if (!this.fret) { this.posture = null; return; }
    const lm = this.fret.lm;
    const curls = {};
    for (const [name, [mcp, pip, dip, tip]] of Object.entries(FINGERS)) {
      curls[name] = { pip: angle(lm[mcp], lm[pip], lm[dip]), dip: angle(lm[pip], lm[dip], lm[tip]) };
    }
    const handSize = dist(lm[WRIST], lm[9]) || 0.1;
    const thumbOver = (lm[THUMB_TIP].y < lm[5].y - handSize * 0.15); // thumb peeking over the neck
    const flat = Object.entries(curls).filter(([, c]) => c.dip > 168 && c.pip > 160).map(([n]) => n);
    const arched = Object.values(curls).filter(c => c.pip < 150).length;
    // Wrist angle proxy: angle between wrist->index MCP and index MCP->index PIP
    const wristBend = 180 - angle(lm[WRIST], lm[5], lm[6]);
    // Steadiness: fingertip jitter over the last frames
    this._tipHist = (this._tipHist || []).concat([[lm[8], lm[12], lm[16]]]).slice(-12);
    let jitter = 0;
    if (this._tipHist.length > 4) {
      const first = this._tipHist[0], last = this._tipHist[this._tipHist.length - 1];
      jitter = (dist(first[0], last[0]) + dist(first[1], last[1]) + dist(first[2], last[2])) / 3 / handSize;
    }
    const tips = [];
    if (flat.length >= 2) tips.push({ k: 'flat', msg: `Arch those fingers — ${flat.join(' & ')} look flat. Play on the very tips so you don't mute the string below.` });
    if (wristBend > 70) tips.push({ k: 'wrist', msg: 'Your wrist is bent hard. Drop the elbow a little and bring the neck up so the wrist can stay straighter.' });
    if (jitter > 0.35) tips.push({ k: 'jitter', msg: 'Fingers are moving around. Plant them, then relax — use only as much pressure as stops the buzz.' });
    this.posture = { curls, flat, arched, thumbOver, wristBend, jitter, tips, score: Math.max(0, Math.min(100, Math.round(100 - flat.length * 18 - Math.max(0, wristBend - 55) * 1.2 - jitter * 60))) };
  }
  // Strum hand: track wrist/index MCP vertical motion, detect direction reversals => strokes (down/up) with timestamps.
  _strumTrack(now) {
    if (!this.strum) { this.trail = this.trail.slice(-1); return; }
    const p = this.strum.lm[9];
    const y = p.y, x = p.x;
    this.trail.push({ x, y, t: now }); if (this.trail.length > 40) this.trail.shift();
    if (this.trail.length < 3) return;
    const prev = this.trail[this.trail.length - 2];
    const vy = (y - prev.y) / ((now - prev.t) || 16);
    const dir = Math.abs(vy) < 0.00015 ? 0 : Math.sign(vy); // + = moving down the image = downstroke
    if (!this._extreme) this._extreme = { y, t: now };
    if (dir !== 0 && dir !== this._dirY) {
      const travel = Math.abs(y - this._extreme.y);
      if (this._dirY !== 0 && travel > 0.035) {
        const stroke = { dir: this._dirY > 0 ? 'D' : 'U', t: now, travel };
        this.strumEvents.push(stroke); if (this.strumEvents.length > 64) this.strumEvents.shift();
        this.dispatchEvent(new CustomEvent('stroke', { detail: stroke }));
      }
      this._extreme = { y, t: now }; this._dirY = dir;
    }
  }
  strumRate() { // strokes per minute over last 4s
    const now = performance.now(); const recent = this.strumEvents.filter(s => now - s.t < 4000);
    return recent.length * 15;
  }
  _gestures(now, hands) {
    if (now - this._lastGesture < 1500) return;
    for (const h of hands) {
      const lm = h.lm;
      const curled = ['index', 'middle', 'ring', 'pinky'].every(n => { const [m, , , t] = FINGERS[n]; return dist(lm[t], lm[WRIST]) < dist(lm[m], lm[WRIST]) * 1.15; });
      const thumbUp = lm[THUMB_TIP].y < lm[THUMB_IP].y && lm[THUMB_TIP].y < lm[5].y - 0.06;
      const open = ['index', 'middle', 'ring', 'pinky'].every(n => { const [m, p, , t] = FINGERS[n]; return dist(lm[t], lm[WRIST]) > dist(lm[p], lm[WRIST]) * 1.25 && angle(lm[m], lm[p], lm[t]) > 160; });
      if (curled && thumbUp) { this._fire('thumbsup', now); return; }
      if (open && h === this.strum && lm[0].y > lm[12].y + 0.2) { this._palm = (this._palm || 0) + 1; if (this._palm > 20) { this._palm = 0; this._fire('palm', now); return; } }
      else this._palm = 0;
    }
  }
  _fire(name, now) { this._lastGesture = now; this.dispatchEvent(new CustomEvent('gesture', { detail: name })); }
  _draw(hands) {
    const c = this.canvas, g = this.g, v = this.video;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    g.clearRect(0, 0, c.width, c.height);
    const W = c.width, H = c.height;
    for (const h of hands) {
      const isFret = h === this.fret;
      const color = isFret ? '#ffb020' : '#36d6c3';
      g.lineWidth = 3; g.strokeStyle = color; g.globalAlpha = 0.9;
      for (const [a, b] of CONNECTIONS) { g.beginPath(); g.moveTo(h.lm[a].x * W, h.lm[a].y * H); g.lineTo(h.lm[b].x * W, h.lm[b].y * H); g.stroke(); }
      h.lm.forEach((p, i) => {
        g.beginPath(); g.fillStyle = [4, 8, 12, 16, 20].includes(i) ? '#fff' : color;
        g.arc(p.x * W, p.y * H, [4, 8, 12, 16, 20].includes(i) ? 6 : 3.5, 0, Math.PI * 2); g.fill();
      });
      if (isFret && this.posture) {
        for (const n of this.posture.flat) { const t = h.lm[FINGERS[n][3]]; g.strokeStyle = '#ff4d4d'; g.lineWidth = 3; g.beginPath(); g.arc(t.x * W, t.y * H, 14, 0, Math.PI * 2); g.stroke(); }
      }
    }
    if (this.trail.length > 1) {
      g.lineWidth = 4;
      for (let i = 1; i < this.trail.length; i++) {
        const a = this.trail[i - 1], b = this.trail[i];
        g.strokeStyle = `rgba(54,214,195,${i / this.trail.length})`;
        g.beginPath(); g.moveTo(a.x * W, a.y * H); g.lineTo(b.x * W, b.y * H); g.stroke();
      }
    }
    g.globalAlpha = 1;
  }
  // Where is the user's hand (0..1 screen coords, mirrored) — the avatar's eyes follow this.
  gazeTarget() {
    const h = this.fret || this.strum; if (!h) return null;
    const p = h.lm[9]; return { x: this.mirror ? 1 - p.x : p.x, y: p.y };
  }
}
export const eyes = new Eyes();
