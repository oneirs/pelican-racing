import THREE from "../core/three.js?v=combat-48";

const VIEW_FOV = 68;
const RETURN_TIME = 0.55;
const smooth = value => value * value * (3 - 2 * value);

// Follow the visible pieces during breakup without changing the selected view
// or the rider's physical transform. Normal camera updates supply the return goal.
export function createCollisionCamera() {
  const center = new THREE.Vector3(), forward = new THREE.Vector3();
  const lastPosition = new THREE.Vector3(), lastRotation = new THREE.Quaternion();
  const returnPosition = new THREE.Vector3(), returnRotation = new THREE.Quaternion();
  const normalPosition = new THREE.Vector3(), normalRotation = new THREE.Quaternion();
  let observing = false, returning = false, heading = 0, distance = 0;
  let returnAge = 0, lastFov = VIEW_FOV, returnFov = VIEW_FOV;
  function setFov(camera, fov) {
    if (Math.abs(camera.fov - fov) < 0.001) return;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  return {
    reset() { observing = returning = false; returnAge = 0; },
    update(camera, state, path, dt, focus) {
      const elapsed = state.running === false ? 0 : Math.max(0, dt);
      normalPosition.copy(camera.position);
      normalRotation.copy(camera.quaternion);
      const normalFov = camera.fov;
      if (focus) {
        if (!observing) {
          camera.getWorldDirection(forward);
          heading = Math.atan2(-forward.x, -forward.z) - (state.lookYaw ?? 0);
        }
        const halfVertical = THREE.MathUtils.degToRad(VIEW_FOV / 2);
        const halfHorizontal = Math.atan(Math.tan(halfVertical) * camera.aspect);
        const required = Math.max(6.5,
          Math.max(0.5, focus.radius) / Math.sin(Math.min(halfVertical, halfHorizontal)) * 1.12 + 0.8);
        distance = !observing || required > distance ? required
          : THREE.MathUtils.lerp(distance, required, 1 - Math.exp(-elapsed * 5));
        observing = true; returning = false;
        const yaw = heading + (state.lookYaw ?? 0);
        const elevation = THREE.MathUtils.clamp(0.3 + (state.lookPitch ?? 0), 0.1, 0.65);
        const horizontal = Math.cos(elevation) * distance;
        center.set(focus.x, focus.y, focus.z);
        camera.position.set(center.x + Math.sin(yaw) * horizontal,
          Math.max(path.height + 1.5, center.y + Math.sin(elevation) * distance),
          center.z + Math.cos(yaw) * horizontal);
        camera.up.set(0, 1, 0);
        camera.lookAt(center);
        setFov(camera, VIEW_FOV);
        lastPosition.copy(camera.position); lastRotation.copy(camera.quaternion);
        lastFov = camera.fov;
      } else {
        if (observing) {
          observing = false; returning = true; returnAge = 0;
          returnPosition.copy(lastPosition); returnRotation.copy(lastRotation); returnFov = lastFov;
        }
        if (returning) {
          returnAge += elapsed;
          const amount = smooth(Math.min(1, returnAge / RETURN_TIME));
          camera.position.copy(returnPosition).lerp(normalPosition, amount);
          camera.quaternion.copy(returnRotation).slerp(normalRotation, amount);
          setFov(camera, THREE.MathUtils.lerp(returnFov, normalFov, amount));
          if (returnAge >= RETURN_TIME) returning = false;
        }
      }
      state.collisionView = observing || returning;
    },
  };
}
