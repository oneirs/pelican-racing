import THREE from "../../core/three.js?v=combat-48";
import { mesh, ell, rod, box, ring, shape } from "../../core/geometry.js?v=combat-48";
import { mat } from "../materials.js?v=combat-48";

export function createScarf(bird, color = "#c51f37") {
  const scarfMat = mat(color);
  // Red scarf with two ribbons animated in the slipstream.
  const scarf = ring([0.10, 3.485, 0], 0.277, 0.084, scarfMat, bird, 24);
  scarf.rotation.x = Math.PI / 2;
  scarf.rotation.y = -0.25;
  scarf.scale.set(1.05, 1.05, 1);
  ell([-0.12, 3.50, 0.09], [0.15, 0.12, 0.16], scarfMat, bird, 10, 7);
  const ribbons = [];
  for (let strip = 0; strip < 2; strip++) {
    const geo = new THREE.BufferGeometry(),
      pos = new Float32Array(19 * 2 * 3),
      indices = [];
    for (let i = 0; i < 18; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(indices);
    const material = scarfMat.clone();
    material.side = THREE.DoubleSide;
    const ribbon = mesh(geo, material, bird);
    ribbons.push({ geo, strip });
  }
  return ribbons;
}
