import THREE from "../core/three.js?v=combat-48";
import { createRoute } from "./track/route.js?v=combat-48";
import { createRaceLayout } from "./track/race-layout.js?v=combat-48";
import { createRoad } from "./track/road.js?v=combat-48";
import { createTerrain } from "./beach/terrain.js?v=combat-48";
import { createProps } from "./beach/props.js?v=combat-48";
import { batchStatic } from "./beach/batch.js?v=combat-48";
export function createStage(scene) {
  const world = new THREE.Group();
  world.name = "Sunny Bay Circuit";
  scene.add(world);
  const route = createRoute();
  const layout = createRaceLayout(route);
  const { foam } = createTerrain(world);
  const staticProps = new THREE.Group();
  world.add(staticProps);
  createRoad(route, staticProps, layout);
  createProps(staticProps, route);
  batchStatic(staticProps);
  return {
    route,
    layout,
    world,
    update(time) {
      foam.children.forEach(
        (o, i) =>
          (o.material.opacity = 0.4 + 0.2 * Math.sin(time * 0.7 + i * 0.55)),
      );
    },
  };
}
