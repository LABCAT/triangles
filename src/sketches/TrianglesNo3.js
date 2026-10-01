import p5 from 'p5';
import '@lib/p5.audioReact.js';
import '../lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';
import {
  installFullScreenBg,
  randomizeFullScreenBg,
  setFullScreenOverlayOpacity,
} from './functions/fullScreenBackground.js';

const base = import.meta.env.BASE_URL || './';
const audioUrl = base + 'audio/TrianglesNo3.mp3';
const midiUrl = base + 'audio/TrianglesNo3.mid';
const INITIAL_SHAPE_SIZE = 60;
const FILL_ALPHA = 63;
// Inner-triangle outlines are lifted to full brightness while keeping their hue
// (scale the channels so the strongest one hits max) — brighter, never washed white.
const STROKE_TARGET = 255;
// Inner outlines were 1px and vanished into the glow; a bolder line carries the
// vivid hue without needing to wash it white.
const INNER_STROKE = 2.2;
const CUE_TRACK = 1;
const MIDI_BPM = 114;

// Geometry is sized off the short axis so the figure reads the same on every
// device and never overflows the narrow side (portrait = width). 1080p is the
// reference look: scale is exactly 1 there.
const REFERENCE_MIN = 1080;
const screenScale = (p) => Math.min(p.width, p.height) / REFERENCE_MIN;

