// Rocky Corner (training camp for the Rocky music) and the Song Decoder (audio → tempo, key, chords, melody → tab).
import * as store from './store.js';
import { ears, analyzeBuffer, framesToNotes, framesToChords } from './audio.js';
import { coach } from './coach.js';
import { strum, arpeggio, playNote } from './synth.js';
import { h, chordEl, tabEl, toast, fmtTime } from './ui.js';
import { notesToTab, renderAsciiTab, prettyChord, midiName, normalize, STANDARD } from './theory.js';
import { SONGS } from './songs.js';

const MONTAGE = [
  { day: 1, title: 'Roadwork: the cinematic minor loop', what: 'Am → F → C → G, slow arpeggios (bass-3-2-1). This is the mood engine of the ballad.', go: '#/song/gym-minor-cinema' },
  { day: 2, title: 'Heavy bag: Dm and E7', what: 'The two chords that make minor keys sound like film music. Mic-checked.', go: '#/lesson/' + encodeURIComponent('chord:Dm') },
  { day: 3, title: 'Speed bag: arpeggio engine', what: 'Picking pattern at 60 bpm with live timing grading. Stay relaxed.', go: '#/lesson/' + encodeURIComponent('strum:pickArp') },
  { day: 4, title: 'Sparring: Empty Arena étude, melody', what: 'Melody on the top strings in wait mode. Axel waits for each note.', go: '#/lesson/' + encodeURIComponent('riff:rocky-alone-in-the-ring') },
  { day: 5, title: 'The stairs: étude with capo 3 = C minor', what: 'Full étude, play-along with bar-by-bar scoring. Capo on 3 puts you in the original key.', go: '#/song/rocky-alone-in-the-ring' },
  { day: 6, title: 'Film study: decode the real cue', what: 'Load your own copy of "Alone in the Ring" into the Decoder at 50% speed. Extract the melody and save the chart.', go: '#/decoder' },
  { day: 7, title: 'Fight night', what: 'Play it top to bottom, slow and free (rubato). Soft start, swell in the middle, fade out. Record yourself.', go: '#/song/rocky-alone-in-the-ring' },
];

