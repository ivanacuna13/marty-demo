// Progress, Settings, and The Method (the research behind how Axel teaches).
import * as store from './store.js';
import { ears } from './audio.js';
import { coach } from './coach.js';
import { metronome, setVolume } from './synth.js';
import { h, toast, modal, stars } from './ui.js';
import { lessonById } from './lessons.js';
import { allSongs, playable } from './songs.js';

export async function progressView(root) {
  const st = store.get();
  const days = []; for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10); days.push({ d, m: st.sessions.find(s => s.d === d)?.minutes || 0 }); }
  const max = Math.max(15, ...days.map(d => d.m));
  const skills = Object.entries(st.skills).sort((a, b) => b[1].level - a[1].level);
  const known = skills.filter(([k, v]) => k.startsWith('chord:') && v.level >= 2).map(([k]) => k.slice(6));
  const songs = allSongs(st.userSongs).filter(s => !s.decodeOnly);
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Your Progress'), h('p', {}, 'Proof that it\'s working.')),
    h('div', { class: 'card stat-row' }, stat('🔥 ' + st.streak.count, 'day streak'), stat(days.reduce((a, d) => a + d.m, 0), 'minutes · 14 days'), stat(known.length, 'chords owned'), stat(songs.filter(s => playable(s, known)).length, 'songs playable')),
    h('div', { class: 'card' }, h('h3', {}, 'Practice minutes (last 14 days)'),
      h('div', { class: 'bars-chart', role: 'img', 'aria-label': 'Practice minutes per day' }, ...days.map(d => h('div', { class: 'bc', title: `${d.d}: ${d.m} min` }, h('i', { style: { height: (d.m / max * 100) + '%' } }), h('small', {}, d.d.slice(8))))),
      h('p', { class: 'muted small' }, 'Minutes count while the mic or metronome is running. Short and daily beats long and rare.')),
    h('div', { class: 'card' }, h('h3', {}, 'One-Minute Change records'),
      Object.keys(st.bests).filter(k => k.startsWith('change:')).length
        ? h('div', { class: 'chips static' }, ...Object.entries(st.bests).filter(([k]) => k.startsWith('change:')).map(([k, v]) => h('span', { class: 'chip' }, `${k.slice(7).replace('-', ' ↔ ')}: `, h('b', {}, v))))
        : h('p', { class: 'muted' }, 'No records yet. Do a One-Minute Changes drill.')),
    h('div', { class: 'card' }, h('h3', {}, 'Skills'),
      skills.length ? h('table', { class: 'skills' }, h('tr', {}, h('th', {}, 'Skill'), h('th', {}, 'Mastery'), h('th', {}, 'Last'), h('th', {}, 'Next review')),
        ...skills.map(([id, s]) => h('tr', {}, h('td', {}, lessonById(id)?.title || id), h('td', { class: 'stars' }, stars(s.level)), h('td', {}, Math.round((s.history[s.history.length - 1]?.score || 0) * 100) + '%'), h('td', {}, s.due <= Date.now() ? 'due now' : new Date(s.due).toLocaleDateString()))))
        : h('p', { class: 'muted' }, 'Start a lesson and your skills appear here.')));
}
const stat = (n, l) => h('div', { class: 'stat' }, h('b', {}, n), h('small', {}, l));

