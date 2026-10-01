// Lesson runner: every drill type, with live audio/vision grading and adaptive difficulty (aim for ~85% success).
import * as store from './store.js';
import { ears } from './audio.js';
import { eyes } from './vision.js';
import { coach } from './coach.js';
import { metronome, strum, playNote, arpeggio } from './synth.js';
import { h, toast, chordEl, tabEl, meter, fmtTime } from './ui.js';
import { getShape, recognize, parseChord, STRUMS, STANDARD, notesToTab, prettyChord, pcName, midiName } from './theory.js';
import { lessonById, STAGES, ALL_LESSONS, FIXES } from './lessons.js';
import { allSongs } from './songs.js';
import { describeShape, photoCheck } from './coach.js';
import { IS_ARTIFACT } from './platform.js';
import { tunerWidget } from './v_tools.js';

const COMMON = ['G', 'C', 'D', 'Em', 'Am', 'E', 'A', 'Dm', 'F', 'Bm', 'E7', 'A7', 'D7', 'B7', 'G7', 'Cadd9'];

// When Axel can't hear you (inside Claude, or the mic is blocked): honest self-rating keeps spaced repetition working.
function selfCheck(ctx, what = 'it') {
  const box = h('div', { class: 'card self-check' },
    h('h3', {}, 'How did it go?'),
    h('p', { class: 'muted small' }, `I can't hear you live here, so rate ${what} honestly. Or tap 🎧 Listen up top and play me a recording, and I'll grade it by ear.`),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: () => ctx.complete(0.92, 'Logged as nailed. I will bring it back in a few days to make sure it sticks.') }, '✓ Nailed it'),
      h('button', { class: 'btn ghost', onclick: () => ctx.complete(0.7, 'Getting there. Same drill tomorrow, a little cleaner.') }, 'Getting there'),
      h('button', { class: 'btn ghost', onclick: () => ctx.complete(0.4, 'No stress. Slow it right down and we will hit it again later today.') }, 'Not yet')));
  ctx.body.append(box);
  return box;
}
// Photo check: Claude looks at a picture of your fretting hand.
function photoBox(sym, shapeText, label = '📸 Photo check my hand') {
  const out = h('p', { class: 'tip', hidden: true });
  const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
  const btn = h('button', { class: 'btn ghost', onclick: () => inp.click() }, label);
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    out.hidden = false; out.textContent = 'Looking at your hand…'; btn.disabled = true;
    try { const t = await photoCheck(f, sym, shapeText); out.textContent = '👀 ' + t; coach.say(t); }
    catch (e) { out.textContent = e?.code === 'not_granted' ? 'Claude is not allowed on this page, so photo check is off.' : (e?.message || 'Photo check failed. Try another photo.'); }
    finally { btn.disabled = false; inp.value = ''; }
  };
  return h('div', { class: 'photo-check' }, h('p', { class: 'muted small' }, 'Take a photo from the front, close enough to see the strings, frets and every fingertip.'), btn, inp, out);
}

function synthLesson(id) {
  const [type, rest = ''] = id.split(':');
  if (type === 'chord') return { id, type, chord: rest, title: `Chord: ${rest}`, mins: 2 };
  if (type === 'change') { const [a, b] = rest.split('-'); return { id, type, a, b, title: `One-Minute Changes: ${a} ↔ ${b}`, mins: 2, target: 30 }; }
  if (type === 'strum') return { id, type, pattern: rest, chord: 'G', title: STRUMS[rest]?.name || 'Strumming', mins: 2, bpm: 70 };
  if (type === 'riff') return { id, type, song: rest, title: 'Riff', mins: 3 };
  if (type === 'song') return { id, type, song: rest };
  return null;
}

