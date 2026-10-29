import THREE from "../core/three.js?v=combat-48";
const LIMIT = 96;

// Large shell fragments supplement the physical debris at first-person speeds.
export function createFractureBurst(scene) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const vertices = geometry.attributes.position;
  for (let i = 0; i < vertices.count; i++)
    vertices.setX(i, vertices.getX(i) + vertices.getY(i) * 0.22);
  geometry.computeVertexNormals();
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.7, flatShading: true }), LIMIT);
  mesh.name = "collision-shell-fragments";
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.count = 0;
  scene.add(mesh);
  const transform = new THREE.Object3D(), color = new THREE.Color();
  let pieces = [];
  return {
    reset() { pieces = []; mesh.count = 0; },
    update(dt, state, events) {
      if (state.mapSettings?.destruction === false) { pieces = []; mesh.count = 0; return; }
      for (const event of events) {
        if (event.type !== "break") continue;
        const travel = event.travelVelocity ?? event.velocity;
        const speed = Math.hypot(travel.x, travel.z);
        const forwardX = speed > 0.1 ? travel.x / speed : 0;
        const forwardZ = speed > 0.1 ? travel.z / speed : -1;
        for (let i = 0; i < 24; i++) {
          const angle = i * 2.399963;
          const spread = Math.sin(angle) * (1.5 + i % 4);
          pieces.push({
            x: event.x + forwardX * 1.5 + Math.cos(angle) * 0.35,
            y: event.y + 0.4 + (i % 5) * 0.22,
            z: event.z + forwardZ * 1.5 + Math.sin(angle) * 0.25,
            vx: travel.x * 1.06 - forwardZ * spread,
            vy: 2.5 + (i % 4) * 0.9,
            vz: travel.z * 1.06 + forwardX * spread,
            life: 0.7 + (i % 3) * 0.12, age: 0, spin: angle,
            size: [0.18 + (i % 3) * 0.065, 0.28 + (i % 4) * 0.09, 0.06],
            white: i % 3 === 0,
          });
        }
      }
      if (pieces.length > LIMIT) pieces.splice(0, pieces.length - LIMIT);
      pieces = pieces.filter((piece) => {
        piece.age += dt;
        piece.life -= dt;
        piece.x += piece.vx * dt;
        piece.z += piece.vz * dt;
        piece.vy -= 9.81 * dt;
        piece.y += piece.vy * dt;
        return piece.life > 0;
      });
      mesh.count = pieces.length;
      pieces.forEach((piece, i) => {
        transform.position.set(piece.x, piece.y, piece.z + state.distance);
        transform.rotation.set(piece.age * 11, piece.spin + piece.age * 8, piece.age * 13);
        const fade = Math.min(1, piece.life / 0.2);
        transform.scale.set(...piece.size.map((size) => size * fade));
        transform.updateMatrix();
        mesh.setMatrixAt(i, transform.matrix);
        mesh.setColorAt(i, color.set(piece.white ? "#fff1cf" : "#ef7129"));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
