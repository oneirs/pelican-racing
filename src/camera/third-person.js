import THREE from "../core/three.js?v=combat-48";
import { speedFeel } from "./speed-feel.js?v=combat-48";

export function createThirdPersonCamera() {
  const desired = new THREE.Vector3(), target = new THREE.Vector3();
  let initialized = false, lastX = 0, heading = 0, motion = 0;
  return {
    reset() { initialized = false; motion = 0; },
    update(camera, state, path, dt) {
      const pose = state.physicsPose;
      if (!pose) return;
      if (!initialized) heading = pose.yaw;
      else if (!state.crashed) {
        const turn = Math.atan2(Math.sin(pose.yaw - heading), Math.cos(pose.yaw - heading));
        heading += turn * (1 - Math.exp(-dt * 9));
      }
      const yaw = heading + state.lookYaw;
      motion += (speedFeel(state) - motion) * (1 - Math.exp(-dt * 4));
      const distance = Math.max(6 - motion * 0.45, 4.6 / camera.aspect);
      desired.set(pose.x + Math.sin(yaw) * distance, Math.max(path.height + 3.4 - motion * 0.65, pose.y + 3.2 - motion * 0.65 + state.lookPitch * 5), Math.cos(yaw) * distance);
      if (!initialized) camera.position.copy(desired);
      else {
        // Z is already rider-relative; compensate lateral travel before smoothing the offset.
        camera.position.x += pose.x - lastX;
        camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
      }
      camera.position.y = Math.max(path.height + 1.5, camera.position.y);
      target.set(pose.x - Math.sin(heading) * 1.4, pose.y + 1.05, -Math.cos(heading) * 1.4);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      const fov = 58 + motion * 18;
      if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
      if (!state.looking) { state.lookYaw *= Math.exp(-dt * 5); state.lookPitch *= Math.exp(-dt * 5); }
      initialized = true;
      lastX = pose.x;
    },
  };
}
