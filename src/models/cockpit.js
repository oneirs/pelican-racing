import { createTwinGatling } from "./twin-gatling.js?v=combat-48";
import THREE from "../core/three.js?v=combat-48";
import { rod, ell, poly, box, mesh, moveRod } from "../core/geometry.js?v=combat-48";
import { mat } from "./materials.js?v=combat-48";
import { createWeaponMount } from "./weapon-mount.js?v=combat-48";
import { createMaterials } from "./materials.js?v=combat-48";
import { weaponRaise } from "./held-weapon.js?v=durability-57";
import { createAttackBeak } from "./attack-beak.js?v=beak-54";
import { beakSwingAngle } from "../combat/beak-motion.js?v=beak-54";
export function createCockpit(camera, character = {}, bicycle = {}) {
  const group = new THREE.Group();
  group.name = "first-person-handlebars";
  camera.add(group);
  // Keep the mouth below the view center, attached to the cockpit transform.
  const mouth = character.attackBeak ? new THREE.Group() : null;
  if (mouth) {
    mouth.name = "first-person-mouth-joint";
    mouth.position.set(0, -0.40, 0.05);
    const beak = createAttackBeak(createMaterials(character, bicycle));
    beak.scale.setScalar(0.62);
    beak.rotation.y = Math.PI / 2;
    mouth.add(beak);
    group.add(mouth);
    mouth.traverse(node => { if (node.isMesh) node.castShadow = node.receiveShadow = false; });
  }
  const metal = mat("#c1d4cf", 0.4),
    grip = mat(bicycle.dark ?? "#244a50"),
    white = mat(character.body ?? "#fff5df"),
    feather = mat(character.feather ?? "#e4e9df"),
    teal = mat(bicycle.color ?? "#2e9390"),
    bell = mat("#efb949", 0.36);
  rod([-0.62, -0.61, -1.13], [0.62, -0.61, -1.13], 0.026, metal, group, 10);
  rod([0, -0.61, -1.13], [0, -1.02, -1.26], 0.034, metal, group);
  rod([0, -1.0, -1.26], [0, -1.8, -1.8], 0.08, teal, group);
  const wingNodes = [];
  for (const side of [-1, 1]) {
    rod(
      [side * 0.39, -0.61, -1.13],
      [side * 0.64, -0.59, -0.98],
      0.05,
      grip,
      group,
      10,
    );
    const wing = poly(
      [side * 0.5, -0.65, -1.03],
      [0.14, 0.11, 0.17],
      white,
      group,
      1,
    );
    wing.rotation.y = side * 0.35;
    wingNodes.push({ wing, rest: wing.position.clone(), side });
    const armStart = group.children.length;
    const arm = poly(
      [side * 0.69, -0.91, -0.7],
      [0.2, 0.34, 0.2],
      white,
      group,
      1,
    );
    arm.rotation.z = side * 0.5;
    if (character.wingPart === "sprint")
      poly([side * 0.65, -0.82, -0.66], [0.18, 0.16, 0.05], teal, group, 0);
    if (character.wingPart === "glide")
      for (let i = 0; i < 3; i++)
        poly(
          [side * (0.66 + i * 0.05), -0.94 - i * 0.05, -0.63],
          [0.04, 0.27, 0.06],
          feather,
          group,
          0,
        );
    for (let i = 0; i < 3; i++)
      ell(
        [side * (0.7 + i * 0.037), -0.9 - i * 0.06, -0.57],
        [0.04, 0.18, 0.055],
        feather,
        group,
        5,
        3,
      ).rotation.z = side * 0.5;
    const nodes = group.children.slice(armStart);
    Object.assign(wingNodes[wingNodes.length - 1], { nodes,
      shoulder: new THREE.Vector3(side * 0.78, -1.04, -0.45),
      upper: mesh(new THREE.CylinderGeometry(0.12, 0.10, 1, 6), white, group),
      lower: mesh(new THREE.CylinderGeometry(0.10, 0.07, 1, 6), white, group),
    });
    rod(
      [side * 0.32, -0.62, -1.14],
      [side * 0.39, -0.72, -1.3],
      0.012,
      grip,
      group,
      6,
    );
  }
  ell([0.28, -0.575, -1.11], [0.064, 0.04, 0.064], bell, group, 10, 6);
  box([0, -0.57, -1.12], [0.13, 0.035, 0.15], grip, group);
  if (bicycle.type === "road") {
    for (const side of [-1, 1]) {
      const points = [
        [side * 0.5, -0.61, -1.13],
        [side * 0.54, -0.67, -1.28],
        [side * 0.54, -0.87, -1.26],
        [side * 0.5, -0.88, -1.06],
      ];
      const handle = new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            points.map((p) => new THREE.Vector3(...p)),
          ),
          16,
          0.035,
          6,
          false,
        ),
        grip,
      );
      group.add(handle);
    }
  }
  if (bicycle.handlebarPart === "precision" || bicycle.handlebarPart === "agile") {
    const accent = bicycle.handlebarPart === "agile" ? mat("#ff8b40") : bell;
    for (const side of [-1, 1]) {
      rod([0, -0.8, -1.22], [side * 0.42, -0.63, -1.14], 0.025, accent, group);
      box([side * 0.47, -0.62, -1.14], [0.12, 0.10, 0.10], accent, group);
    }
  }
  if (bicycle.framePart === "reinforced")
    rod([-0.3, -0.85, -1.2], [0.3, -0.85, -1.2], 0.035, metal, group);
  box([0, -0.8, -1.22], [0.12, 0.3, 0.07], teal, group);
  wingNodes.forEach(({ upper, lower }) => { upper.visible = lower.visible = false; });
  const gatling = bicycle.gatlingPart === "dual" ? createTwinGatling(createMaterials(character, bicycle), "dual") : null;
  if (gatling) {
    gatling.group.scale.setScalar(0.55); gatling.group.rotation.y = Math.PI / 2;
    gatling.group.position.set(0, -1.77, -0.43); group.add(gatling.group);
  }
  let weapon = null;
  if (["launcher", "homing-launcher"].includes(bicycle.weaponPart)) {
    weapon = createWeaponMount(createMaterials(character, bicycle), bicycle.weaponPart);
    weapon.scale.setScalar(0.8);
    weapon.rotation.y = Math.PI / 2;
    weapon.position.set(-0.64, -0.50, -0.9);
    weapon.visible = false;
    group.add(weapon);
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  return {
    group,
    update(state) {
      if (mouth) {
        const action = state.beakAttack;
        mouth.rotation.y = action ? beakSwingAngle(action.age, action.direction) : 0;
      }
      gatling?.update(state);
      if (weapon) {
        const action = state.crashed ? null : state.weaponAction, raise = weaponRaise(action);
        weapon.visible = raise > 0.001;
        weapon.position.set(0.50, -1.15 + raise * 0.90, -1.08);
        weapon.rotation.set(0, Math.PI / 2, -0.65 * (1 - raise));
        if (action) {
          camera.updateWorldMatrix(true, false);
          const inverse = camera.getWorldQuaternion(new THREE.Quaternion()).invert();
          const direction = new THREE.Vector3(action.aim.dx, action.aim.dy, action.aim.dz).applyQuaternion(inverse);
          weapon.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize()), raise);
          if (action.fired) weapon.position.z += Math.sin(Math.PI * THREE.MathUtils.clamp((action.age - 0.48) / 0.16, 0, 1)) * 0.07;
        }
        weapon.updateMatrix();
        for (const { wing, rest, side, nodes, shoulder, upper, lower } of wingNodes) {
          const grip = new THREE.Vector3(side < 0 ? -0.1 : 0.38, -0.22, 0).applyMatrix4(weapon.matrix);
          wing.position.copy(rest).lerp(grip, raise);
          upper.visible = lower.visible = raise > 0.001;
          nodes.forEach(n => n.visible = !upper.visible);
          const elbow = shoulder.clone().lerp(wing.position, 0.5); elbow.y -= 0.14;
          moveRod(upper, shoulder, elbow); moveRod(lower, elbow, wing.position);
        }
      }
      group.rotation.z = (state.rideLean ?? 0) * 0.25;
      group.rotation.y = (state.steeringAngle ?? 0) * 0.65;
      group.position.x = -(state.weightShiftX ?? 0) * 0.5;
      group.position.z = -(state.weightShiftZ ?? 0) * 0.5;
      group.scale.x =
        Math.min(1, camera.aspect / 0.95) * (bicycle.barWidth ?? 1);
      group.position.y =
        (camera.aspect < 0.8 ? 0.2 : 0.09) + Math.sin(state.phase * 2) * 0.003;
    },
  };
}
