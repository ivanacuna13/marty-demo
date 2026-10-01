// UI helpers: DOM builder, SVG chord diagrams, tab rendering, the Axel avatar (eyes follow your hands, mouth moves when he talks).
import { getShape, STRING_LABELS, prettyChord } from './theory.js';

export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return e;
}
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export function svg(markup) { const t = document.createElement('template'); t.innerHTML = markup.trim(); return t.content.firstChild; }

export function toast(msg, kind = 'info', ms = 3200) {
  const t = h('div', { class: `toast ${kind}`, role: 'status' }, msg);
  $('#toasts').append(t); setTimeout(() => t.classList.add('out'), ms); setTimeout(() => t.remove(), ms + 400);
}

// Chord diagram (vertical, nut at top). opts.size = width px.
export function chordSVG(sym, { size = 120, showName = true, highlightStrings = [], capo = 0 } = {}) {
  const sh = typeof sym === 'string' ? getShape(sym) : sym;
  const name = typeof sym === 'string' ? sym : sh?.name;
  if (!sh) return `<svg viewBox="0 0 100 120" width="${size}" class="chord-svg"><text x="50" y="60" text-anchor="middle" class="cd-name">${name}</text></svg>`;
  const fretted = sh.frets.filter(f => f > 0);
  const minF = fretted.length ? Math.min(...fretted) : 1, maxF = fretted.length ? Math.max(...fretted) : 1;
  const start = maxF > 4 ? minF : 1, rows = Math.max(4, maxF - start + 1);
  const W = 100, top = showName ? 40 : 18, left = 14, gap = (W - left * 2) / 5, fh = 17, H = top + rows * fh + 22;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${size}" class="chord-svg" role="img" aria-label="${name} chord diagram">`;
  if (showName) s += `<text x="${W / 2}" y="15" text-anchor="middle" class="cd-name">${prettyChord(name)}</text>`;
  if (start === 1) s += `<rect x="${left - 1}" y="${top - 4}" width="${gap * 5 + 2}" height="4" class="cd-nut"/>`;
  else s += `<text x="${left - 4}" y="${top + fh * 0.7}" text-anchor="end" class="cd-pos">${start}</text>`;
  for (let r = 0; r <= rows; r++) s += `<line x1="${left}" x2="${left + gap * 5}" y1="${top + r * fh}" y2="${top + r * fh}" class="cd-fret"/>`;
  for (let i = 0; i < 6; i++) s += `<line x1="${left + i * gap}" x2="${left + i * gap}" y1="${top}" y2="${top + rows * fh}" class="cd-string ${highlightStrings.includes(i) ? 'hl' : ''}"/>`;
  if (sh.barre && sh.barre.fret >= start) {
    const y = top + (sh.barre.fret - start + 0.5) * fh;
    s += `<rect x="${left + sh.barre.from * gap - 6}" y="${y - 6}" width="${(sh.barre.to - sh.barre.from) * gap + 12}" height="12" rx="6" class="cd-barre"/>`;
  }
  sh.frets.forEach((f, i) => {
    const x = left + i * gap;
    if (f < 0) s += `<text x="${x}" y="${top - 8}" text-anchor="middle" class="cd-x">×</text>`;
    else if (f === 0) s += `<circle cx="${x}" cy="${top - 11}" r="4" class="cd-open"/>`;
    else {
      const y = top + (f - start + 0.5) * fh;
      const fing = sh.fingers?.[i];
      s += `<circle cx="${x}" cy="${y}" r="7" class="cd-dot f${fing}"/>`;
      if (fing) s += `<text x="${x}" y="${y + 3.5}" text-anchor="middle" class="cd-finger">${fing}</text>`;
    }
  });
  s += `<text x="${W / 2}" y="${H - 4}" text-anchor="middle" class="cd-strings">${STRING_LABELS.join(' ')}</text></svg>`;
  return s;
}
export const chordEl = (sym, opts) => svg(chordSVG(sym, opts));

// Horizontal tab with an optional highlighted index.
export function tabEl(positions, { active = -1, labels = null } = {}) {
  const wrap = h('div', { class: 'tab' });
  const cols = positions.map((p, i) => h('div', { class: 'tab-col' + (i === active ? ' active' : '') + (i < active ? ' done' : ''), 'data-i': i },
    ...[5, 4, 3, 2, 1, 0].map(s => h('span', { class: 'tab-cell' + (p && p.s === s ? ' note' : '') }, p && p.s === s ? String(p.f) : '')),
    labels ? h('small', {}, labels[i] || '') : null));
  wrap.append(h('div', { class: 'tab-strings' }, ...['e', 'B', 'G', 'D', 'A', 'E'].map(x => h('span', {}, x))), ...cols);
  return wrap;
}

