// Library (your taste → your songs), the Song Player (play-along with live bar-by-bar scoring), and the chord-sheet importer.
import * as store from './store.js';
import { ears } from './audio.js';
import { coach } from './coach.js';
import { metronome, strum, playNote } from './synth.js';
import { h, chordEl, toast, modal, stars } from './ui.js';
import { getShape, prettyChord, STRUMS, STANDARD, recognize } from './theory.js';
import { allSongs, songChords, playable, links } from './songs.js';
import { parseSheet, parsePlaylist } from './parser.js';

const FILTERS = [['all', 'All'], ['playable', '✓ Playable now'], ['rocky', '🥊 Rocky'], ['country', '🤠 Country'], ['mine', '★ Mine'], ['easy', 'Beginner'], ['riff', 'Riffs'], ['fingerpicking', 'Fingerpicking'], ['public domain', 'Public domain'], ['gym', 'Gyms']];

export async function libraryView(root, [filter = 'all'], app) {
  const st = store.get();
  const known = Object.entries(st.skills).filter(([k, v]) => k.startsWith('chord:') && v.level >= 2).map(([k]) => k.slice(6));
  const songs = allSongs(st.userSongs);
  const q = h('input', { type: 'search', placeholder: 'Search songs, artists, techniques…', 'aria-label': 'Search library' });
  const grid = h('div', { class: 'song-grid' });
  let f = filter;
  const chips = h('div', { class: 'chips' }, ...FILTERS.map(([id, label]) => h('button', { class: 'chip' + (id === f ? ' on' : ''), 'data-id': id, onclick: () => { f = id; chips.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.id === id)); draw(); } }, label)));
  const draw = () => {
    const s = q.value.toLowerCase();
    const list = songs.filter(x => {
      if (s && !(x.title + ' ' + x.artist + ' ' + (x.tags || []).join(' ') + ' ' + (x.techniques || []).join(' ')).toLowerCase().includes(s)) return false;
      if (f === 'playable') return !x.decodeOnly && playable(x, known);
      if (f === 'mine') return x.user;
      if (f === 'easy') return x.diff <= 1;
      if (f === 'riff') return x.riff || x.tags.includes('riff');
      if (f !== 'all') return (x.tags || []).includes(f);
      return true;
    });
    grid.innerHTML = '';
    list.forEach(x => {
      const ok = !x.decodeOnly && playable(x, known);
      grid.append(h('a', { class: 'song-card' + (x.tags?.includes('rocky') ? ' rocky' : ''), href: '#/song/' + encodeURIComponent(x.id) },
        h('div', { class: 'sc-top' }, h('b', {}, x.title), h('span', { class: 'diff', title: 'Difficulty' }, stars(x.diff || 1))),
        h('small', {}, x.artist + (x.year ? ' · ' + x.year : '') + (x.film ? ' · ' + x.film : '')),
        h('div', { class: 'sc-chords' }, x.decodeOnly ? 'Decode from your recording' : songChords(x).slice(0, 7).map(prettyChord).join('  ')),
        h('div', { class: 'badges' }, ok ? h('span', { class: 'badge good' }, '✓ playable now') : null, x.pd ? h('span', { class: 'badge' }, 'PD · full melody') : null, x.user ? h('span', { class: 'badge' }, x.source === 'axel' ? '✨ Axel' : x.source === 'decoder' ? '🎧 decoded' : '★ imported') : null, x.riff ? h('span', { class: 'badge' }, 'riff') : null)));
    });
    if (!list.length) grid.append(h('p', { class: 'muted' }, 'Nothing here yet. Import a chord sheet, decode a recording, or ask Axel to add it.'));
  };
  q.addEventListener('input', draw);
  const playableCount = songs.filter(x => !x.decodeOnly && playable(x, known)).length;
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Your Library'), h('p', {}, `${songs.length} songs · you can play ${playableCount} of them right now with the chords you own. Every new chord unlocks more.`)),
    tasteBox(app),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn', onclick: () => playlistModal(app) }, '🎵 Import my playlist'), h('button', { class: 'btn ghost', onclick: () => importModal(app) }, '➕ Import a chord sheet'), h('button', { class: 'btn ghost', onclick: () => app.go('#/decoder') }, '🎧 Decode a recording'), h('button', { class: 'btn ghost', onclick: () => askAxelAdd(app) }, '✨ Ask Axel to add a song')),
    h('div', { class: 'row' }, q), chips, grid);
  draw();
}