export async function lessonView(root, [id], app) {
  const l = lessonById(id) || synthLesson(id);
  if (!l) { root.append(h('div', { class: 'card' }, 'Unknown lesson.')); return; }
  if (l.type === 'song') { app.go('#/song/' + encodeURIComponent(l.song) + '/lesson'); return; }
  if (l.type === 'link') { app.go(l.href); return; }
  const stage = STAGES[l.stage];
  const inPlan = app.planIdx >= 0 && app.plan[app.planIdx]?.id === l.id;
  const head = h('header', { class: 'lesson-head' },
    h('div', { class: 'crumbs' }, inPlan ? `Today's session · ${app.planIdx + 1} of ${app.plan.length}` : stage ? stage.title : 'Practice'),
    h('h1', {}, l.title),
    l.coach ? h('p', { class: 'coach-line' }, '🥊 ' + l.coach) : null);
  const body = h('section', { class: 'lesson-body' });
  const result = h('div', { class: 'result', hidden: true });
  root.append(head, body, result);

  const nextLesson = () => {
    if (app.nextInPlan()) return;
    const idx = ALL_LESSONS.findIndex(x => x.id === l.id);
    const n = ALL_LESSONS[idx + 1];
    if (n) app.go('#/lesson/' + encodeURIComponent(n.id)); else app.go('#/path');
  };
  let stopped = false;
  const ctx = {
    l, body, app,
    complete(score, summary, detail = {}) {
      if (stopped) return; stopped = true;
      const s = store.record(l.id, score, detail);
      if (l.type === 'chord' && score >= 0.6) store.record('chord:' + l.chord, Math.max(score, 0.85));
      const pct = Math.round(score * 100);
      result.hidden = false; result.innerHTML = '';
      result.append(h('div', { class: 'result-card ' + (score >= 0.85 ? 'good' : score >= 0.6 ? 'mid' : 'bad') },
        h('div', { class: 'big' }, pct + '%'), h('p', {}, summary),
        h('small', {}, `Mastery ${'●'.repeat(s.level)}${'○'.repeat(5 - s.level)} · next review ${s.interval ? 'in ' + s.interval + ' day' + (s.interval > 1 ? 's' : '') : 'later today'}`),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => app.go(location.hash) }, '↻ Again'), h('button', { class: 'btn', onclick: nextLesson }, 'Next →'))));
      if (score >= 0.85) app.avatar?.mood('happy');
      coach.say(summary);
      result.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },
    next: nextLesson,
  };
  app.ctl = { next: () => (stopped ? nextLesson() : ctx.skip?.()), describe: () => ({ lesson: l.id, title: l.title, type: l.type, ...(ctx.state?.() || {}) }) };
  const runners = { tune: runTune, posture: runPosture, chord: runChord, change: runChange, strum: runStrum, riff: runRiff, ear: runEar };
  const cleanup = await runners[l.type]?.(ctx);
  ctx.skip = () => ctx.complete(0.5, 'Skipped. We will come back to this one.');
  return () => { stopped = true; cleanup?.(); };
}

// ---------- TUNE ----------
async function runTune(ctx) {
  const mic = await ctx.app.micOn();
  const w = tunerWidget({ onAllTuned: () => ctx.complete(1, 'All six strings in tune. Now we play.') });
  if (!mic) ctx.body.append(h('p', { class: 'tip' }, 'Tune by ear: tap a string below to hear its note, pluck yours, and turn the peg until the wobble between the two sounds slows down and disappears. Or use any phone tuner app, then come back.'));
  ctx.body.append(w.el, h('button', { class: 'btn ghost', onclick: () => ctx.complete(0.9, 'Tuned up. Let\'s go.') }, 'My guitar is already in tune →'));
  return w.destroy;
}