export async function settingsView(root, _, app) {
  const st = store.get(); const s = st.settings;
  const field = (label, input, help) => h('label', { class: 'field' }, h('span', {}, label), input, help ? h('small', {}, help) : null);
  const bind = (el, path, cast = v => v) => { el.addEventListener('change', () => store.set(path, cast(el.type === 'checkbox' ? el.checked : el.value))); return el; };
  const voices = h('select', {}, h('option', { value: '' }, 'Auto (best available)'), ...coach.voices.filter(v => /^en/i.test(v.lang)).map(v => h('option', { value: v.name, selected: v.name === s.voice || undefined }, `${v.name} (${v.lang})`)));
  const sens = h('input', { type: 'range', min: 0.2, max: 1, step: 0.05, value: s.sensitivity });
  sens.oninput = () => { store.set('settings.sensitivity', +sens.value); ears.setSensitivity(+sens.value); };
  const mvol = h('input', { type: 'range', min: 0, max: 1, step: 0.05, value: s.metronomeVol });
  mvol.oninput = () => { store.set('settings.metronomeVol', +mvol.value); metronome.volume = +mvol.value; };
  const calib = h('button', { class: 'btn ghost', onclick: async () => {
    if (!(await app.micOn())) return; calib.disabled = true; calib.textContent = 'Stay quiet… 3s';
    const vals = []; const f = () => vals.push(ears.db); ears.addEventListener('frame', f);
    setTimeout(() => { ears.removeEventListener('frame', f); vals.sort((a, b) => a - b); const noise = vals[Math.floor(vals.length * 0.9)] || -60; ears.gateDb = Math.min(-30, noise + 8); store.set('settings.gateDb', ears.gateDb); calib.disabled = false; calib.textContent = `Noise gate set to ${Math.round(ears.gateDb)} dB ✓`; }, 3000);
  } }, 'Calibrate room noise');
  if (s.gateDb) ears.gateDb = s.gateDb;
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),
    h('div', { class: 'card stack' }, h('h3', {}, 'You'),
      field('Name', bind(h('input', { type: 'text', value: st.profile.name }), 'profile.name')),
      field('Daily minutes', bind(h('select', {}, ...[10, 15, 20, 30, 45].map(m => h('option', { value: m, selected: m === st.profile.minutesPerDay || undefined }, m + ' min'))), 'profile.minutesPerDay', Number)),
      h('label', { class: 'switch' }, bind(h('input', { type: 'checkbox', checked: st.profile.leftHanded || undefined }), 'profile.leftHanded'), ' Left-handed (flips which hand the camera treats as the fretting hand)')),
    h('div', { class: 'card stack' }, h('h3', {}, "Axel's voice"),
      field('Voice', bind(voices, 'settings.voice')),
      field('Speed', bind(h('input', { type: 'range', min: 0.7, max: 1.4, step: 0.05, value: s.rate }), 'settings.rate', Number)),
      field('How much he talks', bind(h('select', {}, ...[[0, 'Silent (text only)'], [1, 'Just results'], [2, 'Full coaching'], [3, 'Hype man']].map(([v, l]) => h('option', { value: v, selected: +v === +s.talkative || undefined }, l))), 'settings.talkative', Number)),
      h('label', { class: 'switch' }, bind(h('input', { type: 'checkbox', checked: s.wakeWord || undefined }), 'settings.wakeWord'), ' Wake word: only respond after "Axel…"'),
      h('button', { class: 'btn ghost', onclick: () => coach.say("Yo! This is how I sound. Now go get that G chord ringing.") }, '🔊 Test voice')),
    h('div', { class: 'card stack' }, h('h3', {}, 'Ears & timing'), field('Strum detection sensitivity', sens), field('Metronome volume', mvol), calib),
    h('div', { class: 'card stack' }, h('h3', {}, '🧠 Superpowers (optional API keys)'),
      h('p', { class: 'muted small' }, 'Keys are stored only in this browser (localStorage) and sent only to that provider, straight from your browser. Use a key with a spending limit, and don\'t use these on a shared computer.'),
      field('Claude API key: full conversation, song charts on demand, coaching that reads your live sensor data', bind(h('input', { type: 'password', value: s.claudeKey, placeholder: 'sk-ant-…', autocomplete: 'off' }), 'settings.claudeKey', v => v.trim()), h('a', { href: 'https://console.anthropic.com/settings/keys', target: '_blank', rel: 'noopener' }, 'Get a key at console.anthropic.com')),
      field('ElevenLabs API key: a studio-quality voice for Axel', bind(h('input', { type: 'password', value: s.elevenKey, placeholder: 'optional', autocomplete: 'off' }), 'settings.elevenKey', v => v.trim())),
      field('ElevenLabs voice ID', bind(h('input', { type: 'text', value: s.elevenVoice, placeholder: 'leave blank for default' }), 'settings.elevenVoice', v => v.trim()))),
    h('div', { class: 'card stack' }, h('h3', {}, 'Your data'),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn ghost', onclick: () => { const st2 = { ...store.get(), settings: { ...store.get().settings, claudeKey: '', elevenKey: '' } }; const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(st2, null, 1)], { type: 'application/json' })), download: 'axel-progress.json' }); a.click(); } }, '⬇ Export progress'),
        h('label', { class: 'btn ghost' }, '⬆ Import progress', h('input', { type: 'file', accept: 'application/json', hidden: true, onchange: async e => { try { const d = JSON.parse(await e.target.files[0].text()); const keep = store.get().settings; Object.assign(store.get(), d, { settings: { ...d.settings, claudeKey: keep.claudeKey, elevenKey: keep.elevenKey } }); store.save(); toast('Progress imported', 'good'); } catch (err) { toast('Bad file', 'bad'); } } })),
        h('button', { class: 'btn danger', onclick: () => modal('Reset everything?', h('p', {}, 'This erases your progress, songs and settings on this device.'), [['Erase', () => { store.reset(); location.hash = '#/'; location.reload(); }, 'danger'], ['Cancel', () => {}]]) }, 'Reset'))));
}

