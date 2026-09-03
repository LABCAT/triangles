export const sketchMetadata = {
  'number-1': {
    title: '#TrianglesNo1',
    description: 'A centered triangle.',
    sketch: 'TrianglesNo1.js',
  },
  'number-2': {
    title: '#TrianglesNo2',
    description: 'Four corner clusters, chromatic heat.',
    sketch: 'TrianglesNo2.js',
  }
};

export function getAllSketches() {
  return Object.keys(sketchMetadata).map(id => ({
    id,
    ...sketchMetadata[id],
  }));
}

export function getSketchById(id) {
  return sketchMetadata[id] || null;
}
