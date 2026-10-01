// Song library. Chord progressions (no lyrics) + tempo/feel + the skills each song trains.
// Copyrighted songs carry only chord charts and short teaching riffs; full tabs come from your own sources via Import or the Song Decoder.
// bpm values are approximate practice targets — the trainer always starts you slower and ramps up.

const sec = (name, bars, repeat = 1) => ({ name, bars, repeat });
const song = s => ({ capo: 0, meter: 4, strum: 'oldFaithful', tags: [], techniques: [], diff: 1, ...s });

export const SONGS = [
  // ── ROCKY CORNER ─────────────────────────────────────────────
  song({
    id: 'rocky-alone-in-the-ring', title: 'Alone in the Ring', artist: 'Bill Conti', year: 1976, film: 'Rocky',
    tags: ['rocky', 'film', 'fingerstyle', 'favorite'], diff: 3, key: 'C minor', bpm: 56, meter: 4, strum: 'pickArp', capo: 3,
    feel: 'Slow, free, lonely. Solo piano in the film: the quiet version of the Rocky theme, played the night before the fight in the empty arena (~1:09).',
    special: 'rocky',
    techniques: ['Fingerpicking arpeggios', 'Melody on the top strings', 'Rubato (free time)', 'Dynamics: soft → swell', 'Capo for key changes'],
    why: 'The original is a solo-piano cue in C minor with no common guitar arrangement, so we build yours: A-minor shapes with a capo on 3 sound in C minor. Learn the étude below for the technique, then use the Song Decoder on your own copy of the track to pull out the exact melody.',
    sections: [sec('Étude: Empty Arena (original practice piece, Am shapes)', ['Am', 'F', 'C', 'G', 'Am', 'Dm', 'E7', 'Am'], 2)],
    melody: [[64, 1], [69, 1], [67, 1], [64, 1], [65, 1], [69, 1], [67, 1], [65, 1], [64, 1], [67, 1], [64, 1], [60, 1], [62, 1], [67, 1], [65, 1], [62, 1], [64, 1], [69, 1], [67, 1], [64, 1], [65, 1], [62, 1], [69, 1], [65, 1], [64, 1], [62, 1], [59, 1], [56, 1], [57, 4]],
    melodyNote: 'Original melody written for this app in the mood of the cue — not Conti\'s notes.',
  }),
  song({
    id: 'rocky-gonna-fly-now', title: 'Gonna Fly Now (Theme from Rocky)', artist: 'Bill Conti', year: 1976, film: 'Rocky',
    tags: ['rocky', 'film', 'anthem'], diff: 3, key: 'varies by version (one Conti version is listed in F minor)', bpm: 113,
    feel: 'Brass fanfare + driving disco-era rhythm section. Hit #1 on the Billboard Hot 100 in July 1977.',
    special: 'rocky', decodeOnly: true,
    techniques: ['Power chords', 'Triad fanfares on top strings', 'Sixteenth-note muted strumming'],
    why: 'Guitar lessons for this one are common online. Use the Decoder on your own recording to get the chords and melody, then save it to your library.',
    sections: [],
  }),
  song({
    id: 'rocky-going-the-distance', title: 'Going the Distance', artist: 'Bill Conti', year: 1976, film: 'Rocky',
    tags: ['rocky', 'film'], diff: 4, key: 'A minor (piano solo edition)', bpm: 92,
    feel: 'The final-fight cue: builds from tension to triumph.', special: 'rocky', decodeOnly: true,
    techniques: ['Am-family chords', 'Building dynamics', 'Tremolo picking'],
    why: 'A minor is guitar-friendly: open Am, Dm, E, F, G and C cover most of what you need. Decode it from your own copy.',
    sections: [],
  }),
  song({
    id: 'eye-of-the-tiger', title: 'Eye of the Tiger', artist: 'Survivor', year: 1982, film: 'Rocky III',
    tags: ['rocky', 'rock', 'riff', 'power chords', 'favorite'], diff: 2, key: 'C minor', bpm: 109, strum: 'rock',
    feel: 'Palm-muted chugs and stabs. All downstrokes.',
    techniques: ['Power chords (C5, Bb5, Ab5)', 'Palm muting', 'Stops / rests', 'Downstroke stamina'],
    why: 'The Rocky gateway riff. Three power-chord shapes, one hand position: an 80/20 rock skill.',
    sections: [sec('Intro riff', ['C5', 'C5', 'C5 Bb5 C5', 'C5 Bb5 C5', 'C5 Bb5 Ab5', 'Ab5'], 2)],
    verify: 'Chart is the commonly taught version. Check stops and rhythm against the record with the Decoder.',
  }),

  // ── DAY-ONE SONGS (1–2 chords) ───────────────────────────────
  song({ id: 'horse-no-name', title: 'A Horse with No Name', artist: 'America', year: 1971, tags: ['folk', 'two-chord'], diff: 1, key: 'E minor', bpm: 123, strum: 'island',
    techniques: ['Two-chord change', 'Steady 16th-feel strum'], why: 'A real song on day one: two easy shapes, and your 2nd finger barely moves.',
    sections: [sec('Whole song', ['Em', 'D6/9/F#', 'Em', 'D6/9/F#'], 4)] }),
  song({ id: 'seven-nation-army', title: 'Seven Nation Army', artist: 'The White Stripes', year: 2003, tags: ['rock', 'riff', 'single notes'], diff: 1, key: 'E', bpm: 124, strum: 'rock',
    techniques: ['Single-note riff on one string', 'Power chords'], why: 'The most famous one-string riff. Teaches fretting accuracy with no chords at all.',
    riff: { name: 'Main riff (A string)', notes: [[52, 1.5], [52, 0.5], [55, 0.75], [52, 0.75], [50, 0.5], [48, 2], [47, 2]] },
    sections: [sec('Power-chord version', ['E5', 'E5 G5', 'E5 D5', 'C5 B5'], 4)] }),
  song({ id: 'smoke-on-the-water', title: 'Smoke on the Water', artist: 'Deep Purple', year: 1972, tags: ['rock', 'riff'], diff: 1, key: 'G minor', bpm: 114, strum: 'rock',
    techniques: ['Riff in 4ths on the D & G strings', 'Muting', 'Counting rests'], why: 'Rite of passage. One finger shape sliding along two strings.',
    riff: { name: 'Main riff (top note, G string)', notes: [[55, 1], [58, 1], [60, 1.5], [55, 1], [58, 1], [61, 0.5], [60, 2], [55, 1], [58, 1], [60, 1.5], [58, 1], [55, 2.5]] },
    sections: [sec('Power-chord version', ['G5 Bb5', 'C5', 'G5 Bb5', 'Db5 C5', 'G5 Bb5', 'C5 Bb5', 'G5'], 2)] }),

  // ── THE FOUR-CHORD UNIVERSE (G C D Em Am) ───────────────────
  song({ id: 'knockin-heavens-door', title: "Knockin' on Heaven's Door", artist: 'Bob Dylan', year: 1973, tags: ['rock', 'folk', 'classic'], diff: 1, key: 'G', bpm: 69,
    techniques: ['G–D–Am / G–D–C changes', 'Old Faithful strum'], why: 'Slow tempo, four of the five most useful chords. The perfect first "real" song.',
    sections: [sec('Verse & chorus', ['G', 'D', 'Am', 'Am', 'G', 'D', 'C', 'C'], 4)] }),
  song({ id: 'stand-by-me', title: 'Stand By Me', artist: 'Ben E. King', year: 1961, tags: ['soul', 'classic', '50s progression'], diff: 1, key: 'A (G shapes, capo 2)', capo: 2, bpm: 118,
    techniques: ['I–vi–IV–V progression', 'Capo use'], why: 'The "50s progression" (G Em C D) behind hundreds of songs.',
    sections: [sec('Verse', ['G', 'G', 'Em', 'Em', 'C', 'D', 'G', 'G'], 4)] }),
  song({ id: 'brown-eyed-girl', title: 'Brown Eyed Girl', artist: 'Van Morrison', year: 1967, tags: ['classic', 'pop'], diff: 2, key: 'G', bpm: 150,
    techniques: ['G–C–D changes at speed', 'Upbeat strum'], why: 'G-C-D at a lively tempo builds fast changes.',
    sections: [sec('Verse', ['G', 'C', 'G', 'D'], 4), sec('Sha-la-la', ['C', 'D', 'G', 'Em', 'C', 'D', 'G', 'D'], 1)] }),
  song({ id: 'good-riddance', title: 'Good Riddance (Time of Your Life)', artist: 'Green Day', year: 1997, tags: ['punk', 'acoustic'], diff: 2, key: 'G', bpm: 95, strum: 'eighths',
    techniques: ['Cadd9 shortcut (anchor fingers 3 & 4)', 'Single-string picking + strum'], why: 'Teaches the G → Cadd9 → D "anchor finger" trick that makes changes nearly free.',
    sections: [sec('Verse', ['G', 'G', 'Cadd9', 'D'], 4), sec('Chorus', ['Em', 'D', 'Cadd9', 'G'], 2)] }),
  song({ id: 'zombie', title: 'Zombie', artist: 'The Cranberries', year: 1994, tags: ['rock', '90s'], diff: 2, key: 'E minor', bpm: 84,
    techniques: ['vi–IV–I–V loop', 'Dynamics: verse soft, chorus loud'], why: 'Same 4 chords as a thousand songs, in a minor mood.',
    sections: [sec('Loop', ['Em', 'C', 'G', 'D/F#'], 8)] }),
  song({ id: 'wonderwall', title: 'Wonderwall', artist: 'Oasis', year: 1995, tags: ['britpop', '90s'], diff: 2, key: 'F# minor (capo 2)', capo: 2, bpm: 87, strum: 'eighths',
    techniques: ['Anchored fingers 3 & 4', 'Sixteenth-note strumming'], why: 'Fingers 3 & 4 never move. Every chord change is only two fingers.',
    sections: [sec('Verse', ['Em7', 'G', 'Dsus4', 'A7sus4'], 8)] }),
  song({ id: 'sweet-home-alabama', title: 'Sweet Home Alabama', artist: 'Lynyrd Skynyrd', year: 1974, tags: ['rock', 'southern'], diff: 2, key: 'D', bpm: 98,
    techniques: ['D–C–G loop', 'Fill notes between chords'], why: 'One loop for the whole song. Great for locking in timing.',
    sections: [sec('Loop', ['D', 'Cadd9', 'G', 'G'], 8)] }),
  song({ id: 'riptide', title: 'Riptide', artist: 'Vance Joy', year: 2013, tags: ['indie', 'pop'], diff: 2, key: 'C (Am–G–C)', bpm: 102, strum: 'island',
    techniques: ['Am–G–C changes', 'Island strum'], why: 'Three chords and the island strum.',
    sections: [sec('Verse', ['Am', 'G', 'C', 'C'], 8)] }),
  song({ id: 'perfect', title: 'Perfect', artist: 'Ed Sheeran', year: 2017, tags: ['pop', 'ballad'], diff: 2, key: 'Ab (G shapes, capo 1)', capo: 1, bpm: 63, meter: 6, strum: 'waltz',
    techniques: ['6/8 feel', 'G–Em–C–D'], why: 'The I–vi–IV–V loop in a slow 6/8 sway.',
    sections: [sec('Verse', ['G', 'Em', 'C', 'D'], 4)] }),
  song({ id: 'im-yours', title: "I'm Yours", artist: 'Jason Mraz', year: 2008, tags: ['pop', 'reggae'], diff: 2, key: 'B (G shapes, capo 4)', capo: 4, bpm: 151, strum: 'island',
    techniques: ['Reggae-pop chuck strum', 'I–V–vi–IV'], why: 'The "Axis" progression (G D Em C). Learn it once, play it everywhere.',
    sections: [sec('Loop', ['G', 'D', 'Em', 'C'], 8)] }),
  song({ id: 'someone-like-you', title: 'Someone Like You', artist: 'Adele', year: 2011, tags: ['pop', 'ballad'], diff: 3, key: 'A (G shapes, capo 2)', capo: 2, bpm: 67, strum: 'pickArp',
    techniques: ['Bm (first barre-ish chord)', 'Arpeggio pattern'], why: 'A great first fingerpicking song with a gentle introduction to Bm.',
    sections: [sec('Verse', ['G', 'Bm', 'Em', 'C'], 4)] }),
  song({ id: 'country-roads', title: 'Take Me Home, Country Roads', artist: 'John Denver', year: 1971, tags: ['country', 'folk', 'singalong'], diff: 2, key: 'A (G shapes, capo 2)', capo: 2, bpm: 82,
    techniques: ['G–Em–D–C', 'Singalong strumming'], why: 'Campfire king. Same chord family as everything else here.',
    sections: [sec('Verse', ['G', 'Em', 'D', 'C', 'G'], 2), sec('Chorus', ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'G'], 2)] }),
  song({ id: 'wagon-wheel', title: 'Wagon Wheel', artist: 'Old Crow Medicine Show / Darius Rucker', year: 2004, tags: ['country', 'folk'], diff: 2, key: 'A (G shapes, capo 2)', capo: 2, bpm: 75,
    techniques: ['I–V–vi–IV', 'Bluegrass boom-chick'], why: 'Axis progression, country flavor.',
    sections: [sec('Loop', ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'C'], 4)] }),
  song({ id: 'jolene', title: 'Jolene', artist: 'Dolly Parton', year: 1973, tags: ['country', 'fingerpicking'], diff: 3, key: 'C# minor (Am shapes, capo 4)', capo: 4, bpm: 111, strum: 'pickArp',
    techniques: ['Fast arpeggio picking', 'Am–C–G–Am'], why: 'Teaches a rolling, steady picking-hand engine.',
    sections: [sec('Verse', ['Am', 'C', 'G', 'Am', 'G', 'Em', 'Am', 'Am'], 4)] }),
  song({ id: 'tennessee-whiskey', title: 'Tennessee Whiskey', artist: 'Chris Stapleton', year: 2015, tags: ['country', 'soul', 'two-chord'], diff: 2, key: 'A', bpm: 48, meter: 6, strum: 'waltz',
    techniques: ['Two-chord vamp A ↔ Bm', 'Slow 6/8 soul groove', 'Bm (A-shape barre or 4-string version)'], why: 'One of the biggest modern country songs, built on just two chords. Your gateway to Bm.',
    sections: [sec('Vamp (whole song)', ['A', 'A', 'Bm', 'Bm'], 8)] }),
  song({ id: 'folsom-prison-blues', title: 'Folsom Prison Blues', artist: 'Johnny Cash', year: 1955, tags: ['country', 'classic', 'boom-chick'], diff: 2, key: 'E shapes', bpm: 105, strum: 'rock',
    techniques: ['Boom-chick: bass note, then strum', 'E–A–B7 country-blues form'], why: 'The Johnny Cash train beat: alternate the bass note and a short strum. That is half of classic country guitar.',
    verify: 'Commonly taught in E shapes. The record sits a little higher, so tune or capo to match it.',
    sections: [sec('Verse', ['E', 'E', 'E', 'E', 'E', 'E', 'E', 'E', 'A', 'A', 'E', 'E', 'B7', 'B7', 'E', 'E'], 2)] }),
  song({ id: 'gym-country-boom-chick', title: 'Gym: Country Boom-Chick (G–C–D)', artist: 'Progression', tags: ['gym', 'country', 'boom-chick'], diff: 1, key: 'G', bpm: 90, strum: 'quarters',
    techniques: ['Alternating bass + strum', 'I–IV–V'], why: 'The engine under hundreds of country songs: bass note on 1 and 3, strum on 2 and 4.',
    sections: [sec('Loop', ['G', 'G', 'C', 'C', 'D', 'D', 'G', 'G'], 4)] }),
  song({ id: 'mad-world', title: 'Mad World (Gary Jules version)', artist: 'Tears for Fears / Gary Jules', year: 2001, tags: ['ballad', 'film'], diff: 2, key: 'F minor-ish (Em shapes)', bpm: 88, strum: 'pickArp',
    techniques: ['Em–G–D–A', 'Soft dynamics'], why: 'Moody, slow, cinematic. Pairs well with the Rocky ballad mood.',
    sections: [sec('Verse', ['Em', 'G', 'D', 'A'], 8)] }),
  song({ id: 'fast-car', title: 'Fast Car', artist: 'Tracy Chapman', year: 1988, tags: ['folk', 'riff'], diff: 3, key: 'C (capo 2)', capo: 2, bpm: 104, strum: 'pickArp',
    techniques: ['Picked riff over Cmaj7–G–Em–D'], why: 'An iconic picked riff built from chords you already know.',
    sections: [sec('Riff', ['Cmaj7', 'G', 'Em', 'D'], 8)] }),

  // ── CLASSICS WITH THE NEXT TIER OF CHORDS ────────────────────
  song({ id: 'let-it-be', title: 'Let It Be', artist: 'The Beatles', year: 1970, tags: ['classic', 'piano-song'], diff: 3, key: 'C', bpm: 72,
    techniques: ['F chord (or Fmaj7 shortcut)', 'C–G–Am–F'], why: 'Your F-chord graduation song. Use Fmaj7 until the barre F is ready.',
    sections: [sec('Verse', ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'], 2), sec('Chorus', ['Am', 'G', 'F', 'C', 'C', 'G', 'F', 'C'], 2)] }),
  song({ id: 'imagine', title: 'Imagine', artist: 'John Lennon', year: 1971, tags: ['classic', 'piano-song'], diff: 2, key: 'C', bpm: 76,
    techniques: ['C–Cmaj7–F', 'Gentle eighths'], why: 'A one-finger move (C → Cmaj7) that sounds gorgeous.',
    sections: [sec('Verse', ['C', 'Cmaj7', 'F', 'F'], 4)] }),
  song({ id: 'hallelujah', title: 'Hallelujah', artist: 'Leonard Cohen', year: 1984, tags: ['ballad', 'fingerpicking'], diff: 3, key: 'C', bpm: 56, meter: 6, strum: 'waltz',
    techniques: ['6/8 arpeggio', 'C–Am–F–G'], why: 'A slow ballad that builds fingerpicking control.',
    sections: [sec('Verse', ['C', 'Am', 'C', 'Am', 'F', 'G', 'C', 'G'], 2), sec('Chorus', ['F', 'Am', 'F', 'C', 'G', 'C'], 1)] }),
  song({ id: 'wish-you-were-here', title: 'Wish You Were Here', artist: 'Pink Floyd', year: 1975, tags: ['classic rock', 'acoustic'], diff: 3, key: 'G', bpm: 61,
    techniques: ['D/F# thumb or 1st-finger bass', 'Em7–G–A7sus4'], why: 'A beautiful use of the Em7/A7sus4 "anchor" shapes.',
    sections: [sec('Intro', ['Em7', 'G', 'Em7', 'G', 'Em7', 'A7sus4', 'Em7', 'A7sus4', 'G'], 1), sec('Verse', ['C', 'D/F#', 'Am', 'G', 'D/F#', 'C', 'Am', 'G'], 2)] }),
  song({ id: 'hotel-california', title: 'Hotel California', artist: 'Eagles', year: 1976, tags: ['classic rock'], diff: 4, key: 'B minor', bpm: 74, strum: 'pickArp',
    techniques: ['Barre chords Bm, F#', 'Arpeggio picking'], why: 'Barre-chord bootcamp inside a legendary progression.',
    sections: [sec('Verse', ['Bm', 'F#', 'A', 'E', 'G', 'D', 'Em', 'F#'], 2)] }),
  song({ id: 'creep', title: 'Creep', artist: 'Radiohead', year: 1992, tags: ['alt rock', '90s'], diff: 3, key: 'G', bpm: 92,
    techniques: ['B and Cm barre chords', 'Dynamics: the big chorus hits'], why: 'G–B–C–Cm: two barre chords in a famous context.',
    sections: [sec('Loop', ['G', 'B', 'C', 'Cm'], 8)] }),
  song({ id: 'teen-spirit', title: 'Smells Like Teen Spirit', artist: 'Nirvana', year: 1991, tags: ['grunge', 'power chords'], diff: 3, key: 'F minor', bpm: 117, strum: 'rock',
    techniques: ['Moving power chords', 'Ghost-strum muted scratches'], why: 'Power chords on the move, the core grunge/punk skill.',
    sections: [sec('Riff', ['F5', 'Bb5', 'Ab5', 'Db5'], 8)] }),
  song({ id: 'iron-man', title: 'Iron Man', artist: 'Black Sabbath', year: 1970, tags: ['metal', 'power chords', 'riff'], diff: 2, key: 'B minor', bpm: 75, strum: 'rock',
    techniques: ['Power-chord slides', 'Heavy palm-free sustain'], why: 'Slow, heavy and iconic. Power-chord accuracy along the neck.',
    sections: [sec('Main riff', ['B5', 'D5', 'D5 E5', 'E5', 'G5 F#5 G5 F#5', 'G5 F#5 D5', 'D5 E5', 'E5'], 2)] }),
  song({ id: 'bad-moon-rising', title: 'Bad Moon Rising', artist: 'Creedence Clearwater Revival', year: 1969, tags: ['classic', 'rock'], diff: 2, key: 'D', bpm: 179,
    techniques: ['D–A–G at speed'], why: 'Three open chords, fast and fun.',
    sections: [sec('Verse', ['D', 'A G', 'D', 'D'], 4), sec('Chorus', ['G', 'G', 'D', 'D', 'A', 'G', 'D', 'D'], 2)] }),
  song({ id: 'twist-and-shout', title: 'Twist and Shout', artist: 'The Beatles / Isley Brothers', year: 1962, tags: ['rock and roll', 'party'], diff: 1, key: 'D', bpm: 125,
    techniques: ['D–G–A loop'], why: 'One loop, three chords, maximum energy.',
    sections: [sec('Loop', ['D G', 'A', 'D G', 'A'], 8)] }),
  song({ id: 'wild-thing', title: 'Wild Thing', artist: 'The Troggs', year: 1966, tags: ['rock and roll', 'garage'], diff: 1, key: 'A', bpm: 110, strum: 'rock',
    techniques: ['A–D–E–D stabs'], why: 'Garage-rock simplicity.',
    sections: [sec('Riff', ['A D', 'E D', 'A D', 'E D'], 8)] }),
  song({ id: 'la-bamba', title: 'La Bamba', artist: 'Ritchie Valens', year: 1958, tags: ['rock and roll', 'latin'], diff: 1, key: 'C', bpm: 145,
    techniques: ['C–F–G loop (use Fmaj7 shortcut)'], why: 'I–IV–V in one bar. Great change-speed builder.',
    sections: [sec('Loop', ['C F', 'G G'], 16)] }),

  // ── PUBLIC DOMAIN (full melodies included) ──────────────────
  song({ id: 'house-rising-sun', title: 'House of the Rising Sun', artist: 'Traditional', year: 1934, tags: ['folk', 'fingerpicking', 'public domain'], diff: 3, key: 'A minor', bpm: 116, meter: 6, strum: 'pickArp', pd: true,
    techniques: ['6/8 arpeggio', 'Am–C–D–F–E', 'F (or Fmaj7) shortcut'], why: 'THE fingerpicking rite of passage.',
    sections: [sec('Verse', ['Am', 'C', 'D', 'F', 'Am', 'C', 'E', 'E', 'Am', 'C', 'D', 'F', 'Am', 'E', 'Am', 'E'], 2)] }),
  song({ id: 'ode-to-joy', title: 'Ode to Joy', artist: 'Beethoven', year: 1824, tags: ['classical', 'single notes', 'public domain'], diff: 1, key: 'C', bpm: 100, pd: true,
    techniques: ['Reading single notes on the top two strings'], why: 'Your first melody: only 5 notes, all on the B and high E strings.',
    riff: { name: 'Melody', notes: [[64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [64, 1.5], [62, 0.5], [62, 2], [64, 1], [64, 1], [65, 1], [67, 1], [67, 1], [65, 1], [64, 1], [62, 1], [60, 1], [60, 1], [62, 1], [64, 1], [62, 1.5], [60, 0.5], [60, 2]] },
    sections: [sec('Accompaniment', ['C', 'G', 'C', 'G', 'C', 'G', 'C G', 'C'], 1)] }),
  song({ id: 'happy-birthday', title: 'Happy Birthday', artist: 'Traditional', year: 1893, tags: ['singalong', 'single notes', 'public domain'], diff: 1, key: 'G', bpm: 90, meter: 3, strum: 'waltz', pd: true,
    techniques: ['3/4 time', 'G–D–C'], why: 'You will be asked to play this at every party. Be ready.',
    riff: { name: 'Melody', notes: [[62, 0.75], [62, 0.25], [64, 1], [62, 1], [67, 1], [66, 2], [62, 0.75], [62, 0.25], [64, 1], [62, 1], [69, 1], [67, 2], [62, 0.75], [62, 0.25], [74, 1], [71, 1], [67, 1], [66, 1], [64, 1], [72, 0.75], [72, 0.25], [71, 1], [67, 1], [69, 1], [67, 2]] },
    sections: [sec('Chords', ['G', 'D', 'D', 'G', 'G', 'C', 'G D', 'G'], 1)] }),
  song({ id: 'twinkle', title: 'Twinkle Twinkle Little Star', artist: 'Traditional', year: 1806, tags: ['single notes', 'public domain'], diff: 1, key: 'C', bpm: 96, pd: true,
    techniques: ['First melody', 'Counting'], why: 'Warm-up melody for finger independence.',
    riff: { name: 'Melody', notes: [[60, 1], [60, 1], [67, 1], [67, 1], [69, 1], [69, 1], [67, 2], [65, 1], [65, 1], [64, 1], [64, 1], [62, 1], [62, 1], [60, 2]] },
    sections: [sec('Chords', ['C', 'C F', 'C', 'G C'], 2)] }),
  song({ id: 'greensleeves', title: 'Greensleeves', artist: 'Traditional', year: 1580, tags: ['folk', 'classical', 'public domain'], diff: 3, key: 'A minor', bpm: 90, meter: 6, strum: 'pickArp', pd: true,
    techniques: ['6/8 arpeggios', 'Am–C–G–Em–F–E'], why: 'Minor-key mood. A good warm-up for the Rocky ballad.',
    sections: [sec('A', ['Am', 'C', 'G', 'Em', 'Am', 'F', 'E', 'E'], 2)] }),
  song({ id: 'amazing-grace', title: 'Amazing Grace', artist: 'Traditional (John Newton)', year: 1779, tags: ['hymn', 'public domain'], diff: 1, key: 'G', bpm: 80, meter: 3, strum: 'waltz', pd: true,
    techniques: ['3/4 time', 'G–C–D'], why: 'Three chords in a slow waltz. Perfect for clean changes.',
    sections: [sec('Verse', ['G', 'G', 'C', 'G', 'G', 'G', 'D', 'D', 'G', 'G', 'C', 'G', 'G', 'D', 'G', 'G'], 1)] }),
  song({ id: 'canon-progression', title: 'Canon in D (progression)', artist: 'Pachelbel', year: 1690, tags: ['classical', 'public domain', 'progression'], diff: 3, key: 'D', bpm: 70, strum: 'pickArp', pd: true,
    techniques: ['Bm and F#m barre shapes', 'Arpeggios'], why: 'The ancestor of countless pop progressions.',
    sections: [sec('Loop', ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A'], 4)] }),

  // ── PROGRESSION GYMS (not songs: the engines inside songs) ──
  song({ id: 'gym-axis', title: 'Gym: The Axis (G–D–Em–C)', artist: 'Progression', tags: ['gym', 'progression'], diff: 1, key: 'G', bpm: 90,
    techniques: ['I–V–vi–IV'], why: 'The progression inside hundreds of hits. Get it smooth and you can play along with a huge share of the radio.',
    sections: [sec('Loop', ['G', 'D', 'Em', 'C'], 8)] }),
  song({ id: 'gym-50s', title: 'Gym: 50s Doo-Wop (G–Em–C–D)', artist: 'Progression', tags: ['gym', 'progression'], diff: 1, key: 'G', bpm: 90,
    techniques: ['I–vi–IV–V'], why: 'Stand By Me, Perfect and many more.', sections: [sec('Loop', ['G', 'Em', 'C', 'D'], 8)] }),
  song({ id: 'gym-blues-e', title: 'Gym: 12-Bar Blues in E', artist: 'Progression', tags: ['gym', 'blues'], diff: 2, key: 'E', bpm: 96, strum: 'rock',
    techniques: ['E7–A7–B7', 'Shuffle feel'], why: 'The form behind rock & roll, blues and early rock.',
    sections: [sec('12 bars', ['E7', 'E7', 'E7', 'E7', 'A7', 'A7', 'E7', 'E7', 'B7', 'A7', 'E7', 'B7'], 2)] }),
  song({ id: 'gym-minor-cinema', title: 'Gym: Cinematic Minor (Am–F–C–G)', artist: 'Progression', tags: ['gym', 'progression', 'rocky'], diff: 2, key: 'A minor', bpm: 72, strum: 'pickArp',
    techniques: ['vi–IV–I–V', 'Arpeggio'], why: 'The emotional film-score loop. Builds the Rocky-ballad picking hand.',
    sections: [sec('Loop', ['Am', 'F', 'C', 'G'], 8)] }),
];

export function allSongs(userSongs = []) { return [...userSongs.map(s => ({ ...s, user: true })), ...SONGS]; }

// Every chord symbol a song needs (splits multi-chord bars).
export function songChords(s) {
  const set = new Set();
  (s.sections || []).forEach(x => x.bars.forEach(b => b.split(/\s+/).filter(Boolean).forEach(c => set.add(c))));
  return [...set];
}
// "Playable now" = all chords known (shortcut aliases count).
const SHORTCUTS = { F: ['Fmaj7'], Cadd9: ['C'], 'D/F#': ['D'], 'D6/9/F#': ['D'], Em7: ['Em'], Dsus4: ['D'], A7sus4: ['A', 'Am'], Cmaj7: ['C'], Bm: ['Bm'] };
export function playable(s, known) {
  const k = new Set(known);
  return songChords(s).every(c => k.has(c) || (SHORTCUTS[c] || []).some(x => k.has(x)) || (c.endsWith('5') && k.size >= 3));
}
export function links(s) {
  const q = encodeURIComponent(`${s.title} ${s.artist}`);
  return {
    youtube: `https://www.youtube.com/results?search_query=${q}+guitar+lesson`,
    songsterr: `https://www.songsterr.com/?pattern=${q}`,
    ug: `https://www.ultimate-guitar.com/search.php?search_type=title&value=${q}`,
    listen: `https://www.youtube.com/results?search_query=${q}`,
  };
}
