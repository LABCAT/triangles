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

// Glow config for one draw call — stroke color/weight/offset depends only on
// baseColor + layer + halfSize, identical for every leaf. Computed once and
// reused across all leaves instead of allocating a p5.Color per leaf (243 leaves
// x 7 layers was ~1700 color objects + stroke state changes per frame).
const computeGlowSpec = (p, halfSize, baseColor) => {
  const h0 = p.hue(baseColor);
  const s0 = p.saturation(baseColor);
  const b0 = p.brightness(baseColor);
  // Adaptive detail: tiny sierpinski leaves don't need 240 steps / 7 glows
  // halfSize 12 -> 14 steps, 150 -> 165 steps, 410 -> 240
  const adaptiveSteps = Math.max(12, Math.min(240, Math.floor(halfSize * 1.1)));
  const steps = Math.floor(adaptiveSteps / 3) * 3;
  // Stroke relative to screen area / halfSize — fixes 360x490 too-thick vs 1600x800 good
  const refHalf = 410;
  const scale = p.constrain(halfSize / refHalf, 0.35, 1.8);
  const areaScale = Math.sqrt((p.width * p.height) / (1600 * 800));
  const s = p.constrain(scale * (0.7 + 0.3 * areaScale), 0.3, 2.0);
  // Glow layers: tiny tris only center glow (1 layer), medium 3, large 7
  const glowOrder = halfSize < 14 ? [3] : halfSize < 32 ? [0, 3, 6] : GLOW_LAYER_ORDER;
  return glowOrder.map((layer) => {
    const distFromCenter = Math.abs(layer - GLOW_CENTER_LAYER);
    const alpha = p.map(distFromCenter, 0, GLOW_CENTER_LAYER, 0.8, 0.15);
    const weight = Math.max(0.6, layer === GLOW_CENTER_LAYER ? 32 * s : 3 * s);
    const offset = (layer - GLOW_CENTER_LAYER) * 2.2 * s;
    return { layer, color: p.color((h0 + layer * 6) % 360, s0, b0, alpha), weight, offset, steps };
  });
};

// Draws the perimeter of ONE leaf for ONE glow layer. Stroke/blend state is set
// by the caller once per layer; this only emits lines (absolute coords, no save()).
const drawLeafLayer = (p, waveSm, wlen, cx, cy, halfSize, edges, spec) => {
  const rMax = halfSize * (0.36 / 0.22);
  const rMinEdge = halfSize * (0.1 / 0.22) * 0.12;
  const stepsPerEdge = spec.steps / edges.length;
  const perimeterPts = stepsPerEdge + (edges.length - 1) * (stepsPerEdge - 1);
  const wScale = (wlen - 1) / (perimeterPts - 1);
  const L = halfSize;
  const { offset } = spec;

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
      const px = ax + (bx - ax) * t;
      const py = ay + (by - ay) * t;
      const atCorner =
        (e === 0 && (s === 0 || s === stepsPerEdge - 1)) || (e > 0 && s === sMax - 1);
      const { nx: nnx, ny: nny } = triOutlineNormal(edges, e, t, full);
      const wi = Math.min(wlen - 1, Math.floor(idx * wScale));
      idx++;
      const wv = waveSm[wi] ?? 0;
      const env = Math.abs(wv);
      const waveDisp = atCorner ? 0 : rMinEdge + env * (rMax - rMinEdge);
      const totalDisp = waveDisp + offset;
      const x = cx + px * L + nnx * totalDisp;
      const y = cy + py * L + nny * totalDisp;
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
  const specs = computeGlowSpec(p, halfSize, baseColor);

  p.push();
  p.blendMode(p.ADD);
  p.noFill();
  p.strokeCap(p.SQUARE);
  for (const spec of specs) {
    p.strokeWeight(spec.weight);
    p.stroke(spec.color);
    drawLeafLayer(p, waveSm, wlen, cx, cy, halfSize, edges, spec);
  }
  p.blendMode(p.BLEND);
  p.pop();
};

/** Vertical offset from cell center to top sub-triangle centroid (bbox center ≈ 0.5). */
const CLUSTER_CENTROID_Y = 0.5;

export { drawLeafLayer, computeGlowSpec };

/** Three apex-up equilateral triangles forming one larger triangle, centered at (cx, cy). */
export const drawFftTriangleCluster = (p, waveSm, wlen, cx, cy, halfSize, baseColor) => {
  const h = halfSize;
  const topY = cy - CLUSTER_CENTROID_Y * h;
  drawFftTriangleOutline(p, waveSm, wlen, cx, topY, h, baseColor, TRI_UP_EDGES);
  drawFftTriangleOutline(p, waveSm, wlen, cx - SQ3H * h, topY + 1.5 * h, h, baseColor, TRI_UP_EDGES);
  drawFftTriangleOutline(p, waveSm, wlen, cx + SQ3H * h, topY + 1.5 * h, h, baseColor, TRI_UP_EDGES);
};
