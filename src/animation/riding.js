import THREE from "../core/three.js?v=combat-48";
import { moveRod } from "../core/geometry.js?v=combat-48";
import { beakSwingAngle } from "../combat/beak-motion.js?v=beak-54";

export function updateRiding(rider, phase, forwardShift = 0, sideShift = 0, scarfTime = phase, beakAttack = null) {
  const { bird, legs, ribbons } = rider.pelican;
  const { pedalRig, wheels, pedals } = rider.bicycle;
  const bob = Math.sin(phase * 2) * 0.022;
  bird.position.set(forwardShift, bob, sideShift);
  if (rider.pelican.headRig)
    rider.pelican.headRig.rotation.y = beakAttack
      ? beakSwingAngle(beakAttack.age, beakAttack.direction) : 0;
  pedalRig.rotation.z = -phase;
  wheels.forEach((w) => (w.rotation.z = -phase * 0.8));
  legs.forEach(({ side, upper, lower, ankle, foot, kneeGuard }) => {
    const a = phase + (side === 1 ? 0 : Math.PI),
      end = new THREE.Vector3(
        -0.17 + Math.cos(a) * 0.25,
        0.99 - Math.sin(a) * 0.25,
        side * 0.34,
      ),
      hip = new THREE.Vector3(-0.68 + forwardShift, 2.27 + bob, side * 0.43 + sideShift),
      knee = new THREE.Vector3(
        0.02 + Math.cos(a) * 0.12 + forwardShift * 0.5,
        1.62 + Math.sin(a) * 0.09,
        side * 0.43 + sideShift * 0.5,
      );
    moveRod(upper, hip, knee);
    moveRod(lower, knee, end);
    if (kneeGuard) kneeGuard.position.copy(knee);
    ankle.position.copy(end);
    foot.position.copy(end);
    foot.rotation.z = 0.04 * Math.cos(a);
  });
  pedals.forEach((p) => (p.rotation.z = phase));
  ribbons.forEach(({ geo, strip }) => {
    const p = geo.attributes.position;
    for (let i = 0; i <= 18; i++) {
      const t = i / 18,
        x = -0.15 - t * (strip ? 2.65 : 3.15),
        y = 3.52 - 0.28 * t + Math.sin(t * 7 - scarfTime * 3.5 + strip) * 0.13 * t,
        z = 0.07 + strip * 0.12 + Math.sin(t * 8 - scarfTime * 4.2 + strip * 0.4) * 0.12 * t,
        w = (0.15 * (1 - t) + 0.028) * (strip ? 0.7 : 1);
      p.setXYZ(i * 2, x, y + w, z);
      p.setXYZ(i * 2 + 1, x, y - w, z + 0.015);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
  });
}
