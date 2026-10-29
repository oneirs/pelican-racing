import THREE from "../core/three.js?v=combat-48";
import { createMaterials } from "./materials.js?v=combat-48";
import { createBicycle } from "./bicycle.js?v=combat-48";
import { createPelican } from "./pelican.js?v=beak-54";

// Each rider owns its nodes and animation state, allowing multiple racers.
export function createRider(character = {}, bike = {}) {
  const materials = createMaterials(character, bike);
  const bicycle = createBicycle(materials, bike);
  const pelican = createPelican(materials, character);
  if (character.attackBeak)
    bicycle.group.getObjectByName("weapon-mount").visible = false;
  const group = new THREE.Group();
  group.add(bicycle.group, pelican.group);
  return { group, bicycle, pelican };
}
