// Music theory core: notes, tuning, chord shapes, chord templates for recognition, tab mapping.
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_ALIASES = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };
export const DISPLAY_FLATS = { 'A#': 'Bb', 'D#': 'Eb', 'G#': 'Ab', 'C#': 'C#', 'F#': 'F#' };

// Standard tuning, low E (string 6) to high e (string 1), as MIDI numbers.
export const STANDARD = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS = ['E', 'A', 'D', 'G', 'B', 'e'];

export const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
export const freqToMidi = f => 69 + 12 * Math.log2(f / 440);
export const midiName = m => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);
export const pcName = pc => NOTE_NAMES[((pc % 12) + 12) % 12];
export function pcOf(name) {
  const n = FLAT_ALIASES[name] || name;
  return NOTE_NAMES.indexOf(n);
}

// Chord qualities: intervals from root. Used for recognition templates and for generating chords not in the shape DB.
export const QUALITIES = {
  '': [0, 4, 7], 'm': [0, 3, 7], '7': [0, 4, 7, 10], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10],
  'sus2': [0, 2, 7], 'sus4': [0, 5, 7], '5': [0, 7], 'add9': [0, 4, 7, 2], 'dim': [0, 3, 6], 'aug': [0, 4, 8],
  '6': [0, 4, 7, 9], 'm6': [0, 3, 7, 9], '9': [0, 4, 7, 10, 2], '7sus4': [0, 5, 7, 10], '6/9': [0, 4, 7, 9, 2], 'm9': [0, 3, 7, 10, 2],
};

