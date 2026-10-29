import THREE from "../core/three.js?v=combat-48";
const MAX_MARKS = 360, MAX_DUST = 72;
export function createRearBrakeEffects(scene) {
  const marks = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: "#20292b", transparent: true, opacity: 0.5, depthWrite: false }), MAX_MARKS);
  const dust = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: "#d4d6cf", transparent: true, opacity: 0.25, depthWrite: false }), MAX_DUST);
  marks.name = "rear-tire-skid-marks";
  dust.name = "rear-tire-smoke";
  for (const mesh of [marks, dust]) { mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh); }
  let tracks = [], particles = [], previous = null, smokeClock = 0;
  const dummy = new THREE.Object3D();
  function reset() { tracks = []; particles = []; previous = null; smokeClock = 0; marks.count = dust.count = 0; }
  return {
    reset,
    update(dt, state) {
      dt = state.running ? dt : 0;
      tracks = tracks.filter(p => (p.life -= dt) > 0 && Math.abs(p.z + state.distance) < 420);
      particles = particles.filter(p => {
        p.life -= dt; p.x += p.vx * dt; p.y += 0.65 * dt; p.z += p.vz * dt;
        return p.life > 0;
      });
      const point = state.rearContact;
      if (dt > 0 && point && state.rearSkid > 0.15 && !state.crashed) {
        if (previous) {
          const dx = point.x - previous.x, dz = point.z - previous.z, length = Math.hypot(dx, dz);
          if (length > 0.035 && length < 25) {
            const n = Math.min(32, Math.ceil(length / 0.7));
            for (let i = 0; i < n; i++) {
              const t = (i + 0.5) / n;
              tracks.push({ x: previous.x + dx * t, y: point.y + 0.018, z: previous.z + dz * t, length: length / n + 0.025, yaw: Math.atan2(dx, dz), life: 7, strength: state.rearSkid });
            }
          }
        }
        previous = { ...point };
        smokeClock += dt;
        while (smokeClock >= 0.035) {
          smokeClock -= 0.035;
          particles.push({ x: point.x, y: point.y + 0.1, z: point.z, vx: (Math.random() - 0.5) * 0.6, vz: (Math.random() - 0.5) * 0.6, life: 0.65, spin: Math.random() * 6 });
        }
      } else if (dt > 0) { previous = null; smokeClock = 0; }
      if (tracks.length > MAX_MARKS) tracks.splice(0, tracks.length - MAX_MARKS);
      if (particles.length > MAX_DUST) particles.splice(0, particles.length - MAX_DUST);
      marks.count = tracks.length;
      tracks.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z + state.distance);
        dummy.rotation.set(0, p.yaw, 0);
        dummy.scale.set(0.13 * p.strength * Math.min(1, p.life), 0.008, p.length);
        dummy.updateMatrix(); marks.setMatrixAt(i, dummy.matrix);
      });
      dust.count = particles.length;
      particles.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z + state.distance);
        dummy.rotation.set(p.spin, p.spin + state.time, 0);
        dummy.scale.setScalar((0.08 + (0.65 - p.life) * 0.28) * Math.min(1, p.life * 5));
        dummy.updateMatrix(); dust.setMatrixAt(i, dummy.matrix);
      });
      marks.instanceMatrix.needsUpdate = dust.instanceMatrix.needsUpdate = true;
    },
  };
}
