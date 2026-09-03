const WAVE_STEPS = 240;
const SQ3H = Math.sqrt(3) / 2;

/** Equilateral triangle, apex up; centroid at origin. */
export const TRI_UP_EDGES = [
  { ax: 0, ay: -1, bx: SQ3H, by: 0.5, nx: SQ3H, ny: -0.5 },
  { ax: SQ3H, ay: 0.5, bx: -SQ3H, by: 0.5, nx: 0, ny: 1 },
  { ax: -SQ3H, ay: 0.5, bx: 0, by: -1, nx: -SQ3H, ny: -0.5 },
];

const GLOW_CENTER_LAYER = 3;
const GLOW_LAYER_ORDER = [0, 1, 2, 4, 5, 6, 3];

const normalize2 = (x, y) => {
  const len = Math.hypot(x, y) || 1;
  return { nx: x / len, ny: y / len };
};

const triOutlineNormal = (edges, edgeIdx, t, isFullEdge) => {
  const e = edges[edgeIdx];
  const prev = edges[(edgeIdx + 2) % 3];
  const next = edges[(edgeIdx + 1) % 3];
  if (isFullEdge) {
    if (t <= 0) return normalize2(prev.nx + e.nx, prev.ny + e.ny);
    if (t >= 1) return normalize2(e.nx + next.nx, e.ny + next.ny);
    return { nx: e.nx, ny: e.ny };
  }
  if (t >= 1) return normalize2(e.nx + next.nx, e.ny + next.ny);
  return { nx: e.nx, ny: e.ny };
};

export const drawFftTriangleOutline = (p, waveSm, wlen, cx, cy, halfSize, baseColor, edges) => {
  const rMax = halfSize * (0.36 / 0.22);
  const rMin = halfSize * (0.1 / 0.22);
  // Adaptive detail: tiny sierpinski leaves don't need 240 steps / 7 glows
  // halfSize 12 -> 14 steps, 150 -> 165 steps, 410 -> 240
  const adaptiveSteps = Math.max(12, Math.min(240, Math.floor(halfSize * 1.1)));
  const WAVE_STEPS_ADAPT = Math.floor(adaptiveSteps / 3) * 3;
  const stepsPerEdge = WAVE_STEPS_ADAPT / edges.length;
  const perimeterPts = stepsPerEdge + (edges.length - 1) * (stepsPerEdge - 1);
  const h0 = p.hue(baseColor);
  const s0 = p.saturation(baseColor);
  const b0 = p.brightness(baseColor);

  p.push();
  p.translate(cx, cy);
  p.blendMode(p.ADD);
  p.noFill();
  p.strokeCap(p.SQUARE);

  const L = halfSize;
  // Stroke relative to screen area / halfSize — fixes 360x490 too-thick vs 1600x800 good
  const refHalf = 410;
  const scale = p.constrain(halfSize / refHalf, 0.35, 1.8);
  const areaScale = Math.sqrt((p.width * p.height) / (1600 * 800));
  const s = p.constrain(scale * (0.7 + 0.3 * areaScale), 0.3, 2.0);
  // Glow layers: tiny tris only center glow (1 layer), medium 3, large 7
  const glowOrder = halfSize < 14 ? [3] : halfSize < 32 ? [0, 3, 6] : GLOW_LAYER_ORDER;
  for (const layer of glowOrder) {
    const distFromCenter = Math.abs(layer - GLOW_CENTER_LAYER);
    const alpha = p.map(distFromCenter, 0, GLOW_CENTER_LAYER, 0.8, 0.15);
    const w = layer === GLOW_CENTER_LAYER ? 32 * s : 3 * s;
    p.strokeWeight(Math.max(0.6, w));
    p.stroke((h0 + layer * 6) % 360, s0, b0, alpha);
    const layerOffset = (layer - GLOW_CENTER_LAYER) * 2.2 * s;

    let fx;
    let fy;
    let px0;
    let py0;
    let idx = 0;
    for (let e = 0; e < edges.length; e++) {
      const { ax, ay, bx, by } = edges[e];
      const full = e === 0;
      const sMax = full ? stepsPerEdge : stepsPerEdge - 1;
      for (let s = 0; s < sMax; s++) {
        const t = full ? s / (stepsPerEdge - 1) : (s + 1) / (stepsPerEdge - 1);
        const px = p.lerp(ax, bx, t);
        const py = p.lerp(ay, by, t);
        const atCorner =
          (e === 0 && (s === 0 || s === stepsPerEdge - 1)) || (e > 0 && s === sMax - 1);
        const { nx: nnx, ny: nny } = triOutlineNormal(edges, e, t, full);
        const wi = p.floor(p.map(idx, 0, perimeterPts - 1, 0, wlen - 1));
        idx++;
        const wv = waveSm[wi] ?? 0;
        const env = p.constrain(Math.abs(wv), 0, 1);
        const waveDisp = atCorner ? 0 : p.map(env, 0, 1, rMin * 0.12, rMax);
        const totalDisp = waveDisp + layerOffset;
        const x = px * L + nnx * totalDisp;
        const y = py * L + nny * totalDisp;
        if (idx === 1) {
          fx = x;
          fy = y;
          px0 = x;
          py0 = y;
        } else {
          p.line(px0, py0, x, y);
          px0 = x;
          py0 = y;
        }
      }
    }
    p.line(px0, py0, fx, fy);
  }

  p.blendMode(p.BLEND);
  p.pop();
};

/** Vertical offset from cell center to top sub-triangle centroid (bbox center ≈ 0.5). */
const CLUSTER_CENTROID_Y = 0.5;

/** Three apex-up equilateral triangles forming one larger triangle, centered at (cx, cy). */
export const drawFftTriangleCluster = (p, waveSm, wlen, cx, cy, halfSize, baseColor) => {
  const h = halfSize;
  const topY = cy - CLUSTER_CENTROID_Y * h;
  drawFftTriangleOutline(p, waveSm, wlen, cx, topY, h, baseColor, TRI_UP_EDGES);
  drawFftTriangleOutline(p, waveSm, wlen, cx - SQ3H * h, topY + 1.5 * h, h, baseColor, TRI_UP_EDGES);
  drawFftTriangleOutline(p, waveSm, wlen, cx + SQ3H * h, topY + 1.5 * h, h, baseColor, TRI_UP_EDGES);
};
