import THREE from "../core/three.js?v=combat-48";
import { createRider } from "./rider.js?v=beak-54";
import { updateRiding } from "../animation/riding.js?v=beak-54";
import { disposeModel } from "./dispose.js?v=combat-48";

import { createHeldWeapon } from "./held-weapon.js?v=durability-57";

export function createRaceRider(scene, character, bicycle) {
  const rider = createRider(character, bicycle);
  const heldWeapon = ["launcher", "homing-launcher"].includes(bicycle?.weaponPart) ? createHeldWeapon(rider) : null;
  const group = new THREE.Group();
  group.name = "third-person-rider";
  rider.group.scale.setScalar(0.62);
  rider.group.rotation.y = Math.PI / 2;
  rider.group.position.y = -0.66;
  group.add(rider.group);
  group.visible = false;
  scene.add(group);
  rider.bicycle.wheels[0].name = "racing-rear-wheel";
  rider.bicycle.wheels[1].name = "racing-front-wheel";
  let frontPhase = 0, rearPhase = 0, lastTime = null;
  return {
    group,
    model: rider,
    update(state) {
      group.visible = state.cameraMode === "third";
      if (!state.physicsPose) { lastTime = state.time; return; }
      const pose = state.physicsPose;
      group.position.set(pose.x, pose.y, 0);
      group.quaternion.copy(pose.rotation);
      if (!state.crashed) group.rotateZ(state.rideLean ?? 0);
      updateRiding(rider, state.phase, -(state.weightShiftZ ?? 0) / 0.62, (state.weightShiftX ?? 0) / 0.62, state.time, state.beakAttack);
      rider.pelican.bird.rotation.z = state.crashed ? 0 : -Math.min(0.1, (state.velocity ?? 0) / 139 * 0.1);
      rider.pelican.bird.rotation.x = state.crashed ? 0 : Math.sin(state.phase) * 0.025 * (1 - (state.balance ?? 0));
      rider.bicycle.wheels[1].rotation.y = state.steeringAngle ?? 0;
      for (const flame of rider.bicycle.flames) {
        flame.visible = state.running && state.grounded && !state.crashed && !state.braking && state.throttleInput > 0;
        flame.scale.y = 0.8 + 0.2 * Math.sin(state.time * 38);
        flame.position.x = -0.6 - 0.375 * flame.scale.y;
      }
      const dt = lastTime === null ? 0 : Math.max(0, Math.min(0.1, state.time - lastTime));
      if (state.grounded) {
        const turn = (state.forwardVelocity ?? state.velocity) * dt / (0.842 * 0.62);
        frontPhase += turn;
        rearPhase += turn * (1 - (state.rearBrake ?? 0));
      }
      rider.bicycle.wheels[0].rotation.z = -rearPhase;
      rider.bicycle.wheels[1].rotation.z = -frontPhase;
      rider.bicycle.gatling.update(state);
      heldWeapon?.update(state);
      lastTime = state.time;
    },
    dispose() { disposeModel(group); },
  };
}
