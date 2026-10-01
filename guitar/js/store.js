// Progress, spaced repetition, streaks, settings. Everything lives in this browser (localStorage), wrapped so private mode can't crash the app.
const KEY = 'axel.v1';
const defaults = () => ({
  profile: { name: '', goal: 'Play the songs I love', minutesPerDay: 15, level: 'beginner', leftHanded: false, favorites: ['rocky-alone-in-the-ring', 'eye-of-the-tiger'], artists: [] },
  settings: { voice: '', rate: 1.02, pitch: 0.95, talkative: 2, claudeKey: '', elevenKey: '', elevenVoice: '', wakeWord: true, metronomeVol: 0.6, sensitivity: 0.6 },
  skills: {},      // id -> { level 0..5, ease, interval(days), due(ts), best, history:[{t,score}] }
  bests: {},       // e.g. changes:Am-C -> 27
  sessions: [],    // {t, minutes, items}
  userSongs: [],   // imported or AI-generated songs
  streak: { count: 0, last: '' },
  stage: 0,
  seen: {},
});

let state;
try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { state = defaults(); }
state.profile = Object.assign(defaults().profile, state.profile);
state.settings = Object.assign(defaults().settings, state.settings);

const subs = new Set();
let remote = null, pushTimer = null;
export function save() {
  state.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  subs.forEach(f => f(state));
  if (remote) { clearTimeout(pushTimer); pushTimer = setTimeout(pushRemote, 2500); }
}
// Account sync (Claude artifact `db`): one private document per person. API keys never leave this browser.
const forRemote = () => ({ ...state, settings: { ...state.settings, claudeKey: '', elevenKey: '' } });
function pushRemote() { remote?.set({ json: JSON.stringify(forRemote()), updatedAt: state.updatedAt || Date.now() }).catch(e => console.warn('sync failed', e)); }
export async function attachRemote(docRef) {
  remote = docRef;
  try {
    const snap = await docRef.get();
    const d = snap.exists ? snap.data() : null;
    if (d?.json && (d.updatedAt || 0) > (state.updatedAt || 0)) {
      const keep = { claudeKey: state.settings.claudeKey, elevenKey: state.settings.elevenKey };
      const incoming = JSON.parse(d.json);
      state = Object.assign(defaults(), incoming);
      state.profile = Object.assign(defaults().profile, incoming.profile);
      state.settings = Object.assign(defaults().settings, incoming.settings, keep);
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      subs.forEach(f => f(state));
      return 'pulled';
    }
    pushRemote();
    return 'pushed';
  } catch (e) { console.warn('sync unavailable', e); remote = null; return 'off'; }
}
export const get = () => state;
export const onChange = f => { subs.add(f); return () => subs.delete(f); };
export function reset() { state = defaults(); save(); }

const DAY = 86400000;
const today = () => new Date().toISOString().slice(0, 10);

// Record a practice result for a skill. score: 0..1. Modified SM-2: good runs push the next review out, misses bring it back tomorrow.
export function record(id, score, extra = {}) {
  const s = state.skills[id] || { level: 0, ease: 2.3, interval: 0, due: 0, best: 0, history: [] };
  s.history.push({ t: Date.now(), score: Math.round(score * 100) / 100, ...extra }); s.history = s.history.slice(-40);
  s.best = Math.max(s.best, score);
  if (score >= 0.85) { s.interval = s.interval ? Math.round(s.interval * s.ease) : 1; s.ease = Math.min(3, s.ease + 0.1); s.level = Math.min(5, s.level + 1); }
  else if (score >= 0.6) { s.interval = Math.max(1, Math.round(s.interval * 1.2)); }
  else { s.interval = 0; s.ease = Math.max(1.3, s.ease - 0.2); s.level = Math.max(0, s.level - 1); }
  s.due = Date.now() + Math.max(s.interval, score < 0.6 ? 0.5 : 1) * DAY;
  state.skills[id] = s;
  touchStreak();
  save();
  return s;
}
export function setBest(key, v) { if (!(state.bests[key] >= v)) { state.bests[key] = v; save(); return true; } return false; }
export function touchStreak() {
  const t = today();
  if (state.streak.last === t) return;
  const y = new Date(Date.now() - DAY).toISOString().slice(0, 10);
  state.streak.count = state.streak.last === y ? state.streak.count + 1 : 1;
  state.streak.last = t;
}
export function logMinutes(min) {
  const t = today();
  const last = state.sessions[state.sessions.length - 1];
  if (last && last.d === t) last.minutes += min; else state.sessions.push({ d: t, minutes: min });
  state.sessions = state.sessions.slice(-120); save();
}
export function due(now = Date.now()) {
  return Object.entries(state.skills).filter(([, s]) => s.due <= now).sort((a, b) => a[1].due - b[1].due).map(([id]) => id);
}
export function mastery(id) { return state.skills[id]?.level || 0; }
export function knownChords() {
  return Object.entries(state.skills).filter(([id, s]) => id.startsWith('chord:') && s.level >= 2).map(([id]) => id.slice(6));
}
export function set(path, value) {
  const parts = path.split('.'); let o = state;
  while (parts.length > 1) o = o[parts.shift()];
  o[parts[0]] = value; save();
}