// ---------- POSTURE ----------
async function runPosture(ctx) {
  const v = h('video', { playsinline: true, muted: true }), c = h('canvas');
  const checks = {
    seen: h('li', {}, 'Fretting hand in view'), arch: h('li', {}, 'Fingers arched (play on the tips)'), wrist: h('li', {}, 'Wrist fairly straight'), steady: h('li', {}, 'Hold it steady for 3 seconds'),
  };
  const score = meter('Posture');
  const tip = h('p', { class: 'tip' }, 'Sit tall, guitar body on your right leg (left if you play lefty), neck pointing slightly up. Show me your fretting hand, holding a chord or a C shape.');
  ctx.body.append(h('div', { class: 'cam-stage' }, v, c), h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('h3', {}, 'Checklist'), h('ul', { class: 'checks' }, Object.values(checks)), score.el), h('div', { class: 'card' }, h('h3', {}, 'Axel says'), tip)));
  if (!(await ctx.app.camOn(v, c))) {
    v.closest('.cam-stage').remove();
    ctx.body.append(h('div', { class: 'card' }, h('h3', {}, 'Posture check by photo'), photoBox('any chord you know (this is a posture check: judge finger arch, thumb behind the neck, wrist angle)', 'Fingertips arched and landing just behind the frets, thumb roughly behind the middle of the neck, wrist fairly straight, guitar neck angled slightly up.', '📸 Check my posture from a photo')));
    selfCheck(ctx, 'your posture against the checklist');
    return;
  }
  let goodSince = 0, lastTip = 0;
  const onFrame = () => {
    const p = eyes.posture;
    checks.seen.classList.toggle('ok', !!eyes.fret);
    if (!p) { score.set(0, '—'); goodSince = 0; return; }
    checks.arch.classList.toggle('ok', p.flat.length === 0 && p.arched >= 2);
    checks.wrist.classList.toggle('ok', p.wristBend <= 65);
    score.set(p.score / 100, p.score);
    if (p.tips.length && performance.now() - lastTip > 7000) { lastTip = performance.now(); tip.textContent = p.tips[0].msg; coach.say(p.tips[0].msg); }
    if (p.score >= 75 && p.flat.length === 0) { goodSince ||= performance.now(); const held = (performance.now() - goodSince) / 1000; checks.steady.classList.toggle('ok', held >= 3); if (held >= 3) ctx.complete(p.score / 100, `Posture score ${p.score}. Fingers arched, wrist relaxed. That is the foundation of clean chords.`); }
    else goodSince = 0;
  };
  eyes.addEventListener('frame', onFrame);
  return () => eyes.removeEventListener('frame', onFrame);
}

// ---------- CHORD ----------
// Which string(s) produce each pitch class in this shape — used to say "I can't hear your B string".
function stringsForPc(sh, pc) { return sh.frets.map((f, i) => f >= 0 && (STANDARD[i] + f) % 12 === pc ? i : -1).filter(i => i >= 0); }
const SN = ['low E', 'A', 'D', 'G', 'B', 'high E'];

async function runChord(ctx) {
  const sym = ctx.l.chord, sh = getShape(sym);
  const diag = chordEl(sym, { size: 210 });
  const match = meter('Match'); const reps = h('div', { class: 'reps' }, ...[0, 1, 2].map(() => h('i')));
  const status = h('p', { class: 'status' }, 'Strum the chord and let it ring.');
  const hint = h('p', { class: 'tip' }, describeShape(sym, sh));
  const posture = h('p', { class: 'tip small' });
  ctx.body.append(h('div', { class: 'grid2' },
    h('div', { class: 'card center' }, diag, h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => strum(sh) }, '▶ Hear it'), h('button', { class: 'btn ghost', onclick: () => arpeggio(sym) }, '▶ String by string'))),
    h('div', { class: 'card' }, h('h3', {}, 'Make it ring 3 times'), reps, match.el, status, hint, posture)));
  if (!(await ctx.app.micOn())) {
    status.textContent = 'Strum it, then pick each string one at a time. Every string should ring clearly, with no buzz and no dead notes.';
    ctx.body.append(h('div', { class: 'card' }, photoBox(sym, describeShape(sym, sh))));
    selfCheck(ctx, `your ${prettyChord(sym)}`);
    return;
  }
  let rep = 0, okSince = 0, needRelease = false, quietSince = 0, soundSince = 0, lastHint = 0, t0 = performance.now(), attempts = 0;
  const others = COMMON.filter(c => c !== sym).slice(0, 10);
  const onFrame = () => {
    const now = performance.now();
    const loud = ears.db > ears.gateDb + 4;
    if (!loud) { quietSince ||= now; soundSince = 0; } else { quietSince = 0; soundSince ||= now; }
    if (needRelease) { status.textContent = 'Nice! Lift your fingers off, put them back, and strum again.'; if (quietSince && now - quietSince > 250 || (!ears.matchChord(sym, others).ok && loud)) needRelease = false; match.set(0, '…'); return; }
    const m = ears.matchChord(sym, others);
    match.set(loud ? Math.max(0, (m.score - 0.5) / 0.45) : 0, loud ? (m.heard ? prettyChord(m.heard) : '…') : '—');
    if (m.ok) {
      okSince ||= now;
      if (now - okSince > 600) {
        rep++; okSince = 0; needRelease = true; reps.children[rep - 1].classList.add('on'); app_happy(ctx);
        if (rep >= 3) { const secs = (now - t0) / 1000; const score = Math.max(0.7, Math.min(1, 1 - Math.max(0, secs - 25) / 120 - attempts * 0.02)); ctx.complete(score, `${prettyChord(sym)} rang clean three times in ${Math.round(secs)} seconds. Locked in.`); }
      }
    } else {
      okSince = 0;
      // Diagnose: chord tones that are missing from the spectrum -> which string to check.
      if (loud && soundSince && now - soundSince > 1500 && now - lastHint > 6500) {
        attempts++;
        const c = parseChord(sym); const missing = [];
        c.pcs.forEach(pc => { if (ears.chroma[pc] < 0.14) stringsForPc(sh, pc).forEach(s => missing.push(s)); });
        let msg;
        if (missing.length) msg = `I'm not hearing your ${[...new Set(missing)].map(s => SN[s]).join(' and ')} string. Arch the finger next to it so it can ring.`;
        else if (m.heard && m.heard !== sym) msg = `That sounds like ${prettyChord(m.heard)}. Check the diagram finger by finger.`;
        else msg = FIXES.buzz[attempts % FIXES.buzz.length];
        status.textContent = msg; lastHint = now;
        if (store.get().settings.talkative >= 2) coach.say(msg);
      } else if (!loud) status.textContent = 'Strum the chord and let it ring.';
    }
  };
  const onEyes = () => { const p = eyes.posture; posture.textContent = p ? (p.tips[0]?.msg || `👀 Hand looks good (posture ${p.score}).`) : ''; };
  ears.addEventListener('frame', onFrame); eyes.addEventListener('frame', onEyes);
  ctx.state = () => ({ chord: sym, repsDone: rep, heard: ears.chord?.name });
  return () => { ears.removeEventListener('frame', onFrame); eyes.removeEventListener('frame', onEyes); };
}
const app_happy = ctx => ctx.app.avatar?.mood('happy');

