import { shape, rod } from "../../core/geometry.js?v=combat-48";

// A small pleated mask stretched over the bill tip; most of the bill stays exposed.
export function createMedicalMask(parent, fabric, seam, strap) {
  const sections = [
    [1.62, 4.00, 3.56, 0.2],
    [1.80, 3.955, 3.57, 0.205],
    [2.02, 3.925, 3.60, 0.17],
    [2.25, 3.875, 3.63, 0.115],
  ];
  const vertices = [], faces = [];
  for (const [x, top, bottom, width] of sections) {
    vertices.push(
      [x, top, -width * 0.7], [x, top, width * 0.7],
      [x, top - 0.035, width], [x, bottom + 0.035, width],
      [x, bottom, width * 0.7], [x, bottom, -width * 0.7],
      [x, bottom + 0.035, -width], [x, top - 0.035, -width],
    );
  }
  for (let i = 0; i < sections.length - 1; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j, b = i * 8 + (j + 1) % 8;
      faces.push([a, b, a + 8], [b, b + 8, a + 8]);
    }
  const last = (sections.length - 1) * 8;
  for (let i = 1; i < 7; i++) faces.push([last, last + i, last + i + 1]);
  const mask = shape(vertices, faces, fabric, parent);
  mask.name = "bill-fitted-medical-mask";
  for (const side of [-1, 1]) {
    for (const fraction of [0.26, 0.5, 0.74])
      for (let i = 0; i < sections.length - 1; i++) {
        const points = [sections[i], sections[i + 1]].map(([x, top, bottom, width]) =>
          [x, bottom + (top - bottom) * fraction, side * (width + 0.008)]);
        rod(points[0], points[1], 0.01, seam, parent, 5);
      }
    const upper = [[-0.17, 4.23, side * 0.34], [0.65, 4.22, side * 0.32], [1.2, 4.08, side * 0.29], [1.62, 3.94, side * 0.21]];
    const lower = [[-0.17, 4.23, side * 0.34], [0.65, 3.72, side * 0.32], [1.2, 3.50, side * 0.29], [1.62, 3.60, side * 0.21]];
    for (const points of [upper, lower])
      for (let i = 0; i < points.length - 1; i++) rod(points[i], points[i + 1], 0.011, strap, parent, 5);
  }
  return mask;
}