// Parse "F#m7", "Bb", "D/F#", "Cadd9" -> { root, quality, bass, pcs }
export function parseChord(sym) {
  if (!sym) return null;
  const m = String(sym).trim().match(/^([A-G])([#b]?)([^/\s]*)(?:\/([A-G][#b]?))?$/);
  if (!m) return null;
  const root = pcOf(m[1] + m[2]);
  let q = m[3] || '';
  const map = { min: 'm', mi: 'm', '-': 'm', M7: 'maj7', Maj7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', sus: 'sus4', min7: 'm7', '-7': 'm7', 'add2': 'add9', '2': 'sus2', '4': 'sus4' };
  if (map[q] !== undefined) q = map[q];
  if (QUALITIES[q] === undefined) {
    // Try to reduce unknown extensions to the nearest known quality.
    if (q.startsWith('m')) q = q.includes('7') ? 'm7' : 'm';
    else if (q.includes('maj')) q = 'maj7';
    else if (q.includes('7')) q = '7';
    else if (q.includes('sus')) q = 'sus4';
    else q = '';
  }
  const bass = m[4] ? pcOf(m[4]) : root;
  return { root, quality: q, bass, pcs: QUALITIES[q].map(i => (root + i) % 12), symbol: sym };
}

// Chord shape DB. frets: low E -> high e, -1 = muted. fingers: 0 open, 1-4 fingers, 'T' thumb. barre: {fret, from, to} (string indexes).
const S = (frets, fingers, extra = {}) => ({ frets, fingers, ...extra });
export const SHAPES = {
  'C': S([-1, 3, 2, 0, 1, 0], [0, 3, 2, 0, 1, 0]),
  'D': S([-1, -1, 0, 2, 3, 2], [0, 0, 0, 1, 3, 2]),
  'E': S([0, 2, 2, 1, 0, 0], [0, 2, 3, 1, 0, 0]),
  'G': S([3, 2, 0, 0, 0, 3], [2, 1, 0, 0, 0, 3], { alt: 'Also played 320033 (fingers 2-1-0-0-3-4) — great for G→C→D songs.' }),
  'A': S([-1, 0, 2, 2, 2, 0], [0, 0, 1, 2, 3, 0]),
  'Am': S([-1, 0, 2, 2, 1, 0], [0, 0, 2, 3, 1, 0]),
  'Em': S([0, 2, 2, 0, 0, 0], [0, 2, 3, 0, 0, 0]),
  'Dm': S([-1, -1, 0, 2, 3, 1], [0, 0, 0, 2, 3, 1]),
  'F': S([1, 3, 3, 2, 1, 1], [1, 3, 4, 2, 1, 1], { barre: { fret: 1, from: 0, to: 5 }, easy: 'Fmaj7' }),
  'Fmaj7': S([-1, -1, 3, 2, 1, 0], [0, 0, 3, 2, 1, 0]),
  'Cadd9': S([-1, 3, 2, 0, 3, 3], [0, 2, 1, 0, 3, 4]),
  'Cmaj7': S([-1, 3, 2, 0, 0, 0], [0, 3, 2, 0, 0, 0]),
  'Em7': S([0, 2, 2, 0, 3, 3], [0, 1, 2, 0, 3, 4]),
  'Dsus4': S([-1, -1, 0, 2, 3, 3], [0, 0, 0, 1, 3, 4]),
  'Dsus2': S([-1, -1, 0, 2, 3, 0], [0, 0, 0, 1, 3, 0]),
  'Asus2': S([-1, 0, 2, 2, 0, 0], [0, 0, 1, 2, 0, 0]),
  'Asus4': S([-1, 0, 2, 2, 3, 0], [0, 0, 1, 2, 3, 0]),
  'A7sus4': S([-1, 0, 2, 0, 3, 3], [0, 0, 1, 0, 3, 4]),
  'D/F#': S([2, -1, 0, 2, 3, 2], ['T', 0, 0, 1, 3, 2]),
  'G/B': S([-1, 2, 0, 0, 0, 3], [0, 1, 0, 0, 0, 3]),
  'D6/9/F#': S([2, 0, 0, 2, 0, 0], [1, 0, 0, 2, 0, 0]),
  'Am7': S([-1, 0, 2, 0, 1, 0], [0, 0, 2, 0, 1, 0]),
  'Dmaj7': S([-1, -1, 0, 2, 2, 2], [0, 0, 0, 1, 1, 1]),
  'A7': S([-1, 0, 2, 0, 2, 0], [0, 0, 2, 0, 3, 0]),
  'B7': S([-1, 2, 1, 2, 0, 2], [0, 2, 1, 3, 0, 4]),
  'C7': S([-1, 3, 2, 3, 1, 0], [0, 3, 2, 4, 1, 0]),
  'D7': S([-1, -1, 0, 2, 1, 2], [0, 0, 0, 2, 1, 3]),
  'E7': S([0, 2, 0, 1, 0, 0], [0, 2, 0, 1, 0, 0]),
  'G7': S([3, 2, 0, 0, 0, 1], [3, 2, 0, 0, 0, 1]),
  'Bm': S([-1, 2, 4, 4, 3, 2], [0, 1, 3, 4, 2, 1], { barre: { fret: 2, from: 1, to: 5 } }),
  'F#m': S([2, 4, 4, 2, 2, 2], [1, 3, 4, 1, 1, 1], { barre: { fret: 2, from: 0, to: 5 } }),
  'Bb': S([-1, 1, 3, 3, 3, 1], [0, 1, 2, 3, 4, 1], { barre: { fret: 1, from: 1, to: 5 } }),
  'Cm': S([-1, 3, 5, 5, 4, 3], [0, 1, 3, 4, 2, 1], { barre: { fret: 3, from: 1, to: 5 } }),
  'Gm': S([3, 5, 5, 3, 3, 3], [1, 3, 4, 1, 1, 1], { barre: { fret: 3, from: 0, to: 5 } }),
  'B': S([-1, 2, 4, 4, 4, 2], [0, 1, 2, 3, 4, 1], { barre: { fret: 2, from: 1, to: 5 } }),
  'E5': S([0, 2, 2, -1, -1, -1], [0, 1, 2, 0, 0, 0]),
  'A5': S([-1, 0, 2, 2, -1, -1], [0, 0, 1, 2, 0, 0]),
  'D5': S([-1, -1, 0, 2, 3, -1], [0, 0, 0, 1, 3, 0]),
  'F5': S([1, 3, 3, -1, -1, -1], [1, 3, 4, 0, 0, 0]),
  'F#5': S([2, 4, 4, -1, -1, -1], [1, 3, 4, 0, 0, 0]),
  'G5': S([3, 5, 5, -1, -1, -1], [1, 3, 4, 0, 0, 0]),
  'Ab5': S([4, 6, 6, -1, -1, -1], [1, 3, 4, 0, 0, 0]),
  'Bb5': S([-1, 1, 3, 3, -1, -1], [0, 1, 3, 4, 0, 0]),
  'B5': S([-1, 2, 4, 4, -1, -1], [0, 1, 3, 4, 0, 0]),
  'C5': S([-1, 3, 5, 5, -1, -1], [0, 1, 3, 4, 0, 0]),
  'C#5': S([-1, 4, 6, 6, -1, -1], [0, 1, 3, 4, 0, 0]),
  'Db5': S([-1, 4, 6, 6, -1, -1], [0, 1, 3, 4, 0, 0]),
  'Eb5': S([-1, 6, 8, 8, -1, -1], [0, 1, 3, 4, 0, 0]),
};

// Movable barre shapes so any chord name gets a playable diagram.
const E_SHAPES = { '': [0, 2, 2, 1, 0, 0], 'm': [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0], 'm7': [0, 2, 0, 0, 0, 0], '5': [0, 2, 2, -1, -1, -1], 'sus4': [0, 2, 2, 2, 0, 0], 'maj7': [0, -1, 1, 1, 0, -1] };
const A_SHAPES = { '': [-1, 0, 2, 2, 2, 0], 'm': [-1, 0, 2, 2, 1, 0], '7': [-1, 0, 2, 0, 2, 0], 'm7': [-1, 0, 2, 0, 1, 0], '5': [-1, 0, 2, 2, -1, -1], 'sus2': [-1, 0, 2, 2, 0, 0], 'sus4': [-1, 0, 2, 2, 3, 0], 'maj7': [-1, 0, 2, 1, 2, 0], 'add9': [-1, 0, 2, 4, 2, 0] };

export function getShape(sym) {
  if (SHAPES[sym]) return { name: sym, ...SHAPES[sym] };
  const c = parseChord(sym);
  if (!c) return null;
  const flatName = sym.replace(/^([A-G])#/, (_, l) => ({ C: 'Db', D: 'Eb', F: 'Gb', G: 'Ab', A: 'Bb' })[l] || l + '#');
  if (SHAPES[flatName]) return { name: sym, ...SHAPES[flatName] };
  // Choose the barre position (E-shape or A-shape) with the lowest fret.
  const cands = [];
  if (E_SHAPES[c.quality]) { const f = (c.root - 4 + 12) % 12; cands.push({ base: f === 0 ? 12 : f, shape: E_SHAPES[c.quality], low: 0 }); }
  if (A_SHAPES[c.quality]) { const f = (c.root - 9 + 12) % 12; cands.push({ base: f === 0 ? 12 : f, shape: A_SHAPES[c.quality], low: 1 }); }
  if (!cands.length) { const f = (c.root - 4 + 12) % 12 || 12; cands.push({ base: f, shape: E_SHAPES[c.quality.startsWith('m') ? 'm' : ''], low: 0 }); }
  cands.sort((a, b) => a.base - b.base);
  const { base, shape, low } = cands[0];
  const frets = shape.map(v => v < 0 ? -1 : v + base);
  const fingers = shape.map(v => v < 0 ? 0 : v === 0 ? 1 : v + 1);
  return { name: sym, frets, fingers: fingers.map(x => Math.min(4, x)), barre: { fret: base, from: low, to: 5 }, generated: true };
}

// Pitch classes actually sounded by a shape (used to sanity-check templates).
export function shapeNotes(shape, tuning = STANDARD) {
  return shape.frets.map((f, i) => f < 0 ? null : tuning[i] + f).filter(x => x !== null);
}

// --- Chord recognition templates (chroma) ---
// Harmonic-aware template: each chord tone contributes its first 6 harmonics folded to pitch classes.
const HARM = [[0, 1], [0, 0.6], [7, 0.36], [0, 0.22], [4, 0.13], [7, 0.08]];
function template(pcs, bassPc) {
  const t = new Float32Array(12);
  pcs.forEach(pc => HARM.forEach(([off, w]) => { t[(pc + off) % 12] += w; }));
  if (bassPc !== undefined) t[bassPc] += 0.35;
  return normalize(t);
}
export function normalize(v) {
  let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1;
  return v.map(x => x / s);
}
export const cosine = (a, b) => { let s = 0; for (let i = 0; i < 12; i++) s += a[i] * b[i]; return s; };

let ALL_TEMPLATES = null;
export function allTemplates() {
  if (ALL_TEMPLATES) return ALL_TEMPLATES;
  ALL_TEMPLATES = [];
  for (let r = 0; r < 12; r++) for (const q of ['', 'm', '7', 'm7', 'maj7', 'sus2', 'sus4', '5']) {
    const pcs = QUALITIES[q].map(i => (r + i) % 12);
    ALL_TEMPLATES.push({ name: pcName(r) + q, root: r, quality: q, t: template(pcs, r) });
  }
  return ALL_TEMPLATES;
}
export function chordTemplate(sym) { const c = parseChord(sym); return c ? template(c.pcs, c.bass) : null; }

// Recognize a chord from a 12-bin chroma vector. Simpler qualities get a tiny prior so noise doesn't produce exotic labels.
const PRIOR = { '': 0.02, 'm': 0.02, '5': 0, '7': 0, 'm7': 0, 'maj7': -0.01, 'sus2': -0.02, 'sus4': -0.02 };
export function recognize(chroma, candidates = null) {
  const c = normalize(chroma);
  const list = candidates ? candidates.map(s => ({ name: s, t: chordTemplate(s) })).filter(x => x.t) : allTemplates();
  let best = null, second = null;
  for (const x of list) {
    const q = parseChord(x.name)?.quality ?? '';
    const score = cosine(c, x.t) + (candidates ? 0 : (PRIOR[q] || 0));
    if (!best || score > best.score) { second = best; best = { name: x.name, score }; }
    else if (!second || score > second.score) second = { name: x.name, score };
  }
  return best ? { ...best, margin: best.score - (second?.score ?? 0) } : null;
}

// Prettify enharmonics for display (A# -> Bb etc.)
export function prettyChord(name) { return name.replace(/^([A-G]#)/, m => DISPLAY_FLATS[m] || m); }

// --- Tab mapping: assign MIDI notes to (string, fret) minimizing hand movement (dynamic programming). ---
export function notesToTab(midis, { maxFret = 15, tuning = STANDARD } = {}) {
  const options = midis.map(m => {
    const o = [];
    tuning.forEach((open, s) => { const f = Math.round(m) - open; if (f >= 0 && f <= maxFret) o.push({ s, f }); });
    return o.length ? o : [{ s: 0, f: Math.max(0, Math.round(m) - tuning[0]), out: true }];
  });
  const cost = (a, b) => {
    const pa = a.f || b.f, pb = b.f || a.f; // open strings are free to move from/to
    return Math.abs(pa - pb) * 1.0 + Math.abs(a.s - b.s) * 0.3 + (b.f > 7 ? 0.4 : 0);
  };
  const dp = options.map(o => o.map(() => ({ c: Infinity, p: -1 })));
  options[0]?.forEach((o, j) => { dp[0][j] = { c: o.f * 0.1, p: -1 }; });
  for (let i = 1; i < options.length; i++) options[i].forEach((o, j) => {
    options[i - 1].forEach((po, k) => { const c = dp[i - 1][k].c + cost(po, o); if (c < dp[i][j].c) dp[i][j] = { c, p: k }; });
  });
  if (!options.length) return [];
  let j = 0, best = Infinity; dp[dp.length - 1].forEach((x, k) => { if (x.c < best) { best = x.c; j = k; } });
  const out = [];
  for (let i = options.length - 1; i >= 0; i--) { out.unshift(options[i][j]); j = dp[i][j].p; }
  return out;
}

export function renderAsciiTab(positions, perLine = 16) {
  const lines = [];
  for (let i = 0; i < positions.length; i += perLine) {
    const chunk = positions.slice(i, i + perLine);
    const rows = [5, 4, 3, 2, 1, 0].map(s => STRING_LABELS[s] + '|' + chunk.map(p => {
      const t = p && p.s === s ? String(p.f) : '-';
      return t.padEnd(2, '-') + '-';
    }).join('') + '|');
    lines.push(rows.join('\n'));
  }
  return lines.join('\n\n');
}

// Strum patterns (per bar, 8 slots = eighth notes). D = down, U = up, '-' = miss (hand keeps moving).
export const STRUMS = {
  quarters: { name: 'Four Downs', slots: 'D-D-D-D-', level: 1, tip: 'Steady downstrokes on every beat. Count out loud: 1, 2, 3, 4.' },
  eighths: { name: 'Down-Up Eighths', slots: 'DUDUDUDU', level: 2, tip: 'Your hand never stops: down on the numbers, up on the "and".' },
  oldFaithful: { name: 'Old Faithful (D DU UDU)', slots: 'D-DU-UDU', level: 3, tip: 'The most useful strum in pop. Hand keeps moving down-up; you just miss the strings on 3 and on the "and" of 1.' },
  island: { name: 'Island (D-DU-UD-)', slots: 'D-DU-UD-', level: 3, tip: 'Laid-back reggae-pop feel. Same motion as Old Faithful, one fewer up.' },
  rock: { name: 'Rock Eighths (palm-muted)', slots: 'DDDDDDDD', level: 2, tip: 'All downstrokes, palm resting on the strings by the bridge. This is the Eye of the Tiger engine.' },
  waltz: { name: 'Waltz 3/4 (D DU DU)', slots: 'D-DUDU', level: 3, tip: 'Three beats per bar: bass/down, then down-up, down-up. Hallelujah and House of the Rising Sun feel.' },
  pickArp: { name: 'Arpeggio (bass-3-2-1)', slots: 'B321B321', level: 4, tip: 'Pick the bass note, then strings 3, 2, 1 one at a time. Let everything ring.' },
};
