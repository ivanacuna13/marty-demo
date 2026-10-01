// The coach's VOICE and BRAIN. Speaks (Web Speech or ElevenLabs), listens (wake word "Axel" + push-to-talk),
// and thinks (Claude via the Anthropic SDK with app-control tools; a built-in offline brain otherwise).
import * as store from './store.js';
import { getShape, STRING_LABELS } from './theory.js';
import { FIXES } from './lessons.js';
import { allSongs } from './songs.js';
import { IS_ARTIFACT, cap } from './platform.js';

export const PERSONA = `You are Axel, an elite guitar coach living inside a web app. Your personality is a gritty boxing trainer crossed with the warmest, most patient guitar teacher alive. Think Rocky's corner man who also happens to be a world-class musician. You are hype, direct and funny, and never condescending.

How you teach (non-negotiable):
- 80/20 first: always push the smallest skill that unlocks the most music. Real songs early and often.
- Target ~85% success: if they're cruising, raise the tempo ~5 bpm or add a harder bit; if they're failing, slow down 10% or shrink the chunk to 1–2 bars.
- Short daily sessions (10–20 min) beat cramming. Sleep consolidates motor skills; tell them that progress shows up tomorrow.
- New chord = blocked practice until it rings; after that, interleave chords and sections.
- Find exactly where an error happens and fix that spot. Don't just replay from the top.
- Celebrate specific wins with numbers ("27 changes, up from 19!").

You can SEE the student's hands (camera hand-tracking: finger arch, wrist bend, strum direction) and HEAR them (pitch, chord recognition, timing) via the live sensor context in each message. Reference it naturally when relevant ("I heard that B string buzzing" only if the context supports it). Never invent sensor readings.

Speech style: your replies are read aloud by a voice engine while the student holds a guitar. Keep most replies to 1–3 short sentences. No markdown, no lists, no emojis, no tab blocks unless they ask for detail. Use plain words for chords ("A minor", "G").

Use tools to drive the app: open lessons, songs, chord diagrams, the tuner, set the metronome, play chords aloud, or add songs to the library. When the student names a song, check the library first (open_song). If it isn't there, you may add_song_to_library with the chord progression you know; mark confidence honestly and never include lyrics. For copyrighted songs, give chord progressions and techniques, not full transcriptions; suggest the Song Decoder for exact parts.

Facts you may use: "Alone in the Ring" is a ~1:09 solo-piano cue from Bill Conti's Rocky (1976) score, a quiet version of the Rocky theme in C minor, played slow and free. The app teaches it with Am shapes and a capo on 3 (which sounds in C minor), plus an original étude and the Decoder for the exact melody from the student's own recording. Latency-sensitive: begin your visible answer immediately.`;

const TOOLS = [
  { name: 'navigate', description: 'Open a screen in the app.', input_schema: { type: 'object', properties: { view: { type: 'string', enum: ['home', 'path', 'tuner', 'library', 'rocky', 'decoder', 'chords', 'camera', 'progress', 'settings', 'method', 'ear'] } }, required: ['view'], additionalProperties: false } },
  { name: 'show_chord', description: 'Show a chord diagram on screen and play it so the student hears it.', input_schema: { type: 'object', properties: { chord: { type: 'string', description: 'Chord symbol like G, Am, F#m, Cadd9, D/F#' } }, required: ['chord'], additionalProperties: false } },
  { name: 'start_lesson', description: 'Start a lesson/drill from the learning path by id (e.g. "chord:G", "change:G-C", "strum:oldFaithful", "song:wonderwall", "tune").', input_schema: { type: 'object', properties: { lesson_id: { type: 'string' } }, required: ['lesson_id'], additionalProperties: false } },
  { name: 'open_song', description: 'Open a song from the library in the song player. Use the song id or a title search string.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } },
  { name: 'set_metronome', description: 'Set or toggle the metronome.', input_schema: { type: 'object', properties: { bpm: { type: 'integer', minimum: 30, maximum: 240 }, on: { type: 'boolean' } }, required: ['on'], additionalProperties: false } },
  {
    name: 'add_song_to_library', description: "Add a song to the student's library as a chord chart (no lyrics). Only include chords you are reasonably confident about.",
    input_schema: {
      type: 'object', additionalProperties: false, required: ['title', 'artist', 'sections', 'confidence'], properties: {
        title: { type: 'string' }, artist: { type: 'string' }, key: { type: 'string' }, capo: { type: 'integer', minimum: 0, maximum: 9 }, bpm: { type: 'integer', minimum: 40, maximum: 220 },
        strum: { type: 'string', enum: ['quarters', 'eighths', 'oldFaithful', 'island', 'rock', 'waltz', 'pickArp'] },
        sections: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'bars'], properties: { name: { type: 'string' }, bars: { type: 'array', items: { type: 'string', description: 'One bar: one chord, or two chords separated by a space' } }, repeat: { type: 'integer', minimum: 1, maximum: 16 } } } },
        techniques: { type: 'array', items: { type: 'string' } }, tips: { type: 'string' },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    },
  },
].map(t => ({ ...t, eager_input_streaming: true }));