// ---------- ONE-MINUTE CHANGES ----------
async function runChange(ctx) {
  const { a, b } = ctx.l; const target = ctx.l.target || 30;
  const key = `change:${a}-${b}`; const best = store.get().bests[key] || 0;
  const count = h('div', { class: 'counter' }, '0');
  const clock = h('div', { class: 'clock' }, '1:00');
  const status = h('p', { class: 'status' }, `Strum each chord once, change, strum the other. Every clean landing counts. Target: ${target}.`);
  const da = chordEl(a, { size: 150 }), db = chordEl(b, { size: 150 });
  const startBtn = h('button', { class: 'btn big' }, '▶ Start 60 seconds');
  ctx.body.append(h('div', { class: 'card center' }, h('div', { class: 'row chords-pair' }, da, h('span', { class: 'arrows' }, '⇄'), db), h('div', { class: 'row stats' }, h('div', {}, count, h('small', {}, 'changes')), h('div', {}, clock, h('small', {}, 'left')), h('div', {}, h('div', { class: 'counter dim' }, String(best)), h('small', {}, 'your best'))), status, startBtn));
  const mic = await ctx.app.micOn();
  if (!mic) status.textContent = `Count your own changes out loud: every time you land ${prettyChord(a)} or ${prettyChord(b)} cleanly, that's one. Target: ${target}.`;
  let running = false, n = 0, state = null, cand = null, candSince = 0, t0 = 0, iv;
  const onFrame = () => {
    if (!running) return;
    const now = performance.now();
    if (ears.db < ears.gateDb + 4) { cand = null; return; }
    const r = recognize(ears.chroma, [a, b]);
    const sc = recognize(ears.chroma, [r.name]).score;
    if (sc < 0.7) return;
    if (r.name !== cand) { cand = r.name; candSince = now; return; }
    if (now - candSince > 120 && r.name !== state) {
      if (state) { n++; count.textContent = n; count.classList.add('pop'); setTimeout(() => count.classList.remove('pop'), 150); }
      state = r.name; da.classList.toggle('lit', state === a); db.classList.toggle('lit', state === b);
    }
  };
  const go = async () => {
    startBtn.disabled = true;
    for (const x of ['3', '2', '1']) { status.textContent = x + '…'; await new Promise(r => setTimeout(r, 700)); }
    status.textContent = `Go! ${prettyChord(a)} → ${prettyChord(b)} → ${prettyChord(a)}…`; coach.say('Go!');
    running = true; t0 = performance.now(); n = 0; state = null;
    iv = setInterval(() => {
      const left = Math.max(0, 60 - (performance.now() - t0) / 1000);
      clock.textContent = fmtTime(Math.ceil(left));
      if (left <= 10 && left > 9.7) coach.say('Ten seconds!');
      if (left <= 0) {
        running = false; clearInterval(iv);
        if (!mic) {
          const inp = h('input', { type: 'number', min: 0, max: 200, id: 'oneMinCount', placeholder: 'How many?', style: { maxWidth: '8em' } });
          status.replaceChildren('Time! How many clean changes did you count? ', inp, ' ', h('button', { class: 'btn', onclick: () => { n = Math.max(0, Math.round(+inp.value || 0)); count.textContent = n; finishChange(); } }, 'Save'));
          coach.say('Time! How many did you get?'); inp.focus();
          return;
        }
        finishChange();
      }
    }, 100);
  };
  const finishChange = () => {
    const isBest = store.setBest(key, n);
    const score = Math.min(1, n / target);
    const msg = `${n} changes${isBest && best ? `, a new personal best, up from ${best}` : isBest ? ', your first score on the board' : `. Your best is ${best}`}. ${n >= target ? 'You hit the target. This change is yours.' : `Target is ${target}. Do this once a day; the number climbs fast.`}`;
    ctx.complete(score, msg, { count: n });
  };
  startBtn.onclick = go;
  ctx.app.ctl.start = go;
  ctx.state = () => ({ running, changes: n, target, best });
  ears.addEventListener('frame', onFrame);
  return () => { running = false; clearInterval(iv); ears.removeEventListener('frame', onFrame); };
}

