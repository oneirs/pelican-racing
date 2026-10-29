import THREE from "../core/three.js?v=combat-48";
import { shape, rod } from "../core/geometry.js?v=combat-48";

// The root is the mouth joint; +X is the rider's forward direction.
export function createAttackBeak(materials) {
  const group = new THREE.Group();
  group.name = "attack-beak";
  group.userData.partSlot = "weapon";
  const stations = [
    [0, 0, 0.20, 0.17],
    [0.30, -0.015, 0.25, 0.28],
    [1.35, -0.05, 0.22, 0.24],
    [3.35, -0.11, 0.16, 0.18],
    [5.30, -0.19, 0.08, 0.10],
    [6.20, -0.24, 0.008, 0.015],
  ];
  const vertices = [], faces = [], upper = [], topFaces = [];
  stations.forEach(([x, y, width, depth], i) => {
    for (let j = 0; j < 8; j++) {
      const angle = (j / 8) * Math.PI * 2;
      vertices.push([x, y - depth / 2 + Math.cos(angle) * depth / 2, Math.sin(angle) * width]);
      if (i) {
        const a = (i - 1) * 8 + j, b = (i - 1) * 8 + (j + 1) % 8;
        faces.push([a, b, a + 8], [b, b + 8, a + 8]);
      }
    }
    upper.push([x, y + 0.006, -width], [x, y + 0.045 * (1 - i / 6), 0], [x, y + 0.006, width]);
    if (i) {
      const a = (i - 1) * 3;
      topFaces.push([a, a + 1, a + 3], [a + 1, a + 4, a + 3], [a + 1, a + 2, a + 4], [a + 2, a + 5, a + 4]);
    }
  });
  // Close the broad root, retaining visibly angular gold and orange surfaces.
  for (let j = 1; j < 7; j++) faces.push([0, j + 1, j]);
  shape(vertices, faces, materials.billMat, group);
  shape(upper, topFaces, materials.billTop, group);
  for (const side of [-1, 1]) {
    for (let i = 1; i < stations.length; i++) {
      const a = stations[i - 1], b = stations[i];
      rod([a[0], a[1], side * a[2]], [b[0], b[1], side * b[2]], 0.012, materials.saddleMat, group, 5);
    }
  }
  group.userData.tip = new THREE.Vector3(6.20, -0.24, 0);
  return group;
}
