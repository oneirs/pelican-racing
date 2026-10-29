import THREE from "../../core/three.js?v=combat-48";
import { mesh, ell, rod, box, ring, shape } from "../../core/geometry.js?v=combat-48";
import { mat } from "../materials.js?v=combat-48";

export function createHelmet(bird, materials, character = {}) {
  const { dark } = materials;
  const helmetMat = mat(character.helmet ?? "#d53d45", 0.48),
    helmetStripe = mat(character.scarf ?? "#267c8b", 0.5);
  // Open-bottom helmet dome, trim, and ventilation inlays.
  const helmet = mesh(
    new THREE.SphereGeometry(1, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    helmetMat,
    bird,
  );
  helmet.position.set(0.17, 4.43, 0);
  helmet.scale.set(0.43, 0.235, 0.355);
  helmet.rotation.z = -0.08;
  const brim = ring([0.17, 4.425, 0], 1, 0.035, dark, bird, 36);
  brim.rotation.x = Math.PI / 2;
  brim.scale.set(0.43, 0.355, 1);
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const vent = ell(
        [-0.08 + i * 0.14, 4.6 - Math.abs(i - 1) * 0.025, side * 0.145],
        [0.07, 0.014, 0.035],
        helmetStripe,
        bird,
        8,
        5,
      );
      vent.rotation.z = 0.1 - i * 0.12;
    }
  const visor = ell(
    [0.52, 4.43, 0],
    [0.18, 0.035, 0.29],
    helmetMat,
    bird,
    12,
    5,
  );
  visor.rotation.z = -0.12;
  if (character.headPart === "guard") {
    for (const side of [-1, 1]) {
      box([0.12, 4.36, side * 0.34], [0.38, 0.18, 0.1], helmetStripe, bird);
      rod(
        [-0.17, 4.45, side * 0.32],
        [0.41, 4.45, side * 0.32],
        0.055,
        dark,
        bird,
      );
    }
    rod([-0.17, 4.64, 0], [0.43, 4.62, 0], 0.055, helmetStripe, bird);
  }
  if (character.headPart === "aero") {
    shape(
      [
        [-0.8, 4.4, 0],
        [-0.15, 4.67, 0],
        [-0.15, 4.45, 0.27],
        [-0.15, 4.45, -0.27],
      ],
      [
        [0, 1, 2],
        [0, 3, 1],
        [0, 2, 3],
      ],
      helmetMat,
      bird,
    );
  }
}