export async function rockyView(root, _, app) {
  const st = store.get();
  const prog = st.rockyDay || 0;
  const ring = SONGS.find(s => s.id === 'rocky-alone-in-the-ring');
  root.append(
    h('section', { class: 'rocky-hero' },
      h('div', { class: 'rh-text' },
        h('small', { class: 'kicker' }, 'ROCKY CORNER'),
        h('h1', {}, 'Alone in the Ring'),
        h('p', {}, 'The night before the fight. An empty arena. Bill Conti\'s quiet, solo-piano take on the Rocky theme, about a minute long, in C minor, played slow and free. There is no common guitar arrangement, so we build yours.'),
        h('div', { class: 'row wrap' }, h('a', { class: 'btn big', href: MONTAGE[Math.min(prog, 6)].go, onclick: () => { st.rockyDay = Math.min(7, prog + 1); store.save(); } }, prog ? `▶ Continue: Day ${Math.min(prog + 1, 7)}` : '▶ Start the 7-day training camp'),
          h('button', { class: 'btn ghost', onclick: () => playMood() }, '🔊 Hear the étude mood'))),
      h('div', { class: 'rh-art', 'aria-hidden': 'true' }, h('div', { class: 'spot' }), h('div', { class: 'ropes' }))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, '🎯 The 80/20 guitar plan for this cue'),
        h('ol', { class: 'plan' },
          h('li', {}, h('b', {}, 'Capo on fret 3 + A-minor shapes = C minor.'), ' You keep easy open chords and still match the record.'),
          h('li', {}, h('b', {}, 'Melody on the top two strings,'), ' bass note on the first beat. That is how a piano piece becomes a guitar piece.'),
          h('li', {}, h('b', {}, 'Rubato:'), ' no metronome for the final performance. Breathe between phrases, the way the piano does.'),
          h('li', {}, h('b', {}, 'Dynamics are the drama:'), ' whisper the opening, swell in the middle, let the last chord ring out.'),
          h('li', {}, h('b', {}, 'Exact notes:'), ' run your own copy through the Song Decoder at 50% speed and save it as your chart.'))),
      h('div', { class: 'card' }, h('h3', {}, 'Étude chords (Am shapes, capo 3)'), h('div', { class: 'chord-grid tight' }, ...['Am', 'F', 'C', 'G', 'Dm', 'E7'].map(c => h('button', { class: 'chord-tile', onclick: () => arpeggio(c, { capo: 3 }) }, chordEl(c, { size: 80 })))), h('p', { class: 'tip small' }, ring.melodyNote))),
    h('h2', { class: 'group-title' }, '7-Day Training Camp'),
    h('div', { class: 'montage' }, ...MONTAGE.map(m => h('a', { class: 'montage-day' + (m.day <= prog ? ' done' : m.day === prog + 1 ? ' next' : ''), href: m.go, onclick: () => { if (m.day === prog + 1) { st.rockyDay = m.day; store.save(); } } }, h('b', {}, 'Day ' + m.day), h('span', {}, m.title), h('small', {}, m.what)))),
    h('h2', { class: 'group-title' }, 'More from the Rocky films'),
    h('div', { class: 'song-grid' }, ...SONGS.filter(s => s.tags.includes('rocky') && s.id !== 'rocky-alone-in-the-ring').map(s => h('a', { class: 'song-card rocky', href: '#/song/' + s.id }, h('b', {}, s.title), h('small', {}, `${s.artist} · ${s.film}`), h('p', { class: 'muted' }, s.feel || s.why)))),
    h('details', { class: 'card sources' }, h('summary', {}, 'Sources & honesty notes'),
      h('ul', {},
        h('li', {}, 'Cue length, solo-piano scoring and context: ', h('a', { href: 'https://moviemusicuk.us/2018/04/23/rocky-bill-conti/', target: '_blank', rel: 'noopener' }, 'MovieMusicUK review of the Rocky score')),
        h('li', {}, 'C minor, "slowly and freely" (piano solo edition): ', h('a', { href: 'https://www.musicnotes.com/sheetmusic/mtd.asp?ppn=MN0057505', target: '_blank', rel: 'noopener' }, 'Musicnotes')),
        h('li', {}, '"Gonna Fly Now" #1 on the Billboard Hot 100 (July 1977): ', h('a', { href: 'https://www.songfacts.com/facts/bill-conti/gonna-fly-now-theme-from-rocky', target: '_blank', rel: 'noopener' }, 'Songfacts')),
        h('li', {}, 'The "Empty Arena" étude is an original practice piece written for this app in the mood of the cue. It is not Conti\'s melody. For his notes, use the Decoder on a recording you own.'))));
  async function playMood() {
    const ac = await ears.ensureContext(); let t = ac.currentTime + 0.1;
    ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'E7', 'Am'].forEach(c => { arpeggio(c, { when: t, step: 0.27, capo: 3 }); t += 0.27 * 6; });
  }
}

// ---------- SONG DECODER ----------
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
function guessKey(frames) { // Krumhansl–Schmuckler
  const acc = new Float32Array(12); frames.forEach(f => f.chroma && f.chroma.forEach((v, i) => { acc[i] += v; }));
  const c = normalize(acc); let best = { s: -9 };
  for (let r = 0; r < 12; r++) for (const [prof, q] of [[MAJOR, 'major'], [MINOR, 'minor']]) {
    const p = normalize(Float32Array.from({ length: 12 }, (_, i) => prof[(i - r + 12) % 12]));
    let s = 0; for (let i = 0; i < 12; i++) s += c[i] * p[i];
    if (s > best.s) best = { s, name: `${NN[r]} ${q}`, root: r, q };
  }
  return best;
}
// Suggest a capo so the key sits on friendly open shapes (C/G/D/A/E major or Am/Em/Dm).
function capoSuggestion(key) {
  const friendly = key.q === 'major' ? [0, 7, 2, 9, 4] : [9, 4, 2];
  let best = null;
  for (const f of friendly) { const capo = (key.root - f + 12) % 12; if (capo <= 7 && (!best || capo < best.capo)) best = { capo, shape: NN[f] + (key.q === 'minor' ? 'm' : '') }; }
  return best;
}

