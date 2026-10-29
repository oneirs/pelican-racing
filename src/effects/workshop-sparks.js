import THREE from "../core/three.js?v=combat-48";

// Faceted solid fragments erupt above the curtain in four uneven bursts.
export function createWorkshopSparks(scene) {
  const count = 56;
  const geometry = new THREE.OctahedronGeometry(0.085, 0);
  const material = new THREE.MeshStandardMaterial({
    color: "#ffd567",
    emissive: "#ff7618",
    emissiveIntensity: 1.25,
    roughness: 0.4,
    metalness: 0.25,
    flatShading: true,
  });
  const particles = new THREE.InstancedMesh(geometry, material, count);
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  particles.visible = false;
  scene.add(particles);
  const transform = new THREE.Object3D();
  const palette = ["#fff0a4", "#ffbe39", "#ff7528", "#ffd76a"];
  for (let i = 0; i < count; i++) particles.setColorAt(i, new THREE.Color(palette[i % 4]));
  const glow = new THREE.PointLight("#ffaf35", 0, 5);
  glow.position.set(0, 4.75, 1.1);
  scene.add(glow);
  return {
    update(progress, active) {
      particles.visible = active;
      glow.intensity = active ? 1.5 + Math.abs(Math.sin(progress * 37)) * 2 : 0;
      if (!active) return;
      for (let i = 0; i < count; i++) {
        const delay = [0, 0.11, 0.34, 0.61][Math.floor(i / 14)] + (i % 3) * 0.012;
        const age = progress - delay;
        const alive = age >= 0 && age < 0.75;
        const a = Math.max(0, age);
        const direction = i * 2.39996;
        const vx = Math.cos(direction) * (1.2 + (i % 7) * 0.32);
        const vy = 4.4 + (i % 5) * 0.35;
        transform.position.set(
          Math.sin(i * 8.1) * 0.65 + vx * a,
          4.45 + vy * a - 7.5 * a * a,
          0.82 + (1.3 + (i % 4) * 0.25) * a,
        );
        transform.rotation.set(a * (9 + i % 6), direction + a * 13, a * 17);
        const size = alive ? (0.75 + (i % 4) * 0.23) * Math.min(1, (0.75 - age) * 8) : 0;
        transform.scale.set(size, size * (1.1 + (i % 3) * 0.35), size * 0.7);
        transform.updateMatrix();
        particles.setMatrixAt(i, transform.matrix);
      }
      particles.instanceMatrix.needsUpdate = true;
    },
  };
}
