import THREE from "../core/three.js?v=combat-48";
import { speedFeel } from "./speed-feel.js?v=combat-48";

const RECOVERY_SECONDS = 0.8;
const views = new WeakMap();
const direction = new THREE.Vector3(), bodyForward = new THREE.Vector3(), bodyUp = new THREE.Vector3();
const rotation = new THREE.Quaternion(), targetPosition = new THREE.Vector3(), targetRotation = new THREE.Quaternion();
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const smooth = value => value * value * (3 - 2 * value);

function viewFor(camera) {
  let view = views.get(camera);
  if (!view) {
    view = { wasCrashed: false, safeYaw: null, crashYaw: 0, recovery: null, lastOutput: null };
    views.set(camera, view);
  }
  return view;
}

function beginRecovery(view, camera) {
  // The camera may have been moved after our previous update by an impact view.
  view.recovery = {
    position: camera.position.clone(),
    rotation: camera.quaternion.clone(),
    elapsed: 0,
  };
}

export function resetFirstPerson(camera) {
  views.delete(camera);
}

export function updateFirstPerson(camera, state, path, dt) {
  const pose = state.physicsPose;
  if (!pose) return;
  const view = viewFor(camera);
  const crashed = !!state.crashed;
  const collisionView = state.collisionView === true;
  if (collisionView) {
    // The collision observer owns the transition back to this normal camera goal.
    view.recovery = null;
    view.wasCrashed = false;
  }
  const externallyMoved = !collisionView && view.lastOutput && (
    camera.position.distanceToSquared(view.lastOutput.position) > 1e-6 ||
    1 - Math.abs(camera.quaternion.dot(view.lastOutput.rotation)) > 1e-6
  );
  const startingRecovery = !collisionView && !crashed && view.wasCrashed;
  if (startingRecovery || (!crashed && view.recovery && externallyMoved))
    beginRecovery(view, camera);
  if (crashed && !view.wasCrashed) {
    view.crashYaw = view.safeYaw ?? (Number.isFinite(pose.yaw) ? pose.yaw : 0);
    view.recovery = null;
  }

  const shake = (state.impact ?? 0) * Math.sin(state.time * 65);
  camera.position.set(pose.x + shake * 0.035, pose.y + 2.18 + shake * 0.025, 0);
  if (crashed) {
    // Follow the launch, but keep the horizon and the approach direction legible.
    camera.position.y = Math.max(path.height + 1.5, camera.position.y);
    rotation.set(0, 0, 0, 1);
    if (pose.rotation) rotation.copy(pose.rotation);
    bodyForward.set(0, 0, -1).applyQuaternion(rotation);
    bodyUp.set(0, 1, 0).applyQuaternion(rotation);
    const pitch = clamp(Math.asin(clamp(bodyForward.y, -1, 1)), -0.12, 0.12);
    const roll = clamp(Math.atan2(-bodyUp.x, bodyUp.y), -0.12, 0.12);
    const yaw = view.crashYaw + (state.lookYaw ?? 0);
    direction.set(-Math.sin(yaw), -0.065 + (state.lookPitch ?? 0) + pitch, -Math.cos(yaw));
    camera.up.set(-Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(targetPosition.copy(camera.position).add(direction));
  } else {
    const yaw = (Number.isFinite(pose.yaw) ? pose.yaw : 0) + (state.lookYaw ?? 0);
    view.safeYaw = Number.isFinite(pose.yaw) ? pose.yaw : 0;
    direction.set(-Math.sin(yaw), -0.065 + (state.lookPitch ?? 0), -Math.cos(yaw));
    camera.up.set(-(state.rideLean ?? 0) * 0.22, 1, 0).normalize();
    camera.lookAt(targetPosition.copy(camera.position).add(direction));
    if (view.recovery) {
      targetPosition.copy(camera.position);
      targetRotation.copy(camera.quaternion);
      if (!startingRecovery && !externallyMoved && state.running !== false && dt > 0)
        view.recovery.elapsed += dt;
      const progress = smooth(clamp(view.recovery.elapsed / RECOVERY_SECONDS, 0, 1));
      camera.position.copy(view.recovery.position).lerp(targetPosition, progress);
      camera.quaternion.copy(view.recovery.rotation).slerp(targetRotation, progress);
      if (progress >= 1) view.recovery = null;
    }
  }

  const motion = speedFeel(state);
  const fov = state.mapSettings?.speedEffects === false
    ? 68
    : 68 + motion * 18 + (state.accelerationEffect ?? 0) * 4;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov += (fov - camera.fov) * (1 - Math.exp(-dt * 4));
    camera.updateProjectionMatrix();
  }
  if (!state.looking && state.running !== false && dt > 0) {
    state.lookYaw *= Math.exp(-dt * 5);
    state.lookPitch *= Math.exp(-dt * 5);
  }
  view.wasCrashed = crashed && !collisionView;
  if (!view.lastOutput)
    view.lastOutput = { position: new THREE.Vector3(), rotation: new THREE.Quaternion() };
  view.lastOutput.position.copy(camera.position);
  view.lastOutput.rotation.copy(camera.quaternion);
}
