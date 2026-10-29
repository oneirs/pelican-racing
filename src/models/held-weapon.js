import THREE from "../core/three.js?v=combat-48";
import { mesh, poly, moveRod } from "../core/geometry.js?v=combat-48";
import { DRAW_TIME, ACTION_TIME } from "../combat/simulation.js?v=durability-57";

const smooth = x => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
export function weaponRaise(action) {
  if (!action) return 0;
  return smooth(action.age / (DRAW_TIME * 0.8)) * (1 - smooth((action.age - 0.82) / (ACTION_TIME - 0.82)));
}
// One launcher moves from its mount into the bird's hands; shoulders stay attached.
export function createHeldWeapon(rider) {
  const gun = rider.bicycle.group.getObjectByName("weapon-mount");
  const bird = rider.pelican.bird;
  const resting = new THREE.Vector3(0.25, 1.85, 0.85);
  gun.scale.setScalar(1.5);
  gun.visible = false;
  const wings = bird.children.filter(n => n.userData.partSlot === "wings");
  const material = wings.find(n => n.isMesh).material;
  bird.add(gun);
  const rig = new THREE.Group(); rig.name = "weapon-holding-wings"; bird.add(rig);
  const arms = [-1, 1].map(side => ({
    shoulder: new THREE.Vector3(-0.32, 2.97, side * 0.52),
    elbow: new THREE.Vector3(), wrist: new THREE.Vector3(),
    upper: mesh(new THREE.CylinderGeometry(0.18, 0.15, 1, 6), material, rig),
    lower: mesh(new THREE.CylinderGeometry(0.14, 0.10, 1, 6), material, rig),
    hand: poly([0, 0, 0], [0.15, 0.13, 0.16], material, rig, 0), side,
  }));
  const forward = new THREE.Vector3(1, 0, 0), direction = new THREE.Vector3();
  const inverse = new THREE.Quaternion(), aimRotation = new THREE.Quaternion();
  const identity = new THREE.Quaternion();
  return { gun, rig, arms, update(state) {
    const action = state.crashed ? null : state.weaponAction;
    const raise = weaponRaise(action);
    gun.visible = rig.visible = raise > 0.001;
    wings.forEach(n => n.visible = !rig.visible);
    gun.position.copy(resting).lerp(new THREE.Vector3(0.25, 3.25, 0.85), raise);
    gun.quaternion.copy(identity);
    if (action) {
      bird.updateWorldMatrix(true, false);
      bird.getWorldQuaternion(inverse).invert();
      direction.set(action.aim.dx, action.aim.dy, action.aim.dz).applyQuaternion(inverse).normalize();
      aimRotation.setFromUnitVectors(forward, direction);
      gun.quaternion.slerp(aimRotation, raise);
      const recoil = action.fired ? Math.sin(Math.PI * THREE.MathUtils.clamp((action.age - DRAW_TIME) / 0.16, 0, 1)) : 0;
      gun.position.addScaledVector(direction, -recoil * 0.13);
    }
    gun.updateMatrix();
    for (const arm of arms) {
      // Both grips and all limb endpoints share bird-local coordinates.
      arm.wrist.set(arm.side < 0 ? -0.1 : 0.38, -0.22, 0).applyMatrix4(gun.matrix);
      arm.wrist.lerp(new THREE.Vector3(0.63, 2.36, arm.side * 0.48), 1 - raise);
      arm.elbow.copy(arm.shoulder).lerp(arm.wrist, 0.5);
      arm.elbow.y -= 0.20; arm.elbow.z += arm.side * 0.16;
      moveRod(arm.upper, arm.shoulder, arm.elbow);
      moveRod(arm.lower, arm.elbow, arm.wrist);
      arm.hand.position.copy(arm.wrist);
    }
  } };
}
