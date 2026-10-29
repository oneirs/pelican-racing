import THREE from "../core/three.js?v=combat-48";
export function bindOrbit(canvas, state) {
  let lastX = 0,
    lastY = 0;
  canvas.addEventListener("pointerdown", (e) => {
    state.drag = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!state.drag) return;
    state.angle -= (e.clientX - lastX) * 0.006;
    state.elevation = Math.max(
      0.22,
      Math.min(1.35, state.elevation + (e.clientY - lastY) * 0.004),
    );
    lastX = e.clientX;
    lastY = e.clientY;
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    canvas.addEventListener(event, () => (state.drag = false));
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      state.zoom = Math.max(
        0.62,
        Math.min(1.8, state.zoom + e.deltaY * 0.0007),
      );
    },
    { passive: false },
  );
}
const desired = new THREE.Vector3(),
  look = new THREE.Vector3();
export function updateCamera(camera, target, state, pose, dt, instant = false) {
  if (state.view === "overview") {
    const d = Math.max(155, 148 / camera.aspect) * state.zoom;
    desired.set(
      Math.sin(state.angle) * Math.cos(state.elevation) * d,
      Math.sin(state.elevation) * d,
      Math.cos(state.angle) * Math.cos(state.elevation) * d,
    );
    look.set(0, 0, 0);
  } else {
    const offset = pose.tangent
      .clone()
      .multiplyScalar(-13)
      .addScaledVector(pose.normal, 4);
    offset
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), state.angle - 0.45)
      .multiplyScalar(state.zoom);
    offset.y = (5 + state.elevation * 3) * state.zoom;
    desired.copy(pose.point).add(offset);
    look.copy(pose.point).addScaledVector(pose.tangent, 4);
    look.y += 1.8;
  }
  const blend = instant ? 1 : 1 - Math.exp(-dt * 5);
  camera.position.lerp(desired, blend);
  target.lerp(look, blend);
  camera.lookAt(target);
}