// "Songs I love" → library. With a Claude key Axel builds charts; without, each wish gets lesson/tab/decoder links.
function tasteBox(app) {
  const st = store.get(); st.profile.wishlist ||= [];
  const ta = h('textarea', { rows: 2, placeholder: 'Songs or artists you love, one per line. e.g. "Alone in the Ring – Rocky", "Hotel California", "Metallica"' });
  const list = h('ul', { class: 'wish' });
  const draw = () => {
    list.innerHTML = '';
    st.profile.wishlist.forEach((w, i) => {
      const L = links({ title: w, artist: '' });
      list.append(h('li', {}, h('b', {}, w),
        h('a', { href: L.youtube, target: '_blank', rel: 'noopener' }, 'video lessons'), h('a', { href: L.ug, target: '_blank', rel: 'noopener' }, 'chords'), h('a', { href: L.songsterr, target: '_blank', rel: 'noopener' }, 'tabs'),
        h('a', { href: '#/decoder' }, 'decode'), st.settings.claudeKey ? h('button', { class: 'link', onclick: () => coach.ask(`Add "${w}" to my library with the chord progression and the techniques I need. Then open it.`) }, '✨ build chart') : null,
        h('button', { class: 'link', 'aria-label': 'Remove', onclick: () => { st.profile.wishlist.splice(i, 1); store.save(); draw(); } }, '✕')));
    });
  };
  const add = () => {
    const items = ta.value.split('\n').map(x => x.trim()).filter(Boolean); if (!items.length) return;
    st.profile.wishlist.unshift(...items); store.save(); ta.value = ''; draw();
    if (st.settings.claudeKey) coach.ask(`I love these: ${items.join('; ')}. Add the ones you know well to my library as chord charts and tell me which one to start with given my current chords.`);
    else toast('Saved to your wishlist. Add a Claude key in Settings and Axel will build charts automatically.', 'info', 5000);
  };
  draw();
  return h('details', { class: 'card taste', open: !st.profile.wishlist.length || undefined }, h('summary', {}, '❤️ Songs I love (build my library)'), h('div', { class: 'row' }, ta, h('button', { class: 'btn', onclick: add }, 'Add')), list);
}

