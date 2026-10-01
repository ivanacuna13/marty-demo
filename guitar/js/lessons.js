// The 80/20 path: the smallest set of skills that unlocks the largest number of songs, ordered so you play real music on day one.
// Drill types: tune | posture | chord | change | strum | riff | song | ear | rhythm-air
export const STAGES = [
  {
    id: 'camp', title: 'Fight Camp: Day One', tagline: 'Tune, hold it right, and play a real song today.', reward: 'A Horse with No Name',
    lessons: [
      { id: 'tune', title: 'Tune up with Axel', type: 'tune', mins: 2, coach: 'Every session starts in tune. Pluck each string; I will tell you tighter or looser.' },
      { id: 'posture', title: 'Posture check (camera)', type: 'posture', mins: 2, coach: 'Show me your fretting hand. Thumb behind the neck, fingers arched like you are holding a tennis ball.' },
      { id: 'chord:Em', title: 'Your first chord: Em', type: 'chord', chord: 'Em', mins: 2, coach: 'Two fingers, fifth and fourth strings, second fret. Strum all six.' },
      { id: 'chord:D6/9/F#', title: 'The secret second chord', type: 'chord', chord: 'D6/9/F#', mins: 2, coach: 'Slide those two fingers over: low E and G strings, second fret. That is the Horse With No Name sound.' },
      { id: 'change:Em-D6/9/F#', title: 'One-Minute Changes: Em ↔ D6/9', type: 'change', a: 'Em', b: 'D6/9/F#', mins: 2, target: 30 },
      { id: 'song:horse-no-name', title: 'PLAY: A Horse with No Name', type: 'song', song: 'horse-no-name', mins: 4 },
    ],
  },
  {
    id: 'four', title: 'The Four-Chord Universe', tagline: 'G, D, C, Em, Am: these 5 chords play hundreds of songs.', reward: "Knockin' on Heaven's Door",
    lessons: [
      { id: 'chord:G', title: 'G major', type: 'chord', chord: 'G', mins: 2 },
      { id: 'chord:D', title: 'D major', type: 'chord', chord: 'D', mins: 2 },
      { id: 'change:G-D', title: 'One-Minute Changes: G ↔ D', type: 'change', a: 'G', b: 'D', mins: 2, target: 30 },
      { id: 'chord:Am', title: 'A minor', type: 'chord', chord: 'Am', mins: 2 },
      { id: 'change:D-Am', title: 'One-Minute Changes: D ↔ Am', type: 'change', a: 'D', b: 'Am', mins: 2, target: 30 },
      { id: 'chord:C', title: 'C major', type: 'chord', chord: 'C', mins: 2 },
      { id: 'change:Am-C', title: 'One-Minute Changes: Am ↔ C (anchor finger!)', type: 'change', a: 'Am', b: 'C', mins: 2, target: 40 },
      { id: 'change:G-C', title: 'One-Minute Changes: G ↔ C', type: 'change', a: 'G', b: 'C', mins: 2, target: 30 },
      { id: 'song:knockin-heavens-door', title: "PLAY: Knockin' on Heaven's Door", type: 'song', song: 'knockin-heavens-door', mins: 5 },
    ],
  },
  {
    id: 'rhythm', title: 'Rhythm Is the Song', tagline: 'Your strumming hand is a pendulum. It never stops.', reward: 'Stand By Me',
    lessons: [
      { id: 'strum:quarters', title: 'Four downs, dead on the click', type: 'strum', pattern: 'quarters', chord: 'G', mins: 2, bpm: 70 },
      { id: 'strum:eighths', title: 'Down-up pendulum', type: 'strum', pattern: 'eighths', chord: 'G', mins: 2, bpm: 70 },
      { id: 'strum:oldFaithful', title: 'Old Faithful: D DU UDU', type: 'strum', pattern: 'oldFaithful', chord: 'C', mins: 3, bpm: 70 },
      { id: 'song:gym-50s', title: 'Gym: G–Em–C–D with Old Faithful', type: 'song', song: 'gym-50s', mins: 3 },
      { id: 'song:stand-by-me', title: 'PLAY: Stand By Me (capo 2)', type: 'song', song: 'stand-by-me', mins: 4 },
    ],
  },
  {
    id: 'riffs', title: 'Riffs & Power Chords', tagline: 'Two-finger power chords and single notes: the rock toolkit.', reward: 'Eye of the Tiger',
    lessons: [
      { id: 'riff:seven-nation-army', title: 'Riff: Seven Nation Army', type: 'riff', song: 'seven-nation-army', mins: 3 },
      { id: 'chord:E5', title: 'Power chord: E5', type: 'chord', chord: 'E5', mins: 1 },
      { id: 'chord:C5', title: 'Movable power chord: C5', type: 'chord', chord: 'C5', mins: 2 },
      { id: 'change:C5-Bb5', title: 'Slide it: C5 ↔ Bb5', type: 'change', a: 'C5', b: 'Bb5', mins: 2, target: 40 },
      { id: 'strum:rock', title: 'Palm-muted eighths', type: 'strum', pattern: 'rock', chord: 'C5', mins: 2, bpm: 90 },
      { id: 'riff:smoke-on-the-water', title: 'Riff: Smoke on the Water', type: 'riff', song: 'smoke-on-the-water', mins: 3 },
      { id: 'song:eye-of-the-tiger', title: 'PLAY: Eye of the Tiger', type: 'song', song: 'eye-of-the-tiger', mins: 4 },
    ],
  },
  {
    id: 'anchors', title: 'Shortcuts the Pros Use', tagline: 'Anchor fingers, capo tricks, and "cheat" chords that sound great.', reward: 'Wonderwall',
    lessons: [
      { id: 'chord:Cadd9', title: 'Cadd9 (fingers 3 & 4 stay put)', type: 'chord', chord: 'Cadd9', mins: 2 },
      { id: 'change:G-Cadd9', title: 'G ↔ Cadd9 (only two fingers move)', type: 'change', a: 'G', b: 'Cadd9', mins: 2, target: 45 },
      { id: 'chord:Em7', title: 'Em7', type: 'chord', chord: 'Em7', mins: 1 },
      { id: 'chord:Dsus4', title: 'Dsus4', type: 'chord', chord: 'Dsus4', mins: 1 },
      { id: 'chord:A7sus4', title: 'A7sus4', type: 'chord', chord: 'A7sus4', mins: 1 },
      { id: 'song:wonderwall', title: 'PLAY: Wonderwall (capo 2)', type: 'song', song: 'wonderwall', mins: 4 },
      { id: 'song:good-riddance', title: 'PLAY: Good Riddance', type: 'song', song: 'good-riddance', mins: 4 },
    ],
  },
  {
    id: 'pick', title: 'The Picking Hand (Rocky Ballad Prep)', tagline: 'Arpeggios, melody on top, and playing slow and free.', reward: 'Alone in the Ring étude',
    lessons: [
      { id: 'strum:pickArp', title: 'Arpeggio engine: bass-3-2-1', type: 'strum', pattern: 'pickArp', chord: 'Am', mins: 3, bpm: 60 },
      { id: 'chord:Dm', title: 'D minor', type: 'chord', chord: 'Dm', mins: 2 },
      { id: 'chord:E7', title: 'E7', type: 'chord', chord: 'E7', mins: 1 },
      { id: 'chord:Fmaj7', title: 'Fmaj7 (the friendly F)', type: 'chord', chord: 'Fmaj7', mins: 2 },
      { id: 'song:gym-minor-cinema', title: 'Gym: Cinematic Minor (Am–F–C–G)', type: 'song', song: 'gym-minor-cinema', mins: 3 },
      { id: 'riff:rocky-alone-in-the-ring', title: 'Melody: Empty Arena étude (top strings)', type: 'riff', song: 'rocky-alone-in-the-ring', mins: 4 },
      { id: 'song:rocky-alone-in-the-ring', title: 'PLAY: Alone in the Ring étude (capo 3 = C minor)', type: 'song', song: 'rocky-alone-in-the-ring', mins: 5 },
    ],
  },
  {
    id: 'barre', title: 'Barre Chord Breakthrough', tagline: 'F, Bm, B: the gate to every key.', reward: 'Let It Be · Creep · Hotel California',
    lessons: [
      { id: 'chord:F', title: 'Full F barre (minimum pressure!)', type: 'chord', chord: 'F', mins: 3 },
      { id: 'change:C-F', title: 'C ↔ F', type: 'change', a: 'C', b: 'F', mins: 2, target: 20 },
      { id: 'chord:Bm', title: 'Bm (A-shape barre)', type: 'chord', chord: 'Bm', mins: 3 },
      { id: 'song:let-it-be', title: 'PLAY: Let It Be', type: 'song', song: 'let-it-be', mins: 5 },
      { id: 'song:creep', title: 'PLAY: Creep', type: 'song', song: 'creep', mins: 5 },
    ],
  },
  {
    id: 'ear', title: 'Ear Training & Your Own Songs', tagline: 'Hear a chord and know it. Decode any song you love.', reward: 'Your whole library',
    lessons: [
      { id: 'ear:major-minor', title: 'Ear: major or minor?', type: 'ear', set: ['G', 'Em', 'C', 'Am', 'D'], mins: 3 },
      { id: 'ear:four', title: 'Ear: name the chord (G C D Em Am)', type: 'ear', set: ['G', 'C', 'D', 'Em', 'Am'], mins: 3 },
      { id: 'decoder', title: 'Decode a song you love (Song Decoder)', type: 'link', href: '#/decoder', mins: 5 },
    ],
  },
];

