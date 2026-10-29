import THREE from "../../core/three.js?v=combat-48";
import { createEndlessPath, CHUNK_LENGTH } from "./path.js?v=coast-55";
import { createChunk, disposeChunk } from "./chunk.js?v=progress-59";
import { applyMapAtmosphere } from "./themes.js?v=coast-55";
export const AHEAD_CHUNKS = 6,
  BEHIND_CHUNKS = 2;
export function createEndlessWorld(scene, seed = 93417, settings = {}) {
  const root = new THREE.Group();
  root.name = "endless-coast";
  scene.add(root);
  let path = createEndlessPath(seed, settings);
  applyMapAtmosphere(scene, path.options);
  root.name = "endless-" + path.options.mapId;
  const chunks = new Map();
  let activeIndex = null;
  function update(distance) {
    const index = Math.floor(distance / CHUNK_LENGTH);
    if (index !== activeIndex) {
      for (const [id, chunk] of chunks)
        if (id < index - BEHIND_CHUNKS || id > index + AHEAD_CHUNKS) {
          disposeChunk(chunk);
          chunks.delete(id);
        }
      for (let id = index - BEHIND_CHUNKS; id <= index + AHEAD_CHUNKS; id++)
        if (!chunks.has(id)) {
          const chunk = createChunk(path, id);
          chunks.set(id, chunk);
          root.add(chunk);
        }
      activeIndex = index;
    }
    // Continuous floating origin: the player stays near Z=0 even after long rides.
    for (const [id, chunk] of chunks)
      chunk.position.z = distance - id * CHUNK_LENGTH;
  }
  function reset(seed = path.seed, settings = path.options) {
    for (const chunk of chunks.values()) disposeChunk(chunk);
    chunks.clear();
    path = createEndlessPath(seed, settings);
    applyMapAtmosphere(scene, path.options);
    root.name = "endless-" + path.options.mapId;
    activeIndex = null;
    update(0);
  }
  function dispose() {
    for (const chunk of chunks.values()) disposeChunk(chunk);
    chunks.clear();
    root.removeFromParent();
  }
  update(0);
  return {
    root,
    update,
    reset,
    dispose,
    get chunks() {
      return chunks;
    },
    get path() {
      return path;
    },
    get chunkCount() {
      return chunks.size;
    },
    get activeIds() {
      return [...chunks.keys()];
    },
  };
}
