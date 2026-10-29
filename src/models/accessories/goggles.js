import THREE from "../../core/three.js?v=combat-48";
import { mesh, ell, rod, box, ring, shape } from "../../core/geometry.js?v=combat-48";
import { mat } from "../materials.js?v=combat-48";

export function createGoggles(bird) {
  // A single wraparound wind-goggle lens with a perimeter frame and elastic strap.
  const goggleFrame = mat("#274c56", 0.42),
    goggleBand = mat("#65323b"),
    goggleLens = new THREE.MeshPhysicalMaterial({
      color: "#88d6e4",
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.43,
      depthWrite: false,
      side: THREE.DoubleSide,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
    });
  function lensPoint(theta, v, offset = 0) {
    const edge = Math.pow(Math.abs(theta) / 1.78, 3),
      top = 4.405 - 0.026 * edge,
      bottom = 4.205 + 0.018 * edge;
    return new THREE.Vector3(
      0.22 + (0.447 + offset) * Math.cos(theta),
      THREE.MathUtils.lerp(bottom, top, v),
      (0.375 + offset) * Math.sin(theta),
    );
  }
  const gv = [],
    gf = [],
    goggleSteps = 32;
  for (let i = 0; i <= goggleSteps; i++) {
    const a = -1.78 + (i / goggleSteps) * 3.56;
    for (let j = 0; j <= 4; j++) gv.push(lensPoint(a, j / 4).toArray());
  }
  for (let i = 0; i < goggleSteps; i++)
    for (let j = 0; j < 4; j++) {
      const a = i * 5 + j;
      gf.push([a, a + 1, a + 5], [a + 1, a + 6, a + 5]);
    }
  const shield = shape(gv, gf, goggleLens, bird);
  shield.material.flatShading = false;
  shield.castShadow = false;
  shield.receiveShadow = false;
  shield.renderOrder = 2;
  function goggleLine(points, r, material) {
    const line = mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        48,
        r,
        6,
        false,
      ),
      material,
      bird,
    );
    line.castShadow = false;
    return line;
  }
  const perimeter = [];
  for (let i = 0; i <= 32; i++)
    perimeter.push(lensPoint(-1.78 + (i / 32) * 3.56, 1, 0.003));
  for (let j = 1; j <= 6; j++)
    perimeter.push(lensPoint(1.78, 1 - j / 6, 0.003));
  for (let i = 1; i <= 32; i++)
    perimeter.push(lensPoint(1.78 - (i / 32) * 3.56, 0, 0.003));
  for (let j = 1; j <= 6; j++) perimeter.push(lensPoint(-1.78, j / 6, 0.003));
  goggleLine(perimeter, 0.018, goggleFrame);
  const strapV = [],
    strapF = [];
  for (let i = 0; i <= 24; i++) {
    const a = 1.78 + (i / 24) * (Math.PI * 2 - 3.56),
      x = 0.22 + 0.405 * Math.cos(a),
      z = 0.329 * Math.sin(a);
    strapV.push([x, 4.33, z], [x, 4.265, z]);
    if (i) {
      const k = (i - 1) * 2;
      strapF.push([k, k + 1, k + 2], [k + 1, k + 3, k + 2]);
    }
  }
  shape(strapV, strapF, goggleBand, bird);
  for (const side of [-1, 1])
    box([0.127, 4.296, side * 0.373], [0.074, 0.085, 0.035], goggleFrame, bird);
  const reflection = new THREE.MeshBasicMaterial({
    color: "#e9fcff",
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  for (const [from, to, v] of [
    [0.65, 1.3, 0.81],
    [-1.3, -0.7, 0.81],
  ]) {
    const pts = [];
    for (let i = 0; i <= 10; i++)
      pts.push(lensPoint(THREE.MathUtils.lerp(from, to, i / 10), v, 0.012));
    goggleLine(pts, 0.008, reflection).renderOrder = 3;
  }
}
