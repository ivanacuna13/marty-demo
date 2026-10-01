// Home (today's session, built by the coach) and the Path (8 stages of 80/20 skills).
import * as store from './store.js';
import { coach } from './coach.js';
import { h, avatarEl, stars } from './ui.js';
import { STAGES, planToday, ALL_LESSONS } from './lessons.js';
import { allSongs, playable } from './songs.js';
import { IS_ARTIFACT } from './platform.js';

const ICON = { tune: '🎚', posture: '📷', chord: '✋', change: '⇄', strum: '↕', riff: '🎯', song: '🎸', ear: '👂', link: '🧠' };

export async function homeView(root, _, app) {
  const st = store.get();
  const plan = planToday(st, st.profile.minutesPerDay);
  const known = Object.entries(st.skills).filter(([k, v]) => k.startsWith('chord:') && v.level >= 2).map(([k]) => k.slice(6));
  const songs = allSongs(st.userSongs).filter(s => !s.decodeOnly);
  const canPlay = songs.filter(s => playable(s, known));
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening';
  const face = avatarEl(150);
  const total = plan.reduce((a, l) => a + (l.mins || 2), 0);
  root.append(
    h('section', { class: 'hero' },
      h('div', { class: 'hero-face' }, face.el),
      h('div', { class: 'hero-text' },
        h('small', { class: 'kicker' }, `${greet}${st.profile.name ? ', ' + st.profile.name : ''}${st.streak.count ? ` · 🔥 ${st.streak.count}-day streak` : ' · Day 1'}`),
        h('h1', {}, st.streak.count ? 'Back in the ring.' : 'Let\'s make you a guitar player.'),
        h('p', {}, `I built today's ${total}-minute session from what you know and what's due for review. We always finish on a real song.`),
        h('div', { class: 'row wrap' }, h('button', { class: 'btn big', onclick: () => { app.micOn(); coach.say('Let\'s go. Tune first.'); app.startPlan(plan); } }, "▶ Start today's session"), h('a', { class: 'btn ghost', href: '#/rocky' }, '🥊 Rocky Corner')))),
    h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', {}, "Today's session"), h('ol', { class: 'plan-list' }, ...plan.map((l, i) => h('li', {}, h('a', { href: l.type === 'link' ? l.href : '#/lesson/' + encodeURIComponent(l.id), onclick: () => { app.plan = plan; app.planIdx = i; } }, h('span', { class: 'ic' }, ICON[l.type] || '•'), h('span', {}, l.title), h('small', {}, `${l.why} · ${l.mins || 2} min`)))))),
      h('div', { class: 'stack' },
        h('div', { class: 'card stat-row' }, stat(known.length, 'chords owned'), stat(canPlay.length, 'songs playable'), stat(Object.values(st.skills).filter(s => s.level >= 4).length, 'skills mastered')),
        h('div', { class: 'card' }, h('h3', {}, 'Play something now'), h('div', { class: 'quick-songs' }, ...(canPlay.length ? canPlay.slice(0, 6) : songs.filter(s => s.diff <= 1).slice(0, 6)).map(s => h('a', { class: 'pill', href: '#/song/' + s.id }, s.title)))),
        h('div', { class: 'tiles' },
          tile('#/tuner', '🎚', 'Tuner'), tile('#/camera', '📷', 'Camera Coach'), tile('#/decoder', '🧠', 'Song Decoder'), tile('#/chords', '✋', 'Chord Finder'), tile('#/library', '📚', 'Library'), tile('#/method', '🔬', 'The Method')))),
    h('div', { class: 'card howto' }, h('h3', {}, 'How Axel coaches you'),
      h('div', { class: 'grid3' },
        ...(IS_ARTIFACT ? [
          feat('🎧 Ears', 'Load a voice memo or video of yourself playing and Axel hears every chord and strum: he grades your take against the song chart and your timing against the tempo.'),
          feat('📼 Eyes', 'Load a phone video and hand tracking checks finger arch and wrist angle and follows your strumming hand. Or snap one photo for a chord-shape check.'),
          feat('🗣 Voice', 'Ask anything in the coach box: "show me F", "add Tennessee Whiskey", "what should I practice?". He answers out loud with Claude built in.'),
        ] : [
          feat('👂 Ears', 'Hears every note and chord through your mic. He tells you which string is dead, scores your timing to the millisecond, and counts your chord changes.'),
          feat('👀 Eyes', 'Hand tracking checks finger arch and wrist angle, and follows your strumming hand. Thumbs-up = next, open palm = stop.'),
          feat('🗣 Voice', 'Say "Axel, show me F", "slower", "next", "open Wonderwall". With a Claude key he can talk about anything guitar.'),
        ]),
        feat('📈 Brain', 'Spaced repetition, a ~85% success sweet spot, and tempo that ramps itself. Short daily sessions, because sleep locks in skill.'))));
  face.look(0.4, 0.1);
  if (!st.profile.name) setTimeout(() => onboarding(app), 400);
}
const stat = (n, l) => h('div', { class: 'stat' }, h('b', {}, n), h('small', {}, l));
const tile = (href, ic, label) => h('a', { class: 'tile', href }, h('span', {}, ic), h('b', {}, label));
const feat = (t, d) => h('div', { class: 'feat' }, h('b', {}, t), h('p', {}, d));