export const ALL_LESSONS = STAGES.flatMap((s, si) => s.lessons.map(l => ({ ...l, stage: si, stageTitle: s.title })));
export const lessonById = id => ALL_LESSONS.find(l => l.id === id);

// Problem → fix playbook (what great teachers say when they see/hear this).
export const FIXES = {
  buzz: ['Press right behind the fret wire, not in the middle of the space.', 'Use the very tip of the finger; trim your nails.', 'Arch the finger so it does not lean on the next string.', 'Squeeze less, but closer to the fret.'],
  muted: ['A finger is lying on a neighbor string. Arch more and bring your wrist forward.', 'Check each string one at a time to find the dead one.'],
  pain: ['Fingertip soreness is normal in weeks 1–3; calluses come with short, daily practice.', 'Press with the minimum force that stops the buzz.', 'Stop when it stings. Three 5-minute sessions beat one 15-minute grind.'],
  slowChange: ['Lift all fingers together as one shape and land them together.', 'Look for anchor fingers that can stay down between chords.', 'Practice "air changes" away from the guitar; mental practice helps too.', 'Do One-Minute Changes daily and log your score.'],
  rhythm: ['Keep the strumming hand moving down-up like a pendulum, even when you miss the strings.', 'Count out loud: "1 and 2 and…".', 'Slow the metronome until it feels easy, then add 5 bpm.'],
  fChord: ['Roll the index finger slightly onto its bony side.', 'Pull back with the arm (gravity) instead of squeezing with the thumb.', 'Use Fmaj7 until the barre rings out. It works in most songs.'],
};

// Build today's session: warm-up → review what's due → push the next new thing → finish with a song (always end on music).
export function planToday(state, minutes = 15) {
  const done = id => (state.skills[id]?.level || 0) >= 2;
  const due = Object.entries(state.skills).filter(([, s]) => s.due <= Date.now()).map(([id]) => id);
  const items = [];
  items.push({ ...lessonById('tune'), why: 'Warm-up' });
  const review = due.map(lessonById).filter(Boolean).filter(l => l.type !== 'tune').slice(0, minutes >= 20 ? 3 : 2);
  review.forEach(l => items.push({ ...l, why: 'Review (spaced repetition)' }));
  const next = ALL_LESSONS.filter(l => !done(l.id) && l.type !== 'tune' && !review.some(r => r.id === l.id));
  const newOnes = next.filter(l => l.type !== 'song').slice(0, minutes >= 20 ? 3 : 2);
  newOnes.forEach(l => items.push({ ...l, why: 'New skill' }));
  const songLesson = next.find(l => l.type === 'song') || ALL_LESSONS.filter(l => l.type === 'song' && done(l.id)).sort(() => Math.random() - 0.5)[0];
  if (songLesson) items.push({ ...songLesson, why: 'Song time: always finish with music' });
  return items;
}
