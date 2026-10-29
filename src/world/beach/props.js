import THREE from "../../core/three.js?v=combat-48";
import { mesh, box, rod, ell, poly, shape } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
const wood = mat("#b7814e"),
  leaf = mat("#44875c"),
  leafLight = mat("#79a75a"),
  ivory = mat("#fff4d5"),
  red = mat("#e88263"),
  teal = mat("#378b93"),
  rock = mat("#a5afa4");
[wood, leaf, leafLight, ivory, red, teal, rock].forEach(
  (material) => (material.userData.shared = true),
);

export function palm(parent, x, z, size = 1, turn = 0) {
  const g = new THREE.Group();
  g.position.set(x, 0.04, z);
  g.scale.setScalar(size);
  g.rotation.y = turn;
  parent.add(g);
  const top = [0.75, 5.7, 0.1];
  for (let i = 0; i < 6; i++)
    rod(
      [i * i * 0.021, i * 0.95, 0],
      [(i + 1) * (i + 1) * 0.021, (i + 1) * 0.95, 0.01],
      0.2 - i * 0.013,
      wood,
      g,
      6,
    );
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2,
      d = [Math.cos(a), Math.sin(a)],
      v = [
        [top[0], top[1], top[2]],
        [
          top[0] + d[0] * 1.15 - d[1] * 0.48,
          6.1,
          top[2] + d[1] * 1.15 + d[0] * 0.48,
        ],
        [top[0] + d[0] * 1.15, 6.3, top[2] + d[1] * 1.15],
        [
          top[0] + d[0] * 1.15 + d[1] * 0.48,
          6.1,
          top[2] + d[1] * 1.15 - d[0] * 0.48,
        ],
        [top[0] + d[0] * 3.1, 4.85, top[2] + d[1] * 3.1],
      ];
    shape(
      v,
      [
        [0, 1, 2],
        [0, 2, 3],
        [1, 4, 2],
        [2, 4, 3],
      ],
      i % 2 ? leaf : leafLight,
      g,
    );
  }
  for (let i = 0; i < 3; i++)
    poly(
      [top[0] + Math.cos(i * 2) * 0.3, 5.6, Math.sin(i * 2) * 0.3],
      [0.22, 0.27, 0.22],
      wood,
      g,
      0,
    );
  return g;
}
export function umbrella(parent, x, z, color) {
  const g = new THREE.Group();
  g.position.set(x, 0.05, z);
  parent.add(g);
  rod([0, 0, 0], [0, 2.7, 0], 0.055, wood, g);
  const canopy = mesh(
    new THREE.ConeGeometry(1.45, 0.6, 8, 1, true),
    [mat(color), ivory],
    g,
  );
  canopy.position.y = 2.65;
  const pos = canopy.geometry;
  pos.clearGroups();
  for (let i = 0; i < 8; i++) pos.addGroup(i * 3, 3, i % 2);
  box([1.7, 0.14, 0.2], [0.8, 0.13, 2.0], ivory, g);
  box([1.7, 0.26, -0.55], [0.8, 0.15, 0.6], mat(color), g).rotation.x = -0.3;
}
export function lighthouse(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.06, z);
  parent.add(g);
  for (let i = 0; i < 4; i++) {
    const o = mesh(
      new THREE.CylinderGeometry(1.1 - i * 0.11, 1.23 - i * 0.11, 1.65, 12),
      i % 2 ? red : ivory,
      g,
    );
    o.position.y = 0.825 + i * 1.65;
  }
  const balcony = mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 0.23, 12),
    ivory,
    g,
  );
  balcony.position.y = 6.5;
  const lantern = mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.1, 8), teal, g);
  lantern.position.y = 7.1;
  const roof = mesh(new THREE.ConeGeometry(1.2, 0.8, 12), red, g);
  roof.position.y = 8.05;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rod(
      [Math.cos(a) * 1.5, 6.6, Math.sin(a) * 1.5],
      [Math.cos(a) * 1.5, 7.15, Math.sin(a) * 1.5],
      0.035,
      wood,
      g,
    );
  }
  box([0, 0.75, 1.24], [0.5, 1.5, 0.06], teal, g);
}
export function beachHut(parent, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0.1, z);
  g.rotation.y = -0.25;
  parent.add(g);
  box([0, 1.5, 0], [3.8, 3, 2.8], ivory, g);
  box([0, 1.1, 1.42], [0.9, 2.2, 0.07], teal, g);
  for (const s of [-1, 1])
    box([s * 1.22, 1.7, 1.43], [0.75, 0.8, 0.08], teal, g);
  const roof = mesh(new THREE.ConeGeometry(3.3, 1.5, 4), red, g);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.8;
  roof.position.y = 3.55;
  box([0, 0.08, 2.2], [4.6, 0.16, 1.6], wood, g);
}
export function pier(parent) {
  const g = new THREE.Group();
  g.position.set(-1, -0.03, 35);
  parent.add(g);
  for (let i = 0; i < 28; i++)
    box([0, 0.45, i * 0.58], [3.8, 0.23, 0.5], wood, g);
  for (let i = 0; i < 7; i++)
    for (const side of [-1, 1])
      rod([side * 1.8, -1, i * 2.3], [side * 1.8, 1.2, i * 2.3], 0.12, wood, g);
  box([2.7, 0.4, 12], [1.9, 0.65, 4.4], teal, g);
  box([2.7, 0.7, 12], [1.4, 0.1, 3.7], ivory, g);
}
export function createProps(parent, route) {
  // Keep fixed scenery outside the racing surface when its width changes.
  function clearRoad(x, z, margin) {
    const nearest = route.samples.reduce(
      (best, p) =>
        Math.hypot(p.x - x, p.z - z) < Math.hypot(best.x - x, best.z - z)
          ? p
          : best,
      route.samples[0],
    );
    const dx = x - nearest.x,
      dz = z - nearest.z,
      distance = Math.hypot(dx, dz),
      limit = route.width / 2 + margin;
    if (distance >= limit) return [x, z];
    return [
      nearest.x + (dx / Math.max(distance, 0.001)) * limit,
      nearest.z + (dz / Math.max(distance, 0.001)) * limit,
    ];
  }

  const palms = [
    [-43, 7, 1],
    [-40, 18, 0.9],
    [-26, 32, 1.1],
    [-18, 34, 0.95],
    [5, 33, 1.2],
    [17, 32, 0.8],
    [41, 8, 1.1],
    [41, -4, 0.9],
    [37, -22, 1.15],
    [14, -35, 0.9],
    [-7, -33, 1.1],
    [-29, -35, 0.85],
    [-46, -15, 0.9],
    [-17, 9, 0.8],
    [-7, -8, 1.1],
    [6, 6, 0.9],
    [14, -8, 0.8],
    [-23, -9, 1.05],
  ];
  palms.forEach(([x, z, s], i) => {
    const [px, pz] = clearRoad(x, z, 1.8);
    palm(parent, px, pz, s, i * 0.91);
  });
  for (const [x, z, c] of [
    [-33, 31, "#f0a352"],
    [-12, 34, "#50b4b1"],
    [10, 33, "#e97862"],
    [23, 30, "#f0a352"],
    [43, 0, "#50b4b1"],
  ]) {
    const [px, pz] = clearRoad(x, z, 3);
    umbrella(parent, px, pz, c);
  }
  lighthouse(parent, 38, -29);
  beachHut(parent, -16, 12);
  pier(parent);
  for (const [x, z] of [
    [-44, -25],
    [-45, -27],
    [-43, -29],
    [43, -31],
    [44, -28],
    [38, -36],
    [12, -36],
    [15, -37],
  ])
    poly([x, 0.5, z], [1.3, 1.2, 1], rock, parent, 0);
  for (let i = 0; i < 12; i++) {
    const x = Math.sin(i * 4.7) * 20 - 3,
      z = Math.cos(i * 3.1) * 10;
    if (route.distanceTo(x, z) > route.width / 2 + 2)
      poly([x, 0.45, z], [1.2, 0.8, 1.1], i % 2 ? leaf : leafLight, parent, 0);
  }
  // Two small sailboats offshore.
  for (const [x, z, angle] of [
    [-68, 7, 0.3],
    [48, 58, -0.6],
  ]) {
    const boat = new THREE.Group();
    boat.position.set(x, -0.2, z);
    boat.rotation.y = angle;
    parent.add(boat);
    ell([0, 0, 0], [1, 0.3, 2.8], ivory, boat, 8, 4);
    rod([0, 0, 0], [0, 4, 0], 0.035, wood, boat);
    shape(
      [
        [0, 4, 0],
        [0, 0.4, 0],
        [0, 0.4, 2.25],
      ],
      [[0, 1, 2]],
      ivory,
      boat,
    );
    shape(
      [
        [0, 3.5, -0.1],
        [0, 0.4, -0.1],
        [0, 0.4, -1.5],
      ],
      [[0, 1, 2]],
      red,
      boat,
    );
  }
}