// Import a whole playlist (Spotify via Exportify CSV, Apple Music export, or pasted lines). Matches the library; the rest goes to the wishlist.
const norm = t => t.toLowerCase().replace(/\s*\(.*?\)|[^a-z0-9 ]/g, '').replace(/^the /, '').trim();
export function playlistModal(app) {
  const ta = h('textarea', { rows: 10, placeholder: 'Paste your playlist, one song per line:\nTennessee Whiskey - Chris Stapleton\nWagon Wheel - Darius Rucker\n…\n\nor upload a CSV/TXT export below.' });
  const name = h('input', { type: 'text', placeholder: 'Playlist name (e.g. My Country ❤️)' });
  const fileIn = h('input', { type: 'file', accept: '.csv,.txt,.tsv,text/*', onchange: async e => { const f = e.target.files[0]; if (!f) return; ta.value = await f.text(); if (!name.value) name.value = f.name.replace(/\.[^.]+$/, ''); ta.dispatchEvent(new Event('input')); } });
  const preview = h('div', { class: 'preview muted' }, 'Waiting for songs…');
  ta.addEventListener('input', () => { const items = parsePlaylist(ta.value); preview.textContent = items.length ? `Found ${items.length} songs: ${items.slice(0, 6).map(i => i.title).join(', ')}${items.length > 6 ? '…' : ''}` : 'No songs detected yet.'; });
  modal('Import my playlist', h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Spotify: export the playlist as CSV at exportify.net (it signs in with Spotify), then upload it here. Apple Music on a Mac: select the playlist, then File → Library → Export Playlist… (.txt). Any app: copy the track list and paste it.'),
    name, ta, h('label', { class: 'btn ghost sm' }, '⬆ Upload CSV / TXT', h('span', { hidden: true }, fileIn)), preview), [
    ['Import', () => {
      const items = parsePlaylist(ta.value); if (!items.length) { toast('No songs found in that text.', 'bad'); return false; }
      const st = store.get(); st.profile.wishlist ||= []; st.profile.playlists ||= [];
      const lib = allSongs(st.userSongs); const matched = [], missing = [];
      items.forEach(i => { const hit = lib.find(s => norm(s.title) === norm(i.title)); if (hit) { matched.push(hit); if (!st.profile.favorites.includes(hit.id)) st.profile.favorites.push(hit.id); } else missing.push(i); });
      missing.forEach(i => { const w = i.artist ? `${i.title} – ${i.artist}` : i.title; if (!st.profile.wishlist.includes(w)) st.profile.wishlist.push(w); });
      st.profile.playlists.push({ name: name.value || 'My playlist', count: items.length, at: Date.now() });
      store.save();
      toast(`${items.length} songs imported: ${matched.length} already in your library, ${missing.length} added to your wishlist.`, 'good', 6000);
      if (st.settings.claudeKey && missing.length) {
        const batch = missing.slice(0, 12).map(i => `${i.title}${i.artist ? ' by ' + i.artist : ''}`).join('; ');
        coach.ask(`I just imported my playlist "${name.value || 'my playlist'}". Add chord charts to my library for the songs you know well (skip any you're unsure of): ${batch}. Then tell me which one to learn first given the chords I know.`);
      } else coach.say(`Imported ${items.length} songs. ${matched.length} are ready to play right now. The rest are on your wishlist with lesson links and the decoder.`);
      app.go('#/library');
    }],
  ]);
}

function askAxelAdd(app) {
  if (!store.get().settings.claudeKey) { toast('Axel needs a Claude API key (Settings) to write new charts. You can still Import or Decode.', 'info', 6000); return; }
  const inp = h('input', { type: 'text', placeholder: 'Song title – artist' });
  modal('Ask Axel to add a song', h('div', {}, h('p', {}, 'Axel will write a chord chart (no lyrics) with key, capo, tempo and techniques, and tell you how confident he is.'), inp), [
    ['Add it', () => { if (inp.value.trim()) coach.ask(`Add "${inp.value.trim()}" to my library, then open it.`); }],
  ]);
  setTimeout(() => inp.focus(), 50);
}

export function importModal(app) {
  const ta = h('textarea', { rows: 12, placeholder: '[Verse]\nG        D        Am\n(lyrics are fine; I only keep them on this device)\n\nor ChordPro: [G]Some [D]words…' });
  const title = h('input', { type: 'text', placeholder: 'Title' }), artist = h('input', { type: 'text', placeholder: 'Artist' });
  const preview = h('div', { class: 'preview muted' }, 'Paste a chord sheet to preview.');
  ta.addEventListener('input', () => {
    const p = parseSheet(ta.value);
    if (p.title && !title.value) title.value = p.title; if (p.artist && !artist.value) artist.value = p.artist;
    preview.textContent = p.chordCount ? `Found ${p.sections.length} section(s), ${p.chordCount} chords: ${[...new Set(p.sections.flatMap(s => s.bars))].join(' ')}${p.capo ? ` · capo ${p.capo}` : ''}` : 'No chords detected yet.';
  });
  modal('Import a chord sheet', h('div', { class: 'stack' }, h('p', { class: 'muted' }, 'Copy a chord sheet from any site you use and paste it here. It becomes a practice chart with live mic scoring. Stays on this device.'), h('div', { class: 'row' }, title, artist), ta, preview), [
    ['Save to library', () => {
      const p = parseSheet(ta.value, { title: title.value, artist: artist.value });
      if (!p.chordCount) { toast('No chords found in that text.', 'bad'); return false; }
      const r = app.addSong({ title: title.value || p.title || 'Imported song', artist: artist.value || p.artist, capo: p.capo, key: p.key, sections: p.sections, display: p.display, confidence: 'imported' }, 'import');
      app.go('#/song/' + encodeURIComponent(r.replace('added as ', '')));
    }],
  ]);
}

