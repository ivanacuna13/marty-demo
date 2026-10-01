// Tools: tuner, chord dictionary, camera coach.
import * as store from './store.js';
import { ears } from './audio.js';
import { eyes } from './vision.js';
import { coach, describeShape } from './coach.js';
import { strum, arpeggio, playNote } from './synth.js';
import { h, chordEl, meter, toast } from './ui.js';
import { STANDARD, STRING_LABELS, SHAPES, midiName, prettyChord, getShape } from './theory.js';

// ---------- TUNER ----------
export function tunerWidget({ onAllTuned } = {}) {
  const tuned = new Set();
  const needle = h('div', { class: 'needle' });
  const noteEl = h('div', { class: 'tuner-note' }, '—');
  const centsEl = h('div', { class: 'tuner-cents' }, 'Pluck a string');
  const strings = STANDARD.map((m, i) => h('button', { class: 'string-btn', onclick: () => playNote(m, { vel: 0.9 }) }, h('b', {}, STRING_LABELS[i]), h('small', {}, midiName(m))));
  const el = h('div', { class: 'tuner card center' },
    h('div', { class: 'gauge' }, h('div', { class: 'scale' }, ...[-50, -25, 0, 25, 50].map(c => h('span', { style: { left: (c + 50) + '%' } }, c ? (c > 0 ? '+' + c : c) : '0'))), needle, h('div', { class: 'zone' })),
    noteEl, centsEl, h('div', { class: 'strings' }, strings),
    h('p', { class: 'tip small' }, 'Tap a string name to hear its reference pitch. Tune UP to the note: if you are sharp, drop below and come back up so the string holds.'));
  let inTuneSince = 0, lastString = -1;
  const onFrame = () => {
    const p = ears.pitch;
    if (!p) { needle.style.opacity = 0.3; return; }
    // nearest open string (allow some slop for badly out-of-tune strings)
    let si = 0, bd = 99;
    STANDARD.forEach((m, i) => { const d = Math.abs(p.midi - m); if (d < bd) { bd = d; si = i; } });
    if (bd > 3) { noteEl.textContent = midiName(p.note); centsEl.textContent = 'Not an open string. Pluck one open string at a time.'; return; }
    const cents = (p.midi - STANDARD[si]) * 100;
    const c = Math.max(-50, Math.min(50, cents));
    needle.style.opacity = 1; needle.style.left = (c + 50) + '%';
    noteEl.textContent = STRING_LABELS[si] + ' string';
    const ok = Math.abs(cents) < 5;
    el.classList.toggle('in-tune', ok);
    centsEl.textContent = ok ? '✓ In tune' : cents < 0 ? `${Math.round(-cents)}¢ flat: tighten ↑` : `${Math.round(cents)}¢ sharp: loosen ↓`;
    strings.forEach((b, i) => b.classList.toggle('active', i === si));
    if (si !== lastString) { inTuneSince = 0; lastString = si; }
    if (ok) {
      inTuneSince ||= performance.now();
      if (performance.now() - inTuneSince > 700 && !tuned.has(si)) {
        tuned.add(si); strings[si].classList.add('done');
        if (tuned.size === 6) { coach.say('All six in tune.'); onAllTuned?.(); }
        else coach.say(`${STRING_LABELS[si] === 'e' ? 'High E' : STRING_LABELS[si]} string, good.`);
      }
    } else inTuneSince = 0;
  };
  ears.addEventListener('frame', onFrame);
  return { el, destroy: () => ears.removeEventListener('frame', onFrame) };
}

export async function tunerView(root, _, app) {
  root.append(h('header', { class: 'page-head' }, h('h1', {}, 'Tuner'), h('p', {}, 'Standard tuning E A D G B E. Axel listens and tells you which way to turn.')));
  const w = tunerWidget({ onAllTuned: () => toast('All strings in tune 🎸', 'good') });
  root.append(w.el);
  await app.micOn();
  return w.destroy;
}

