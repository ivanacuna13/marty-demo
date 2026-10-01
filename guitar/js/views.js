import { homeView, pathView } from './v_home.js';
import { lessonView } from './v_lesson.js';
import { tunerView, chordsView, cameraView } from './v_tools.js';
import { libraryView, songView } from './v_library.js';
import { rockyView, decoderView } from './v_rocky.js';
import { progressView, settingsView, methodView } from './v_misc.js';

export const VIEWS = {
  home: homeView, '': homeView, path: pathView, lesson: lessonView, tuner: tunerView, chords: chordsView, camera: cameraView,
  library: libraryView, song: songView, rocky: rockyView, decoder: decoderView, progress: progressView, settings: settingsView, method: methodView,
  ear: (root, _, app) => app.go('#/lesson/' + encodeURIComponent('ear:four')),
};
