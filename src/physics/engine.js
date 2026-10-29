import RAPIER from "../../vendor/rapier/rapier.mjs";
let ready;
export async function loadPhysics() {
  if (!ready) ready = RAPIER.init();
  await ready;
  return RAPIER;
}
