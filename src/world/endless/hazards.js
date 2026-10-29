import THREE from "../../core/three.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
import { CHUNK_LENGTH, randomAt } from "./path.js?v=coast-55";

const rampMaterial = mat("#e5a755"), bumpMaterial = mat("#d58454");
const boostMaterial = mat("#46bfe3"), repairMaterial = mat("#65ca82"), symbolMaterial = mat("#fff7d7");
for (const material of [rampMaterial, bumpMaterial, boostMaterial, repairMaterial, symbolMaterial]) material.userData.shared = true;

export function addHazards(root, path, index) {
  const start = index * CHUNK_LENGTH;
  root.userData.terrain = [];
  root.userData.pickups = [];
  if (index < 0) return;
  const lane = (Math.floor(randomAt(path.seed, index, 621) * 3) - 1) * path.width / 4;
  if (index > 0 && index % 3 === 1 && path.options?.obstacles !== "off") {
    const bump = Math.floor(index / 3) % 2 === 1;
    const profile = bump
      ? [[10, 0], [14, 0.36], [18, 0], [22, 0.36], [26, 0]]
      : [[10, 0], [16, 0.7], [22, 0.7], [28, 0]];
    const vertices = [], indices = [];
    for (const [offset, height] of profile) {
      for (const edge of [-1.8, 1.8]) {
        const p = path.sample(start + offset, lane + edge).point;
        vertices.push(p.x, path.height + height + 0.015, p.z + start);
      }
      const i = vertices.length / 3 - 2;
      if (i) indices.push(i - 2, i - 1, i, i - 1, i + 1, i);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const model = new THREE.Mesh(geometry, bump ? bumpMaterial : rampMaterial);
    model.name = bump ? "terrain-bumps" : "terrain-ramp";
    model.receiveShadow = true; model.castShadow = true;
    root.add(model);
    root.userData.terrain.push({ vertices, indices, kind: bump ? "bumps" : "ramp" });
  }
  if (index % 2 !== 0) return;
  const kind = index % 4 === 0 ? "boost" : "repair";
  const p = path.sample(start + 22, lane).point;
  const pickup = new THREE.Group();
  pickup.name = `pickup-${kind}`;
  pickup.position.set(p.x, path.height + 1.1, p.z + start);
  const shell = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), kind === "boost" ? boostMaterial : repairMaterial);
  shell.castShadow = true; pickup.add(shell);
  const horizontal = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.13, 0.07), symbolMaterial);
  horizontal.position.z = 0.61; pickup.add(horizontal);
  if (kind === "repair") {
    const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.52, 0.07), symbolMaterial);
    vertical.position.z = 0.61; pickup.add(vertical);
  } else {
    horizontal.rotation.z = -0.55;
  }
  root.add(pickup);
  root.userData.pickups.push({ kind, x: p.x, y: pickup.position.y, z: pickup.position.z, mesh: pickup });
}
