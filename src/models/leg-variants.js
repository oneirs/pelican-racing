import THREE from "../core/three.js?v=combat-48";
import { box, rod, mesh } from "../core/geometry.js?v=combat-48";

export function createLegVariant(id) {
  const make = (color, metalness = 0, roughness = 0.6, extra = {}) =>
    new THREE.MeshStandardMaterial({
      color,
      metalness,
      roughness,
      flatShading: true,
      ...extra,
    });
  if (id === "golden")
    return {
      body: make("#efb72f", 0.78, 0.25),
      joint: make("#996719", 0.72, 0.3),
      accent: make("#fff0a6", 0.55, 0.24),
      width: 1.75,
      shin: 2.5,
      foot: 1.22,
    };
  if (id === "diamond")
    return {
      body: new THREE.MeshPhysicalMaterial({
        color: "#9de7ff",
        metalness: 0.2,
        roughness: 0.13,
        clearcoat: 1,
        flatShading: true,
      }),
      joint: make("#438fac", 0.4, 0.2),
      accent: make("#edfdff", 0.2, 0.15, {
        emissive: "#a4eaff",
        emissiveIntensity: 0.25,
      }),
      width: 1.5,
      shin: 2,
      foot: 1.15,
    };
  if (id === "mechanical")
    return {
      body: make("#8c9aa5", 0.8, 0.35),
      joint: make("#25343e", 0.65, 0.38),
      accent: make("#61e0d1", 0.3, 0.3, {
        emissive: "#22a999",
        emissiveIntensity: 0.3,
      }),
      width: 1.15,
      shin: 1.55,
      foot: 1.12,
    };
  if (id === "hormone")
    return {
      body: make("#d97179", 0, 0.65),
      joint: make("#b84d62", 0, 0.6),
      accent: make("#d4ef7e", 0.05, 0.4, {
        emissive: "#79ad27",
        emissiveIntensity: 0.15,
      }),
      width: 1.65,
      shin: 1.4,
      foot: 1.05,
    };
  return null;
}
export function applyLegVariant(
  id,
  variant,
  { upper, lower, ankle, foot, kneeGuard },
  side,
) {
  if (!variant) return;
  upper.material = lower.material = variant.body;
  upper.scale.x *= variant.width;
  upper.scale.z *= variant.width;
  lower.scale.x = lower.scale.z = variant.shin;
  ankle.material = variant.joint;
  ankle.scale.multiplyScalar(1.4);
  kneeGuard.material = variant.joint;
  kneeGuard.scale.multiplyScalar(1.6);
  foot.scale.set(variant.foot, 1.2, variant.foot);
  if (id === "golden") {
    for (const y of [-0.5, 0.5])
      box([0, y, 0], [1.85, 0.12, 1.85], variant.joint, upper);
    box([0.1, 0.075, 0], [0.25, 0.04, 0.24], variant.accent, foot);
  } else if (id === "diamond") {
    upper.geometry.dispose();
    upper.geometry = new THREE.SphereGeometry(1, 6, 3);
    kneeGuard.geometry.dispose();
    kneeGuard.geometry = new THREE.OctahedronGeometry(1, 0);
    const crystal = mesh(
      new THREE.OctahedronGeometry(0.65, 0),
      variant.accent,
      upper,
    );
    crystal.position.set(0, 0.1, side * 0.88);
    const toe = mesh(
      new THREE.OctahedronGeometry(0.075, 0),
      variant.accent,
      foot,
    );
    toe.position.set(0.18, 0.07, 0);
  } else if (id === "mechanical") {
    for (const sign of [-1, 1]) {
      rod(
        [sign * 0.095, -0.4, 0],
        [sign * 0.095, 0.4, 0],
        0.022,
        variant.joint,
        lower,
      );
      rod(
        [sign * 0.095, -0.1, 0],
        [sign * 0.095, 0.4, 0],
        0.012,
        variant.accent,
        lower,
      );
    }
    box([0, 0.05, side * 0.92], [0.75, 1.1, 0.18], variant.joint, upper);
    box([0, 0.05, side * 1.03], [0.16, 0.65, 0.08], variant.accent, upper);
    box([0.05, 0.075, 0], [0.22, 0.055, 0.22], variant.joint, foot);
    box([0.21, 0.07, 0], [0.055, 0.03, 0.22], variant.accent, foot);
  } else if (id === "hormone") {
    for (const sign of [-1, 1]) {
      const muscle = mesh(
        new THREE.SphereGeometry(1, 7, 4),
        variant.body,
        upper,
      );
      muscle.position.set(sign * 0.48, 0.12, 0);
      muscle.scale.set(0.65, 0.85, 0.8);
    }
    box([0, -0.36, 0], [0.16, 0.07, 0.17], variant.accent, lower);
    box([0.04, 0.06, 0], [0.1, 0.04, 0.2], variant.accent, foot);
  }
}