class Coach extends EventTarget {
  constructor() {
    super();
    this.history = []; this.actions = {}; this.speaking = false; this.listening = false; this.context = () => ({});
    this.synth = window.speechSynthesis; this.voices = [];
    if (this.synth) { const load = () => { this.voices = this.synth.getVoices(); }; load(); this.synth.onvoiceschanged = load; }
  }
  // ---------- VOICE ----------
  pickVoice() {
    const want = store.get().settings.voice;
    const v = this.voices;
    return v.find(x => x.name === want) || v.find(x => /Daniel|Google UK English Male|Alex|Aaron|Arthur|Guy|Christopher/i.test(x.name) && /^en/i.test(x.lang)) || v.find(x => /^en/i.test(x.lang)) || v[0];
  }
  async say(text, { interrupt = true } = {}) {
    if (!text) return;
    this.dispatchEvent(new CustomEvent('said', { detail: text }));
    const s = store.get().settings;
    if (s.talkative === 0) return;
    if (interrupt) this.stopSpeaking();
    this._pauseRec();
    if (s.elevenKey) { try { return await this._eleven(text, s); } catch (e) { console.warn('ElevenLabs failed, falling back', e); } }
    if (!this.synth) return;
    return new Promise(res => {
      const u = new SpeechSynthesisUtterance(text.replace(/[*_#`]/g, ''));
      const voice = this.pickVoice(); if (voice) u.voice = voice;
      u.rate = s.rate; u.pitch = s.pitch;
      u.onstart = () => this._speaking(true);
      u.onboundary = () => this.dispatchEvent(new Event('syllable'));
      u.onend = u.onerror = () => { this._speaking(false); res(); };
      this.synth.speak(u);
    });
  }
  async _eleven(text, s) {
    const voice = s.elevenVoice || 'JBFqnCBsd6RMkjVDRZzb';
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
      method: 'POST', headers: { 'xi-api-key': s.elevenKey, 'content-type': 'application/json' },
      body: JSON.stringify({ text, model_id: 'eleven_turbo_v2_5', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
    });
    if (!r.ok) throw new Error('TTS ' + r.status);
    const url = URL.createObjectURL(await r.blob());
    const a = new Audio(url); this._audio = a;
    return new Promise(res => {
      a.onplay = () => this._speaking(true);
      const tick = setInterval(() => this.dispatchEvent(new Event('syllable')), 140);
      a.onended = a.onerror = () => { clearInterval(tick); this._speaking(false); URL.revokeObjectURL(url); res(); };
      a.play().catch(() => { clearInterval(tick); this._speaking(false); res(); });
    });
  }
  stopSpeaking() { this._ctl?.abort(); this.synth?.cancel(); if (this._audio) { this._audio.pause(); this._audio = null; } this._speaking(false); }
  _speaking(v) { this.speaking = v; this.dispatchEvent(new CustomEvent('speaking', { detail: v })); if (!v) setTimeout(() => this._resumeRec(), 350); }

  // ---------- EARS FOR SPEECH (voice commands) ----------
  get canListen() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
  startListening({ wake = store.get().settings.wakeWord } = {}) {
    if (!this.canListen) { this.dispatchEvent(new CustomEvent('note', { detail: 'Voice commands need Chrome, Edge or Safari.' })); return false; }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.rec = new R(); this.rec.lang = 'en-US'; this.rec.continuous = true; this.rec.interimResults = true;
    this.wake = wake; this.listening = true; this._armed = !wake;
    this.rec.onresult = e => {
      const r = e.results[e.results.length - 1];
      const text = r[0].transcript.trim();
      this.dispatchEvent(new CustomEvent('hearing', { detail: { text, final: r.isFinal } }));
      if (!r.isFinal) return;
      let t = text;
      const m = t.match(/\b(hey |ok |okay )?(axel|axle|access|excel|axl|actual)\b[,.]?\s*/i);
      if (this.wake && !this._armed) { if (!m) return; t = t.slice(m.index + m[0].length); if (!t) { this._armed = true; this.dispatchEvent(new Event('armed')); return; } }
      this._armed = !this.wake;
      if (t) this.ask(t, { spoken: true });
    };
    this.rec.onend = () => { if (this.listening && !this.speaking) try { this.rec.start(); } catch (e) {} };
    this.rec.onerror = e => { if (e.error === 'not-allowed') { this.listening = false; this.dispatchEvent(new CustomEvent('note', { detail: 'Microphone permission for voice commands was blocked.' })); } };
    try { this.rec.start(); } catch (e) {}
    this.dispatchEvent(new CustomEvent('listening', { detail: true }));
    return true;
  }
  stopListening() { this.listening = false; try { this.rec?.stop(); } catch (e) {} this.dispatchEvent(new CustomEvent('listening', { detail: false })); }
  pushToTalk() { if (!this.listening) this.startListening({ wake: false }); this._armed = true; this.dispatchEvent(new Event('armed')); }
  _pauseRec() { if (this.listening) try { this.rec.abort(); } catch (e) {} }
  _resumeRec() { if (this.listening && !this.speaking) try { this.rec.start(); } catch (e) {} }

  // ---------- BRAIN ----------
  async ask(text, { spoken = false } = {}) {
    this.dispatchEvent(new CustomEvent('user', { detail: text }));
    const quick = this._quickCommand(text);
    if (quick) return;
    const key = store.get().settings.claudeKey;
    try {
      const sample = IS_ARTIFACT && !this._sampleOff ? await cap('sample') : null;
      if (sample) { const r = await this._sample(text, sample); if (r !== 'fallback') return; }
      else if (key) return await this._claude(text, key);
    } catch (e) {
      console.error(e);
      this.dispatchEvent(new CustomEvent('note', { detail: 'Claude brain error: ' + (e.message || e) + '. Using the offline brain.' }));
    }
    return this._local(text);
  }
  // Instant hands-free commands that never need the cloud.
  _quickCommand(t) {
    const s = t.toLowerCase().trim().replace(/[.!?]$/, '');
    const A = this.actions;
    const map = [
      [/^(next|next one|go on|continue|done)$/, () => A.next?.()],
      [/^(back|previous|go back)$/, () => A.back?.()],
      [/^(again|repeat|one more time|restart)$/, () => A.repeat?.()],
      [/^(slower|slow (it )?down)$/, () => A.tempo?.(-0.1)],
      [/^(faster|speed (it )?up)$/, () => A.tempo?.(+0.05)],
      [/^(stop|pause|hold on|wait)$/, () => A.stop?.()],
      [/^(start|go|play|let'?s go)$/, () => A.start?.()],
      [/^(tune|tuner|tune up|let'?s tune)$/, () => A.navigate?.('tuner')],
      [/^(metronome (on|off))$/, m => A.metronome?.({ on: m[2] === 'on' })],
      [/^(be quiet|shut up|less talking|quiet)$/, () => { store.set('settings.talkative', 1); this.say('Got it. Fewer words, more guitar.'); }],
    ];
    for (const [re, fn] of map) { const m = s.match(re); if (m) { fn(m); this.dispatchEvent(new CustomEvent('reply', { detail: { text: '👍 ' + s, done: true } })); return true; } }
    return false;
  }
  async _claude(text, apiKey) {
    if (!this._sdk) {
      const mod = await import('https://esm.sh/@anthropic-ai/sdk');
      this._sdk = mod.default || mod.Anthropic;
    }
    const client = this._client && this._clientKey === apiKey ? this._client : new this._sdk({ apiKey, dangerouslyAllowBrowser: true });
    this._client = client; this._clientKey = apiKey;
    const ctx = this.context();
    // History is append-only (required for preserved thinking); when it gets long, start a fresh conversation.
    if (this.history.length > 60) this.history = [];
    this.history.push({ role: 'user', content: [{ type: 'text', text: `[live sensor + app context]\n${JSON.stringify(ctx)}` }, { type: 'text', text }] });
    let reply = '';
    for (let turn = 0; turn < 5; turn++) {
      const stream = client.beta.messages.stream({
        model: 'claude-opus-5-5', max_tokens: 4000,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        thinking: { type: 'adaptive' }, output_config: { effort: 'low' },
        system: [{ type: 'text', text: PERSONA, cache_control: { type: 'ephemeral' } }],
        tools: TOOLS, messages: this.history,
      });
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') { reply += ev.delta.text; this.dispatchEvent(new CustomEvent('reply', { detail: { text: reply, done: false } })); }
      }
      const msg = await stream.finalMessage();
      this.history.push({ role: 'assistant', content: msg.content });
      if (msg.stop_reason === 'refusal') { reply = reply || "Let's keep it on guitar. What do you want to play?"; break; }
      if (msg.stop_reason !== 'tool_use') break;
      const results = [];
      for (const b of msg.content.filter(b => b.type === 'tool_use')) results.push(await this._runTool(b));
      this.history.push({ role: 'user', content: results });
      if (reply) reply += ' ';
    }
    this.dispatchEvent(new CustomEvent('reply', { detail: { text: reply, done: true } }));
    if (reply.trim()) await this.say(reply.trim(), { interrupt: false });
  }
  // Inside a Claude artifact: the built-in Claude (viewer's own plan, asks permission once), same tools, no API key.
  async _sample(text, sample) {
    this.turns ||= [];
    this.turns.push({ role: 'user', content: `[live app context]\n${JSON.stringify(this.context())}\n\n${text}` });
    while (this.turns.length > 14 || this.turns[0]?.role !== 'user') this.turns.shift();
    const rules = PERSONA + `\n\nYou are running inside a Claude artifact. Live camera, microphone and speech input are unavailable here, so sensor fields may read "off". The student can still upload a recording (Camera Coach, Song Decoder, "Grade a recording" on a song) or a photo of their chord hand ("Photo check") for you to review. Reply in plain sentences, briefly.`;
    const lim = await sample.limits().catch(() => null);
    const tools = lim?.tools && !this._noTools ? TOOLS.slice(0, lim.tools.maxCount).map(t => ({
      name: t.name, description: t.description, inputSchema: t.input_schema,
      execute: async input => { const r = await this._runTool({ id: 't', name: t.name, input }); if (r.is_error) throw new Error(r.content); return r.content; },
    })) : undefined;
    const heavy = /\b(add|playlist|chart|library|songs?\b.*\b(love|like))/i.test(text);
    const ctl = new AbortController(); this._ctl = ctl;
    this.dispatchEvent(new CustomEvent('reply', { detail: { text: 'Thinking…', done: false } }));
    try {
      const { text: out, truncated } = await sample([{ role: 'user', content: rules }, ...this.turns], {
        cache: false, tools, modelTier: heavy ? 'default' : 'quick', signal: ctl.signal,
        onText: ({ text: t }) => this.dispatchEvent(new CustomEvent('reply', { detail: { text: t, done: false } })),
      });
      this.turns.push({ role: 'assistant', content: out });
      this.dispatchEvent(new CustomEvent('reply', { detail: { text: out + (truncated ? ' …' : ''), done: true } }));
      await this.say(out, { interrupt: false });
    } catch (e) {
      const code = e?.code;
      if (code === 'cancelled') { this.dispatchEvent(new CustomEvent('reply', { detail: { text: e.text || 'Stopped.', done: true } })); return; }
      if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) { this._sampleOff = true; this.dispatchEvent(new CustomEvent('note', { detail: 'Claude is off for this page, so Axel is using his offline brain.' })); return 'fallback'; }
      if (code === 'tools_unavailable' && !this._noTools) { this._noTools = true; this.turns.pop(); return this._sample(text, sample); }
      const msg = code === 'rate_limited' ? "I'm out of breath. Too many questions at once; try again in a minute." : code === 'session_expired' ? 'Your Claude session expired. Sign in again and ask me once more.' : code === 'refused' ? "Let's keep it on guitar. What do you want to play?" : (e.text ? e.text + ' …(cut off)' : 'I lost the connection. Ask me again.');
      this.dispatchEvent(new CustomEvent('reply', { detail: { text: msg, done: true } }));
    }
  }
  async _runTool(block) {
    const A = this.actions;
    let input = block.input;
    if (typeof input === 'string') { try { input = JSON.parse(input); } catch (e) { return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: 'INVALID_JSON' }; } }
    if (!input || typeof input !== 'object') return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: 'INVALID_INPUT' };
    try {
      let out = 'ok';
      switch (block.name) {
        case 'navigate': A.navigate(String(input.view)); break;
        case 'show_chord': out = A.showChord(String(input.chord)) || 'shown'; break;
        case 'start_lesson': out = A.startLesson(String(input.lesson_id)) || 'started'; break;
        case 'open_song': out = A.openSong(String(input.query)) || 'opened'; break;
        case 'set_metronome': A.metronome(input); break;
        case 'add_song_to_library': if (!Array.isArray(input.sections)) throw new Error('sections required'); out = A.addSong(input); break;
        default: throw new Error('unknown tool');
      }
      return { type: 'tool_result', tool_use_id: block.id, content: String(out) };
    } catch (e) { return { type: 'tool_result', tool_use_id: block.id, is_error: true, content: String(e.message || e) }; }
  }
  // Offline brain: pattern-matched teacher knowledge. Good enough to drive the app hands-free.
  _local(text) {
    const s = text.toLowerCase();
    const A = this.actions;
    let reply = '';
    const chordAsk = text.match(/\b(?:play|show(?: me)?|how (?:do i|to) (?:play|make|do)|what(?:'s| is))\s+(?:an?\s+|the\s+)?([A-G](?:#|b|♯|♭)?(?:\s?(?:minor|major|m|maj7|7|sus2|sus4|add9|m7|5|dim))?)(?:\s+chord)?\b/i);
    const songs = allSongs(store.get().userSongs);
    const songHit = songs.find(x => s.includes(x.title.toLowerCase().replace(/\s*\(.*\)/, '')) || (x.film && s.includes('rocky') && x.id === 'rocky-alone-in-the-ring' && /alone|ring/.test(s)));
    if (/alone in the ring|rocky/.test(s)) { A.navigate('rocky'); reply = "Rocky Corner. Alone in the Ring is a slow, solo-piano version of the Rocky theme in C minor. We play it with A minor shapes and a capo on three. Start with the Empty Arena étude, then decode the real melody from your copy of the track."; }
    else if (songHit) { A.openSong(songHit.id); reply = `${songHit.title}. ${songHit.why || ''} Hit play when you're ready; I'll start you slow.`; }
    else if (chordAsk) {
      let sym = chordAsk[1].replace(/\s*minor/i, 'm').replace(/\s*major/i, '').replace(/\s+/g, '').replace('♯', '#').replace('♭', 'b');
      sym = sym[0].toUpperCase() + sym.slice(1);
      const sh = getShape(sym);
      if (sh) { A.showChord(sym); reply = describeShape(sym, sh); } else reply = `I don't have a shape for ${sym} yet.`;
    }
    else if (/buzz/.test(s)) reply = pick(FIXES.buzz);
    else if (/hurt|pain|sore|fingertip/.test(s)) reply = pick(FIXES.pain);
    else if (/mute|dead string|doesn'?t ring/.test(s)) reply = pick(FIXES.muted);
    else if (/\bf\b.*chord|barre/.test(s)) reply = pick(FIXES.fChord);
    else if (/change|switch|slow at|too slow/.test(s)) reply = pick(FIXES.slowChange);
    else if (/strum|rhythm|timing|beat/.test(s)) reply = pick(FIXES.rhythm);
    else if (/tune|tuning|out of tune/.test(s)) { A.navigate('tuner'); reply = 'Tuner is up. Pluck the low E string first.'; }
    else if (/what should i|practice today|plan|where do i start|start/.test(s)) { A.navigate('home'); reply = "Today's plan is on screen: warm-up, review, one new skill, and we finish on a song. Say next when you're ready."; }
    else if (/decode|transcribe|figure out|by ear/.test(s)) { A.navigate('decoder'); reply = 'Song Decoder. Drop in an audio file you own, and I will pull out the chords and a melody draft, slowed down and looped.'; }
    else if (/camera|watch me|look at|posture|hand/.test(s)) { A.navigate('camera'); reply = "Eyes on. Show me your fretting hand: thumb behind the neck, fingers arched."; }
    else if (/song|library|learn/.test(s)) { A.navigate('library'); reply = 'Here is your library. The ones marked playable use only chords you already own.'; }
    else if (/progress|how am i doing|stats/.test(s)) { A.navigate('progress'); reply = `You're on a ${store.get().streak.count}-day streak. Here's everything you've built.`; }
    else reply = "I've got you. Ask me to show a chord, open a song, tune up, or watch your hands. Add a Claude API key in Settings and I can talk about anything guitar.";
    this.dispatchEvent(new CustomEvent('reply', { detail: { text: reply, done: true } }));
    return this.say(reply);
  }
}

const pick = a => a[Math.floor(Math.random() * a.length)];
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth'];
const FNAME = { 1: 'index', 2: 'middle', 3: 'ring', 4: 'pinky', T: 'thumb' };
const SNAME = ['low E', 'A', 'D', 'G', 'B', 'high E'];
export function describeShape(sym, sh) {
  const parts = [];
  const b = sh.barre;
  if (b) parts.push(`index finger flat across ${b.from === 0 && b.to === 5 ? 'all six strings' : 'the top ' + (b.to - b.from + 1) + ' strings'} at the ${ORD[b.fret] || b.fret + 'th'} fret`);
  sh.frets.forEach((f, i) => { if (f > 0 && sh.fingers[i] && !(b && f === b.fret && sh.fingers[i] === 1)) parts.push(`${FNAME[sh.fingers[i]] || 'a'} finger on the ${SNAME[i]} string, ${ORD[f] || f + 'th'} fret`); });
  const muted = sh.frets.map((f, i) => f < 0 ? SNAME[i] : null).filter(Boolean);
  let txt = `${sym}: ` + (parts.length ? parts.join('; ') : 'all open strings') + '.';
  if (muted.length) txt += ` Don't play the ${muted.join(' or ')} string${muted.length > 1 ? 's' : ''}.`;
  return txt;
}

// Photo check: Claude looks at a photo of the fretting hand and compares it with the target chord shape.
export async function photoCheck(file, sym, shapeText) {
  const prompt = `You are Axel, a guitar coach. The attached photo shows a student's fretting hand on a guitar. They are trying to play ${sym}. The correct shape is: ${shapeText}
Look carefully at which strings and frets each fingertip is on, finger arch (tips vs flat pads), whether fingers sit just behind the fret wire, and thumb position. Reply in 2-4 short spoken sentences: say whether the shape matches, then the single most important fix. If the photo doesn't clearly show the fretboard and fingers, say what angle to retake it from. No markdown.`;
  if (IS_ARTIFACT) {
    const sample = await cap('sample');
    if (!sample) throw new Error('Claude is not available on this page.');
    const lim = await sample.limits().catch(() => null);
    if (!lim?.images) throw new Error('This view cannot send photos to Claude.');
    const { text } = await sample(prompt, { images: file, modelTier: 'default', cache: false });
    return text;
  }
  const key = store.get().settings.claudeKey;
  if (!key) throw new Error('Add a Claude API key in Settings to use Photo check.');
  const mod = await import('https://esm.sh/@anthropic-ai/sdk');
  const client = new (mod.default || mod.Anthropic)({ apiKey: key, dangerouslyAllowBrowser: true });
  const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5', max_tokens: 2000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'low' },
    messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('Claude declined to review that photo.');
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
}

export const coach = new Coach();
export { STRING_LABELS };
