import { createGatlingView } from "./gatling-view.js?v=combat-48";
import THREE from "../core/three.js?v=combat-48";
import { createRaceRider } from "../models/race-rider.js?v=durability-57";
import { disposeModel } from "../models/dispose.js?v=combat-48";

export function createCombatView(scene) {
  const opponent = createRaceRider(scene, { body: "#fff3d7", feather: "#c65e44", helmet: "#df563d", scarf: "#e45639" }, { color: "#df6546", dark: "#763f36" });
  opponent.group.name = "ai-pelican-rival";
  const gatlingView = createGatlingView(scene, opponent);
  const projectiles = new Map();
  const particleMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 180);
  particleMesh.name = "rocket-explosion-particles"; particleMesh.frustumCulled = false; particleMesh.count = 0;
  scene.add(particleMesh);
  const transform = new THREE.Object3D(), color = new THREE.Color(), up = new THREE.Vector3(0, 1, 0), direction = new THREE.Vector3();
  function missileModel() {
    const group = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 7), new THREE.MeshStandardMaterial({ color: "#bacbc4", metalness: 0.5, roughness: 0.4 }));
    group.add(shell);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.2, 7), new THREE.MeshStandardMaterial({ color: "#f59448" }));
    tip.position.y = 0.35; group.add(tip);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 7), new THREE.MeshBasicMaterial({ color: "#ffb44d" }));
    flame.position.y = -0.48; flame.rotation.z = Math.PI; group.add(flame);
    group.name = "flying-rocket"; scene.add(group); return group;
  }
  function reset() {
    gatlingView.reset();
    for (const model of projectiles.values()) disposeModel(model);
    projectiles.clear(); particleMesh.count = 0; opponent.group.visible = false;
  }
  return {
    opponent, particleMesh, reset,
    update(state) {
      gatlingView.update(state);
      const rival = state.rival;
      if (rival) {
        opponent.update({ cameraMode: "third", physicsPose: { ...rival }, phase: rival.phase, time: state.time, velocity: rival.speed, forwardVelocity: rival.speed, grounded: rival.recovery === 0, crashed: rival.recovery > 0, running: state.running, balance: 1 });
        opponent.group.position.z = rival.z + state.distance;
      } else opponent.group.visible = false;
      const active = new Set();
      for (const missile of state.missiles ?? []) {
        active.add(missile.id);
        if (!projectiles.has(missile.id)) projectiles.set(missile.id, missileModel());
        const model = projectiles.get(missile.id);
        model.scale.setScalar(state.weaponKind === "homing-launcher" ? 2 : 1);
        model.position.set(missile.x, missile.y, missile.z + state.distance);
        model.quaternion.setFromUnitVectors(up, direction.set(missile.dx, missile.dy, missile.dz));
      }
      for (const [id, model] of projectiles) if (!active.has(id)) { disposeModel(model); projectiles.delete(id); }
      let count = 0;
      for (const blast of state.explosions ?? []) {
        for (let i = 0; i < 30 && count < 180; i++) {
          const angle = i * 2.399963, age = blast.age, radius = age * (3 + i % 6) * 3, fade = Math.max(0, 1 - age / 0.95);
          transform.position.set(blast.x + Math.cos(angle) * radius, blast.y + Math.sin(i * 4.1) * radius * 0.55 + age * 3, blast.z + state.distance + Math.sin(angle) * radius);
          transform.rotation.set(angle + age * 7, angle, age * 9);
          transform.scale.setScalar((0.18 + (i % 4) * 0.07) * fade * 3);
          transform.updateMatrix(); particleMesh.setMatrixAt(count, transform.matrix);
          particleMesh.setColorAt(count++, color.set(i % 4 === 0 ? "#4d5552" : i % 3 ? "#ff963f" : "#ffe6a3"));
        }
      }
      for (const hit of state.beakImpacts ?? []) {
        for (let i = 0; i < 12 && count < 180; i++) {
          const angle = i * 2.399963, age = hit.age, fade = Math.max(0, 1 - age / 0.35);
          const radius = age * (1.8 + i % 4);
          transform.position.set(hit.x + Math.cos(angle) * radius, hit.y + Math.sin(i * 3.1) * radius * 0.5 + age * 0.8,
            hit.z + state.distance + Math.sin(angle) * radius);
          transform.rotation.set(angle + age * 9, age * 7, angle);
          transform.scale.set(0.05 * fade, (i % 3 === 0 ? 0.14 : 0.07) * fade, 0.035 * fade);
          transform.updateMatrix(); particleMesh.setMatrixAt(count, transform.matrix);
          particleMesh.setColorAt(count++, color.set(i % 3 === 0 ? "#fff5df" : "#f3c76b"));
        }
      }
      particleMesh.count = count; particleMesh.instanceMatrix.needsUpdate = true;
      if (particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
    },
    dispose() { reset(); gatlingView.dispose(); opponent.dispose(); disposeModel(particleMesh); },
  };
}
