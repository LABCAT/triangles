import p5 from 'p5';
import '@lib/p5.audioReact.js';
import '../lib/p5.fps.js';
import initCapture from '@labcat2020/p5.audioreactive-capture';

const base = import.meta.env.BASE_URL || './';
const audioUrl = base + 'audio/TrianglesNo3.mp3';
const midiUrl = base + 'audio/TrianglesNo3.mid';
const INITIAL_SHAPE_SIZE = 60;
const FILL_ALPHA = 63;
const CUE_TRACK = 1;
const MIDI_BPM = 114;

const shuffle = (items, p) => {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = p.floor(p.random(index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }
  return items;
};

const createTriangleGroups = (p, shapeSize) => {
  const groups = [];

  for (let x = 0; x < p.width + shapeSize; x += shapeSize * 2) {
    for (let y = 0; y < p.height + shapeSize; y += shapeSize * 2) {
      groups.push({
        x,
        y,
        shapeSize,
        r: p.random(255),
        g: p.random(255),
        b: p.random(255),
      });
    }
  }

  return shuffle(groups, p);
};

const drawTriangleGroup = (p, group) => {
  p.stroke(group.r, group.g, group.b);
  p.fill(group.r, group.g, group.b, FILL_ALPHA);

  for (let scale = 0.5; scale <= 8; scale *= 2) {
    p.triangle(
      group.x - group.shapeSize / scale,
      group.y + group.shapeSize / scale,
      group.x,
      group.y - group.shapeSize / scale,
      group.x + group.shapeSize / scale,
      group.y + group.shapeSize / scale,
    );
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

  p.resetAnimation = () => {
    p.cueGroups = [];
    p.cueStart = 0;
    p.cueDuration = 0;
    p.shapeSize = INITIAL_SHAPE_SIZE;
    p.background(0);
  };

  p.setup = async () => {
    p.randomSeed(Date.now());
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
    p.background(0);

    if (!p.cueGroups.length) return;

    const currentTime = p.getSongPlaybackTime?.() ?? 0;
    const progress = p.cueDuration > 0
      ? p.constrain((currentTime - p.cueStart) / p.cueDuration, 0, 1)
      : 1;
    const visibleCount = p.cueDuration > 0
      ? Math.min(p.cueGroups.length, Math.max(1, Math.ceil(progress * p.cueGroups.length)))
      : p.cueGroups.length;

    for (let index = 0; index < visibleCount; index += 1) {
      drawTriangleGroup(p, p.cueGroups[index]);
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

    p.shapeSize = shapeSize;
    p.cueStart = note.time ?? 0;
    p.cueDuration = note.duration
      ?? ((note.durationTicks ?? 0) / p.midiPpq) * (60 / p.midiBpm);
    p.cueGroups = createTriangleGroups(p, p.shapeSize);
    p.background(0);
  };

  p.mouseClicked = () => {
    p.togglePlayback();
  };

  p.windowResized = () => {
    p.resizeCanvas(window.innerWidth, window.innerHeight);
  };
};

new p5(sketch);