// ---------- STRUMMING / PICKING (rhythm grading with audio onsets + camera stroke direction) ----------
async function runStrum(ctx) {
  const pat = STRUMS[ctx.l.pattern] || STRUMS.quarters;
  const chord = ctx.l.chord || 'G';
  const slotsPerBar = pat.slots.length; // 8 = eighths in 4/4, 6 = eighths in 3/4
  const beatsPerBar = slotsPerBar / 2;
  const isPick = pat.slots.includes('B');
  let bpm = ctx.l.bpm || 70;
  const slotEls = [...pat.slots].map((s, i) => h('div', { class: 'slot ' + (s === '-' ? 'air' : 'hit') }, h('b', {}, s === '-' ? '·' : s === 'D' ? '↓' : s === 'U' ? '↑' : s), h('small', {}, i % 2 ? '&' : String(i / 2 + 1))));
  const lane = h('div', { class: 'lane' }); const accM = meter('Timing'); const dirM = meter('Direction (camera)');
  const bpmEl = h('b', {}, bpm); const status = h('p', { class: 'status' }, pat.tip);
  const startBtn = h('button', { class: 'btn big' }, '▶ Start (1 bar count-in)');
  ctx.body.append(h('div', { class: 'grid2' },
    h('div', { class: 'card center' }, chordEl(chord, { size: 130 }), h('div', { class: 'pattern' }, slotEls), h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => demo() }, '▶ Hear the pattern'), h('span', { class: 'bpm-read' }, bpmEl, ' bpm'))),
    h('div', { class: 'card' }, h('h3', {}, 'Live grading'), lane, accM.el, dirM.el, status, startBtn)));
  const mic = await ctx.app.micOn();
  if (!mic) { status.textContent = pat.tip + ' Play along with the click. Grading needs a mic, so rate yourself below.'; selfCheck(ctx, 'your timing'); }
  const demo = async () => {
    const ac = await ears.ensureContext(); const spb = 60 / bpm, t = ac.currentTime + 0.1;
    [...pat.slots].forEach((s, i) => { if (s === 'D' || s === 'U') strum(chord, { when: t + i * spb / 2, dir: s, vel: i % 2 ? 0.45 : 0.75 }); else if (s !== '-') playPick(chord, s, t + i * spb / 2); });
  };
  let running = false, rounds = 0, results = [], expected = [], hits = 0, extras = 0, offsets = [], dirHits = 0, dirTotal = 0, clickFloor = 0, countIn = true;
  const onSched = e => {
    const { t, beat } = e.detail; const bar = Math.floor(beat / beatsPerBar);
    if (bar === 0) return; // count-in bar
    if (beat % beatsPerBar === 0) for (let k = 0; k < slotsPerBar; k++) if (pat.slots[k] !== '-') expected.push({ t: t + k * metronome.spb / 2, k, claimed: false, dir: pat.slots[k] });
  };
  const onBeat = e => {
    const { beat, beatInBar } = e.detail; const bar = Math.floor(beat / beatsPerBar);
    slotEls.forEach((s, i) => s.classList.toggle('now', Math.floor(i / 2) === beatInBar));
    if (bar === 0) { status.textContent = `Count-in: ${beatInBar + 1}… (don't play yet)`; return; }
    if (countIn) { countIn = false; if (clickFloor) ears.onsetNode?.port.postMessage({ floor: clickFloor * 1.6 }); status.textContent = 'Play!'; }
    if (beatInBar === 0 && bar > 1 && (bar - 1) % 4 === 0) roundDone();
  };
  const onOnset = e => {
    if (!running) return;
    const t = e.detail.t;
    if (countIn) { clickFloor = Math.max(clickFloor, e.detail.e); return; }
    let best = null; for (const x of expected) { if (x.claimed) continue; const d = t - x.t; if (Math.abs(d) < 0.09 && (!best || Math.abs(d) < Math.abs(best.d))) best = { x, d }; }
    const dot = h('i', { class: 'onset' });
    if (best) { best.x.claimed = true; hits++; offsets.push(best.d * 1000); dot.style.left = 50 + best.d * 400 + '%'; dot.classList.add(Math.abs(best.d) < 0.035 ? 'good' : 'ok'); }
    else { extras++; dot.classList.add('bad'); dot.style.left = (Math.random() * 90 + 5) + '%'; }
    lane.append(dot); if (lane.children.length > 24) lane.firstChild.remove();
  };
  // Camera: compare stroke direction with the pattern letter at that moment.
  const onStroke = e => {
    if (!running || countIn || isPick) return;
    const ac = ears.ctx; const ts = ac.getOutputTimestamp?.();
    const t = ts ? ts.contextTime + (e.detail.t - ts.performanceTime) / 1000 : ac.currentTime;
    const x = expected.find(x => Math.abs(x.t - t) < 0.14);
    if (x) { dirTotal++; if (x.dir === e.detail.dir) dirHits++; dirM.set(dirHits / dirTotal); }
  };
  function roundDone() {
    const now = ears.ctx.currentTime;
    const due = expected.filter(x => x.t < now - 0.1);
    const acc = due.length ? Math.max(0, (due.filter(x => x.claimed).length - extras * 0.5) / due.length) : 0;
    const mean = offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : 0;
    results.push(acc); rounds++;
    accM.set(acc);
    let msg;
    if (acc >= 0.9) { bpm = Math.round(bpm + 5); msg = `${Math.round(acc * 100)}%! Tempo up to ${bpm}.`; }
    else if (acc < 0.7) { bpm = Math.max(40, Math.round(bpm * 0.9)); msg = `${Math.round(acc * 100)}%. Slowing to ${bpm}. ${Math.abs(mean) > 25 ? (mean < 0 ? 'You are rushing; lay back a hair.' : 'You are dragging; lean forward a touch.') : 'Keep the hand moving like a pendulum.'}`; }
    else msg = `${Math.round(acc * 100)}%. Sweet spot. Stay here. ${Math.abs(mean) > 25 ? (mean < 0 ? 'Slightly rushing.' : 'Slightly behind.') : ''}`;
    status.textContent = msg; bpmEl.textContent = bpm; if (store.get().settings.talkative >= 1) coach.say(msg);
    metronome.setBpm(bpm);
    expected = expected.filter(x => x.t >= now - 0.1); hits = 0; extras = 0; offsets = [];
    if (rounds >= 3) {
      stop();
      const avg = results.reduce((a, b) => a + b, 0) / results.length;
      ctx.complete(avg, `${pat.name}: average timing ${Math.round(avg * 100)}% over three rounds${dirTotal ? `, strum direction ${Math.round(dirHits / dirTotal * 100)}%` : ''}. Next time we start at ${bpm} bpm.`, { bpm });
      store.set(`bests.bpm:${ctx.l.id}`, bpm);
    }
  }
  const start = async () => {
    if (running) return; running = true; countIn = true; clickFloor = 0; rounds = 0; results = []; expected = [];
    startBtn.disabled = true;
    metronome.beatsPerBar = beatsPerBar; metronome.addEventListener('schedule', onSched); metronome.addEventListener('beat', onBeat);
    await metronome.start(bpm);
  };
  const stop = () => { running = false; metronome.stop(); metronome.beatsPerBar = 4; metronome.removeEventListener('schedule', onSched); metronome.removeEventListener('beat', onBeat); startBtn.disabled = false; };
  startBtn.onclick = start; ctx.app.ctl.start = start; ctx.app.ctl.stop = stop;
  ctx.app.ctl.tempo = f => { bpm = Math.round(bpm * (1 + f)); bpmEl.textContent = bpm; metronome.setBpm(bpm); };
  ctx.state = () => ({ pattern: pat.name, bpm, rounds, lastAccuracy: results[results.length - 1] });
  ears.addEventListener('onset', onOnset); eyes.addEventListener('stroke', onStroke);
  if (!eyes.running) dirM.set(0, 'camera off');
  return () => { stop(); ears.removeEventListener('onset', onOnset); eyes.removeEventListener('stroke', onStroke); };
}
function playPick(chord, s, when) {
  const sh = getShape(chord); if (!sh) return;
  const idx = s === 'B' ? sh.frets.findIndex(f => f >= 0) : 6 - Number(s);
  if (sh.frets[idx] >= 0) playNote(STANDARD[idx] + sh.frets[idx], { when, vel: s === 'B' ? 0.9 : 0.6 });
}

