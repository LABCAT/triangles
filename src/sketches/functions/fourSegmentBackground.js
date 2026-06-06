const chromaRgb = (p, h, sat, bri) => {
  p.push();
  p.colorMode(p.HSB, 360, 100, 100);
  const hh = ((h % 360) + 360) % 360;
  const c = p.color(hh, p.constrain(sat, 0, 100), p.constrain(bri, 0, 100));
  const out = { r: Math.round(p.red(c)), g: Math.round(p.green(c)), b: Math.round(p.blue(c)) };
  p.pop();
  return out;
};

const biasedHue = (p, variant, salt, driftDeg, hueSkew) => {
  const roll = p.random();
  let h;
  if (roll < 0.2) h = p.random(4, 46);
  else if (roll < 0.36) h = p.random(46, 88);
  else if (roll < 0.52) h = p.random(275, 348);
  else if (roll < 0.66) h = p.random(248, 275);
  else if (roll < 0.78) h = p.random(88, 148);
  else if (roll < 0.88) h = p.random(0, 18);
  else if (roll < 0.94) h = p.random(148, 172);
  else h = p.random(188, 218);
  h = (h + hueSkew + variant * driftDeg + salt * 17 + p.random(-22, 22) + 360) % 360;
  if (p.random() < 0.24) h = (h + 180) % 360;
  return h;
};

const rgbToHex = (r, g, b) =>
  `#${[r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    })
    .join('')}`;

const rgba = (r, g, b, a) => `rgba(${r}, ${g}, ${b}, ${a})`;

