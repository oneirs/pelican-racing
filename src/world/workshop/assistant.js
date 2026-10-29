import { createMedicalArm } from "./medical-arm.js?v=combat-48";
import { createMedicalMask } from "./medical-mask.js?v=combat-48";
import { createBoneSaw } from "./bone-saw.js?v=combat-48";
import THREE from "../../core/three.js?v=combat-48";
import { createPelican } from "../../models/pelican.js?v=beak-54";
import { createMaterials, mat } from "../../models/materials.js?v=combat-48";
import { poly, box, moveRod, ell, rod, mesh } from "../../core/geometry.js?v=combat-48";
export function createAssistant(color, { scientist = false } = {}) {
  const material = createMaterials({
    body: scientist ? "#a8bc90" : "#e4e8dc",
    feather: "#b9c9bb",
  });
  const bird = createPelican(material, { helmet: color, scarf: color, goggles: false });
  // Replace cycling headgear and scarf with a surgical cap and a white coat.
  for (const node of [...bird.bird.children])
    if (["head", "wings"].includes(node.userData.partSlot)) node.removeFromParent();
  for (const ribbon of bird.ribbons) {
    const meshNode = bird.bird.children.find((n) => n.geometry === ribbon.geo);
    meshNode?.removeFromParent();
  }
  const pivot = new THREE.Group();
  pivot.add(bird.group);
  bird.group.position.y = -1;
  const scrubs = mat(color),
    coat = mat("#f4f2df"),
    glove = mat("#659e91"),
    brow = mat("#233b38"),
    maskFabric = mat("#83cbc5"),
    maskSeam = mat("#caeeea"),
    arms = [], armRigs = [];
  poly([-0.64, 2.7, 0], [1.12, 0.77, 0.84], coat, bird.bird, 0);
  box([0.35, 2.64, 0], [0.1, 0.75, 0.7], scrubs, bird.bird);
  for (const side of [-1, 1]) {
    poly([-0.34, 2.95, side * 0.77], [0.51, 0.44, 0.38], coat, bird.bird, 0);
    const rig = createMedicalArm(bird.bird, side, coat, glove, maskFabric);
    arms.push(rig.control);
    armRigs.push(rig);
    box(
      [0.38, 2.67, side * 0.4],
      [0.15, 0.8, 0.28],
      coat,
      bird.bird,
    ).rotation.x = side * 0.17;
    // Downward slanted, heavy eyebrows and narrow eyes create a stern expression.
    rod(
      [0.33, 4.4, side * 0.335],
      [0.57, 4.33, side * 0.32],
      0.039,
      brow,
      bird.bird,
      5,
    );
    box([0.44, 4.26, side * 0.329], [0.14, 0.035, 0.025], brow, bird.bird);
  }
  const capY = scientist ? 4.82 : 4.56;
  ell([0.17, capY, 0], [0.5, 0.22, 0.4], maskFabric, bird.bird, 10, 5);
  box([0.62, capY, 0], [0.04, 0.24, 0.075], coat, bird.bird);
  box([0.62, capY, 0], [0.04, 0.075, 0.25], coat, bird.bird);
  createMedicalMask(bird.bird, maskFabric, maskSeam, coat);
  for (const side of [-1, 1]) {
    // A clipped ID card and pocket pen on each visible side of the coat.
    box([-0.12, 2.68, side * 0.89], [0.36, 0.43, 0.045], coat, bird.bird);
    box([-0.12, 2.9, side * 0.91], [0.1, 0.08, 0.055], material.metal, bird.bird);
    box([-0.21, 2.75, side * 0.92], [0.105, 0.13, 0.025], scrubs, bird.bird);
    for (const y of [2.62, 2.56])
      box([-0.08, y, side * 0.92], [0.2, 0.018, 0.02], brow, bird.bird);
    rod([0.1, 2.68, side * 0.83], [0.1, 3.02, side * 0.83], 0.025, scrubs, bird.bird, 5);
  }
  // Coat buttons and a hanging stethoscope.
  for (const y of [2.3, 2.5, 2.7])
    ell([0.48, y, 0], [0.026, 0.026, 0.026], brow, bird.bird, 6, 4);
  const tube = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.18, 3.12, -0.23),
    new THREE.Vector3(0.5, 2.8, -0.29),
    new THREE.Vector3(0.52, 2.46, -0.25),
    new THREE.Vector3(0.51, 2.48, 0.2),
    new THREE.Vector3(0.22, 3.12, 0.2),
  ]);
  mesh(new THREE.TubeGeometry(tube, 18, 0.025, 5, false), brow, bird.bird);
  ell([0.56, 2.44, 0.02], [0.045, 0.11, 0.11], material.metal, bird.bird, 8, 5);
  for (const leg of bird.legs) {
    const hip = new THREE.Vector3(-0.7, 2.32, leg.side * 0.35),
      knee = new THREE.Vector3(-0.48, 1.62, leg.side * 0.44),
      ankle = new THREE.Vector3(-0.12, 1.05, leg.side * 0.46);
    moveRod(leg.upper, hip, knee);
    moveRod(leg.lower, knee, ankle);
    leg.ankle.position.copy(ankle);
    leg.foot.position.copy(ankle);
    leg.upper.scale.x *= 1.8;
    leg.upper.scale.z *= 1.8;
    leg.upper.material = scrubs;
  }
  let saw;
  if (scientist) {
    pivot.name = "bone-saw-doctor";
    // Flat dark hair, forehead stitches and neck bolts echo a cartoon Frankenstein.
    box([0.12, 4.65, 0], [0.75, 0.16, 0.65], brow, bird.bird);
    for (const side of [-1, 1]) {
      rod(
        [0.08, 4.03, side * 0.2],
        [0.08, 4.03, side * 0.43],
        0.065,
        material.metal,
        bird.bird,
        6,
      );
      rod(
        [0.06, 4.42, side * 0.34],
        [0.39, 4.38, side * 0.34],
        0.012,
        brow,
        bird.bird,
        4,
      );
      for (let i = 0; i < 4; i++)
        rod(
          [0.1 + i * 0.07, 4.38, side * 0.35],
          [0.08 + i * 0.07, 4.45, side * 0.35],
          0.009,
          brow,
          bird.bird,
          4,
        );
    }
    saw = createBoneSaw();
    saw.position.set(0.08, 0, 0);
    saw.rotation.z = -0.2;
    saw.rotation.y = Math.PI / 2;
    saw.scale.setScalar(1.1);
    armRigs[1].hand.add(saw);
    pivot.scale.set(0.88, 1.04, 1.05);
  } else pivot.scale.set(0.92, 1, 1.15);
  return { pivot, arms, saw, armRigs, updateArms() { armRigs.forEach((rig) => rig.update()); } };
}
