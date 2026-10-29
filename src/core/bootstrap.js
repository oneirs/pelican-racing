// Warm shared model dependencies sequentially before the feature entry point.
// Limit simultaneous requests during cold local preview loads.
const modelModules = [
  "./three.js?v=combat-48",
  "./geometry.js?v=combat-48",
  "../models/materials.js?v=combat-48",
  "../models/part-tags.js?v=combat-48",
  "../models/weapon-mount.js?v=combat-48",
  "../models/twin-gatling.js?v=combat-48",
  "../models/bicycle.js?v=combat-48",
  "../models/leg-variants.js?v=combat-48",
  "../models/accessories/goggles.js?v=combat-48",
  "../models/accessories/helmet.js?v=combat-48",
  "../models/accessories/scarf.js?v=combat-48",
  "../models/pelican.js?v=beak-54",
  "../models/rider.js?v=beak-54",
  "../combat/gatling.js?v=combat-48",
  "../combat/racer-driver.js?v=durability-57",
  "../combat/simulation.js?v=durability-57",
  "../models/held-weapon.js?v=durability-57",
  "../animation/riding.js?v=beak-54",
  "../models/dispose.js?v=combat-48",
];
try {
  for (const module of modelModules) await import(module);
  await import("../main.js?v=progress-59");
} catch (error) {
  const panel = document.getElementById("error");
  if (panel) { panel.textContent = `场景加载失败：${error.message}`; panel.style.display = "block"; }
  console.error(error);
}
