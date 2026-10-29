import THREE from "../core/three.js?v=combat-48";
import { rod, box, mesh } from "../core/geometry.js?v=combat-48";
export function createWeaponMount(materials, part) {
  const group = new THREE.Group();
  group.userData.partSlot = "weapon";
  group.name = "weapon-mount";
  box([0, -0.16, 0], [0.48, 0.1, 0.3], materials.metal, group);
  for (const x of [-0.18, 0.18]) rod([x, -0.3, 0], [x, 0, 0], 0.035, materials.tealDark, group);
  if (["launcher", "homing-launcher"].includes(part)) {
    rod([-0.62, 0, 0], [0.56, 0, 0], 0.18, materials.tealDark, group, 8);
    for (const x of [-0.59, 0.53]) {
      const rim = mesh(new THREE.TorusGeometry(0.18, 0.035, 5, 10), materials.metal, group);
      rim.position.x = x; rim.rotation.y = Math.PI / 2;
    }
    rod([0.54, 0, 0], [0.59, 0, 0], 0.145, materials.black, group, 10);
    box([-0.1, -0.22, 0], [0.14, 0.3, 0.14], materials.dark, group);
    box([0.12, 0.22, 0], [0.28, 0.06, 0.11], materials.orange, group);
    box([0.05, 0.31, 0], [0.04, 0.15, 0.055], materials.metal, group);
    for (const x of [-0.35, -0.22]) box([x, 0.14, 0], [0.055, 0.065, 0.24], materials.orange, group);
  }
  if (part === "homing-launcher") {
    rod([-1.02, 0, 0], [-0.58, 0, 0], 0.22, materials.tealDark, group, 8);
    const rear = mesh(new THREE.TorusGeometry(0.23, 0.045, 5, 10), materials.orange, group);
    rear.position.x = -1.02; rear.rotation.y = Math.PI / 2;
    box([-0.1, 0.36, 0], [0.38, 0.17, 0.2], materials.dark, group);
    box([0.1, 0.36, 0], [0.025, 0.11, 0.13], materials.orange, group);
  }
  return group;
}
