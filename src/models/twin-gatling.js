import THREE from "../core/three.js?v=combat-48";
import { box, rod, mesh } from "../core/geometry.js?v=combat-48";

export function createTwinGatling(materials, part) {
  const group = new THREE.Group(); group.name = "twin-gatling"; group.userData.partSlot = "weapon";
  const rotors = [], flashes = [], guns = [];
  if (part !== "dual") return { group, update() {} };
  for (const side of [-1, 1]) {
    const gun = new THREE.Group(); gun.position.set(1.12, 2.25, side * 0.6); group.add(gun); guns.push(gun);
    box([0, -0.2, 0], [0.35, 0.12, 0.23], materials.metal, gun);
    rod([0, -0.2, 0], [-0.3, -0.55, -side * 0.12], 0.04, materials.tealDark, gun);
    if (part !== "dual") continue;
    box([-0.22, 0, 0], [0.48, 0.30, 0.28], materials.tealDark, gun);
    box([-0.20, -0.04, side * 0.22], [0.32, 0.38, 0.22], materials.dark, gun);
    for (let i = 0; i < 4; i++) box([-0.32 + i * 0.08, 0.16, 0], [0.035, 0.04, 0.25], materials.orange, gun);
    const rotor = new THREE.Group(); rotor.name = "gatling-rotor"; gun.add(rotor); rotors.push(rotor);
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3, y = Math.sin(a) * 0.105, z = Math.cos(a) * 0.105;
      rod([0, y, z], [0.65, y, z], 0.038, materials.metal, rotor, 6);
      rod([0.64, y, z], [0.67, y, z], 0.028, materials.black, rotor, 6);
    }
    for (const x of [0.12, 0.52]) {
      const ring = mesh(new THREE.TorusGeometry(0.13, 0.035, 4, 10), materials.dark, rotor);
      ring.position.x = x; ring.rotation.y = Math.PI / 2;
    }
    const flash = mesh(new THREE.ConeGeometry(0.22, 0.85, 6), new THREE.MeshBasicMaterial({ color: "#ffe08b", transparent: true, opacity: 0.85 }), gun);
    flash.name = "gatling-muzzle-flash"; flash.rotation.z = -Math.PI / 2; flash.position.x = 1.07; flash.visible = false; flash.userData.previewHidden = true; flashes.push(flash);
    const core = mesh(new THREE.ConeGeometry(0.10, 0.48, 5), new THREE.MeshBasicMaterial({ color: "#fff6d0" }), gun);
    core.rotation.z = -Math.PI / 2; core.position.x = 0.89; core.visible = false; core.userData.previewHidden = true; flashes.push(core);
    const glow = new THREE.PointLight(0xff9b36, 0, 3); glow.position.x = 0.85; gun.add(glow);
    flashes.push(glow);
  }
  return { group, update(state) {
    guns.forEach(g => g.quaternion.identity());
    const firing = state.running && !state.crashed && state.gatlingFiring;
    rotors.forEach(r => r.rotation.x = state.gatlingPhase ?? 0);
    flashes.forEach((f, i) => { f.visible = !!firing; if (f.isLight) f.intensity = firing ? 1.5 : 0; f.scale.setScalar(0.55 + 0.45 * Math.abs(Math.sin((state.gatlingPhase ?? 0) * 3 + i * 2))); });
  } };
}
