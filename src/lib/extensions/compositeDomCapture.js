/**
 * p5.capture extension: composite an async DOM/raster background under a 2D canvas.
 *
 * Circles (WebGL / p5 1.x) must snapshot the GL buffer *before* any await.
 * Triangles/rectangles (2D / p5 2.x) must *not* — an early drawImage reads an
 * empty buffer; awaiting the background (or rAF) lets the frame flush, then
 * draw the live canvas like rectangles' captureFrameWithBackground.
 */

export function compositeDomCaptureExtension({ background }) {
  if (typeof background !== 'function') {
    throw new TypeError(
      'compositeDomCaptureExtension: background must be async (p, width, height) => CanvasImageSource',
    );
  }

  return {
    async captureFrameWithBackground(p, canvasElt, frameNum) {
      const width = canvasElt.width;
      const height = canvasElt.height;
      const source = p.drawingContext?.canvas ?? canvasElt?.elt ?? canvasElt;

      let bgCanvas = null;
      try {
        bgCanvas = await background(p, width, height);
      } catch (err) {
        console.warn('compositeDomCapture: DOM background failed, using canvas layer only', err);
      }

      const compositeCanvas = document.createElement('canvas');
      compositeCanvas.width = width;
      compositeCanvas.height = height;
      const ctx = compositeCanvas.getContext('2d');
      if (bgCanvas) {
        try {
          ctx.drawImage(bgCanvas, 0, 0);
        } catch (err) {
          console.warn('compositeDomCapture: could not draw background canvas', err);
        }
      }
      ctx.drawImage(source, 0, 0);

      return new Promise((resolve) => {
        compositeCanvas.toBlob((blob) => {
          if (blob) {
            p.capturedFrames.push({
              blob,
              frameNumber: frameNum,
              filename: `${p.captureFilePrefix}_${p.nf(frameNum, 5)}.png`,
            });
          }
          resolve();
        }, 'image/png');
      });
    },
  };
}
