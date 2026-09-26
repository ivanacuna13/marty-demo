// Marty demo player: every scene/command is a pre-rendered film; directing = choosing which one plays.
const $ = s => document.querySelector(s);
const vid = $('#vid');
const store = { get(k) { try { return localStorage.getItem('marty.' + k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem('marty.' + k, v); } catch (e) {} } };
const STARTERS = [['Try a street vlog', 'street', 0], ['Try a podcast', 'podcast', 0], ['Watch the drone', 'interview', 2], ['Morning run', 'run', 0]];
let index = null, scene = null, cur = null;

const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function el(tag, attrs = {}, text = '') { const e = document.createElement(tag); Object.assign(e, attrs); if (text) e.textContent = text; return e; }

async function boot() {
  index = await fetch('video/index.json').then(r => r.json()).catch(() => ({ scenes: [] }));
  const nav = $('#scenes');
  index.scenes.forEach(s => { const b = el('button', { type: 'button' }, s.name); b.dataset.id = s.id; b.onclick = () => pick(s.id, firstReady(s), true); nav.appendChild(b); });
  refreshReady();
  const h = new URLSearchParams(location.hash.slice(1));
  pick(h.get('scene') || 'street', +(h.get('cmd') || 0), false);
  if (index.scenes.some(x => x.videos.some(v => !v.file))) setInterval(poll, 45000);
  $('#bigPlay').onclick = () => { $('#bigPlay').hidden = true; vid.muted = false; vid.play(); store.set('seenIntro', '1'); };
  $('#play').onclick = () => { $('#bigPlay').hidden = true; vid.paused ? vid.play() : vid.pause(); };
  $('#mute').onclick = () => { vid.muted = !vid.muted; $('#mute').textContent = vid.muted ? '🔇' : '🔊'; };
  vid.onplay = () => { $('#play').textContent = '❚❚'; $('#end').hidden = true; };
  vid.onpause = () => { $('#play').textContent = '▶'; };
  vid.onended = () => showEnd();
  vid.ontimeupdate = tick; vid.onclick = () => $('#play').click();
  const ch = $('#chapters'); let drag = false;
  const seek = e => { const r = ch.getBoundingClientRect(); const x = Math.max(0, Math.min(1, ((e.touches ? e.touches[0] : e).clientX - r.left) / r.width)); vid.currentTime = posToTime(x); tick(); };
  ch.addEventListener('pointerdown', e => { drag = true; ch.setPointerCapture(e.pointerId); seek(e); });
  ch.addEventListener('pointermove', e => { if (drag) seek(e); });
  ch.addEventListener('pointerup', () => { drag = false; });
  document.addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); $('#play').click(); } });
  const starters = $('#starters');
  STARTERS.forEach(([label, s, c]) => { if (!find(s, c)) return; const b = el('button', { type: 'button' }, label); b.onclick = () => pick(s, c, true); starters.appendChild(b); });
}
function find(sid, cmd) { const s = index.scenes.find(x => x.id === sid); return s && s.videos.find(v => v.cmd === cmd && v.file); }
const firstReady = s => (s.videos.find(v => v.file) || s.videos[0]).cmd;
function refreshReady() { document.querySelectorAll('#scenes button').forEach(b => { const s = index.scenes.find(x => x.id === b.dataset.id); b.classList.toggle('not-ready', !s.videos.some(v => v.file)); }); }
// films still rendering (local preview): check again shortly
async function poll() {
  const fresh = await fetch('video/index.json', { cache: 'no-store' }).then(r => r.json()).catch(() => null); if (!fresh) return;
  index = fresh; refreshReady(); if (!cur?.file) { const v = index.scenes.find(x => x.id === scene.id)?.videos.find(x => x.cmd === cur.cmd); if (v?.file) pick(scene.id, v.cmd, false); } else pick(scene.id, cur.cmd, null);
}
function pick(sid, cmd, autoplay) {
  scene = index.scenes.find(x => x.id === sid) || index.scenes[0]; if (!scene) return;
  const next = scene.videos.find(v => v.cmd === cmd) || scene.videos[0];
  const same = cur && next.file && cur.file === next.file; cur = next;
  document.querySelectorAll('#scenes button').forEach(b => b.setAttribute('aria-pressed', b.dataset.id === scene.id));
  document.querySelector('#scenes [aria-pressed="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  const cmds = $('#cmds'); cmds.innerHTML = '';
  scene.videos.forEach(v => { const b = el('button', { type: 'button' }, '“' + v.say + '”' + (v.file ? '' : '  · rendering…')); b.disabled = !v.file; b.setAttribute('aria-pressed', v === cur); b.onclick = () => pick(scene.id, v.cmd, true); cmds.appendChild(b); });
  history.replaceState(null, '', `#scene=${scene.id}&cmd=${cur.cmd}`);
  if (autoplay === null && same) return;          // index refresh: keep playing
  if (!cur.file) { vid.removeAttribute('src'); vid.load(); vid.poster = ''; $('#bigPlay').hidden = true; $('#end').hidden = true; $('#pending').hidden = false; $('#chapters').innerHTML = ''; clearTimeout(poll.t); poll.t = setTimeout(poll, 20000); return; }
  $('#pending').hidden = true;
  vid.src = 'video/' + cur.file; vid.poster = 'video/' + cur.poster;
  buildChapters(); $('#end').hidden = true;
  if (autoplay) { $('#bigPlay').hidden = true; vid.muted = false; vid.play().catch(() => { $('#bigPlay').hidden = false; }); }
  else $('#bigPlay').hidden = false;
}
// chapters get equal-ish widths so short beats (upload, post) stay tappable; time maps piecewise
function chapterSpans() {
  const C = cur.chapters.map(c => c.t), end = cur.dur; const spans = C.map((t, i) => [t, i + 1 < C.length ? C[i + 1] : end]);
  const wts = spans.map(([a, b]) => Math.max(0.12, Math.sqrt(b - a))); const tot = wts.reduce((x, y) => x + y, 0);
  let acc = 0; return spans.map(([a, b], i) => { const w = wts[i] / tot; const r = { a, b, x0: acc, w }; acc += w; return r; });
}
function posToTime(x) { for (const s of chapterSpans()) if (x <= s.x0 + s.w + 1e-6) return s.a + (s.b - s.a) * Math.max(0, (x - s.x0) / s.w); return cur.dur; }
function buildChapters() {
  const ch = $('#chapters'); ch.innerHTML = '';
  chapterSpans().forEach((s, i) => {
    const d = el('div', { className: 'chap' }); d.style.flex = `0 0 calc(${(s.w * 100).toFixed(2)}% - 4px)`; d.appendChild(el('i'));
    const l = el('span', { className: 'chap-l' }, cur.chapters[i].name); l.style.left = (s.x0 * 100).toFixed(2) + '%';
    ch.append(d, l);
  });
}
function tick() {
  const t = vid.currentTime; $('#time').textContent = fmt(t);
  const spans = chapterSpans(), bars = document.querySelectorAll('.chap i'), labels = document.querySelectorAll('.chap-l');
  spans.forEach((s, i) => { const f = Math.max(0, Math.min(1, (t - s.a) / Math.max(0.01, s.b - s.a))); bars[i].style.width = f * 100 + '%'; labels[i].classList.toggle('on', t >= s.a && t < s.b); });
}
function showEnd() { $('#end').hidden = false; }

boot();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
