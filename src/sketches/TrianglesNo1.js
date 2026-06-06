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

const WAVE_SMOOTH_R = 6;

const segmentCenters = (p) => [
  [p.width * 0.25, p.height * 0.25],
  [p.width * 0.75, p.height * 0.25],
  [p.width * 0.25, p.height * 0.75],
  [p.width * 0.75, p.height * 0.75],
];

const sketch = (p) => {
  p.fft = null;
  p.fftTriColors = null;

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

    const baseHue = Math.random() * 360;
    const colorGen = new ColorGenerator(p, p.color(baseHue, 92, 94));
    p.fftTriColors = colorGen.getTetradic();

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
      drawFftTriangleCluster(p, waveSm, wlen, tx, ty, halfSize, p.fftTriColors[i]);
    }
  };

  p.onTrack1Cue = function (note) {
    randomizeFourSegmentBg(p);
  };

  p.onTrack2Cue = function (note) {
    if (note.midi === 36) {
      setFourSegmentOverlayOpacity(p, {
        topLeft: BD_BG_OVERLAY_OPACITY,
        topRight: SD_BG_OVERLAY_OPACITY,
        bottomLeft: SD_BG_OVERLAY_OPACITY,
        bottomRight: BD_BG_OVERLAY_OPACITY,
      });
    } else if (note.midi === 39) {
      setFourSegmentOverlayOpacity(p, {
        topLeft: SD_BG_OVERLAY_OPACITY,
        topRight: BD_BG_OVERLAY_OPACITY,
        bottomLeft: BD_BG_OVERLAY_OPACITY,
        bottomRight: SD_BG_OVERLAY_OPACITY,
      });
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