export async function decoderView(root, _, app) {
  const file = h('input', { type: 'file', accept: 'audio/*,video/*', 'aria-label': 'Audio file' });
  const audio = h('audio', { controls: true, preload: 'auto' });
  audio.preservesPitch = true; audio.mozPreservesPitch = true; audio.webkitPreservesPitch = true;
  const speed = h('input', { type: 'range', min: 0.4, max: 1, step: 0.05, value: 0.75 }); const speedL = h('b', {}, '75%');
  speed.oninput = () => { audio.playbackRate = +speed.value; speedL.textContent = Math.round(speed.value * 100) + '%'; };
  const prog = h('progress', { max: 1, value: 0, hidden: true });
  const out = h('div', { class: 'decoded' });
  const live = h('div', { class: 'live-chord' }, '—');
  let loopA = null, loopB = null;
  const abBtn = h('button', { class: 'btn ghost sm' }, 'Set A');
  abBtn.onclick = () => { if (loopA === null) { loopA = audio.currentTime; abBtn.textContent = 'Set B'; } else if (loopB === null) { loopB = Math.max(audio.currentTime, loopA + 0.5); abBtn.textContent = `Loop ${fmtTime(loopA)}–${fmtTime(loopB)} ✕`; } else { loopA = loopB = null; abBtn.textContent = 'Set A'; } };
  audio.addEventListener('timeupdate', () => { if (loopB !== null && audio.currentTime >= loopB) audio.currentTime = loopA; });
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Song Decoder'), h('p', {}, 'Learn any song you love by ear, with superpowers. Load a track you own. Axel finds the tempo, key, chord changes and a melody draft, maps the melody to tab, and lets you slow it down and loop it without changing the pitch. Everything runs on your device; nothing is uploaded.')),
    h('div', { class: 'card' }, h('div', { class: 'row wrap' }, file, prog), h('div', { class: 'row wrap' }, audio, h('label', { class: 'tempo' }, 'Speed ', speed, speedL), abBtn)),
    h('div', { class: 'card row' }, h('div', {}, h('h3', {}, '🎧 Live chord ears'), h('p', { class: 'muted' }, 'Play anything near your mic (YouTube on speakers, a band, yourself). Axel names chords in real time.')), live),
    out);
  // Live chord readout (mic)
  let liveOn = false;
  live.onclick = async () => { liveOn = await app.micOn(); };
  const onFrame = () => { const c = ears.chord; live.textContent = c && c.score > 0.78 ? prettyChord(c.name) : '…'; };
  ears.addEventListener('frame', onFrame);
  app.micOn();

  file.onchange = async () => {
    const f = file.files[0]; if (!f) return;
    audio.src = URL.createObjectURL(f); audio.playbackRate = +speed.value;
    out.innerHTML = ''; prog.hidden = false; prog.value = 0;
    try {
      const ac = await ears.ensureContext();
      const buf = await ac.decodeAudioData(await f.arrayBuffer());
      toast('Decoding… this takes a few seconds per minute of audio.', 'info');
      const res = await analyzeBuffer(buf, { onProgress: p => { prog.value = p; } });
      prog.hidden = true;
      render(res, f.name.replace(/\.[^.]+$/, ''), buf.duration);
    } catch (e) { prog.hidden = true; toast('Could not decode that file: ' + e.message, 'bad', 6000); }
  };

  function render(res, name, duration) {
    const key = guessKey(res.frames); const capo = capoSuggestion(key);
    let bpm = res.tempo;
    const chordsLane = h('div', { class: 'chord-lane' });
    const melodyBox = h('div', {});
    const bpmIn = h('input', { type: 'number', min: 40, max: 220, value: bpm, style: { width: '5em' } });
    const per = h('select', {}, ...[['1', 'per beat'], ['2', 'per 2 beats'], ['4', 'per bar']].map(([v, l]) => h('option', { value: v, selected: v === '2' || undefined }, l)));
    const drawChords = () => {
      bpm = +bpmIn.value || bpm;
      const cs = framesToChords(res.frames, bpm, { beatsPerChord: +per.value });
      chordsLane.innerHTML = '';
      cs.forEach(c => chordsLane.append(h('button', { class: 'lane-chord' + (c.name ? '' : ' none'), style: { flexGrow: Math.max(1, (c.end - c.t)) }, title: fmtTime(c.t), onclick: () => { audio.currentTime = c.t; audio.play(); } }, c.name ? prettyChord(c.name) : '·')));
      return cs;
    };
    let chordList = [];
    const notes = framesToNotes(res.frames);
    const drawMelody = (fromT = 0, toT = 30) => {
      melodyBox.innerHTML = '';
      const sel = notes.filter(n => n.start >= fromT && n.start < toT).slice(0, 64);
      if (!sel.length) { melodyBox.append(h('p', { class: 'muted' }, 'No clear single-note melody found in this range (full-band mixes are hard; try a solo section or an isolated stem).')); return; }
      const shift = capoOn.checked && capo ? capo.capo : 0;
      const pos = notesToTab(sel.map(n => n.midi - shift), { maxFret: 12 });
      melodyBox.append(h('p', { class: 'muted small' }, `${sel.length} notes from ${fmtTime(fromT)}${shift ? ` · frets relative to capo ${shift}` : ''}. Tap ▶ to hear Axel play the draft.`), tabEl(pos, { labels: sel.map(n => midiName(n.midi).replace(/\d/, '')) }),
        h('div', { class: 'row' }, h('button', { class: 'btn ghost sm', onclick: async () => { const ac = await ears.ensureContext(); const t0 = ac.currentTime + 0.1; sel.forEach(n => playNote(n.midi, { when: t0 + (n.start - sel[0].start) / audio.playbackRate, dur: 1.2 })); } }, '▶ Play draft'),
          h('button', { class: 'btn ghost sm', onclick: () => { navigator.clipboard?.writeText(renderAsciiTab(pos)); toast('ASCII tab copied'); } }, '📋 Copy tab')));
      return sel;
    };
    const capoOn = h('input', { type: 'checkbox', checked: !!capo?.capo || undefined });
    const fromIn = h('input', { type: 'number', min: 0, step: 1, value: 0, style: { width: '5em' } });
    out.append(
      h('div', { class: 'card' }, h('h3', {}, `“${name}”`),
        h('div', { class: 'facts' }, h('span', {}, `⏱ ${fmtTime(duration)}`), h('span', {}, '♩ ', bpmIn, ' bpm'), h('span', {}, `🎼 ${key.name} (best guess)`), capo ? h('span', { class: 'hot' }, capo.capo ? `📎 Try capo ${capo.capo} + ${capo.shape}-family shapes` : `Open ${capo.shape}-family shapes`) : null),
        h('p', { class: 'tip small' }, 'Tempo and key are estimates. If chords look busy, set the tempo to what you hear, or count chords per bar.')),
      h('div', { class: 'card' }, h('div', { class: 'row wrap' }, h('h3', {}, 'Chord timeline'), per, h('button', { class: 'btn ghost sm', onclick: () => { chordList = drawChords(); } }, 'Re-analyze')), chordsLane),
      h('div', { class: 'card' }, h('div', { class: 'row wrap' }, h('h3', {}, 'Melody draft → tab'), h('label', {}, 'from second ', fromIn), h('label', { class: 'switch' }, capoOn, ` use capo ${capo?.capo || 0}`), h('button', { class: 'btn ghost sm', onclick: () => drawMelody(+fromIn.value, +fromIn.value + 30) }, 'Show')), melodyBox),
      h('div', { class: 'card row' }, h('p', {}, 'Happy with it? Save the chord chart to your library and practice it with live scoring.'), h('button', { class: 'btn', onclick: save }, '💾 Save to library')));
    chordList = drawChords(); drawMelody(0, 30);
    function save() {
      const beats = +per.value; const perBar = Math.max(1, Math.round(4 / beats));
      const seq = []; chordList.forEach(c => { const n = Math.max(1, Math.round((c.end - c.t) / (60 / bpm * beats))); for (let i = 0; i < n; i++) seq.push(c.name || (seq[seq.length - 1] || 'N.C.')); });
      const bars = []; for (let i = 0; i < seq.length; i += perBar) { const b = seq.slice(i, i + perBar); bars.push([...new Set(b)].filter(x => x !== 'N.C.').join(' ') || (bars[bars.length - 1] || 'C')); }
      const sections = []; for (let i = 0; i < bars.length; i += 8) sections.push({ name: `Part ${sections.length + 1} (${fmtTime(i * 4 * 60 / bpm)})`, bars: bars.slice(i, i + 8) });
      const r = app.addSong({ title: name, artist: 'Decoded', key: key.name, capo: capo?.capo || 0, bpm: Math.round(bpm), sections: sections.slice(0, 24), confidence: 'decoded', verify: 'Decoded automatically from audio. Check the chords by ear and edit as needed.' }, 'decoder');
      app.go('#/song/' + encodeURIComponent(r.replace('added as ', '')));
    }
    coach.say(`Got it. Around ${bpm} bpm, probably ${key.name}. ${capo?.capo ? `Capo ${capo.capo} with ${capo.shape} shapes will make it easy.` : ''} Tap any chord to jump there.`);
  }
  return () => { ears.removeEventListener('frame', onFrame); audio.pause(); };
}