export async function methodView(root) {
  const src = (t, u) => h('a', { href: u, target: '_blank', rel: 'noopener' }, t);
  root.append(
    h('header', { class: 'page-head' }, h('h1', {}, 'The Method'), h('p', {}, 'How Axel teaches, and why. Built from what the best teachers and apps do, plus the learning science behind motor skills.')),
    h('div', { class: 'card' }, h('h3', {}, '1 · Song-first, 80/20 order'),
      h('p', {}, 'Across roughly 680,000 songs on Ultimate Guitar, G and C alone make up about a quarter of all chords played. G, C, D, Em and Am, plus a capo, cover a huge share of pop, rock and folk. So you get a two-chord song on day one, then the "four-chord universe", then rhythm, then riffs and power chords, then fingerpicking, then barre chords. Every stage ends with a real song.'),
      h('p', { class: 'muted small' }, 'Sources: ', src('Chordonomicon analysis', 'https://www.cantgetmuchhigher.com/p/i-analyzed-chord-progressions-in'), ' · ', src('JustinGuitar Grade 1', 'https://www.justinguitar.com/classes/beginner-guitar-course-grade-one'), ' · ', src('Fender Play path', 'https://play-instructor.fender.com/hc/en-us/articles/12716412478605-My-Path'))),
    h('div', { class: 'card' }, h('h3', {}, '2 · One-Minute Changes'),
      h('p', {}, 'Count how many clean changes between two chords you make in 60 seconds, and log it daily. Around 30 per minute is "song ready". Axel counts them for you by ear, so you only have to play.'),
      h('p', { class: 'muted small' }, src('JustinGuitar: One Minute Changes', 'https://www.justinguitar.com/guitar-lessons/one-minute-changes-exercise-b1-110'))),
    h('div', { class: 'card' }, h('h3', {}, '3 · The ~85% sweet spot'),
      h('p', {}, 'Learning is fastest when you succeed most of the time but not always. Axel keeps you near 80–90%: above 90% the tempo goes up 5 bpm, below 70% it drops 10% and shrinks the chunk. (The research was on perceptual and machine learning; we use it as a difficulty dial, not a law of nature.)'),
      h('p', { class: 'muted small' }, src('Wilson et al., 2019, Nature Communications', 'https://www.nature.com/articles/s41467-019-12552-4'), ' · Rocksmith-style adaptive difficulty')),
    h('div', { class: 'card' }, h('h3', {}, '4 · Fix the exact spot'),
      h('p', {}, 'The best musicians find precisely where and why an error happens, slow down just before it, and fix that spot instead of replaying from the top. The song player scores every bar, shows you the red ones, and lets you loop them.'),
      h('p', { class: 'muted small' }, src('Duke, Simmons & Cash, 2009', 'https://journals.sagepub.com/doi/10.1177/0022429408328851'))),
    h('div', { class: 'card' }, h('h3', {}, '5 · Short, daily, then sleep'),
      h('p', {}, 'Motor skills keep improving overnight: in finger-sequence studies, people were 10–20% faster and more accurate the next day with no extra practice. Spaced sessions beat cramming. So Axel builds a 10–20 minute session daily and uses spaced repetition to bring skills back right before you\'d forget them.'),
      h('p', { class: 'muted small' }, src('Walker et al., 2002, Neuron', 'https://www.cell.com/fulltext/S0896-6273(02)00766-3'), ' · ', src('Simmons, 2012', 'https://eric.ed.gov/?id=EJ951332'))),
    h('div', { class: 'card' }, h('h3', {}, '6 · Block first, then mix'),
      h('p', {}, 'Repeat a brand-new chord on its own until it rings (blocked practice). Once it\'s stable, mix it with others (interleaving), which helps long-term retention. Today\'s session does both: new skills, then mixed review.'),
      h('p', { class: 'muted small' }, src('Shea & Morgan, 1979', 'https://gwern.net/doc/psychology/spaced-repetition/1979-shea.pdf'))),
    h('div', { class: 'card' }, h('h3', {}, '7 · How the AI senses you'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Pitch:'), ' YIN autocorrelation (de Cheveigné & Kawahara, 2002), used for the tuner, riffs and melodies.'),
        h('li', {}, h('b', {}, 'Chords:'), ' 12-bin chroma (pitch-class profile) matched against harmonic-aware chord templates. Because Axel knows which chord you should be playing, he checks that one directly, and finds the missing string by which notes are absent.'),
        h('li', {}, h('b', {}, 'Timing:'), ' a sample-accurate onset detector in an AudioWorklet, graded against the metronome grid.'),
        h('li', {}, h('b', {}, 'Hands:'), ' MediaPipe HandLandmarker (21 points per hand) for finger arch, wrist bend, stroke direction and gestures. Fret-exact finger checking needs fretboard detection, which is on the roadmap, so the ears verify the notes.'),
        h('li', {}, h('b', {}, 'Brain:'), ' Claude, with tools that drive the app and a live feed of what the sensors detect. An offline brain covers the basics with no key.'))),
    h('div', { class: 'card' }, h('h3', {}, 'Fixing the classic beginner problems'),
      h('ul', {},
        h('li', {}, h('b', {}, 'Sore fingertips:'), ' normal for 2–4 weeks. Short, daily sessions and the minimum pressure that stops the buzz.'),
        h('li', {}, h('b', {}, 'Buzzing:'), ' play on the tip, right behind the fret wire, with a relaxed thumb mid-neck.'),
        h('li', {}, h('b', {}, 'Slow changes:'), ' lift fingers as one shape, keep anchor fingers down, do "air changes" away from the guitar.'),
        h('li', {}, h('b', {}, 'Rhythm:'), ' your strumming hand is a pendulum that never stops; missed strings are "air strums".'))));
}
