import { createLegVariant, applyLegVariant } from "./leg-variants.js?v=combat-48";
import { tagPartsSince } from "./part-tags.js?v=combat-48";
import THREE from "../core/three.js?v=combat-48";
import {
  mesh,
  ell,
  rod,
  box,
  ring,
  shape,
  poly,
  taperedCurve,
  limb,
} from "../core/geometry.js?v=combat-48";
import { createGoggles } from "./accessories/goggles.js?v=combat-48";
import { createHelmet } from "./accessories/helmet.js?v=combat-48";
import { createScarf } from "./accessories/scarf.js?v=combat-48";
import { createAttackBeak } from "./attack-beak.js?v=beak-54";

export function createPelican(materials, character = {}) {
  const {
    white,
    cream,
    wingWhite,
    gray,
    dark,
    black,
    orange,
    gold,
    billMat,
    billTop,
    teal,
    tealDark,
    metal,
    tire,
    rubber,
    saddleMat,
  } = materials;
  const group = new THREE.Group();
  const bird = new THREE.Group();
  group.add(bird);

  // Broad, explicitly triangulated low-poly torso and long S-neck.

  poly([-0.78, 2.72, 0], [1.04, 0.71, 0.62], white, bird).rotation.z = 0.18;
  poly([-0.17, 2.91, 0], [0.51, 0.6, 0.47], white, bird).rotation.z = 0.24;

  taperedCurve(
    [
      [-0.24, 3.04, 0],
      [0.15, 3.36, 0],
      [0.12, 3.62, 0],
      [-0.05, 3.91, 0],
      [0.05, 4.18, 0],
      [0.23, 4.27, 0],
    ],
    [0.32, 0.26, 0.21, 0.2, 0.24, 0.27],
    white,
    bird,
    26,
    12,
  );
  const headRig = character.attackBeak ? new THREE.Group() : bird;
  if (character.attackBeak) {
    headRig.name = "pelican-head-joint";
    bird.add(headRig);
  }
  ell([0.24, 4.25, 0], [0.39, 0.35, 0.32], white, headRig, 14, 10);
  for (let i = 0; i < 3; i++) {
    const tail = ell(
      [-1.65 - i * 0.09, 2.4 + i * 0.06, (i - 1) * 0.15],
      [0.4, 0.09, 0.13],
      i === 1 ? cream : wingWhite,
      bird,
      7,
      4,
    );
    tail.rotation.z = 0.28;
  }

  for (const side of [-1, 1]) {
    const wingStart = bird.children.length;
    const z = side * 0.52;
    poly([-0.32, 2.97, z], [0.43, 0.27, 0.17], white, bird).rotation.z = -0.16;
    for (let i = 0; i < 5; i++) {
      const f = ell(
        [-0.52 + i * 0.135, 2.55 - i * 0.028, z + side * 0.035],
        [0.13, 0.35, 0.08],
        i % 2 ? black : dark,
        bird,
        7,
        5,
      );
      f.rotation.z = -0.24 + i * 0.1;
    }
    limb([-0.12, 2.89, z], [0.28, 2.55, side * 0.55], 0.22, 0.18, white, bird);
    limb(
      [0.28, 2.55, side * 0.55],
      [0.63, 2.36, side * 0.48],
      0.13,
      0.12,
      white,
      bird,
    );
    ell([0.63, 2.36, side * 0.48], [0.13, 0.12, 0.12], white, bird, 10, 7);
    tagPartsSince(bird, wingStart, "wings");
    // Eyes remain visible through the protective lens.
    ell([0.415, 4.29, side * 0.264], [0.102, 0.093, 0.057], white, headRig, 10, 7);
    ell([0.453, 4.29, side * 0.306], [0.048, 0.06, 0.021], black, headRig, 10, 7);
    ell([0.466, 4.318, side * 0.324], [0.014, 0.019, 0.008], white, headRig, 7, 5);
    rod(
      [0.15, 4.25, side * 0.3],
      [0.17, 3.99, side * 0.255],
      0.015,
      dark,
      headRig,
    );
  }
  const wingExtras = bird.children.length;
  if (character.wingPart !== "standard" && character.wingPart) {
    for (const side of [-1, 1]) {
      if (character.wingPart === "glide") {
        for (let i = 0; i < 4; i++) {
          const feather = poly(
            [-0.65 - i * 0.16, 2.92 - i * 0.07, side * (0.61 + i * 0.11)],
            [0.62, 0.065, 0.16],
            wingWhite,
            bird,
            0,
          );
          feather.rotation.y = side * 0.22;
        }
      } else {
        poly([-0.28, 2.98, side * 0.64], [0.46, 0.2, 0.15], teal, bird, 0);
        for (let i = 0; i < 3; i++)
          box(
            [-0.5 + i * 0.18, 3.01, side * 0.76],
            [0.075, 0.16, 0.04],
            gold,
            bird,
          );
      }
    }
  }
  tagPartsSince(bird, wingExtras, "wings");
  if (character.goggles !== false) createGoggles(headRig);
  for (let i = 0; i < 3; i++) {
    const feather = ell(
      [-0.16 - i * 0.06, 4.26 - i * 0.065, 0],
      [0.23, 0.047, 0.13],
      white,
      headRig,
      7,
      4,
    );
    feather.rotation.z = 0.28;
  }
  const helmetStart = headRig.children.length;
  createHelmet(headRig, materials, character);
  tagPartsSince(headRig, helmetStart, "head");
  let attackBeak = null;
  if (character.attackBeak) {
    attackBeak = createAttackBeak(materials);
    attackBeak.position.set(0.48, 4.19, 0);
    headRig.add(attackBeak);
  } else {
    const beakStart = headRig.children.length;
    // Long tapered bill and deep, gently rounded throat pouch.
    const stations = [
      [0.48, 4.19, 0.19, 0.13],
      [0.65, 4.145, 0.25, 0.32],
      [0.91, 4.08, 0.24, 0.45],
      [1.23, 3.995, 0.195, 0.44],
      [1.57, 3.91, 0.13, 0.32],
      [1.9, 3.83, 0.065, 0.15],
      [2.13, 3.77, 0.012, 0.026],
    ];
    if (character.beakPart === "streamlined") {
      for (const station of stations) {
        station[0] = 0.48 + (station[0] - 0.48) * 1.2;
        station[2] *= 0.8;
        station[3] *= 0.8;
      }
    }
    if (character.beakPart === "cushion") {
      for (const side of [-1, 1])
        rod(
          [0.8, 4.05, side * 0.24],
          [1.92, 3.8, side * 0.08],
          0.065,
          tealDark,
          headRig,
        );
      poly([1.93, 3.8, 0], [0.18, 0.1, 0.11], teal, headRig, 0);
    }
    const pv = [],
      pf = [];
    for (const [x, y, w, depth] of stations) {
      for (let j = 0; j < 12; j++) {
        const a = (j / 12) * Math.PI * 2;
        pv.push([x, y - depth / 2 + (Math.cos(a) * depth) / 2, Math.sin(a) * w]);
      }
    }
    for (let i = 0; i < stations.length - 1; i++)
      for (let j = 0; j < 12; j++) {
        const a = i * 12 + j,
          b = i * 12 + ((j + 1) % 12);
        pf.push([a, b, a + 12], [b, b + 12, a + 12]);
      }
    shape(pv, pf, billMat, headRig);
    const topV = [],
      topF = [];
    stations.forEach(([x, y, w], i) => {
      topV.push(
        [x, y + 0.013, -w * 0.96],
        [x, y + 0.065 * (1 - i / 7), 0],
        [x, y + 0.013, w * 0.96],
      );
      if (i) {
        const a = (i - 1) * 3;
        topF.push(
          [a, a + 1, a + 3],
          [a + 1, a + 4, a + 3],
          [a + 1, a + 2, a + 4],
          [a + 2, a + 5, a + 4],
        );
      }
    });
    shape(topV, topF, billTop, headRig);
    for (const side of [-1, 1]) {
      const line = stations.map(
        ([x, y, w]) => new THREE.Vector3(x, y + 0.005, side * w),
      );
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(line),
          24,
          0.01,
          5,
          false,
        ),
        saddleMat,
        headRig,
      );
    }
    ell(
      [stations.at(-1)[0], 3.756, 0],
      [0.037, 0.054, 0.025],
      billTop,
      headRig,
      7,
      5,
    );
    tagPartsSince(headRig, beakStart, "beak");
  }
  // Rebase the complete head at the neck joint so accessories stay attached.
  if (character.attackBeak) {
    headRig.position.set(0.23, 4.18, 0);
    headRig.children.forEach((node) => node.position.sub(headRig.position));
  }
  const ribbons = createScarf(bird, character.scarf);

  const root = group;
  // Articulated legs follow the opposite pedals.
  const legs = [];
  const legVariant = createLegVariant(character.legPart);
  for (const side of [1, -1]) {
    const group = new THREE.Group();
    root.add(group);
    group.userData.partSlot = "thighs";
    const legPart = character.legPart ?? "standard";
    const footMaterial =
      legVariant?.body ??
      (legPart === "power" ? tealDark : legPart === "agile" ? gold : orange);
    const upper = ell([0, 0, 0], [0.16, 0.5, 0.16], white, group, 12, 8),
      lower = rod([0, 0, 0], [0, 1, 0], 0.058, orange, group);
    const ankle = ell([0, 0, 0], [0.075, 0.075, 0.07], orange, group, 6, 4);
    const foot = new THREE.Group();
    group.add(foot);
    shape(
      [
        [-0.12, 0.03, -0.065],
        [-0.12, 0.03, 0.065],
        [0.3, -0.025, 0.17],
        [0.37, -0.025, 0.03],
        [0.3, -0.025, -0.17],
        [0.02, 0.09, 0],
      ],
      [
        [0, 1, 5],
        [1, 2, 5],
        [2, 3, 5],
        [3, 4, 5],
        [4, 0, 5],
        [0, 4, 3],
        [0, 3, 2],
        [0, 2, 1],
      ],
      footMaterial,
      foot,
    );
    const kneeGuard =
      legPart === "standard"
        ? null
        : ell(
            [0, 0, 0],
            legPart === "power" ? [0.14, 0.13, 0.14] : [0.085, 0.085, 0.085],
            legPart === "power" ? tealDark : gold,
            group,
            8,
            5,
          );
    if (legPart === "power") {
      upper.scale.x *= 1.45;
      upper.scale.z *= 1.45;
      upper.material = teal;
      lower.scale.x = lower.scale.z = 1.8;
      lower.material = teal;
      ankle.scale.multiplyScalar(1.35);
      ankle.material = tealDark;
      foot.scale.set(1.12, 1.2, 1.12);
      box([0.04, 0.065, 0], [0.12, 0.055, 0.2], gold, foot);
    } else if (legPart === "agile") {
      upper.scale.x *= 0.75;
      upper.scale.z *= 0.75;
      upper.material = gold;
      lower.scale.x = lower.scale.z = 0.85;
      lower.material = gold;
      ankle.scale.multiplyScalar(0.9);
      ankle.material = gold;
      foot.scale.set(1, 0.85, 0.82);
      box([0.04, 0.055, 0], [0.1, 0.035, 0.16], dark, foot);
    }
    applyLegVariant(
      legPart,
      legVariant,
      { upper, lower, ankle, foot, kneeGuard },
      side,
    );
    legs.push({ side, upper, lower, ankle, foot, kneeGuard });
  }
  return { group, bird, legs, ribbons, headRig: character.attackBeak ? headRig : null, attackBeak };
}
