import THREE from "../../core/three.js?v=combat-48";
import { box, mesh, poly } from "../../core/geometry.js?v=combat-48";
import { mat } from "../../models/materials.js?v=combat-48";
import { getMapDefinition } from "../../game/map-settings.js?v=coast-55";
import { randomAt } from "./path.js?v=coast-55";

const colors = {
  canyon: { road: "#755953", sand: "#dfa16d", wet: "#be6c48", shallow: "#e7b179", water: "#d4925d", white: "#ffe5bb", coral: "#d26743", grass: "#cd8b58", green: "#65725b", rock: "#ab523b", wood: "#8a5440" },
  neon: { road: "#253148", sand: "#252b42", wet: "#272d4d", shallow: "#303857", water: "#1e243e", white: "#70e5ec", coral: "#e16eeb", grass: "#1c2339", green: "#4e536f", rock: "#394363", wood: "#51627c" },
};
const palettes = Object.fromEntries(Object.entries(colors).map(([id, values]) => [id, Object.fromEntries(Object.entries(values).map(([key, color]) => {
  const material = mat(color);
  material.userData.shared = true;
  if (id === "neon" && ["white", "coral"].includes(key)) { material.emissive.set(color); material.emissiveIntensity = 0.75; }
  return [key, material];
}))]));
const buildings = mat("#30394f"), litWindow = mat("#9ee6ee"), warmWindow = mat("#d691db");
for (const material of [buildings, litWindow, warmWindow]) material.userData.shared = true;
litWindow.emissive.set("#58cbdc"); litWindow.emissiveIntensity = 0.9;
warmWindow.emissive.set("#bd59bf"); warmWindow.emissiveIntensity = 0.8;

export function getThemePalette(id) { return palettes[id]; }

export function applyMapAtmosphere(scene, settings) {
  const map = getMapDefinition(settings);
  const sky = { coast: "#bce5e7", canyon: "#edc7aa", neon: "#14192f" }[map.id];
  scene.background = new THREE.Color(sky);
  if (scene.fog) scene.fog.color.set(sky);
  for (const light of scene.children) {
    if (light.isHemisphereLight) {
      light.color.set(map.id === "neon" ? "#a2bbff" : map.id === "canyon" ? "#ffe5c7" : "#eefbff");
      light.groundColor.set(map.id === "neon" ? "#343052" : map.id === "canyon" ? "#af6c47" : "#b6a279");
      light.intensity = map.id === "neon" ? 1.25 : 2.2;
    } else if (light.isDirectionalLight && light.castShadow) {
      light.color.set(map.id === "neon" ? "#a4bdff" : map.id === "canyon" ? "#ffd4a3" : "#fff1d8");
      light.intensity = map.id === "neon" ? 0.9 : 3.1;
    } else if (light.isDirectionalLight) {
      light.color.set(map.id === "neon" ? "#d9a9ef" : "#e0f3ff");
      light.intensity = map.id === "neon" ? 0.8 : 0.65;
    }
  }
}

export function addThemeScenery(root, path, index, start) {
  const id = getMapDefinition(path.options).id, palette = getThemePalette(id);
  const rand = salt => randomAt(path.seed, index, salt);
  const point = (distance, offset) => { const p = path.sample(distance, offset).point; p.z += start; return p; };
  if (id === "canyon") {
    root.userData.scenery = "red-rock-buttes";
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, d = start + 6 + i * 10;
      const p = point(d, side * (path.width / 2 + 11 + rand(300 + i) * 17));
      const height = 8 + rand(320 + i) * 14;
      const rock = mesh(new THREE.CylinderGeometry(2.8 + rand(330 + i) * 2, 5 + rand(340 + i) * 3, height, 5), i % 2 ? palette.rock : palette.wet, root);
      rock.position.set(p.x, height / 2, p.z); rock.rotation.y = rand(350 + i) * Math.PI;
      poly([p.x, height - 0.6, p.z], [4, 2.6, 3.5], palette.sand, root, 0);
      const shrub = point(d + 4, side * (path.width / 2 + 3.5));
      box([shrub.x, 1.3, shrub.z], [0.35, 2.6, 0.35], palette.green, root);
      box([shrub.x + side * 0.6, 1.45, shrub.z], [1.2, 0.3, 0.3], palette.green, root);
      box([shrub.x + side * 1.05, 1.85, shrub.z], [0.3, 1.1, 0.3], palette.green, root);
    }
  } else if (id === "neon") {
    root.userData.scenery = "neon-city-blocks";
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1, d = start + 5 + i * 10;
      const p = point(d, side * (path.width / 2 + 9 + rand(400 + i) * 8));
      const height = 7 + rand(420 + i) * 17, width = 5 + rand(440 + i) * 4;
      const tower = box([p.x, height / 2, p.z], [width, height, 7], buildings, root);
      tower.rotation.y = -Math.atan(path.sample(d).tangent.x / -path.sample(d).tangent.z);
      box([p.x, height + 0.2, p.z], [width + 0.15, 0.25, 7.15], i % 2 ? palette.white : palette.coral, root);
      for (let row = 0; row < 4; row++) {
        box([p.x - side * (width / 2 + 0.025), 2 + row * (height - 3) / 4, p.z], [0.05, 0.65, 4.8], (i + row) % 2 ? litWindow : warmWindow, root);
      }
      const lamp = point(d, side * (path.width / 2 + 2.5));
      box([lamp.x, 2.1, lamp.z], [0.12, 4.2, 0.12], palette.wood, root);
      box([lamp.x, 4.1, lamp.z], [1.1, 0.2, 0.5], palette.white, root);
    }
    if (index % 3 === 0) {
      const p = point(start + 22, 0);
      for (const side of [-1, 1]) box([p.x + side * (path.width / 2 + 1.2), 2.7, p.z], [0.24, 5.4, 0.3], palette.coral, root);
      box([p.x, 5.25, p.z], [path.width + 2.6, 0.3, 0.3], palette.white, root);
    }
  }
}