// ---------- SONG PLAYER ----------
export async function songView(root, [id, mode], app) {
  const st = store.get();
  const s = allSongs(st.userSongs).find(x => x.id === id);
  if (!s) { root.append(h('div', { class: 'card' }, 'Song not found. ', h('a', { href: '#/library' }, 'Back to library'))); return; }
  const L = links(s);
  const chords = songChords(s);
  const lessonMode = mode === 'lesson';
  root.append(h('header', { class: 'page-head song-head' + (s.tags?.includes('rocky') ? ' rocky' : '') },
    h('div', { class: 'crumbs' }, h('a', { href: '#/library' }, 'Library'), s.film ? ` · from ${s.film}` : ''),
    h('h1', {}, s.title), h('p', { class: 'by' }, `${s.artist}${s.year ? ' · ' + s.year : ''}`),
    h('div', { class: 'facts' }, s.key ? h('span', {}, '🎼 ' + s.key) : null, s.capo ? h('span', { class: 'hot' }, `📎 Capo ${s.capo}`) : null, s.bpm ? h('span', {}, `♩ ≈ ${s.bpm} bpm`) : null, h('span', {}, `Difficulty ${stars(s.diff || 1)}`), s.strum && STRUMS[s.strum] ? h('span', {}, '✋ ' + STRUMS[s.strum].name) : null),
    s.feel ? h('p', { class: 'feel' }, s.feel) : null,
    s.why ? h('p', { class: 'coach-line' }, '🥊 ' + s.why) : null,
    s.verify ? h('p', { class: 'tip small' }, '⚠️ ' + s.verify) : null,
    h('div', { class: 'row wrap links' }, h('a', { class: 'btn ghost sm', href: L.listen, target: '_blank', rel: 'noopener' }, '🎧 Listen'), h('a', { class: 'btn ghost sm', href: L.youtube, target: '_blank', rel: 'noopener' }, '▶ Video lessons'), h('a', { class: 'btn ghost sm', href: L.songsterr, target: '_blank', rel: 'noopener' }, 'Tabs'), h('a', { class: 'btn ghost sm', href: L.ug, target: '_blank', rel: 'noopener' }, 'Chord sheets'), h('a', { class: 'btn ghost sm', href: '#/decoder' }, '🧠 Decode it'))));
  if (s.techniques?.length) root.append(h('div', { class: 'chips static' }, ...s.techniques.map(t => h('span', { class: 'chip' }, t))));
  if (s.decodeOnly) {
    root.append(h('div', { class: 'card cta' }, h('h3', {}, 'Decode this one from your recording'), h('p', {}, 'Load your own copy of the track into the Song Decoder: it finds the tempo, chords and a melody draft, slows it down without changing pitch, and saves a practice chart here.'), h('a', { class: 'btn', href: '#/decoder' }, 'Open the Song Decoder →')));
    if (s.special === 'rocky') root.append(h('a', { class: 'btn ghost', href: '#/rocky' }, '🥊 Back to Rocky Corner'));
    return;
  }
  // Chords you need
  const known = new Set(Object.entries(st.skills).filter(([k, v]) => k.startsWith('chord:') && v.level >= 2).map(([k]) => k.slice(6)));
  root.append(h('h2', { class: 'group-title' }, 'Chords you need'), h('div', { class: 'chord-grid' }, ...chords.map(c => h('button', { class: 'chord-tile' + (known.has(c) ? ' known' : ''), title: known.has(c) ? 'You own this one' : 'Tap to practice', onclick: () => app.showChord(c) }, chordEl(c, { size: 92 })))));
  if (s.riff || s.melody) root.append(h('div', { class: 'card row' }, h('div', {}, h('h3', {}, '🎯 ' + (s.riff?.name || 'Melody') + (s.melody && s.capo ? ` (capo ${s.capo})` : '')), h('p', { class: 'muted' }, 'Wait-mode practice: Axel waits for each correct note.')), h('a', { class: 'btn', href: '#/lesson/' + encodeURIComponent('riff:' + s.id) }, 'Practice →')));

  // Expand the chart into a timeline of bars
  const meterBeats = s.meter === 6 ? 2 : s.meter || 4;
  const pattern = s.meter === 6 && s.strum === 'pickArp' ? 'B32123' : (STRUMS[s.strum] || STRUMS.oldFaithful).slots;
  const timeline = []; // {sec, barInSec, chords:[...], el}
  const sectionsEl = h('div', { class: 'sections' });
  (s.sections || []).forEach((sec, si) => {
    const barsEl = h('div', { class: 'bars' });
    sec.bars.forEach((b, bi) => {
      const el = h('button', { class: 'bar', onclick: e => setLoop(si, e.shiftKey) }, ...b.split(/\s+/).map(c => h('span', {}, prettyChord(c))));
      barsEl.append(el);
    });
    sectionsEl.append(h('div', { class: 'section' }, h('div', { class: 'sec-head' }, h('b', {}, sec.name), sec.repeat > 1 ? h('small', {}, `× ${sec.repeat}`) : null, h('button', { class: 'link', onclick: () => setLoop(si) }, '⟲ loop this')), barsEl));
    for (let r = 0; r < (sec.repeat || 1); r++) sec.bars.forEach((b, bi) => timeline.push({ si, bi, chords: b.split(/\s+/).filter(Boolean), el: barsEl.children[bi], r }));
  });
  if (s.display?.length) {
    const sheet = h('pre', { class: 'sheet' }); s.display.forEach(d => sheet.append(d.type === 'h' ? h('b', {}, `\n[${d.text}]\n`) : d.type === 'cl' ? `${d.chords.join(' ')}\n${d.lyric}\n` : d.text + '\n'));
    root.append(h('details', { class: 'card' }, h('summary', {}, 'Your imported sheet'), sheet));
  }

  // Transport
  let playing = false, loop = null, idx = -1, barScores = [], barSamples = [], barDur = 0, seqStart = 0;
  const stored = st.bests['tempo:' + s.id];
  let tempoPct = stored || (lessonMode || !(st.skills['song:' + s.id]?.level >= 2) ? 70 : 100);
  const tempoIn = h('input', { type: 'range', min: 40, max: 120, step: 5, value: tempoPct, 'aria-label': 'Tempo percent' });
  const tempoLbl = h('b', {}, '');
  const updTempo = () => { tempoPct = +tempoIn.value; tempoLbl.textContent = `${tempoPct}% · ${Math.round((s.bpm || 90) * tempoPct / 100)} bpm`; if (playing) metronome.setBpm((s.bpm || 90) * tempoPct / 100); };
  tempoIn.oninput = updTempo; updTempo();
  const backing = h('input', { type: 'checkbox', checked: true }); const scoring = h('input', { type: 'checkbox', checked: true }); const clickOn = h('input', { type: 'checkbox', checked: true });
  const playBtn = h('button', { class: 'btn big' }, '▶ Play along');
  const nowEl = h('div', { class: 'now-next' });
  const summary = h('div', { class: 'result', hidden: true });
  root.append(h('div', { class: 'card transport sticky' },
    h('div', { class: 'row wrap' }, playBtn, h('label', { class: 'tempo' }, 'Tempo ', tempoIn, tempoLbl)),
    h('div', { class: 'row wrap small' }, h('label', { class: 'switch' }, backing, ' Axel plays along'), h('label', { class: 'switch' }, scoring, ' Listen & score me'), h('label', { class: 'switch' }, clickOn, ' Click'), h('span', { class: 'muted' }, '🎧 Headphones help scoring when Axel plays along. Click a section\'s ⟲ to loop it.')),
    nowEl), h('h2', { class: 'group-title' }, 'Chart'), sectionsEl, summary);

  const setLoop = (si, extend) => {
    const first = timeline.findIndex(t => t.si === si), last = timeline.length - 1 - [...timeline].reverse().findIndex(t => t.si === si);
    loop = extend && loop ? { a: Math.min(loop.a, first), b: Math.max(loop.b, last) } : { a: first, b: timeline.findIndex(t => t.si === si && t.r === 0 && t.bi === s.sections[si].bars.length - 1) };
    if (loop.b < loop.a) loop.b = last;
    timeline.forEach((t, i) => t.el.classList.toggle('loop', i >= loop.a && i <= loop.b && t.r === 0));
    toast(`Looping “${s.sections[si].name}”. Press play.`, 'info', 1800);
  };
  const showNowNext = i => {
    nowEl.innerHTML = '';
    const cur = timeline[i], nxt = timeline[i + 1] || (loop ? timeline[loop.a] : null);
    if (!cur) return;
    nowEl.append(h('div', { class: 'nn now' }, h('small', {}, 'NOW'), ...cur.chords.map(c => chordEl(c, { size: 110 }))), nxt ? h('div', { class: 'nn next' }, h('small', {}, 'NEXT'), chordEl(nxt.chords[0], { size: 80 })) : null);
  };
  const barAt = t => Math.floor((t - seqStart) / barDur);
  const onSched = e => {
    const { t, beat } = e.detail;
    if (beat < meterBeats) return; // count-in
    if ((beat - meterBeats) % meterBeats !== 0) return;
    const n = (beat - meterBeats) / meterBeats;
    const i = loop ? loop.a + (n % (loop.b - loop.a + 1)) : n;
    const bar = timeline[i]; if (!bar) return;
    if (backing.checked) {
      const slotDur = barDur / pattern.length;
      [...pattern].forEach((sl, k) => {
        const chord = bar.chords[Math.min(bar.chords.length - 1, Math.floor(k / pattern.length * bar.chords.length))];
        const when = t + k * slotDur;
        if (sl === 'D' || sl === 'U') strum(chord, { when, dir: sl, vel: (k % 2 ? 0.35 : 0.55), muted: s.strum === 'rock' });
        else if (sl !== '-') { const sh = getShape(chord); if (!sh) return; const si = sl === 'B' ? sh.frets.findIndex(f => f >= 0) : 6 - Number(sl); if (sh.frets[si] >= 0) playNote(STANDARD[si] + sh.frets[si], { when, vel: sl === 'B' ? 0.6 : 0.4 }); }
      });
    }
  };
  const onBeat = e => {
    const { beat, beatInBar } = e.detail;
    if (beat < meterBeats) { nowEl.dataset.count = meterBeats - beat; return; }
    delete nowEl.dataset.count;
    if (beatInBar !== 0 && meterBeats !== 2) return;
    if ((beat - meterBeats) % meterBeats !== 0) return;
    const n = (beat - meterBeats) / meterBeats;
    const i = loop ? loop.a + (n % (loop.b - loop.a + 1)) : n;
    if (!loop && i >= timeline.length) return finish();
    if (idx >= 0) closeBar(idx);
    idx = i; timeline.forEach(t => t.el.classList.remove('now')); timeline[i]?.el.classList.add('now');
    timeline[i]?.el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    showNowNext(i);
  };
  const onFrame = () => {
    if (!playing || !scoring.checked || idx < 0) return;
    const bar = timeline[idx]; if (!bar) return;
    const loud = ears.db > ears.gateDb + 3;
    const pos = ((ears.ctx.currentTime - seqStart) / barDur) % 1;
    const chord = bar.chords[Math.min(bar.chords.length - 1, Math.floor(pos * bar.chords.length))];
    const r = loud ? recognize(ears.chroma, [chord, ...chords.filter(c => c !== chord)]) : null;
    barSamples.push(loud ? (r.name === chord ? 1 : 0.15) : 0);
  };
  const closeBar = i => {
    if (!scoring.checked || !barSamples.length) { barSamples = []; return; }
    const v = barSamples.reduce((a, b) => a + b, 0) / barSamples.length;
    const sc = Math.min(1, v / 0.6);
    barScores.push({ i, sc }); barSamples = [];
    const el = timeline[i].el; el.classList.remove('s-good', 's-mid', 's-bad'); el.classList.add(sc > 0.75 ? 's-good' : sc > 0.45 ? 's-mid' : 's-bad');
  };
  const start = async () => {
    if (playing) return stop();
    if (scoring.checked) await app.micOn();
    playing = true; playBtn.textContent = '■ Stop'; barScores = []; idx = -1; summary.hidden = true;
    timeline.forEach(t => t.el.classList.remove('s-good', 's-mid', 's-bad'));
    const bpm = (s.bpm || 90) * tempoPct / 100;
    metronome.beatsPerBar = meterBeats; metronome.volume = clickOn.checked ? store.get().settings.metronomeVol : 0;
    metronome.addEventListener('schedule', onSched); metronome.addEventListener('beat', onBeat);
    await metronome.start(bpm);
    barDur = metronome.spb * meterBeats; seqStart = metronome.startTime + barDur;
  };
  const stop = () => {
    playing = false; playBtn.textContent = '▶ Play along';
    metronome.stop(); metronome.beatsPerBar = 4; metronome.volume = store.get().settings.metronomeVol;
    metronome.removeEventListener('schedule', onSched); metronome.removeEventListener('beat', onBeat);
    timeline.forEach(t => t.el.classList.remove('now'));
  };
  const finish = () => {
    if (idx >= 0) closeBar(idx);
    stop();
    if (!barScores.length) return;
    const avg = barScores.reduce((a, b) => a + b.sc, 0) / barScores.length;
    const weak = barScores.filter(b => b.sc < 0.45).map(b => timeline[b.i]);
    const weakChords = [...new Set(weak.flatMap(w => w.chords))];
    store.record('song:' + s.id, avg, { tempo: tempoPct });
    let msg;
    if (avg >= 0.85) { const nt = Math.min(120, tempoPct + 5); store.get().bests['tempo:' + s.id] = nt; store.save(); msg = `${Math.round(avg * 100)} percent at ${tempoPct}% speed. Huge. Next run I am bumping you to ${nt}%.`; }
    else if (avg >= 0.6) msg = `${Math.round(avg * 100)} percent. Right in the learning zone.${weakChords.length ? ` The changes into ${weakChords.map(prettyChord).join(' and ')} are where it slips. Loop those bars.` : ''}`;
    else { const nt = Math.max(40, tempoPct - 10); store.get().bests['tempo:' + s.id] = nt; store.save(); msg = `${Math.round(avg * 100)} percent. Let's drop to ${nt}% and nail it.${weakChords.length ? ` Drill ${weakChords.slice(0, 2).map(prettyChord).join(' to ')} first.` : ''}`; }
    summary.hidden = false; summary.innerHTML = '';
    summary.append(h('div', { class: 'result-card ' + (avg >= 0.85 ? 'good' : avg >= 0.6 ? 'mid' : 'bad') }, h('div', { class: 'big' }, Math.round(avg * 100) + '%'), h('p', {}, msg),
      h('div', { class: 'row' }, h('button', { class: 'btn ghost', onclick: () => app.go(location.hash) }, '↻ Again'),
        weakChords.length >= 2 ? h('a', { class: 'btn ghost', href: '#/lesson/' + encodeURIComponent(`change:${weakChords[0]}-${weakChords[1]}`) }, `Drill ${prettyChord(weakChords[0])} ↔ ${prettyChord(weakChords[1])}`) : null,
        lessonMode ? h('button', { class: 'btn', onclick: () => app.nextInPlan() || app.go('#/path') }, 'Next →') : null)));
    if (avg >= 0.85) app.avatar?.mood('happy');
    coach.say(msg);
  };
  playBtn.onclick = start;
  app.ctl = { start, stop, repeat: () => { stop(); start(); }, tempo: f => { tempoIn.value = Math.round(tempoPct * (1 + f) / 5) * 5; updTempo(); }, next: () => app.nextInPlan(), describe: () => ({ song: s.title, playing, tempoPct, currentBar: idx, lastScores: barScores.slice(-8) }) };
  ears.addEventListener('frame', onFrame);
  showNowNext(0);
  return () => { stop(); ears.removeEventListener('frame', onFrame); };
}
