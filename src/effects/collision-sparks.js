import THREE from "../core/three.js?v=combat-48";

const LIMIT = 320;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Faceted, luminous chips remain readable when a rail is scraped at speed.
export function createCollisionSparks(scene) {
  const particles = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(1, 0),
    new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    LIMIT,
  );
  particles.name = "collision-spark-particles";
  particles.count = 0;
  particles.frustumCulled = false;
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(particles);
  const positions = new Float32Array(LIMIT * 6), colors = new Float32Array(LIMIT * 6);
  const tailGeometry = new THREE.BufferGeometry();
  tailGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  tailGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3).setUsage(THREE.DynamicDrawUsage));
  const tails = new THREE.LineSegments(tailGeometry,
    new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false }));
  tails.name = "collision-spark-trails";
  tails.frustumCulled = false;
  scene.add(tails);
  const transform = new THREE.Object3D(), color = new THREE.Color();
  let sparks = [];
  function reset() {
    sparks = [];
    particles.count = 0;
    tailGeometry.setDrawRange(0, 0);
  }
  reset();
  return {
    particles, reset,
    update(dt, state, events = []) {
      if (state.mapSettings?.sparks === false) { reset(); return; }
      for (const event of events) {
        if (!["scrape", "impact", "break"].includes(event.type)) continue;
        const strength = clamp(event.strength ?? 0.5, 0, 1);
        const count = Math.round((event.type === "scrape" ? 14 : event.type === "break" ? 48 : 30) * (0.5 + strength));
        const velocity = event.velocity ?? { x: 0, y: 0, z: 0 };
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2, power = (3 + Math.random() * 9) * (0.5 + strength);
          sparks.push({ x: event.x, y: event.y, z: event.z,
            vx: Math.cos(angle) * power + velocity.x * 0.12, vy: 2 + Math.random() * 7,
            vz: Math.sin(angle) * power + velocity.z * 0.12,
            life: 0.35 + Math.random() * 0.5, size: 0.10 + Math.random() * 0.10 + strength * 0.045,
            spin: angle, amber: i % 3 === 0 });
        }
      }
      if (sparks.length > LIMIT) sparks.splice(0, sparks.length - LIMIT);
      sparks = sparks.filter(p => {
        p.life -= dt;
        p.vy -= 14 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.25) { p.y = 0.25; p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.8; p.vz *= 0.8; }
        return p.life > 0;
      });
      particles.count = sparks.length;
      sparks.forEach((p, i) => {
        const glow = clamp(p.life / 0.22, 0, 1);
        transform.position.set(p.x, p.y, p.z + state.distance);
        transform.rotation.set(p.spin + p.life * 12, p.spin + p.life * 8, p.life * 17);
        transform.scale.set(p.size * glow, p.size * 1.65 * glow, p.size * 0.75 * glow);
        transform.updateMatrix(); particles.setMatrixAt(i, transform.matrix);
        color.set(p.amber ? "#ff9b23" : "#ffde72").multiplyScalar(1.2 * glow);
        particles.setColorAt(i, color);
        const tail = 0.04;
        positions.set([p.x, p.y, p.z + state.distance,
          p.x - p.vx * tail, p.y - p.vy * tail, p.z + state.distance - p.vz * tail], i * 6);
        colors.set([2 * glow, 1.15 * glow, 0.3 * glow, glow, 0.22 * glow, 0.02 * glow], i * 6);
      });
      tailGeometry.setDrawRange(0, sparks.length * 2);
      particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
      tailGeometry.attributes.position.needsUpdate = tailGeometry.attributes.color.needsUpdate = true;
    },
    dispose() {
      reset(); particles.geometry.dispose(); particles.material.dispose();
      tailGeometry.dispose(); tails.material.dispose(); particles.removeFromParent(); tails.removeFromParent();
    },
  };
}
