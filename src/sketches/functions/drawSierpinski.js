import { drawFftTriangleOutline, TRI_UP_EDGES } from './drawFftTriangleOutline.js';

const SQ3H = Math.sqrt(3) / 2;

const collectLeaves = (cx, cy, halfSize, depth, out) => {
  if (halfSize < 6) return;
  if (depth === 0) {
    out.push({ cx, cy, halfSize });
    return;
  }
  const childHalf = halfSize / 2;
  collectLeaves(cx, cy - halfSize * 0.5, childHalf, depth - 1, out);
  collectLeaves(cx + SQ3H * 0.5 * halfSize, cy + halfSize * 0.25, childHalf, depth - 1, out);
  collectLeaves(cx - SQ3H * 0.5 * halfSize, cy + halfSize * 0.25, childHalf, depth - 1, out);
};

const drawRecursive = (p, waveSm, wlen, cx, cy, halfSize, baseColor, depth) => {
  if (halfSize < 6) return;
  if (depth === 0) {
    drawFftTriangleOutline(p, waveSm, wlen, cx, cy, halfSize, baseColor, TRI_UP_EDGES);
    return;
  }
  const childHalf = halfSize / 2;
  // Offsets for 3 upright children relative to parent centroid
  // Top: (0, -0.5*L), BR: ( SQ3H*0.5*L, 0.25*L), BL: (-SQ3H*0.5*L, 0.25*L)
  drawRecursive(p, waveSm, wlen, cx, cy - halfSize * 0.5, childHalf, baseColor, depth - 1);
  drawRecursive(p, waveSm, wlen, cx + SQ3H * 0.5 * halfSize, cy + halfSize * 0.25, childHalf, baseColor, depth - 1);
  drawRecursive(p, waveSm, wlen, cx - SQ3H * 0.5 * halfSize, cy + halfSize * 0.25, childHalf, baseColor, depth - 1);
};

export const drawSierpinskiLevel = (p, waveSm, wlen, cx, cy, halfSize, baseColor, depth) => {
  const d = Math.max(0, Math.min(5, Math.floor(depth)));
  drawRecursive(p, waveSm, wlen, cx, cy, halfSize, baseColor, d);
};

export const drawSierpinskiProgressive = (p, waveSm, wlen, cx, cy, halfSize, baseColor, depth, leavesToShow) => {
  const d = Math.max(0, Math.min(5, Math.floor(depth)));
  if (d === 0 || leavesToShow == null) {
    drawRecursive(p, waveSm, wlen, cx, cy, halfSize, baseColor, d);
    return;
  }
  const leaves = [];
  collectLeaves(cx, cy, halfSize, d, leaves);
  const total = leaves.length;
  const n = Math.max(1, Math.min(total, Math.floor(leavesToShow)));
  for (let i = 0; i < n; i++) {
    const leaf = leaves[i];
    // subtle hue/alpha variation per leaf for energy
    const jitter = (i / total) * 8;
    const c = p.color((p.hue(baseColor) + jitter) % 360, p.saturation(baseColor), p.brightness(baseColor));
    drawFftTriangleOutline(p, waveSm, wlen, leaf.cx, leaf.cy, leaf.halfSize, c, TRI_UP_EDGES);
  }
};