function onboarding(app) {
  if (document.querySelector('.onboard')) return;
  const st = store.get();
  const name = h('input', { type: 'text', placeholder: 'What should I call you?' });
  const mins = h('select', {}, ...[10, 15, 20, 30].map(m => h('option', { value: m, selected: m === 15 || undefined }, `${m} min / day`)));
  const level = h('select', {}, h('option', { value: 'beginner' }, 'Total beginner'), h('option', { value: 'some' }, 'I know a few chords'), h('option', { value: 'intermediate' }, 'I play songs already'));
  const lefty = h('input', { type: 'checkbox' });
  const fav = h('input', { type: 'text', placeholder: 'Songs/artists you love (comma separated)', value: 'Rocky – Alone in the Ring' });
  const el = h('div', { class: 'onboard card' }, h('h2', {}, '🥊 Fight camp sign-up'), h('div', { class: 'stack' }, name, h('div', { class: 'row' }, mins, level), h('label', { class: 'switch' }, lefty, ' I play left-handed'), fav,
    h('button', { class: 'btn big', onclick: () => {
      st.profile.name = name.value.trim() || 'Champ'; st.profile.minutesPerDay = +mins.value; st.profile.level = level.value; st.profile.leftHanded = lefty.checked;
      st.profile.wishlist = fav.value.split(',').map(x => x.trim()).filter(Boolean);
      if (level.value !== 'beginner') ['G', 'C', 'D', 'Em', 'Am'].forEach(c => { st.skills['chord:' + c] = { level: level.value === 'intermediate' ? 3 : 2, ease: 2.5, interval: 3, due: Date.now() + 2 * 864e5, best: 0.9, history: [] }; });
      if (level.value === 'intermediate') st.stage = 2;
      store.save(); el.remove(); document.getElementById('hello').textContent = st.profile.name;
      coach.say(`Welcome to camp, ${st.profile.name}. ${st.profile.minutesPerDay} minutes a day is plenty. ${IS_ARTIFACT ? "Let's tune up." : "Turn on my ears and let's tune up."}`);
      app.go('#/');
    } }, "Let's go")));
  document.querySelector('#view').prepend(el);
}

export async function pathView(root, _, app) {
  const st = store.get();
  root.append(h('header', { class: 'page-head' }, h('h1', {}, 'The Path'), h('p', {}, 'Eight stages. Each one unlocks a real song at the end. The order follows the 80/20 rule: the fewest skills for the most music.')));
  STAGES.forEach((s, si) => {
    const done = s.lessons.filter(l => (st.skills[l.id]?.level || 0) >= 2).length;
    root.append(h('section', { class: 'stage card' + (done === s.lessons.length ? ' complete' : '') },
      h('div', { class: 'stage-head' }, h('div', {}, h('small', { class: 'kicker' }, `Stage ${si + 1} · ${done}/${s.lessons.length}`), h('h2', {}, s.title), h('p', { class: 'muted' }, s.tagline)), h('div', { class: 'reward' }, h('small', {}, 'Unlocks'), h('b', {}, '🎸 ' + s.reward))),
      h('div', { class: 'progress' }, h('i', { style: { width: (done / s.lessons.length * 100) + '%' } })),
      h('div', { class: 'lessons' }, ...s.lessons.map(l => {
        const lv = st.skills[l.id]?.level || 0;
        return h('a', { class: 'lesson-chip' + (lv >= 2 ? ' done' : ''), href: l.type === 'link' ? l.href : '#/lesson/' + encodeURIComponent(l.id) }, h('span', { class: 'ic' }, ICON[l.type] || '•'), h('span', {}, l.title), h('small', { class: 'lv', title: 'Mastery' }, stars(lv)));
      }))));
  });
}
