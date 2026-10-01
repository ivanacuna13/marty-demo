// Chord-sheet importer: paste ChordPro ([G]inline), chords-over-lyrics, or bare chord lines from any site you use. Builds a playable chart.
import { parseChord } from './theory.js';

const CHORD_RE = /^[A-G][#b]?(m|min|maj|M|sus|add|dim|aug|\d|\/|[#b]|\(|\))*$/;
const isChord = t => CHORD_RE.test(t) && !!parseChord(t.replace(/[()]/g, ''));
const HEADER_RE = /^\s*[\[{(]?\s*(intro|verse|pre-?chorus|chorus|bridge|outro|solo|interlude|riff|instrumental|ending|hook|refrain)\b[^\]})]*[\]})]?\s*:?\s*$/i;

export function parseSheet(text, { title = '', artist = '' } = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const meta = { title, artist, capo: 0, key: '' };
  const sections = []; let cur = null; const display = [];
  const push = name => { cur = { name, bars: [], repeat: 1 }; sections.push(cur); };
  for (let raw of lines) {
    const line = raw.trimEnd();
    const dir = line.match(/^\{(\w+)\s*:\s*(.+)\}$/); // ChordPro directives
    if (dir) {
      const [, k, v] = dir;
      if (/^(t|title)$/i.test(k)) meta.title = v; else if (/^(st|subtitle|artist)$/i.test(k)) meta.artist = v;
      else if (/^capo$/i.test(k)) meta.capo = +v || 0; else if (/^key$/i.test(k)) meta.key = v;
      else if (/^(c|comment|soc|start_of_chorus)$/i.test(k)) push(v);
      continue;
    }
    const capo = line.match(/capo\s*(?:on\s*)?(\d+)/i); if (capo) { meta.capo = +capo[1]; continue; }
    if (HEADER_RE.test(line)) { push(line.replace(/[\[\]{}():]/g, '').trim()); display.push({ type: 'h', text: cur.name }); continue; }
    const inline = [...line.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]).filter(isChord);
    if (inline.length) {
      if (!cur) push('Song');
      cur.bars.push(...inline);
      display.push({ type: 'cl', chords: inline, lyric: line.replace(/\[[^\]]+\]/g, '') });
      continue;
    }
    const toks = line.split(/\s+/).filter(Boolean).filter(t => !/^[|/%x\d.-]+$/.test(t));
    if (toks.length && toks.filter(isChord).length / toks.length >= 0.75) {
      if (!cur) push('Song');
      const cs = toks.filter(isChord).map(t => t.replace(/[()]/g, ''));
      cur.bars.push(...cs);
      display.push({ type: 'c', text: line });
    } else if (line.trim()) display.push({ type: 'l', text: line });
  }
  const clean = sections.filter(s => s.bars.length);
  return { ...meta, sections: clean, display, chordCount: clean.reduce((n, s) => n + s.bars.length, 0) };
}

// Playlist importer: Exportify (Spotify) CSV, Apple Music "Export Playlist" (tab-separated), TuneMyMusic/Soundiiz CSV,
// or plain pasted lines like "Song – Artist" / "Artist - Song" / "Song by Artist".
export function parsePlaylist(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim());
  if (!lines.length) return [];
  const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(',') && /name|title|track/i.test(lines[0]) ? ',' : null;
  if (sep) {
    const split = l => sep === '\t' ? l.split('\t') : csvSplit(l);
    const head = split(lines[0]).map(x => x.toLowerCase().replace(/"/g, '').trim());
    const ti = head.findIndex(x => /^(track name|name|title|song|track)$/.test(x));
    const ai = head.findIndex(x => /^(artist name\(s\)|artist name|artists?|artist\(s\))$/.test(x));
    if (ti >= 0) return lines.slice(1).map(l => { const c = split(l); return { title: clean(c[ti]), artist: clean(c[ai] || '').split(/[,;]/)[0].trim() }; }).filter(x => x.title);
  }
  return lines.map(l => {
    const t = l.replace(/^\s*\d+[.)]\s*/, '').trim();
    const by = t.match(/^(.+?)\s+by\s+(.+)$/i); if (by) return { title: clean(by[1]), artist: clean(by[2]) };
    const parts = t.split(/\s+[-–—|]\s+/);
    return parts.length > 1 ? { title: clean(parts[0]), artist: clean(parts.slice(1).join(' ')) } : { title: clean(t), artist: '' };
  }).filter(x => x.title);
}
const clean = s => String(s || '').replace(/^"|"$/g, '').replace(/\s*[([](feat|ft|with|remaster|live|radio edit)[^)\]]*[)\]]/ig, '').trim();
function csvSplit(line) {
  const out = []; let cur = '', q = false;
  for (const ch of line) { if (ch === '"') q = !q; else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; }
  out.push(cur); return out;
}