// ---------- CHORD DICTIONARY ----------
const GROUPS = [
  ['The 80/20 Five', ['G', 'C', 'D', 'Em', 'Am']],
  ['Next up', ['E', 'A', 'Dm', 'Fmaj7', 'F', 'Bm']],
  ['Pro shortcuts', ['Cadd9', 'Em7', 'Dsus4', 'A7sus4', 'D/F#', 'G/B', 'D6/9/F#', 'Cmaj7', 'Asus2', 'Asus4', 'Dsus2', 'Am7', 'Dmaj7']],
  ['Sevenths (blues & country)', ['E7', 'A7', 'D7', 'G7', 'C7', 'B7']],
  ['Barre chords', ['F', 'Bm', 'F#m', 'Bb', 'B', 'Cm', 'Gm']],
  ['Power chords (rock)', ['E5', 'A5', 'D5', 'G5', 'C5', 'F5', 'Bb5', 'B5', 'Ab5']],
];
export async function chordsView(root, [sel], app) {
  const known = new Set(Object.entries(store.get().skills).filter(([k, v]) => k.startsWith('chord:') && v.level >= 2).map(([k]) => k.slice(6)));
  const search = h('input', { type: 'search', placeholder: 'Any chord: F#m7, Bbmaj7, Gsus4…', 'aria-label': 'Find chord' });
  const out = h('div', { class: 'chord-detail' });
  const show = sym => {
    const sh = getShape(sym); out.innerHTML = '';
    if (!sh) { out.append(h('p', {}, `Can't build "${sym}". Try another spelling.`)); return; }
    out.append(h('div', { class: 'card chord-focus' }, chordEl(sym, { size: 200 }), h('div', {},
      h('h2', {}, prettyChord(sym), sh.generated ? h('small', { class: 'tag' }, 'movable barre shape') : null),
      h('p', {}, describeShape(sym, sh)), sh.alt ? h('p', { class: 'tip small' }, sh.alt) : null, sh.easy ? h('p', { class: 'tip small' }, `Easier version: ${sh.easy}`) : null,
      h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => strum(sh) }, '▶ Strum'), h('button', { class: 'btn ghost', onclick: () => arpeggio(sym) }, '▶ Arpeggio'), h('button', { class: 'btn ghost', onclick: () => app.go('#/lesson/' + encodeURIComponent('chord:' + sym)) }, '🎯 Practice with mic')))));
    out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  search.addEventListener('keydown', e => { if (e.key === 'Enter' && search.value.trim()) show(search.value.trim()); });
  root.append(h('header', { class: 'page-head' }, h('h1', {}, 'Chord Finder'), h('p', {}, 'Every shape, with fingers, sound and a mic-checked practice mode. Gold = chords you own.')), h('div', { class: 'row' }, search, h('button', { class: 'btn', onclick: () => search.value && show(search.value.trim()) }, 'Show')), out);
  for (const [name, list] of GROUPS) {
    root.append(h('h2', { class: 'group-title' }, name), h('div', { class: 'chord-grid' }, ...list.map(sym => h('button', { class: 'chord-tile' + (known.has(sym) ? ' known' : ''), onclick: () => { show(sym); strum(sym); } }, chordEl(sym, { size: 96 })))));
  }
  if (sel) show(sel);
}

// ---------- CAMERA COACH ----------
export async function cameraView(root, _, app) {
  const v = h('video', { playsinline: true, muted: true }), c = h('canvas');
  const status = h('p', { class: 'status' }, 'Starting camera…');
  const post = meter('Fretting hand'); const tips = h('ul', { class: 'tips' });
  const rate = h('div', { class: 'counter' }, '0'); const strokes = h('div', { class: 'strokes' });
  const audioHits = h('div', { class: 'counter dim' }, '0');
  const lefty = h('input', { type: 'checkbox', checked: store.get().profile.leftHanded || undefined });
  lefty.onchange = () => { store.set('profile.leftHanded', lefty.checked); eyes.leftHanded = lefty.checked; };
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Camera Coach'), h('p', {}, 'Axel watches both hands: finger arch and wrist on the fretting hand, stroke direction and rhythm on the strumming hand. Gold skeleton = fretting hand; teal = strumming.')),
    h('div', { class: 'cam-layout' },
      h('div', { class: 'cam-stage big' }, v, c, h('div', { class: 'cam-legend' }, '👍 thumbs-up = next · ✋ open palm (hold) = stop')),
      h('div', { class: 'cam-side' },
        h('div', { class: 'card' }, h('h3', {}, 'Fretting hand'), post.el, tips),
        h('div', { class: 'card' }, h('h3', {}, 'Strumming hand'), h('div', { class: 'row stats' }, h('div', {}, rate, h('small', {}, 'strokes / min (eyes)')), h('div', {}, audioHits, h('small', {}, 'strums heard (ears)'))), strokes),
        h('div', { class: 'card' }, h('label', { class: 'switch' }, lefty, ' I play left-handed'), status))));
  await app.micOn();
  if (!(await app.camOn(v, c))) { status.textContent = 'Camera not available.'; return; }
  status.textContent = 'Sit so both hands are in frame, guitar neck across the picture.';
  let heard = 0, lastSpoken = 0;
  const onOnset = () => { heard++; audioHits.textContent = heard; };
  const onStroke = e => { strokes.prepend(h('span', { class: e.detail.dir }, e.detail.dir === 'D' ? '↓' : '↑')); while (strokes.children.length > 16) strokes.lastChild.remove(); };
  const onFrame = () => {
    const p = eyes.posture;
    rate.textContent = eyes.strumRate();
    if (!p) { post.set(0, eyes.fret ? '…' : 'not visible'); tips.innerHTML = ''; return; }
    post.set(p.score / 100, p.score);
    tips.innerHTML = '';
    (p.tips.length ? p.tips : [{ msg: `Fingers arched: ${p.arched}/4 · wrist bend ${Math.round(p.wristBend)}°. Looking good.` }]).forEach(t => tips.append(h('li', {}, t.msg)));
    if (p.tips.length && performance.now() - lastSpoken > 9000 && store.get().settings.talkative >= 2) { lastSpoken = performance.now(); coach.say(p.tips[0].msg); }
  };
  ears.addEventListener('onset', onOnset); eyes.addEventListener('stroke', onStroke); eyes.addEventListener('frame', onFrame);
  return () => { ears.removeEventListener('onset', onOnset); eyes.removeEventListener('stroke', onStroke); eyes.removeEventListener('frame', onFrame); if (eyes.running) app.camOn(); };
}
