# Axel: AI guitar coach

A browser app that **hears** you (mic), **sees** your hands (camera), **talks** to you (voice in and out) and teaches with an 80/20 method. It's built around songs you love, including a Rocky training camp for *Alone in the Ring*.

No build step and no server code: it's static files.

## Run it

Camera and mic need `https://` or `localhost`.

```bash
cd marty-demo && python3 -m http.server 8000
# open http://localhost:8000/guitar/
```

If the repo is served on GitHub Pages, the app is at `/guitar/` on that site.

Optional superpowers (Settings → stored only in your browser):
- **Claude API key**: free conversation, live coaching from sensor data, and charts built on demand for any song, including whole playlists.
- **ElevenLabs key**: a studio-quality voice for Axel. Without it, the browser's built-in voice is used.

## What's inside

| Sense | How | Used for |
|---|---|---|
| Ears | YIN pitch, 12-bin chroma vs harmonic chord templates, AudioWorklet onset detector | Tuner, "which string is dead?", One-Minute Changes counter, strum timing grading, bar-by-bar song scoring, live chord naming |
| Eyes | MediaPipe HandLandmarker (21 points per hand) | Finger arch / flat-finger warnings, wrist bend, strum direction and rate, 👍 = next, ✋ = stop, avatar's eyes follow your hand |
| Voice | Web Speech TTS (or ElevenLabs), SpeechRecognition with wake word "Axel" | Hands-free: "Axel, show me F", "slower", "next", "open Wonderwall" |
| Brain | Claude (Opus 5.5) with app-control tools + live sensor context; offline rule brain fallback | Coaching, navigation, adding songs to the library |
| Hands | Karplus-Strong string synth + lookahead metronome | Axel plays chords, riffs and backing along with you |

**Screens:** Today (auto-built session) · Path (8 stages) · Library (49 songs, playlist import, chord-sheet import, wishlist) · Song player (play-along, tempo ramp, loop, bar scores) · Rocky Corner (7-day camp) · Song Decoder (audio file → tempo, key, capo suggestion, chord timeline, melody → tab) · Chord Finder · Tuner · Camera Coach · Progress · Method · Settings.

## The method (short version)
- Song-first, 80/20 order: a 2-chord song on day 1 → G C D Em Am → rhythm → riffs/power chords → pro shortcuts → picking (Rocky ballad prep) → barre chords → ear training and decoding your own songs.
- One-Minute Changes (counted by ear), aiming for about 30/min.
- An ~85% success target: tempo goes up 5 bpm at ≥90%, down 10% below 70%.
- Bar-level error finding plus looping (Duke et al. 2009).
- Spaced repetition and 10–20 min daily sessions (sleep consolidation, Walker et al. 2002).
- Full sources are on the in-app **Method** page.

## Copyright approach
Copyrighted songs carry **chord progressions and short teaching riffs only, never lyrics**. For exact parts, the user imports their own chord sheets, decodes recordings they own, or follows the lesson links. Public-domain songs include full melodies. The Rocky *Empty Arena* étude is an original practice piece in the mood of the cue, not Conti's melody.

## Files
```
guitar/
  index.html, css/app.css, manifest.webmanifest, icon.svg
  js/app.js        shell, router, sensors bar, coach dock, glue
  js/audio.js      ears: mic, YIN, chroma, onset worklet, offline analysis (decoder)
  js/vision.js     eyes: MediaPipe hands, posture, strum tracking, gestures
  js/coach.js      voice + brain (Claude tools, offline brain)
  js/synth.js      plucked-string synth, metronome
  js/theory.js     notes, chord shapes (+ movable barre generator), recognition, tab DP
  js/songs.js      library    js/lessons.js  path, fixes, daily planner
  js/store.js      progress, spaced repetition   js/parser.js  chord-sheet + playlist parsers
  js/v_*.js        screens
```

## Roadmap (scoped, not built yet)
1. **Fret-exact vision:** detect the fretboard (keypoint model plus homography) so Axel can check each fingertip's string and fret, not just hand posture.
2. **Polyphonic transcription:** Spotify basic-pitch (TF.js) in the Decoder, with stem separation for full-band mixes, for real tabs from recordings.
3. **Playlist sync:** Spotify and Apple Music OAuth instead of CSV export, then auto-build charts for the whole playlist.
4. **Backend:** API-key proxy, accounts and cross-device sync, so no keys live in the browser.
5. **Smarter scoring:** HMM/Viterbi chord smoothing, audio-latency calibration, per-string clarity scores.
6. **Performance mode:** record takes, compare against earlier takes, share clips.
7. **Gamification:** weekly challenges, a "Rocky stairs" streak meter, unlockable songs.