export const generateBottomGradient = (p, variant = 0) => {
  const angleShift = variant * 107 + p.random(-22, 22);
  const radialX = variant === 0 ? p.random(6, 38) : p.random(62, 94);
  const radialY = variant === 0 ? p.random(18, 52) : p.random(48, 88);
  const radialX2 = variant === 0 ? p.random(10, 42) : p.random(58, 90);
  const radialY2 = variant === 0 ? p.random(22, 58) : p.random(42, 78);
  const spineDeg = 165 + variant * 50 + p.random(-14, 14);
  const hueSkew = variant === 0 ? 0 : 58;
  const drift = 47;
  const generateDarkColor = () => {
    if (p.random() < 0.08) return chromaRgb(p, biasedHue(p, variant, 9, drift, hueSkew), p.random(10, 32), p.random(38, 62));
    return chromaRgb(p, biasedHue(p, variant, 1, drift, hueSkew), p.random(48, 92), p.random(32, 58));
  };
  const generateMediumColor = () =>
    chromaRgb(p, biasedHue(p, variant, 2, drift, hueSkew), p.random(50, 92), p.random(48, 82));
  const generateBrightColor = () =>
    chromaRgb(p, biasedHue(p, variant, 3, drift, hueSkew), p.random(72, 100), p.random(76, 100));
  const generateColor = (preferDark = false) => {
    if (preferDark) return p.random() < 0.5 ? generateDarkColor() : generateMediumColor();
    const rand = p.random();
    if (rand < 0.28) return generateDarkColor();
    if (rand < 0.72) return generateMediumColor();
    return generateBrightColor();
  };
  const generateWhite = () =>
    p.random() < 0.1
      ? chromaRgb(p, p.random(28, 48), p.random(10, 28), p.random(90, 100))
      : generateMediumColor();
  const gradients = [];
  const color1 = generateColor(variant === 0);
  const alpha1 = 0.32 + p.random(0.2);
  const angle1 = (p.random(360) + angleShift + 360) % 360;
  const fade1 = 30 + p.random(20);
  gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
  const color2a = generateColor(true);
  const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
  gradients.push(`linear-gradient(${spineDeg}deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
  const color3a = generateColor(true);
  const color3b = generateMediumColor();
  const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
  const angle3 = (p.random(360) + angleShift * 0.85 + 360) % 360;
  const stop3 = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
  const color4a = generateColor(true);
  const color4b = generateMediumColor();
  const color4c = generateWhite();
  const angle4 = (p.random(360) + angleShift * 1.1 + 360) % 360;
  const stop4 = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
  const color5a = generateColor(true);
  const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
  const size5 = 150 + p.random(100);
  const size5y = size5 * (1.8 + p.random(1.2));
  const pos5x = p.constrain(radialX + p.random(-6, 6), 0, 100);
  const pos5y = p.constrain(radialY + p.random(-8, 8), 0, 100);
  gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
  const color6a = generateColor(true);
  const color6b = generateMediumColor();
  const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
  const angle6 = (p.random(360) + angleShift * 0.75 + 360) % 360;
  const stop6a = p.random(10);
  const stop6b = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
  const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
  const color7b = generateMediumColor();
  const color7c = generateWhite();
  const size7 = 120 + p.random(80);
  const size7y = size7 * (1.2 + p.random(0.6));
  const pos7x = p.constrain(radialX2 + p.random(-5, 5), 0, 100);
  const pos7y = p.constrain(radialY2 + p.random(-7, 7), 0, 100);
  const stop7 = 40 + p.random(20);
  gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
  if (p.random() < 0.45) {
    const i = 1 + p.floor(p.random(5));
    const t = gradients[i];
    gradients[i] = gradients[i + 1];
    gradients[i + 1] = t;
  }
  return gradients.join(', ');
};

export const generateTopGradient = (p, variant = 0) => {
  const angleShift = variant * 127 + p.random(-22, 22);
  const radialX = variant === 0 ? p.random(8, 40) : p.random(60, 92);
  const radialY = variant === 0 ? p.random(20, 55) : p.random(45, 85);
  const radialX2 = variant === 0 ? p.random(12, 44) : p.random(56, 88);
  const radialY2 = variant === 0 ? p.random(25, 60) : p.random(40, 75);
  const spineDeg = 175 + variant * 55 + p.random(-16, 16);
  const hueSkew = variant === 0 ? -72 : 104;
  const drift = 61;
  const generateDarkColor = () => {
    if (p.random() < 0.08) return chromaRgb(p, biasedHue(p, variant, 8, drift, hueSkew), p.random(10, 30), p.random(36, 60));
    return chromaRgb(p, biasedHue(p, variant, 4, drift, hueSkew), p.random(46, 90), p.random(30, 56));
  };
  const generateMediumColor = () =>
    chromaRgb(p, biasedHue(p, variant, 5, drift, hueSkew), p.random(50, 90), p.random(46, 80));
  const generateBrightColor = () =>
    chromaRgb(p, biasedHue(p, variant, 6, drift, hueSkew), p.random(72, 100), p.random(74, 100));
  const generateColor = (preferDark = false) => {
    if (preferDark) return p.random() < 0.48 ? generateDarkColor() : generateMediumColor();
    const rand = p.random();
    if (rand < 0.26) return generateDarkColor();
    if (rand < 0.7) return generateMediumColor();
    return generateBrightColor();
  };
  const generateWhite = () =>
    p.random() < 0.1
      ? chromaRgb(p, p.random(0, 360), p.random(8, 26), p.random(90, 100))
      : generateMediumColor();
  const gradients = [];
  const color1 = generateColor(variant === 1);
  const alpha1 = 0.32 + p.random(0.2);
  const angle1 = (p.random(360) + angleShift + 360) % 360;
  const fade1 = 30 + p.random(20);
  gradients.push(`linear-gradient(${angle1}deg, ${rgba(color1.r, color1.g, color1.b, alpha1)} 0%, rgba(0, 0, 0, 0) ${fade1}%)`);
  const color2a = generateColor(true);
  const color2b = p.random() < 0.7 ? generateMediumColor() : generateColor(true);
  gradients.push(`linear-gradient(${spineDeg}deg, ${rgbToHex(color2a.r, color2a.g, color2a.b)} 0%, ${rgbToHex(color2b.r, color2b.g, color2b.b)} 100%)`);
  const color3a = generateColor(true);
  const color3b = generateMediumColor();
  const color3c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
  const angle3 = (p.random(360) + angleShift * 0.9 + 360) % 360;
  const stop3 = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle3}deg, ${rgbToHex(color3a.r, color3a.g, color3a.b)} 0%, ${rgbToHex(color3b.r, color3b.g, color3b.b)} ${stop3}%, ${rgbToHex(color3c.r, color3c.g, color3c.b)} 100%)`);
  const color4a = generateColor(true);
  const color4b = generateMediumColor();
  const color4c = generateWhite();
  const angle4 = (p.random(360) + angleShift * 1.05 + 360) % 360;
  const stop4 = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle4}deg, ${rgbToHex(color4a.r, color4a.g, color4a.b)} 0%, ${rgbToHex(color4b.r, color4b.g, color4b.b)} ${stop4}%, ${rgbToHex(color4c.r, color4c.g, color4c.b)} 100%)`);
  const color5a = generateColor(true);
  const color5b = p.random() < 0.4 ? generateBrightColor() : generateMediumColor();
  const size5 = 150 + p.random(100);
  const size5y = size5 * (1.8 + p.random(1.2));
  const pos5x = p.constrain(radialX + p.random(-6, 6), 0, 100);
  const pos5y = p.constrain(radialY + p.random(-8, 8), 0, 100);
  gradients.push(`radial-gradient(${size5}% ${size5y}% at ${pos5x}% ${pos5y}%, ${rgbToHex(color5a.r, color5a.g, color5a.b)} 0%, ${rgbToHex(color5b.r, color5b.g, color5b.b)} 100%)`);
  const color6a = generateColor(true);
  const color6b = generateMediumColor();
  const color6c = p.random() < 0.3 ? generateBrightColor() : generateMediumColor();
  const angle6 = (p.random(360) + angleShift * 0.7 + 360) % 360;
  const stop6a = p.random(10);
  const stop6b = 40 + p.random(20);
  gradients.push(`linear-gradient(${angle6}deg, ${rgbToHex(color6a.r, color6a.g, color6a.b)} ${stop6a}%, ${rgbToHex(color6b.r, color6b.g, color6b.b)} ${stop6b}%, ${rgbToHex(color6c.r, color6c.g, color6c.b)} 100%)`);
  const color7a = p.random() < 0.3 ? generateBrightColor() : generateColor(true);
  const color7b = generateMediumColor();
  const color7c = generateWhite();
  const size7 = 120 + p.random(80);
  const size7y = size7 * (1.2 + p.random(0.6));
  const pos7x = p.constrain(radialX2 + p.random(-5, 5), 0, 100);
  const pos7y = p.constrain(radialY2 + p.random(-7, 7), 0, 100);
  const stop7 = 40 + p.random(20);
  gradients.push(`radial-gradient(${size7}% ${size7y}% at ${pos7x}% ${pos7y}%, ${rgbToHex(color7a.r, color7a.g, color7a.b)} 0%, ${rgbToHex(color7b.r, color7b.g, color7b.b)} ${stop7}%, ${rgbToHex(color7c.r, color7c.g, color7c.b)} 100%)`);
  if (p.random() < 0.45) {
    const i = 1 + p.floor(p.random(5));
    const t = gradients[i];
    gradients[i] = gradients[i + 1];
    gradients[i + 1] = t;
  }
  return gradients.join(', ');
};

export const setFourSegmentBg = (p) => {
  const upperLeft = p.gradientTopLeft ?? generateTopGradient(p, 0);
  const upperRight = p.gradientTopRight ?? generateTopGradient(p, 1);
  const lowerLeft = p.gradientBottomLeft ?? generateBottomGradient(p, 0);
  const lowerRight = p.gradientBottomRight ?? generateBottomGradient(p, 1);
  const upperLeftBlend = 'soft-light, screen, overlay, difference, exclusion, overlay, normal';
  const upperRightBlend = 'overlay, soft-light, overlay, hue, lighten, screen, normal';
  const lowerBlend = 'overlay, lighten, overlay, soft-light, soft-light, overlay, normal';
  if (p.gradientTopLeftEl) {
    p.gradientTopLeftEl.style.background = upperLeft;
    p.gradientTopLeftEl.style.backgroundBlendMode = upperLeftBlend;
  }
  if (p.gradientTopRightEl) {
    p.gradientTopRightEl.style.background = upperRight;
    p.gradientTopRightEl.style.backgroundBlendMode = upperRightBlend;
  }
  if (p.gradientBottomLeftEl) {
    p.gradientBottomLeftEl.style.background = lowerLeft;
    p.gradientBottomLeftEl.style.backgroundBlendMode = lowerBlend;
  }
  if (p.gradientBottomRightEl) {
    p.gradientBottomRightEl.style.background = lowerRight;
    p.gradientBottomRightEl.style.backgroundBlendMode = lowerBlend;
  }
};

export const setFourSegmentOverlayOpacity = (p, { topLeft, topRight, bottomLeft, bottomRight }) => {
  if (p.bgOverlayTopLeftEl) p.bgOverlayTopLeftEl.style.opacity = String(topLeft);
  if (p.bgOverlayTopRightEl) p.bgOverlayTopRightEl.style.opacity = String(topRight);
  if (p.bgOverlayBottomLeftEl) p.bgOverlayBottomLeftEl.style.opacity = String(bottomLeft);
  if (p.bgOverlayBottomRightEl) p.bgOverlayBottomRightEl.style.opacity = String(bottomRight);
};

export const randomizeFourSegmentBg = (p) => {
  p.gradientTopLeft = generateTopGradient(p, 0);
  p.gradientTopRight = generateTopGradient(p, 1);
  p.gradientBottomLeft = generateBottomGradient(p, 0);
  p.gradientBottomRight = generateBottomGradient(p, 1);
  setFourSegmentBg(p);
};

const OVERLAY_CELL_STYLE =
  'position:absolute;background:#000;pointer-events:none;';

export const installFourSegmentBg = (p, { overlayOpacity = 0.1 } = {}) => {
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;inset:0;z-index:0;';
  p.gradientTopLeftEl = document.createElement('div');
  p.gradientTopLeftEl.style.cssText = 'position:absolute;top:0;left:0;width:50%;height:50%;';
  p.gradientTopRightEl = document.createElement('div');
  p.gradientTopRightEl.style.cssText = 'position:absolute;top:0;left:50%;width:50%;height:50%;';
  p.gradientBottomLeftEl = document.createElement('div');
  p.gradientBottomLeftEl.style.cssText = 'position:absolute;top:50%;left:0;width:50%;height:50%;';
  p.gradientBottomRightEl = document.createElement('div');
  p.gradientBottomRightEl.style.cssText = 'position:absolute;top:50%;left:50%;width:50%;height:50%;';
  p.bgOverlayTopLeftEl = document.createElement('div');
  p.bgOverlayTopLeftEl.style.cssText = `${OVERLAY_CELL_STYLE}top:0;left:0;width:50%;height:50%;opacity:${overlayOpacity};`;
  p.bgOverlayTopRightEl = document.createElement('div');
  p.bgOverlayTopRightEl.style.cssText = `${OVERLAY_CELL_STYLE}top:0;left:50%;width:50%;height:50%;opacity:${overlayOpacity};`;
  p.bgOverlayBottomLeftEl = document.createElement('div');
  p.bgOverlayBottomLeftEl.style.cssText = `${OVERLAY_CELL_STYLE}top:50%;left:0;width:50%;height:50%;opacity:${overlayOpacity};`;
  p.bgOverlayBottomRightEl = document.createElement('div');
  p.bgOverlayBottomRightEl.style.cssText = `${OVERLAY_CELL_STYLE}top:50%;left:50%;width:50%;height:50%;opacity:${overlayOpacity};`;
  wrapper.appendChild(p.gradientTopLeftEl);
  wrapper.appendChild(p.gradientTopRightEl);
  wrapper.appendChild(p.gradientBottomLeftEl);
  wrapper.appendChild(p.gradientBottomRightEl);
  wrapper.appendChild(p.bgOverlayTopLeftEl);
  wrapper.appendChild(p.bgOverlayTopRightEl);
  wrapper.appendChild(p.bgOverlayBottomLeftEl);
  wrapper.appendChild(p.bgOverlayBottomRightEl);
  document.body.insertBefore(wrapper, document.body.firstChild);
  p.bgWrapperEl = wrapper;
  randomizeFourSegmentBg(p);
};
