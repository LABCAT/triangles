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
  // Drum minis (separate from main sierpinski — main path untouched)
  p.kickPunch = 0;
  p.snarePunch = 0;
  p.kickFlash = 0;
  p.snareFlash = 0;
  p.hatJitter = 0;
  p.drumFilter = 0;
  p.filterCC = null;
  p.drumColorA = null;
  p.drumColorB = null;
  // recipes/note-envelopes.md pattern — tweaked for dramatic wash: slam near-black, hold for impact,
  // then snap open (ease-out quart) so most of the 4.35s drone shows the wild gradient.
  p.fullScreenEnvelope = { active: false, startTime: 0, duration: 0, startVal: 0.92, endVal: 0.02, hold: 0.16 };

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
    p.kickWaveSm = new Float32Array(1024);
    p.snareWaveSm = new Float32Array(1024);
    p._waveDenom = 2 * WAVE_SMOOTH_R + 1;

    randomizeFftTriColor();
    p.drumColorA = p.color(p.random(360), 92, 94);
    p.drumColorB = p.color(p.random(360), 92, 94);

    await p.loadSong(audioUrl, midiUrl, (data) => {
      p.midiPpq = data.header.ppq;
      p.midiBpm = 100;
      p.PPQ = data.header.ppq;
      p.bpm = 100;
      p.scheduleCueSet(data.tracks[10]?.notes ?? [], 'executeTrack10');
      p.scheduleCueSet(data.tracks[7]?.notes ?? [], 'executeTrack7');
      // Drums: Redrum 1 (tonejs track 2) — polyMode so every hit fires, handler filters by pitch
      p.scheduleCueSet(data.tracks[2]?.notes ?? [], 'executeDrums', true);
      // Filter sweep: Filter 1 (track 3) CC74 0->1 over 0-19.2s intro; fallback Filter 2 (track 17)
      p.filterCC = data.tracks[3]?.controlChanges?.[74] ?? data.tracks[17]?.controlChanges?.[74] ?? null;
    });

    p.fft = new p5.FFT();
    if (p.song) {
      p.song.disconnect();
      p.song.connect(p.fft);
      p.fft.gain.toDestination();
    }
  };

  const sampleFilterCC = (timeSec) => {
    const cc = p.filterCC;
    if (!cc?.length) return 1;
    if (timeSec <= cc[0].time) return cc[0].value;
    for (let i = 1; i < cc.length; i++) {
      if (timeSec <= cc[i].time) {
        const a = cc[i - 1];
        const b = cc[i];
        const span = b.time - a.time || 1;
        const t = (timeSec - a.time) / span;
        return a.value + (b.value - a.value) * t;
      }
    }
    return cc[cc.length - 1].value;
  };

  p.draw = () => {
    // recipes/note-envelopes.md base — big punchy wash: black-out hit, brief hold, snappy reveal
    if (p.fullScreenEnvelope.active) {
      const nowSec = p.getSongPlaybackTime?.() ?? 0;
      const elapsed = nowSec * 1000 - p.fullScreenEnvelope.startTime;
      const progress = p.constrain(elapsed / (p.fullScreenEnvelope.duration || 1), 0, 1);
      const hold = p.fullScreenEnvelope.hold ?? 0;
      let currentVal;
      if (progress < hold) {
        currentVal = p.fullScreenEnvelope.startVal; // slam to peak and hold for impact
      } else {
        const t = (progress - hold) / Math.max(1e-6, 1 - hold);
        const eased = 1 - Math.pow(1 - t, 4); // ease-out quart — reveal punches open fast
        currentVal = p.lerp(p.fullScreenEnvelope.startVal, p.fullScreenEnvelope.endVal, eased);
      }
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

    // Fullscreen sierpinski — sized from window dimensions (main path untouched)
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

    // --- Drum minis: kick top-left, snare top-right — the triangle leaves corners empty ---
    const songT = p.getSongPlaybackTime?.() ?? 0;
    if (p.filterCC?.length) p.drumFilter = sampleFilterCC(songT);
    else p.drumFilter = 1;
    if (p.kickPunch > 0) p.kickPunch *= 0.94;
    if (p.snarePunch > 0) p.snarePunch *= 0.94;
    if (p.kickFlash > 0) p.kickFlash *= 0.92;
    if (p.snareFlash > 0) p.snareFlash *= 0.92;
    if (p.hatJitter > 0) p.hatJitter *= 0.85;
    // Gate on filter: drums filtered shut (~0) -> minis hidden; open (~1) -> full
    if (p.drumFilter > 0.03 && p.drumColorA && p.drumColorB) {
      const kickWave = p.kickWaveSm;
      const snareWave = p.snareWaveSm;
      for (let i = 0; i < wlen; i++) {
        kickWave[i] = waveSm[i] * p.drumFilter * (0.4 + p.kickFlash * 5.0);
        snareWave[i] = waveSm[i] * p.drumFilter * (0.4 + p.snareFlash * 5.0);
      }
      const miniBase = Math.min(window.innerWidth, window.innerHeight) * 0.1;
      const my = window.innerHeight * 0.2;
      // LEFT/kick (snares ignored): single triangle swelling into full fractal +
      // white-out flash on kick, double-size bloom + shockwave. Hats shake.
      const kickHalf = miniBase * p.drumFilter * (1 + p.kickPunch * 1.0);
      const kickDepth = Math.floor(p.kickFlash * 3.99); // 0 -> 3 morph on hit
      const kickColor = p.color(
        (p.hue(p.drumColorA) + p.hatJitter * 40) % 360,
        92 * (1 - p.kickFlash),
        Math.min(100, 55 + p.kickFlash * 45),
      );
      const lx = window.innerWidth * 0.14 + (p.hatJitter * 12 - 6);
      const echoA = p.color(p.hue(kickColor), 92, 40);
      drawSierpinskiLevel(p, kickWave, wlen, lx, my, kickHalf * 1.3, echoA, kickDepth);
      drawSierpinskiLevel(p, kickWave, wlen, lx, my, kickHalf * 0.78, echoA, kickDepth);
      drawSierpinskiLevel(p, kickWave, wlen, lx, my, kickHalf, kickColor, kickDepth);
      // RIGHT/snare (kicks ignored): the star — single triangle swelling into full
      // fractal + white-out flash on snare, double-size bloom + shockwave. Hats shake.
      const snareHalf = miniBase * p.drumFilter * (1 + p.snarePunch * 1.0);
      const snareDepth = Math.floor(p.snareFlash * 3.99); // 0 -> 3 morph on hit
      const snareColor = p.color(
        (p.hue(p.drumColorB) + p.hatJitter * 40) % 360,
        92 * (1 - p.snareFlash),
        Math.min(100, 55 + p.snareFlash * 45),
      );
      const echoB = p.color(p.hue(snareColor), 92, 40);
      const rx = window.innerWidth * 0.86 + (p.hatJitter * 12 - 6);
      drawSierpinskiLevel(p, snareWave, wlen, rx, my, snareHalf * 1.3, echoB, snareDepth);
      drawSierpinskiLevel(p, snareWave, wlen, rx, my, snareHalf * 0.78, echoB, snareDepth);
      drawSierpinskiLevel(p, snareWave, wlen, rx, my, snareHalf, snareColor, snareDepth);
    }
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
      // Cue 1 keeps the setup color so the first triangle matches the first cue
      if (note.currentCue !== 1) randomizeFftTriColor();
      p.punch = 1;
      // console.log(`  -> RESET depth 0 triCount 1 hue ${Math.round(p.hue(p.fftTriColor))} ${isResetCue && L !== 1 ? '(mid 6/12)' : ''}`);
      return;
    }

    p.sierpDepth = finalDepth;
    randomizeFftTriColor();
    p.punch = 1;
    // console.log(`  -> NEW LAYER depth ${finalDepth} triCount ${triCount} hue ${Math.round(p.hue(p.fftTriColor))} punch 1`);
  };

  p.executeDrums = function (note) {
    // Redrum hits only feed the two flank minis — main sierpinski untouched
    const m = note.midi;
    if (m === 36) {
      p.kickPunch = 1; // bass/kick -> left mini depth 1->3 + punch
      p.kickFlash = 1;
      p.drumColorA = p.color(p.random(360), 92, 94);
    } else if (m === 37 || m === 38 || m === 40) {
      p.snarePunch = 1; // snare -> right mini bloom
      p.snareFlash = 1;
      p.drumColorB = p.color(p.random(360), 92, 94);
    } else if (m === 41 || m === 42 || m === 43 || m === 45) {
      p.hatJitter = 1; // hats -> right mini position jitter + leaf shimmer
    }
  };

  p.executeTrack7 = function (note) {
    // console.log('[Track7]', { cue: note.currentCue, midi: note.midi, name: note.name, time: note.time.toFixed(3), ticks: note.ticks, duration: note.duration?.toFixed(3), durationTicks: note.durationTicks });
    randomizeFullScreenBg(p);
    const { durationTicks } = note;
    const durationSec = (durationTicks / p.PPQ) * (60 / p.bpm);
    p.fullScreenEnvelope.active = true;
    p.fullScreenEnvelope.startTime = p.getSongPlaybackTime() * 1000;
    p.fullScreenEnvelope.duration = durationSec * 1000;
    p.fullScreenEnvelope.startVal = 0.92;
    p.fullScreenEnvelope.endVal = 0.02;
    p.fullScreenEnvelope.hold = 0.16;
    setFullScreenOverlayOpacity(p, 0.92);
    // console.log(`  -> envelope 0.92->0.02 quart-out (hold ${p.fullScreenEnvelope.hold}) over ${p.fullScreenEnvelope.duration.toFixed(0)}ms ticks:${durationTicks}`);
  };

  p.mouseClicked = () => {
    p.togglePlayback();
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
  };
};

new p5(sketch);
