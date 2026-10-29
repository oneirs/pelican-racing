import THREE from "../../core/three.js?v=combat-48";
import { box, rod, shape } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
export function createBoneSaw() {
  const tool = new THREE.Group();
  tool.name = "bone-saw";
  const steel = new THREE.MeshStandardMaterial({
      color: "#c9d7d0",
      metalness: 0.65,
      roughness: 0.3,
      flatShading: true,
    }),
    grip = mat("#583f48");
  // Open handle, broad steel blade and individually modeled serrations.
  rod([0, -0.2, 0], [0, 0.2, 0], 0.05, grip, tool);
  rod([0, 0.2, 0], [0.3, 0.2, 0], 0.05, grip, tool);
  rod([0, -0.2, 0], [0.3, -0.2, 0], 0.05, grip, tool);
  rod([0.3, -0.2, 0], [0.3, 0.2, 0], 0.04, steel, tool);
  box([0.85, 0.035, 0], [1.14, 0.3, 0.045], steel, tool);
  for (let i = 0; i < 11; i++) {
    const x = 0.3 + i * 0.1;
    shape(
      [
        [x, -0.115, 0],
        [x + 0.1, -0.115, 0],
        [x + 0.055, -0.225, 0],
      ],
      [[0, 1, 2]],
      steel,
      tool,
    );
  }
  for (const x of [0.37, 1.32])
    box([x, 0.03, 0.03], [0.045, 0.045, 0.02], grip, tool);
  return tool;
}