const shuffle = (items, p) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = p.floor(p.random(index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const createTriangleGroups = (p, shapeSize) => {
  const groups = [];
  // Unit is the design shape size scaled to the short axis; the 4.5x step puts
  // ~4 cells across the short side at the 60px base (portrait => ~4 columns).
  const unit = shapeSize * screenScale(p);
  const step = unit * 4.5;

  for (let x = 0; x < p.width + unit; x += step) {
    for (let y = 0; y < p.height + unit; y += step) {
      groups.push({
        x,
        y,
        shapeSize: unit * p.random(0.7, 1.3),
        r: p.random(255),
        g: p.random(255),
        b: p.random(255),
      });
    }
  }

  return shuffle(groups, p).slice(0, Math.ceil(groups.length * 0.6));
};

const drawTriangleGroup = (p, group, flash = 0, pop = 0) => {
  const k = screenScale(p); // stroke weights shrink with the geometry on small screens
  if (flash > 0) {
    p.stroke(
      p.lerp(group.r, 255, flash),
      p.lerp(group.g, 255, flash),
      p.lerp(group.b, 255, flash),
    );
    p.strokeWeight((1 + flash * 2.5) * k);
  } else {
    p.stroke(group.r, group.g, group.b);
    p.strokeWeight(k);
  }
  p.fill(group.r, group.g, group.b, FILL_ALPHA);

  const size = group.shapeSize * (1 + pop * 0.3);
  const scales = [0.5, 1, 2, 4];
  for (let s = 0; s < scales.length; s += 1) {
    const scale = scales[s];
    const x1 = group.x - size / scale;
    const y1 = group.y + size / scale;
    const x2 = group.x;
    const y2 = group.y - size / scale;
    const x3 = group.x + size / scale;
    const y3 = group.y + size / scale;

    if (scale === 0.5) {
      p.noFill();
      p.stroke(255, 255, 255, 26 + flash * 30);
      p.strokeWeight(9 * k);
      p.triangle(x1, y1, x2, y2, x3, y3);
      p.stroke(255, 255, 255, 65 + flash * 40);
      p.strokeWeight(4 * k);
      p.triangle(x1, y1, x2, y2, x3, y3);
      p.fill(group.r, group.g, group.b, FILL_ALPHA);
      p.stroke(255, 255, 255, 235);
      p.strokeWeight((1.5 + flash * 2) * k);
      p.triangle(x1, y1, x2, y2, x3, y3);
      continue;
    }

    const gain = STROKE_TARGET / Math.max(1, group.r, group.g, group.b);
    const sr = Math.min(255, group.r * gain);
    const sg = Math.min(255, group.g * gain);
    const sb = Math.min(255, group.b * gain);
    if (flash > 0) {
      p.stroke(p.lerp(sr, 255, flash), p.lerp(sg, 255, flash), p.lerp(sb, 255, flash));
      p.strokeWeight((INNER_STROKE + flash * 2.5) * k);
    } else {
      p.stroke(sr, sg, sb);
      p.strokeWeight(INNER_STROKE * k);
    }
    p.fill(group.r, group.g, group.b, FILL_ALPHA);
    p.triangle(x1, y1, x2, y2, x3, y3);
  }
};

const sketch = (p) => {
  p.loopAudio = false;
  p.shapeSize = INITIAL_SHAPE_SIZE;
  p.cueGroups = [];
  p.cueStart = 0;
  p.cueDuration = 0;
  p.cueCount = 0;
  p.midiPpq = 0;
  p.midiBpm = MIDI_BPM;
  p.punch = 0;
  p.fullScreenEnvelope = { active: false, startTime: 0, duration: 0, startVal: 0.92, endVal: 0.02, hold: 0.16 };

  p.resetAnimation = () => {
    p.cueGroups = [];
    p.cueStart = 0;
    p.cueDuration = 0;
    p.shapeSize = INITIAL_SHAPE_SIZE;
    p.punch = 0;
    p.fullScreenEnvelope.active = false;
    setFullScreenOverlayOpacity(p, 0.18);
    p.clear();
  };

  p.setup = async () => {
    p.randomSeed(Date.now());
    installFullScreenBg(p, { overlayOpacity: 0.18 });
    p.pixelDensity(1);
    p.createCanvas(window.innerWidth, window.innerHeight);
    p.colorMode(p.RGB, 255);
    p.background(0);
    p.strokeWeight(1);
    p.canvas.style.position = 'fixed';
    p.canvas.style.top = '0';
    p.canvas.style.left = '0';
    p.canvas.style.zIndex = '1';
    p.canvas.style.background = 'transparent';

    const params = new URLSearchParams(window.location.search);
    const wantsFps = !params.has('fps') || params.get('fps') !== '0';
    if (wantsFps) p.enableFpsIndicator();
    window.toggleFps = () => p.toggleFpsIndicator();
    window.addEventListener('keydown', (event) => {
      if (event.key.toLowerCase() === 'f' && !event.metaKey && !event.ctrlKey) {
        p.toggleFpsIndicator();
      }
    });

    initCapture(p, {
      prefix: 'TrianglesNo3',
      enabled: false,
    });

    await p.loadSong(audioUrl, midiUrl, (data) => {
      p.midiPpq = data.header.ppq;
      p.midiBpm = MIDI_BPM;
      const notes = data.tracks[CUE_TRACK]?.notes ?? [];
      p.cueCount = notes.length;
      p.scheduleCueSet(notes, 'executeCueSet1');
    });
  };

  p.draw = () => {
    if (p.fullScreenEnvelope.active) {
      const nowSec = p.getSongPlaybackTime?.() ?? 0;
      const elapsed = nowSec * 1000 - p.fullScreenEnvelope.startTime;
      const envProgress = p.constrain(elapsed / (p.fullScreenEnvelope.duration || 1), 0, 1);
      const hold = p.fullScreenEnvelope.hold ?? 0;
      let currentVal;
      if (envProgress < hold) {
        currentVal = p.fullScreenEnvelope.startVal;
      } else {
        const t = (envProgress - hold) / Math.max(1e-6, 1 - hold);
        const eased = 1 - Math.pow(1 - t, 4);
        currentVal = p.lerp(p.fullScreenEnvelope.startVal, p.fullScreenEnvelope.endVal, eased);
      }
      setFullScreenOverlayOpacity(p, currentVal);
      if (envProgress >= 1) p.fullScreenEnvelope.active = false;
    }

    p.clear();

    if (!p.cueGroups.length) return;

    if (p.punch > 0) p.punch *= 0.88;

    const currentTime = p.getSongPlaybackTime?.() ?? 0;
    const progress = p.cueDuration > 0
      ? p.constrain((currentTime - p.cueStart) / p.cueDuration, 0, 1)
      : 1;
    const visibleCount = p.cueDuration > 0
      ? Math.min(p.cueGroups.length, Math.max(1, Math.ceil(progress * p.cueGroups.length)))
      : p.cueGroups.length;
    const flashRaw = progress < 0.5 ? 1 - progress / 0.5 : 0;
    const flash = flashRaw * flashRaw;

    for (let index = 0; index < visibleCount; index += 1) {
      drawTriangleGroup(p, p.cueGroups[index], flash, p.punch);
    }
  };

  p.executeCueSet1 = (note) => {
    let shapeSize = Math.floor((note.durationTicks ?? 0) / 500);

    if (p.cueCount > 0 && note.currentCue === p.cueCount) {
      shapeSize += p.random(20, 40);
    } else if (shapeSize > 80) {
      shapeSize += p.random(-80, 0);
    } else {
      shapeSize += p.random(-10, 20);
    }

    shapeSize = Math.max(36, Math.min(100, Math.round(shapeSize)));

    p.shapeSize = shapeSize;
    p.cueStart = note.time ?? 0;
    p.cueDuration = note.duration
      ?? ((note.durationTicks ?? 0) / p.midiPpq) * (60 / p.midiBpm);
    p.cueGroups = createTriangleGroups(p, p.shapeSize);
    p.punch = 1;
    randomizeFullScreenBg(p);
    const durationSec = ((note.durationTicks ?? 0) / (p.midiPpq || 480)) * (60 / p.midiBpm);
    p.fullScreenEnvelope.active = true;
    p.fullScreenEnvelope.startTime = (p.getSongPlaybackTime?.() ?? p.cueStart) * 1000;
    p.fullScreenEnvelope.duration = Math.max(300, durationSec * 1000);
    p.fullScreenEnvelope.startVal = 0.92;
    p.fullScreenEnvelope.endVal = 0.02;
    p.fullScreenEnvelope.hold = 0.16;
    setFullScreenOverlayOpacity(p, 0.92);
  };

  p.mouseClicked = () => {
    p.togglePlayback();
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
    // Re-lay the grid against the new short axis so the figure keeps its scale.
    if (p.cueGroups.length) p.cueGroups = createTriangleGroups(p, p.shapeSize);
  };
};

new p5(sketch);
