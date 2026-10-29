import { createTwinGatling } from "./twin-gatling.js?v=combat-48";
import { createWeaponMount } from "./weapon-mount.js?v=combat-48";
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

export function createBicycle(materials, options = {}) {
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
  const bike = new THREE.Group();
  const rear = [-1.38, 0.86, 0],
    front = [1.38, 0.86, 0],
    crank = [-0.17, 0.95, 0],
    seat = [-0.65, 1.9, 0],
    head = [0.97, 1.94, 0];
  const wheels = [];
  for (const center of [rear, front]) {
    const w = new THREE.Group();
    w.userData.partSlot = "tires";
    w.position.set(...center);
    bike.add(w);
    ring(
      [0, 0, 0],
      0.75,
      options.tirePart === "grip"
        ? 0.13
        : options.tirePart === "slick"
          ? 0.065
          : 0.092,
      tire,
      w,
      48,
    );
    if (options.tirePart === "grip")
      for (let i = 0; i < 20; i++) {
        const a = (i * Math.PI) / 10;
        const tread = box(
          [Math.cos(a) * 0.79, Math.sin(a) * 0.79, 0],
          [0.14, 0.07, 0.22],
          tire,
          w,
        );
        tread.rotation.z = a + Math.PI / 2;
      }
    ring([0, 0, 0.077], 0.747, 0.022, rubber, w, 48);
    ring([0, 0, -0.077], 0.747, 0.022, rubber, w, 48);
    ring([0, 0, 0], 0.647, 0.028, metal, w, 48);
    rod([0, 0, -0.16], [0, 0, 0.16], 0.09, tealDark, w);
    for (let j = 0; j < 12; j++) {
      let a = (j * Math.PI) / 6;
      rod(
        [0, 0, j % 2 ? 0.045 : -0.045],
        [Math.cos(a) * 0.64, Math.sin(a) * 0.64, 0],
        0.011,
        metal,
        w,
        5,
      );
    }
    const reflector = box([0.45, 0, 0.015], [0.12, 0.05, 0.035], orange, w);
    wheels.push(w);
  }
  const frameStart = bike.children.length;
  for (const [a, b] of [
    [rear, seat],
    [seat, crank],
    [crank, rear],
    [seat, head],
    [head, crank],
  ])
    rod(
      a,
      b,
      options.framePart === "carbon"
        ? 0.034
        : options.framePart === "reinforced"
          ? 0.085
          : 0.052,
      teal,
      bike,
    );
  if (options.framePart === "reinforced") {
    for (const z of [-0.18, 0.18])
      rod([-0.8, 1.4, z], [0.7, 1.45, z], 0.07, metal, bike);
  }
  if (options.framePart === "carbon")
    rod([-0.65, 1.9, 0], [0.97, 1.94, 0], 0.038, dark, bike);
  rod([0.9, 2.05, 0], [1.04, 1.67, 0], 0.07, teal, bike);
  for (const z of [-0.13, 0.13]) {
    rod([1.04, 1.72, z], [1.38, 0.86, z], 0.039, teal, bike);
    rod([-1.38, 0.86, z], [-0.65, 1.88, z], 0.025, teal, bike);
  }
  tagPartsSince(bike, frameStart, "frame");
  rod([-0.65, 1.82, 0], [-0.76, 2.11, 0], 0.043, metal, bike);
  ell([-0.8, 2.12, 0], [0.33, 0.08, 0.22], saddleMat, bike);
  const barStart = bike.children.length;
  rod([0.93, 1.99, 0], [0.82, 2.35, 0], 0.04, metal, bike);
  rod([0.82, 2.35, -0.52], [0.82, 2.35, 0.52], 0.035, metal, bike);
  for (const z of [-0.48, 0.48])
    rod([0.82, 2.35, z], [0.59, 2.35, z], 0.062, tealDark, bike);
  ell([0.78, 2.4, 0.23], [0.085, 0.06, 0.085], gold, bike);
  if (options.handlebarPart === "precision" || options.handlebarPart === "agile") {
    const agile = options.handlebarPart === "agile";
    for (const side of [-1, 1]) {
      rod([0.91, 2.04, 0], [0.82, 2.35, side * 0.43], agile ? 0.045 : 0.028, agile ? orange : gold, bike);
      box([0.70, 2.35, side * 0.48], [0.18, 0.15, 0.16], agile ? orange : gold, bike);
      if (agile) rod([0.59, 2.35, side * 0.48], [0.57, 2.53, side * 0.48], 0.044, tealDark, bike);
    }
    box([0.81, 2.41, 0], [0.18, 0.055, 0.22], dark, bike);
    box([0.81, 2.443, 0], [0.12, 0.012, 0.15], teal, bike);
  }
  tagPartsSince(bike, barStart, "handlebar");
  const driveStart = bike.children.length;
  rod([-0.17, 0.95, -0.3], [-0.17, 0.95, 0.3], 0.065, metal, bike);
  ring(
    [-0.17, 0.95, 0.19],
    options.drivePart === "torque"
      ? 0.33
      : options.drivePart === "balanced"
        ? 0.26
        : 0.2,
    0.026,
    tealDark,
    bike,
    28,
  );
  ring([-1.38, 0.86, 0.17], 0.085, 0.022, tealDark, bike, 20);
  const chainPts = [
    [-0.17, 1.15, 0.21],
    [-1.4, 0.945, 0.21],
    [-1.47, 0.86, 0.21],
    [-1.38, 0.775, 0.21],
    [-0.17, 0.75, 0.21],
    [0.025, 0.94, 0.21],
  ].map((p) => new THREE.Vector3(...p));
  mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3(chainPts, true, "centripetal"),
      48,
      0.013,
      5,
      true,
    ),
    dark,
    bike,
  );
  tagPartsSince(bike, driveStart, "drive");
  if (options.type === "road") {
    const dropStart = bike.children.length;
    for (const side of [-1, 1]) {
      const points = [
        [0.82, 2.35, side * 0.48],
        [1.03, 2.29, side * 0.48],
        [1.03, 2.04, side * 0.48],
        [0.69, 2.04, side * 0.48],
      ];
      mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            points.map((p) => new THREE.Vector3(...p)),
          ),
          16,
          0.045,
          6,
          false,
        ),
        tealDark,
        bike,
      );
    }
    tagPartsSince(bike, dropStart, "handlebar");
  }
  if (options.type === "aero") {
    const aeroStart = bike.children.length;
    const disc = mesh(
      new THREE.CylinderGeometry(0.64, 0.64, 0.1, 24),
      tealDark,
      wheels[0],
    );
    disc.rotation.x = Math.PI / 2;
    shape(
      [
        [-0.62, 1.87, 0],
        [0.96, 1.92, 0],
        [-0.16, 1.02, 0],
      ],
      [[0, 1, 2]],
      teal,
      bike,
    );
    tagPartsSince(bike, aeroStart, "frame");
  }
  const pedalRig = new THREE.Group();
  pedalRig.userData.partSlot = "drive";
  pedalRig.position.set(...crank);
  bike.add(pedalRig);
  const pedals = [];
  for (const side of [1, -1]) {
    rod(
      [0, 0, side * 0.27],
      [side * 0.25, 0, side * 0.27],
      0.031,
      metal,
      pedalRig,
    );
    const p = box(
      [side * 0.25, 0, side * 0.34],
      [0.23, 0.055, 0.19],
      dark,
      pedalRig,
    );
    pedals.push(p);
  }
  const weapon = createWeaponMount(materials, options.weaponPart);
  weapon.position.set(0.62, 1.85, -0.7);
  weapon.visible = !["launcher", "homing-launcher"].includes(options.weaponPart);
  bike.add(weapon);
  const rocket = new THREE.Group();
  rocket.name = "rocket-assembly";
  rocket.userData.partSlot = "rocket";
  bike.add(rocket);
  const flames = [];
  for (const side of [-1, 1]) {
    rod([-1.42, 1.62, side * 0.3], [-0.83, 1.79, side * 0.3], 0.035, metal, rocket);
    box([-1.15, 1.68, side * 0.36], [0.42, 0.09, 0.18], tealDark, rocket);
    if (options.rocketPart !== "boost") continue;
    const pod = new THREE.Group();
    pod.position.set(-1.13, 1.72, side * 0.48);
    rocket.add(pod);
    // Local +X is bicycle forward; exhaust points behind the rear wheel.
    rod([-0.5, 0, 0], [0.3, 0, 0], 0.15, metal, pod, 8);
    const nose = mesh(new THREE.ConeGeometry(0.15, 0.3, 8), orange, pod);
    nose.position.x = 0.45; nose.rotation.z = -Math.PI / 2;
    rod([-0.60, 0, 0], [-0.48, 0, 0], 0.19, dark, pod, 8);
    for (const y of [-0.13, 0.13]) box([-0.25, y, 0], [0.35, 0.07, 0.4], teal, pod);
    const flame = mesh(new THREE.ConeGeometry(0.13, 0.75, 7), orange, pod);
    flame.rotation.z = Math.PI / 2;
    flame.position.x = -0.98;
    flame.visible = false;
    flame.name = "rocket-flame";
    flames.push(flame);
  }
  const gatling = createTwinGatling(materials, options.gatlingPart);
  bike.add(gatling.group);
  return { group: bike, wheels, pedalRig, pedals, flames, gatling };
}
