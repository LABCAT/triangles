import p5 from 'p5';
import '@lib/p5.audioReact.js';
import '../lib/p5.fps.js';
import ColorGenerator from '@lib/p5.colorGenerator.js';
import { drawSierpinskiLevel } from '@sketches/functions/drawSierpinski.js';
import {
  installFullScreenBg,
  randomizeFullScreenBg,
  setFullScreenOverlayOpacity,
} from '@sketches/functions/fullScreenBackground.js';

const base = import.meta.env.BASE_URL || './';
const audioUrl = base + 'audio/TrianglesNo2.mp3';
const midiUrl = base + 'audio/TrianglesNo2.mid';

const WAVE_SMOOTH_R = 6;
const LOOP_LEN = 15;
const RESET_CUES = [1, 6, 11]; // resets at 1, 6, 11 — third around 12 as requested
const LOOP_REPEATS = 3;
const SPLIT_MODE = 1;

const sketch = (p) => {
  p.loopAudio = true;
  p.fft = null;
  p.fftTriColor = null;
  p.sierpDepth = 0;
  p.punch = 0;
  // recipes/note-envelopes.md pattern — tweaked for 4.35s drones to become visible faster (was staying dark)
  p.fullScreenEnvelope = { active: false, startTime: 0, duration: 0, startVal: 0.75, endVal: 0.02 };

  const randomizeFftTriColor = () => {
    const colorGen = new ColorGenerator(p, p.color(p.random(360), 92, 94));
    p.fftTriColor = colorGen.getTetradic()[0];
  };

  p.setup = async () => {
    p.randomSeed(Date.now());
    installFullScreenBg(p, { overlayOpacity: 0.18 });
    // FPS badge — bottom-right lab-label; on by default, ?fps=0 to hide, window.toggleFps() / press F
    const params = new URLSearchParams(window.location.search);
    const wantsFps = !params.has('fps') || params.get('fps') !== '0';
    if (wantsFps) p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    // quick toggle key
    window.addEventListener('keydown', (e) => {
      if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) p.toggleFpsIndicator();
    });

    p.pixelDensity(1);
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.angleMode(p.DEGREES);
    p.colorMode(p.HSB, 360, 100, 100, 1);
    p.canvas.style.position = 'fixed';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '1';
    p.canvas.style.background = 'transparent';

    // Reuse buffers — avoids GC per frame (was new Float32Array each draw)
    p.waveSm = new Float32Array(1024);
    p._waveDenom = 2 * WAVE_SMOOTH_R + 1;

    randomizeFftTriColor();

    await p.loadSong(audioUrl, midiUrl, (data) => {
      p.midiPpq = data.header.ppq;
      p.midiBpm = 100;
      p.PPQ = data.header.ppq;
      p.bpm = 100;
      p.scheduleCueSet(data.tracks[10]?.notes ?? [], 'executeTrack10');
      p.scheduleCueSet(data.tracks[7]?.notes ?? [], 'executeTrack7');
    });

    p.fft = new p5.FFT();
    if (p.song) {
      p.song.disconnect();
      p.song.connect(p.fft);
      p.fft.gain.toDestination();
    }
  };

  p.draw = () => {
    // recipes/note-envelopes.md base + ease-out so 4.35s drones become visible quickly
    if (p.fullScreenEnvelope.active) {
      const nowSec = p.getSongPlaybackTime?.() ?? 0;
      const elapsed = nowSec * 1000 - p.fullScreenEnvelope.startTime;
      const progress = p.constrain(elapsed / (p.fullScreenEnvelope.duration || 1), 0, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic — 25% in = 58% faded
      const currentVal = p.lerp(p.fullScreenEnvelope.startVal, p.fullScreenEnvelope.endVal, eased);
      setFullScreenOverlayOpacity(p, currentVal);
      if (progress >= 1) p.fullScreenEnvelope.active = false;
    }

    p.clear();

    if (!p.fft || !p.fftTriColor) return;

    p.fft.analyze();
    let wave = p.fft.waveform();
    if (!wave?.length) wave = new Float32Array(1024);

    const wlen = wave.length;
    const waveSm = p.waveSm;
    const denom = p._waveDenom;
    // Smoothing + tone-down merged (was two loops) + reused buffer
    for (let i = 0; i < wlen; i++) {
      let sum = 0;
      for (let k = -WAVE_SMOOTH_R; k <= WAVE_SMOOTH_R; k++) {
        sum += wave[(i + k + wlen) % wlen] ?? 0;
      }
      waveSm[i] = (sum / denom) * 0.45;
    }

    // Fullscreen sierpinski — sized from window dimensions
    const SQRT3 = Math.sqrt(3);
    const maxByWidth = window.innerWidth / SQRT3;
    const maxByHeight = window.innerHeight / 1.5;
    const fitSize = Math.min(maxByWidth, maxByHeight);
    const baseHalf = fitSize * 0.77;
    // punch scale on cue — bigger for inner cues
    if (p.punch > 0) p.punch *= 0.82;
    const halfSize = baseHalf * (1 + p.punch * 0.22);
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2 + baseHalf * 0.25;

    drawSierpinskiLevel(p, waveSm, wlen, cx, cy, halfSize, p.fftTriColor, p.sierpDepth);
  };

  p.executeTrack10 = function (note) {
    const L = ((note.currentCue - 1) % LOOP_LEN) + 1;
    const repeat = Math.floor((note.currentCue - 1) / LOOP_LEN);
    const isResetCue = RESET_CUES.includes(L);
    const shouldReset = isResetCue;
    // depth restarts at each reset: [1,6,11] -> 1:0,2:1..5:4,6:0,7:1..10:4,11:0,12:1..15:4
    let rawDepth;
    if (L < 6) rawDepth = L - 1; // 1->0 ...5->4
    else if (L < 11) rawDepth = L - 6; // 6->0 ...10->4
    else rawDepth = L - 11; // 11->0 ...15->4
    const desiredDepth = Math.min(6, rawDepth);

    let finalShouldReset = shouldReset;
    let finalDepth = desiredDepth;
    if (SPLIT_MODE === 3) {
      finalShouldReset = note.currentCue === 1 || (isResetCue && note.currentCue !== 1 ? false : false);
      if (!finalShouldReset && repeat > 0) finalDepth = Math.min(6, rawDepth + repeat);
    } else if (SPLIT_MODE === 2) {
      finalShouldReset = (repeat % 2 === 0 && shouldReset) || note.currentCue === 1;
      if (!finalShouldReset && repeat % 2 === 1) finalDepth = Math.min(6, rawDepth + 1);
    } else {
      finalShouldReset = shouldReset;
      finalDepth = desiredDepth;
    }

    const triCount = finalDepth === 0 ? 1 : Math.pow(3, finalDepth);
    const hueBefore = p.fftTriColor ? Math.round(p.hue(p.fftTriColor)) : null;

    // console.log('[Track10]', { cue: note.currentCue, L, repeat, midi: note.midi, name: note.name, time: note.time.toFixed(3), ticks: note.ticks, depth: p.sierpDepth, desiredDepth: finalDepth, triCount, hueBefore, isResetCue });

    if (finalShouldReset) {
      p.sierpDepth = 0;
      randomizeFftTriColor();
      p.punch = 1;
      // console.log(`  -> RESET depth 0 triCount 1 hue ${Math.round(p.hue(p.fftTriColor))} ${isResetCue && L !== 1 ? '(mid 6/12)' : ''}`);
      return;
    }

    p.sierpDepth = finalDepth;
    randomizeFftTriColor();
    p.punch = 1;
    // console.log(`  -> NEW LAYER depth ${finalDepth} triCount ${triCount} hue ${Math.round(p.hue(p.fftTriColor))} punch 1`);
  };

  p.executeTrack7 = function (note) {
    // console.log('[Track7]', { cue: note.currentCue, midi: note.midi, name: note.name, time: note.time.toFixed(3), ticks: note.ticks, duration: note.duration?.toFixed(3), durationTicks: note.durationTicks });
    randomizeFullScreenBg(p);
    const { durationTicks } = note;
    const durationSec = (durationTicks / p.PPQ) * (60 / p.bpm);
    p.fullScreenEnvelope.active = true;
    p.fullScreenEnvelope.startTime = p.getSongPlaybackTime() * 1000;
    p.fullScreenEnvelope.duration = durationSec * 1000;
    p.fullScreenEnvelope.startVal = 0.75;
    p.fullScreenEnvelope.endVal = 0.02;
    setFullScreenOverlayOpacity(p, 0.75);
    // console.log(`  -> envelope 0.75->0.02 cubic-out over ${p.fullScreenEnvelope.duration.toFixed(0)}ms ticks:${durationTicks}`);
  };

  p.mouseClicked = () => {
    p.togglePlayback();
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
  };
};

new p5(sketch);
