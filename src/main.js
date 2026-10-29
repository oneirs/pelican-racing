// Load feature groups in order to limit the initial burst of local module requests.
const { finishRaceIfNeeded } = await import("./game/race-progress.js?v=progress-59");
const { createThirdPersonCamera } = await import("./camera/third-person.js?v=combat-48");
const { createCollisionCamera } = await import("./camera/collision.js?v=collision-56");
const { createRaceRider } = await import("./models/race-rider.js?v=durability-57");
const { bindCameraSettings } = await import("./ui/camera-settings.js?v=coast-55");
const { bindSettings } = await import("./ui/settings.js?v=coast-55");
const { createMapEditor } = await import("./ui/map-editor.js?v=progress-59");
const { getMapDefinition } = await import("./game/map-settings.js?v=coast-55");
const { createRacingEffects } = await import("./effects/racing-effects.js?v=durability-57");
const { createSound } = await import("./audio/sound.js?v=coast-55");
const { createMainMenu } = await import("./ui/main-menu.js?v=progress-59");
const { disposeModel } = await import("./models/dispose.js?v=combat-48");
const { default: THREE } = await import("./core/three.js?v=combat-48");
const { createScene } = await import("./core/scene.js?v=combat-48");
const { createState } = await import("./core/state.js?v=durability-57");
const { createEndlessWorld } = await import("./world/endless/streamer.js?v=progress-59");
const { createEndlessRaceLayout } = await import("./world/endless/race-layout.js?v=coast-55");
const { createCockpit } = await import("./models/cockpit.js?v=durability-57");
const { updateFirstPerson, resetFirstPerson } = await import("./camera/first-person.js?v=collision-56");
const { bindRiding } = await import("./controls/riding.js?v=coast-55");
const { bindControls } = await import("./ui/controls.js?v=progress-59");
const { createEndlessHud } = await import("./ui/endless-hud.js?v=progress-59");
const { createRiderPhysics } = await import("./physics/rider-physics.js?v=hazards-58");
const { createCombatView } = await import("./combat/view.js?v=durability-57");
const { scene, renderer, camera, sun } = createScene(
  document.getElementById("scene"),
);
scene.fog = new THREE.Fog("#bce5e7", 140, 320);
camera.fov = 68;
camera.far = 700;
camera.updateProjectionMatrix();
scene.add(camera);
const state = createState(),
  mapEditor = createMapEditor(state),
  world = createEndlessWorld(scene, state.seed, state.mapSettings);
const effects = createRacingEffects(scene);
const sound = createSound();
const combatView = createCombatView(scene);
renderer.domElement.tabIndex = 0;
let cockpit = createCockpit(camera);
let raceRider = createRaceRider(scene);
effects.setRider(raceRider, cockpit);
effects.setRival(combatView.opponent);
const thirdPerson = createThirdPersonCamera();
const collisionCamera = createCollisionCamera();
bindCameraSettings(state, () => { thirdPerson.reset(); resetFirstPerson(camera); });
bindSettings(state);
let raceSerial = 0;
let physics;
try {
  physics = await createRiderPhysics();
} catch (error) {
  const message = document.getElementById("error");
  message.textContent = "物理引擎加载失败，请刷新页面。";
  message.style.display = "block";
  throw error;
}
function placeAtStart() {
  const layout = createEndlessRaceLayout(world.path),
    spawn = layout.grid[0];
  state.distance = spawn.distance;
  state.lane = spawn.lane;
  state.desiredLane = spawn.lane;
  state.velocity = 0;
  world.update(state.distance);
  const map = getMapDefinition(state.mapSettings);
  state.training = map.training;
  document.getElementById("race-title").textContent = map.name;
  document.getElementById("race-mode").textContent = map.training ? "单人训练" : "5 公里竞速 · AI 对手";
  document.getElementById("race-kicker").textContent = map.training ? "PELICAN / SOLO TRAINING" : "PELICAN GRAND PRIX";
  physics.reset(world.path, world.chunks, spawn, state.selection?.parts, { rival: !map.training, rivalSpawn: layout.grid[1] });
  physics.update(0, state);
}
placeAtStart();
function resetRace(newRoute) {
  state.raceId = `race-${++raceSerial}`;
  state.raceFinished = false;
  state.raceResult = "";
  thirdPerson.reset();
  resetFirstPerson(camera);
  collisionCamera.reset();
  state.collisionView = false;
  if (newRoute)
    state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  state.phase = 0;
  state.brakeInput = state.brakeLatched = state.braking = false;
  state.cadenceRpm = 0;
  state.jumpRequested = state.fireRequested = state.gatlingHeld = state.balanceAssistHeld = state.balanceAssisting = false;
  state.beakAttackRequested = 0;
  state.throttleInput = state.balanceRoll = state.balancePitch = 0;
  state.time = 0;
  state.lookYaw = 0;
  state.lookPitch = 0;
  state.steerVisual = state.steerInput = 0;
  mapEditor.saveSeed(state.seed);
  effects.reset();
  combatView.reset();
  world.reset(state.seed, state.mapSettings);
  sea.visible = world.path.options.mapId === "coast";
  placeAtStart();
}
const controls = bindControls(state, resetRace);
const input = bindRiding(renderer.domElement, state, controls.pause),
  hud = createEndlessHud();
const sea = new THREE.Mesh(
  new THREE.PlaneGeometry(1800, 1800),
  new THREE.MeshStandardMaterial({ color: "#30aab8", roughness: 0.6 }),
);
sea.rotation.x = -Math.PI / 2;
sea.position.y = -0.6;
sea.visible = world.path.options.mapId === "coast";
scene.add(sea);
const menu = createMainMenu(state, {
  sound,
  start(selection) {
    effects.reset();
    disposeModel(cockpit.group);
    cockpit = createCockpit(camera, selection.character, selection.bicycle);
    raceRider.dispose();
    raceRider = createRaceRider(scene, selection.character, selection.bicycle);
    effects.setRider(raceRider, cockpit);
    state.selection = selection;
    state.tuning = selection.tuning;
    state.targetKmh = selection.tuning.maxSpeedKmh;
    resetRace(false);
  },
  home() {
    state.looking = false;
    mapEditor.refresh();
  },
});
let previous = performance.now();
function tick(now) {
  const dt = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  if (state.screen === "menu") {
    sound.update(state);
    menu.update(now / 1000);
    requestAnimationFrame(tick);
    return;
  }
  input(dt, world.path);
  physics.syncChunks(world.chunks);
  physics.update(dt, state);
  finishRaceIfNeeded(state);
  sound.update(state);
  world.update(state.distance);
  if (state.cameraMode === "third") thirdPerson.update(camera, state, world.path, dt);
  else updateFirstPerson(camera, state, world.path, dt);
  cockpit.group.visible = state.cameraMode !== "third";
  raceRider.update(state);
  combatView.update(state);
  cockpit.update(state);
  effects.update(dt, state, physics.drainEffects());
  collisionCamera.update(camera, state, world.path, dt, effects.getPlayerFocus());
  if (state.collisionView) {
    cockpit.group.visible = false;
    raceRider.group.visible = true;
  }
  controls.update();
  hud(state, world.path, camera);
  sun.position.set(camera.position.x - 35, 55, camera.position.z + 20);
  sun.target.position.set(camera.position.x, 0, camera.position.z - 35);
  sun.target.updateMatrixWorld();
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
