import p5 from 'p5';
import '@lib/p5.audioReact.js';
import initCapture from '@lib/p5.capture.js';
import ColorGenerator from '@lib/p5.colorGenerator.js';
import {
  installFourSegmentBg,
  randomizeFourSegmentBg,
  setFourSegmentOverlayOpacity,
} from '@sketches/functions/fourSegmentBackground.js';
import { drawFftTriangleCluster } from '@sketches/functions/drawFftTriangleOutline.js';

const base = import.meta.env.BASE_URL || './';
const audioUrl = base + 'audio/TrianglesNo1.mp3';
const midiUrl = base + 'audio/TrianglesNo1.mid';
const BD_BG_OVERLAY_OPACITY = 0.8;
const SD_BG_OVERLAY_OPACITY = 0.5;
const LOOP_AUDIO = true;

const WAVE_SMOOTH_R = 6;

const segmentCenters = (p) => [
  [p.width * 0.25, p.height * 0.25],
  [p.width * 0.75, p.height * 0.25],
  [p.width * 0.25, p.height * 0.75],
  [p.width * 0.75, p.height * 0.75],
];

const SILENT_WAVE = new Float32Array(0);

// Cluster order: top-left, top-right, bottom-left, bottom-right
const CLUSTER_MASKS = [
  [true, false, false, false],
  [false, true, false, false],
  [false, false, true, false],
  [false, false, false, true],
];
const ALL_CLUSTER_MASK = [true, true, true, true];

const PATTERN_MAX_CUE = 256;

const isInPattern = (cue) => cue >= 1 && cue <= PATTERN_MAX_CUE;

const isAllClustersCue = (cue) =>
  (cue >= 97 && cue <= 128) || (cue >= 225 && cue <= 256);

const randomizeFftTriColors = (p) => {
  const colorGen = new ColorGenerator(p, p.color(p.random(360), 92, 94));
  p.fftTriColors = colorGen.getTetradic();
};

const TRACK2_CLEAR_RANGES = [
  [193, 253],
  [449, 509],
];
const NO_OVERLAY_OPACITY = 0;

const isTrack2ClearSection = (cue) =>
  TRACK2_CLEAR_RANGES.some(([start, end]) => cue >= start && cue <= end);

const BD_OVERLAY = {
  topLeft: BD_BG_OVERLAY_OPACITY,
  topRight: SD_BG_OVERLAY_OPACITY,
  bottomLeft: SD_BG_OVERLAY_OPACITY,
  bottomRight: BD_BG_OVERLAY_OPACITY,
};

const SD_OVERLAY = {
  topLeft: SD_BG_OVERLAY_OPACITY,
  topRight: BD_BG_OVERLAY_OPACITY,
  bottomLeft: BD_BG_OVERLAY_OPACITY,
  bottomRight: SD_BG_OVERLAY_OPACITY,
};

const CLEAR_OVERLAY = {
  topLeft: NO_OVERLAY_OPACITY,
  topRight: NO_OVERLAY_OPACITY,
  bottomLeft: NO_OVERLAY_OPACITY,
  bottomRight: NO_OVERLAY_OPACITY,
};

const FULL_FADE_OVERLAY = {
  topLeft: BD_BG_OVERLAY_OPACITY,
  topRight: BD_BG_OVERLAY_OPACITY,
  bottomLeft: BD_BG_OVERLAY_OPACITY,
  bottomRight: BD_BG_OVERLAY_OPACITY,
};

const pickRandomCornerMask = (p) => {
  let corner;
  if (p.fftPrevWasRandomCorner) {
    const options = [0, 1, 2, 3].filter((i) => i !== p.fftLastCorner);
    corner = options[p.floor(p.random(options.length))];
  } else {
    corner = p.floor(p.random(4));
  }
  p.fftLastCorner = corner;
  p.fftPrevWasRandomCorner = true;
  return [...CLUSTER_MASKS[corner]];
};

const sketch = (p) => {
  p.fft = null;
  p.fftTriColors = null;
  p.loopAudio = LOOP_AUDIO;
  p.fftClusterMask = [...CLUSTER_MASKS[0]];
  p.fftLastCorner = 0;
  p.fftPrevWasRandomCorner = false;

  p.setup = async () => {
    p.randomSeed(Date.now());
    installFourSegmentBg(p, { overlayOpacity: BD_BG_OVERLAY_OPACITY });

    p.pixelDensity(1);
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.angleMode(p.DEGREES);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.bgWrapperEl.appendChild(p.canvas);
    p.canvas.style.position = 'absolute';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '1';
    p.canvas.style.background = 'transparent';

    initCapture(p, { prefix: 'TrianglesNo1', enabled: false });

    randomizeFftTriColors(p);

    await p.loadSong(audioUrl, midiUrl, (data) => {
      p.midiPpq = data.header.ppq;
      p.midiBpm = 112;
      p.scheduleCueSet(data.tracks[1]?.notes ?? [], 'onTrack1Cue');
      p.scheduleCueSet(data.tracks[2]?.notes ?? [], 'onTrack2Cue', true);
    });

    p.fft = new p5.FFT();
    if (p.song) {
      p.song.disconnect();
      p.song.connect(p.fft);
      p.fft.gain.toDestination();
    }
  };

  p.draw = () => {
    if (!p.fft) return;

    p.clear();

    p.fft.analyze();
    let wave = p.fft.waveform();
    if (!wave?.length) wave = new Float32Array(1024);

    const wlen = wave.length;
    const waveSm = new Float32Array(wlen);
    const denom = 2 * WAVE_SMOOTH_R + 1;
    for (let i = 0; i < wlen; i++) {
      let sum = 0;
      for (let k = -WAVE_SMOOTH_R; k <= WAVE_SMOOTH_R; k++) {
        sum += wave[(i + k + wlen) % wlen] ?? 0;
      }
      waveSm[i] = sum / denom;
    }

    if (!p.fftTriColors?.length) return;

    const halfSize = p.min(p.width, p.height) * 0.1;

    for (let i = 0; i < 4; i++) {
      const [tx, ty] = segmentCenters(p)[i];
      const clusterWave = p.fftClusterMask[i] ? waveSm : SILENT_WAVE;
      drawFftTriangleCluster(p, clusterWave, wlen, tx, ty, halfSize, p.fftTriColors[i]);
    }
  };

  p.onTrack1Cue = function (note) {
    const cue = note.currentCue;
    if (isInPattern(cue)) {
      if (isAllClustersCue(cue)) {
        p.fftClusterMask = [...ALL_CLUSTER_MASK];
        p.fftPrevWasRandomCorner = false;
      } else {
        p.fftClusterMask = pickRandomCornerMask(p);
      }
    }

    randomizeFourSegmentBg(p);
    randomizeFftTriColors(p);
  };

  p.onTrack2Cue = function (note) {
    const cue = note.currentCue;
    const inClearSection = isTrack2ClearSection(cue);
    
    
    if (note.midi === 36) {
      console.log(note.currentCue);
      setFourSegmentOverlayOpacity(p, inClearSection ? CLEAR_OVERLAY : BD_OVERLAY);
    } else if (note.midi === 39) {
      console.log(note.currentCue);
      setFourSegmentOverlayOpacity(p, inClearSection ? FULL_FADE_OVERLAY : SD_OVERLAY);
    }
  };

  p.mouseClicked = () => {
    p.togglePlayback();
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
  };
};

new p5(sketch);
