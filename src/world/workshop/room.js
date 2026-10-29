import THREE from "../../core/three.js?v=combat-48";
import { box, rod, poly, mesh } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
export function createWorkshopRoom(scene) {
  const room = new THREE.Group();
  scene.add(room);
  const cream = mat("#eee4d1"),
    mint = mat("#9dbab1"),
    dark = mat("#365961"),
    metal = mat("#b5c4bc", 0.4),
    orange = mat("#e9a65e"),
    white = mat("#f5f0df");
  box([0, -0.22, 0], [16, 0.4, 10], cream, room);
  box([0, 2.65, -4.1], [16, 5.8, 0.22], mint, room);
  box([-7.9, 2.1, -0.7], [0.22, 4.6, 6.8], mint, room);
  for (let x = -7; x < 8; x += 1)
    rod([x, 0.001, -4], [x, 0.001, 4.8], 0.009, metal, room, 4);
  for (let z = -4; z < 5; z += 1)
    rod([-7.8, 0.001, z], [7.8, 0.001, z], 0.009, metal, room, 4);
  // An ocean-facing window, storage cabinet and repair trolley.
  box([-4.8, 3.05, -3.94], [3.7, 2.4, 0.12], white, room);
  box([-4.8, 3.05, -3.84], [3.45, 2.16, 0.06], mat("#90cbd0"), room);
  box([-4.8, 2.55, -3.79], [3.45, 0.65, 0.035], mat("#59a9b7"), room);
  box([-4.8, 3.05, -3.73], [0.07, 2.2, 0.08], white, room);
  box([-4.8, 3.05, -3.73], [3.5, 0.07, 0.08], white, room);
  box([5.5, 1.5, -3.55], [2.8, 2.9, 0.8], cream, room);
  for (const x of [4.8, 6.2]) {
    box([x, 1.5, -3.09], [1.24, 2.6, 0.05], white, room);
    box([x - 0.35, 1.5, -3.02], [0.06, 0.35, 0.08], metal, room);
  }
  for (const x of [-5.3, 5.1]) {
    box([x, 0.85, 0.3], [1.1, 0.09, 0.7], metal, room);
    for (const side of [-1, 1])
      rod(
        [x + side * 0.42, 0.15, 0.3],
        [x + side * 0.42, 0.85, 0.3],
        0.035,
        metal,
        room,
      );
    box([x, 1.03, 0.3], [0.6, 0.25, 0.4], mint, room);
  }
  // Mobile stretcher: four casters, mattress, side rails and push handles.
  const stretcher = new THREE.Group(),
    wheels = [];
  room.add(stretcher);
  box([0, 0.42, -0.25], [3.4, 0.14, 1.3], metal, stretcher);
  for (const x of [-1.65, 1.65])
    for (const z of [-0.9, 0.4]) {
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.2, z);
      stretcher.add(wheel);
      const tire = mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.11, 12),
        dark,
        wheel,
      );
      tire.rotation.z = Math.PI / 2;
      const hub = mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 0.13, 8),
        metal,
        wheel,
      );
      hub.rotation.z = Math.PI / 2;
      wheels.push(wheel);
      rod([x, 0.25, z], [x, 1.15, z], 0.045, metal, stretcher);
    }
  box([0, 1.17, -0.25], [4.5, 0.15, 1.8], metal, stretcher);
  box([0, 1.33, -0.25], [4.3, 0.17, 1.65], dark, stretcher);
  box([-1.65, 1.46, -0.25], [0.8, 0.18, 1.25], mint, stretcher);
  for (const x of [-2.3, 2.3]) {
    for (const z of [-0.95, 0.45])
      rod([x, 1.15, z], [x, 1.7, z], 0.04, metal, stretcher);
    rod([x, 1.7, -0.95], [x, 1.7, 0.45], 0.05, mint, stretcher);
  }
  const straps = new THREE.Group();
  stretcher.add(straps);
  for (const x of [-0.55, 0.75]) {
    const belt = box(
      [x, 2.3, -0.25],
      [0.21, 0.09, 1.72],
      mat("#805f46"),
      straps,
    );
    box([x, 2.32, 0.46], [0.29, 0.12, 0.24], metal, straps);
    for (const z of [-1.08, 0.58])
      box([x, 1.82, z], [0.21, 1.02, 0.07], belt.material, straps);
  }
  straps.visible = false;
  // Lamp arm and faceted surgical light.
  rod([2.9, 0, -1.45], [2.9, 4.5, -1.45], 0.055, metal, room);
  rod([2.9, 4.5, -1.45], [0, 4.8, -0.4], 0.065, metal, room);
  const lamp = mesh(
    new THREE.CylinderGeometry(0.62, 0.75, 0.18, 8),
    white,
    room,
  );
  lamp.position.set(0, 4.55, -0.4);
  const bulbMaterial = new THREE.MeshStandardMaterial({
    color: "#ffedb0",
    emissive: "#ffdb85",
    emissiveIntensity: 0.8,
  });
  const bulb = mesh(
    new THREE.CylinderGeometry(0.53, 0.58, 0.025, 8),
    bulbMaterial,
    room,
  );
  bulb.position.set(0, 4.44, -0.4);
  const light = new THREE.PointLight("#fff1c1", 1.5, 7);
  light.position.set(0, 3.6, -0.4);
  room.add(light);
  // A pair of pleated curtains on a rail, sliding in from both sides.
  rod([-3.8, 4.7, 1], [3.8, 4.7, 1], 0.045, metal, room);
  for (const x of [-3.8, 3.8]) rod([x, 0, 1], [x, 4.7, 1], 0.045, metal, room);
  const curtains = [];
  for (const side of [-1, 1]) {
    const geometry = new THREE.PlaneGeometry(3.75, 4.15, 36, 1),
      p = geometry.attributes.position;
    for (let i = 0; i < p.count; i++)
      p.setZ(i, Math.cos((p.getX(i) + 1.875) * Math.PI * 8) * 0.055);
    geometry.computeVertexNormals();
    const material = mat("#3e8986");
    material.side = THREE.DoubleSide;
    const curtain = mesh(geometry, material, room);
    curtain.position.set(side * 3.5, 2.52, 1.02);
    curtain.scale.x = 0.14;
    curtains.push({ side, mesh: curtain });
  }
  // A small glowing cross gives the room a readable silhouette.
  box([0.4, 3.55, -3.9], [2.8, 1.3, 0.1], dark, room);
  box([0.4, 3.55, -3.8], [0.22, 0.85, 0.08], orange, room);
  box([0.4, 3.55, -3.8], [0.85, 0.22, 0.08], orange, room);
  const starGroup = new THREE.Group();
  room.add(starGroup);
  for (let i = 0; i < 6; i++) {
    const star = poly(
      [Math.sin(i * 2.4) * 1.6, 3.1 + (i % 3) * 0.25, 0.4],
      [0.09, 0.2, 0.08],
      orange,
      starGroup,
      0,
    );
    star.userData.phase = i;
  }
  starGroup.visible = false;
  return {
    room,
    stretcher,
    wheels,
    straps,
    curtains,
    light,
    bulbMaterial,
    starGroup,
  };
}