// ---------- RIFF / MELODY ("wait mode": Axel waits for the right note) ----------
async function runRiff(ctx) {
  const s = allSongs(store.get().userSongs).find(x => x.id === ctx.l.song);
  const notes = s?.riff?.notes || s?.melody;
  if (!notes) { ctx.body.append(h('p', {}, 'No riff for this song yet.')); return; }
  const capo = s.melody && !s.riff ? s.capo || 0 : 0;
  const midis = notes.map(n => n[0]);
  const pos = notesToTab(midis, { maxFret: 12 });
  const labels = midis.map(m => midiName(m + capo).replace(/\d/, ''));
  let i = 0, mistakes = 0, onsetSince = true, t0 = 0, lastWrong = 0, holdSince = 0;
  const tabWrap = h('div', { class: 'tab-wrap' });
  const draw = () => { tabWrap.innerHTML = ''; tabWrap.append(tabEl(pos, { active: i, labels })); tabWrap.querySelector('.active')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); };
  const status = h('p', { class: 'status' }, 'Play the highlighted note. I will wait for you.');
  const heard = h('div', { class: 'heard-big' }, '—');
  ctx.body.append(h('div', { class: 'card' },
    h('h3', {}, (s.riff?.name || 'Melody') + ' · ' + s.title + (capo ? ` · capo ${capo}` : '')),
    s.melodyNote ? h('p', { class: 'tip small' }, s.melodyNote) : null,
    tabWrap, h('div', { class: 'row' }, heard, status),
    h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => demo() }, '▶ Play it for me'), h('button', { class: 'btn ghost', onclick: () => { i = 0; mistakes = 0; draw(); } }, '↺ From the top'))));
  draw();
  if (!(await ctx.app.micOn())) { status.textContent = 'Read the tab left to right: string, then fret. Tap ▶ to hear it, then play along.'; selfCheck(ctx, 'the riff'); }
  const demo = async () => {
    const ac = await ears.ensureContext(); let t = ac.currentTime + 0.1; const spb = 60 / Math.min(s.bpm || 90, 100);
    notes.forEach(([m, d]) => { playNote(m + capo, { when: t, vel: 0.8, dur: Math.min(2.4, d * spb + 0.6) }); t += d * spb; });
  };
  const onOnset = () => { onsetSince = true; };
  const onFrame = () => {
    if (i >= midis.length) return;
    const p = ears.pitch; const now = performance.now();
    if (!p || ears.db < ears.gateDb + 3) { holdSince = 0; return; }
    heard.textContent = midiName(p.note);
    const want = midis[i] + capo;
    const same = i > 0 && midis[i] === midis[i - 1];
    if (p.note === want && Math.abs(p.cents) < 45 && (!same || onsetSince)) {
      holdSince ||= now; if (now - holdSince < 50) return;
      if (i === 0) t0 = now;
      i++; onsetSince = false; holdSince = 0; draw();
      if (i >= midis.length) {
        const acc = midis.length / (midis.length + mistakes);
        const secs = (now - t0) / 1000; const ideal = notes.reduce((a, n) => a + n[1], 0) * 60 / (s.bpm || 90);
        const speed = Math.min(1, ideal / Math.max(secs, 0.1));
        ctx.complete(Math.min(1, acc * 0.75 + speed * 0.25), `All ${midis.length} notes, ${mistakes} wrong. ${speed > 0.8 ? 'And close to full speed!' : 'Next: same notes, a little faster.'}`, { mistakes });
      }
    } else if (p.note !== want && now - lastWrong > 500 && onsetSince) {
      holdSince ||= now; if (now - holdSince < 160) return;
      mistakes++; lastWrong = now; onsetSince = false; holdSince = 0;
      status.textContent = (p.note % 12 === want % 12) ? 'Right note, wrong octave. Check the string.' : `Heard ${midiName(p.note)}, looking for ${midiName(want)} (string ${6 - pos[i].s}, fret ${pos[i].f}).`;
    }
  };
  ears.addEventListener('frame', onFrame); ears.addEventListener('onset', onOnset);
  ctx.app.ctl.repeat = () => { i = 0; mistakes = 0; draw(); };
  ctx.state = () => ({ noteIndex: i, total: midis.length, mistakes, waitingFor: midiName(midis[i] + capo) });
  return () => { ears.removeEventListener('frame', onFrame); ears.removeEventListener('onset', onOnset); };
}

