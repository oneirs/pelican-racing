import THREE from "../../core/three.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
import { CHUNK_LENGTH, randomAt } from "./path.js?v=coast-55";

const orange = mat("#f28b43"),
  white = mat("#fff6dc");
for (const material of [orange, white]) material.userData.shared = true;

export function obstaclePlacement(path, index) {
  const density = path.options?.obstacles ?? "normal";
  if (index < 0 || density === "off") return null;
  const interval = { light: 4, normal: 2, dense: 1 }[density];
  if (index % interval !== 0) return null;
  const start = index * CHUNK_LENGTH;
  const lane =
    index === 0
      ? path.width / 4
      : (Math.floor(randomAt(path.seed, index, 201) * 3) - 1) *
        (path.width / 4);
  return { distance: start + 40, lane };
}
export function addObstacles(root, path, index) {
  root.userData.obstacles = [];
  const placement = obstaclePlacement(path, index);
  if (!placement) return;
  const start = index * CHUNK_LENGTH;
  const pose = path.sample(placement.distance, placement.lane);
  const barrel = new THREE.Group();
  barrel.name = "dynamic-barrel";
  barrel.position.set(pose.point.x, path.height + 0.5, pose.point.z + start);
  root.add(barrel);
  const shell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.42, 1, 10),
    orange,
  );
  shell.castShadow = shell.receiveShadow = true;
  barrel.add(shell);
  for (const y of [-0.26, 0.26]) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.425, 0.425, 0.16, 10),
      white,
    );
    band.position.y = y;
    band.castShadow = true;
    barrel.add(band);
  }
  root.userData.obstacles.push({
    x: barrel.position.x,
    y: barrel.position.y,
    z: barrel.position.z,
    radius: 0.42,
    halfHeight: 0.5,
    mass: 12,
    breakable: path.options?.destruction !== false,
    mesh: barrel,
  });
}