// ---- Axel avatar ----
export function avatarEl(size = 120) {
  const el = svg(`
<svg class="axel" viewBox="0 0 200 200" width="${size}" height="${size}" aria-label="Axel, your guitar coach">
  <defs>
    <radialGradient id="axSkin" cx="45%" cy="35%" r="70%"><stop offset="0%" stop-color="#ffd27a"/><stop offset="100%" stop-color="#e08a1e"/></radialGradient>
    <linearGradient id="axBand" x1="0" x2="1"><stop offset="0" stop-color="#d7263d"/><stop offset="1" stop-color="#9e1b2c"/></linearGradient>
  </defs>
  <g class="ax-ring"><circle cx="100" cy="104" r="92" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 10" opacity=".55"/></g>
  <!-- guitar-pick head -->
  <path class="ax-head" d="M100 18 C150 18 182 44 182 86 C182 132 132 176 100 190 C68 176 18 132 18 86 C18 44 50 18 100 18 Z" fill="url(#axSkin)" stroke="#2a1606" stroke-width="3"/>
  <!-- headband (fight camp) -->
  <path d="M24 70 C60 52 140 52 176 70 L178 86 C140 70 60 70 22 86 Z" fill="url(#axBand)"/>
  <path d="M176 74 l18 -6 l-6 16 z M176 80 l20 6 l-14 8 z" fill="#d7263d"/>
  <g class="ax-brows"><path class="ax-brow l" d="M52 92 q16 -9 32 -2" stroke="#2a1606" stroke-width="6" fill="none" stroke-linecap="round"/><path class="ax-brow r" d="M116 90 q16 -7 32 2" stroke="#2a1606" stroke-width="6" fill="none" stroke-linecap="round"/></g>
  <g class="ax-eyes">
    <g class="ax-eye l"><ellipse cx="68" cy="112" rx="15" ry="16" fill="#fff"/><circle class="ax-pupil" cx="68" cy="112" r="7.5" fill="#1b0f05"/><circle class="ax-glint" cx="71" cy="108" r="2.4" fill="#fff"/><rect class="ax-lid" x="50" y="94" width="36" height="0" fill="#e9a043"/></g>
    <g class="ax-eye r"><ellipse cx="132" cy="112" rx="15" ry="16" fill="#fff"/><circle class="ax-pupil" cx="132" cy="112" r="7.5" fill="#1b0f05"/><circle class="ax-glint" cx="135" cy="108" r="2.4" fill="#fff"/><rect class="ax-lid" x="114" y="94" width="36" height="0" fill="#e9a043"/></g>
  </g>
  <path class="ax-mouth" d="M78 148 Q100 160 122 148 Q100 152 78 148 Z" fill="#5a1a10" stroke="#2a1606" stroke-width="3" stroke-linejoin="round"/>
  <g class="ax-ears"><path d="M14 104 q-10 8 0 18" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M186 104 q10 8 0 18" stroke="currentColor" stroke-width="4" fill="none" stroke-linecap="round"/></g>
</svg>`);
  const pupils = el.querySelectorAll('.ax-pupil'), glints = el.querySelectorAll('.ax-glint'), lids = el.querySelectorAll('.ax-lid'), mouth = el.querySelector('.ax-mouth');
  let gx = 0, gy = 0, tx = 0, ty = 0, open = 0, targetOpen = 0, mood = 'idle';
  const api = {
    el,
    look(x, y) { tx = Math.max(-1, Math.min(1, x)); ty = Math.max(-1, Math.min(1, y)); }, // -1..1
    syllable() { targetOpen = 0.5 + Math.random() * 0.5; setTimeout(() => { targetOpen = 0.1; }, 90); },
    speaking(v) { el.classList.toggle('speaking', v); if (!v) targetOpen = 0; },
    listening(v) { el.classList.toggle('listening', v); },
    mood(m) { mood = m; el.dataset.mood = m; clearTimeout(api._mt); if (m !== 'idle') api._mt = setTimeout(() => api.mood('idle'), 2600); },
  };
  const blink = () => { el.classList.add('blink'); setTimeout(() => el.classList.remove('blink'), 130); setTimeout(blink, 2200 + Math.random() * 4000); };
  setTimeout(blink, 1800);
  // idle saccades when nobody is in view
  setInterval(() => { if (!api._tracking) api.look((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.6); }, 2600);
  const tick = () => {
    if (!el.isConnected) { requestAnimationFrame(tick); return; }
    gx += (tx - gx) * 0.18; gy += (ty - gy) * 0.18; open += (targetOpen - open) * 0.35;
    pupils.forEach((p, i) => { const cx = i ? 132 : 68; p.setAttribute('cx', cx + gx * 6.5); p.setAttribute('cy', 112 + gy * 6.5); });
    glints.forEach((p, i) => { const cx = (i ? 132 : 68) + 3; p.setAttribute('cx', cx + gx * 6.5); p.setAttribute('cy', 108 + gy * 6.5); });
    const smile = mood === 'happy' ? 12 : mood === 'focus' ? 2 : 6;
    const o = open * 18;
    mouth.setAttribute('d', `M78 148 Q100 ${148 + smile + o} 122 148 Q100 ${150 + o * 0.25} 78 148 Z`);
    requestAnimationFrame(tick);
  };
  tick();
  return api;
}

export function meter(label, cls = '') {
  const fill = h('i'); const val = h('b', {}, '–');
  const el = h('div', { class: 'meter ' + cls }, h('span', {}, label), h('div', { class: 'mbar' }, fill), val);
  return { el, set(v, text) { fill.style.width = Math.max(0, Math.min(100, v * 100)) + '%'; val.textContent = text ?? Math.round(v * 100) + '%'; el.classList.toggle('good', v >= 0.8); el.classList.toggle('mid', v >= 0.5 && v < 0.8); } };
}

export function modal(title, body, actions = []) {
  const onKey = e => { if (e.key === 'Escape') close(); };
  const close = () => { back.remove(); window.removeEventListener('hashchange', close); window.removeEventListener('keydown', onKey); };
  window.addEventListener('hashchange', close); window.addEventListener('keydown', onKey);
  const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) close(); } },
    h('div', { class: 'modal', role: 'dialog', 'aria-label': title },
      h('header', {}, h('h3', {}, title), h('button', { class: 'icon-btn', onclick: close, 'aria-label': 'Close' }, '✕')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('footer', {}, ...actions.map(([label, fn, cls]) => h('button', { class: 'btn ' + (cls || ''), onclick: () => { if (fn() !== false) close(); } }, label))) : null));
  document.body.append(back);
  return { close, el: back };
}

export const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const stars = n => '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n));