// ---------- EAR TRAINING ----------
async function runEar(ctx) {
  const set = ctx.l.set; const majMin = ctx.l.id === 'ear:major-minor';
  let round = 0, correct = 0, cur = null, playedAt = 0;
  const status = h('p', { class: 'status' }, 'Listen, then answer. You can also answer by PLAYING the chord.');
  const btns = h('div', { class: 'row wrap' });
  const prog = h('div', { class: 'reps' }, ...Array.from({ length: 10 }, () => h('i')));
  const answers = majMin ? ['Major', 'Minor'] : set;
  answers.forEach(a => btns.append(h('button', { class: 'btn ghost', onclick: () => answer(a) }, prettyChord(a))));
  ctx.body.append(h('div', { class: 'card center' }, h('button', { class: 'btn big', onclick: () => play() }, '🔊 Play chord'), prog, btns, status));
  const play = () => { if (!cur) { cur = set[Math.floor(Math.random() * set.length)]; } playedAt = performance.now(); strum(cur, { vel: 0.8 }); };
  const isMinor = c => parseChord(c).quality === 'm';
  const answer = a => {
    if (!cur) return play();
    const ok = majMin ? (a === 'Minor') === isMinor(cur) : a === cur;
    prog.children[round].classList.add(ok ? 'on' : 'miss'); round++; if (ok) correct++;
    status.textContent = ok ? `Yes, ${prettyChord(cur)}!` : `That was ${prettyChord(cur)}.`;
    cur = null;
    if (round >= 10) return ctx.complete(correct / 10, `${correct} out of 10. ${correct >= 8 ? 'Your ears are getting sharp.' : 'Ears train fast. Do a round a day.'}`);
    setTimeout(play, 900);
  };
  if (ears.running || await ctx.app.micOn()) {
    let since = 0, last = null;
    const onFrame = () => {
      // ignore the mic while Axel's own chord is still ringing through the speakers
      if (!cur || performance.now() - playedAt < 3000 || ears.db < ears.gateDb + 6) { since = 0; return; }
      const r = recognize(ears.chroma, set);
      if (r.score > 0.8 && r.name === last) { if (performance.now() - since > 500) { since = 0; last = null; answer(majMin ? (isMinor(r.name) ? 'Minor' : 'Major') : r.name); } }
      else { last = r.name; since = performance.now(); }
    };
    ears.addEventListener('frame', onFrame);
    return () => ears.removeEventListener('frame', onFrame);
  }
}
