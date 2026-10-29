import { createRearBrakeEffects } from "./rear-brake.js?v=combat-48";
import { createFractureBurst } from "./fracture-burst.js?v=combat-48";
import { createCollisionSparks } from "./collision-sparks.js?v=coast-55";
import { createRiderBreakup } from "./rider-breakup.js?v=durability-57";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function createRacingEffects(scene) {
  const fracture = createFractureBurst(scene);
  const rearBrake = createRearBrakeEffects(scene);
  const collisionSparks = createCollisionSparks(scene);
  const playerBreakup = createRiderBreakup(scene, "player");
  const rivalBreakup = createRiderBreakup(scene, "rival");
  let cockpit = null;
  const canvas = document.getElementById("speed-fx"),
    ctx = canvas.getContext("2d");
  const boostLabel = document.getElementById("acceleration-notice");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let lastVelocity = 0,
    boost = 0,
    lastTime = 0,
    w = 0,
    h = 0;
  function reset() {
    fracture.reset();
    rearBrake.reset();
    collisionSparks.reset();
    playerBreakup.reset();
    rivalBreakup.reset();
    lastVelocity = boost = lastTime = 0;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    boostLabel.hidden = true;
    canvas.dataset.intensity = "0";
  }
  reset();
  return {
    reset,
    get disassembled() { return playerBreakup.active; },
    getPlayerFocus() { return playerBreakup.getFocus(); },
    setRider(rider, riderCockpit = null) {
      playerBreakup.setRider(rider);
      cockpit = riderCockpit;
    },
    setRival(rider) { rivalBreakup.setRider(rider); },
    update(dt, state, events = []) {
      const options = state.mapSettings ?? {};
      const elapsed = state.running ? Math.max(0, state.time - lastTime) : 0;
      lastTime = state.time;
      fracture.update(elapsed, state, events);
      rearBrake.update(elapsed, state);
      collisionSparks.update(elapsed, state, events);
      playerBreakup.update(elapsed, state, events);
      if (state.rival) {
        rivalBreakup.update(elapsed, { ...state, physicsPose: state.rival, velocity: state.rival.speed,
          crashed: state.rival.recovery > 0, partDurability: state.rival.partDurability });
      } else rivalBreakup.reset();
      if (cockpit) {
        const lostCockpit = ["body", "head", "frame", "handlebar"].some(id => playerBreakup.isDetached(id));
        cockpit.group.visible = state.cameraMode !== "third" && !lostCockpit;
        const mouth = cockpit.group.getObjectByName("first-person-mouth-joint");
        if (mouth) mouth.visible = !playerBreakup.isDetached("beak");
      }
      const acceleration =
        elapsed > 0 ? (state.velocity - lastVelocity) / elapsed : 0;
      lastVelocity = state.velocity;
      const desired =
        state.running && !state.crashed ? clamp(acceleration / 12, 0, 1) : 0;
      boost += (desired - boost) * (1 - Math.exp(-dt * 7));
      state.accelerationEffect = boost;
      const intensity =
        options.speedEffects !== false &&
        state.running &&
        !state.crashed &&
        !reducedMotion.matches
          ? clamp(state.velocity / 139, 0, 1) * 0.6 +
            boost * clamp(state.velocity / 8, 0, 1) * 0.4
          : 0;
      canvas.dataset.intensity = intensity.toFixed(2);
      if (w !== innerWidth || h !== innerHeight) {
        w = canvas.width = innerWidth;
        h = canvas.height = innerHeight;
      }
      ctx.clearRect(0, 0, w, h);
      boostLabel.hidden = !(intensity > 0.18 && boost > 0.2);
      if (intensity < 0.03) return;
      ctx.save();
      const cx = w / 2,
        cy = h * 0.46;
      for (let i = 0; i < 60; i++) {
        const a = i * 2.399963,
          phase = (state.time * (0.7 + intensity * 1.8) + i * 0.173) % 1;
        const r = 0.27 + phase * 0.48,
          length = (0.035 + intensity * 0.18) * (0.3 + phase);
        ctx.strokeStyle = `rgba(${i % 3 ? "235,255,255" : "60,191,206"},${intensity * (0.65 + phase * 0.3)})`;
        ctx.lineWidth = 1.5 + (i % 3) * 0.7;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * w * r, cy + Math.sin(a) * h * r);
        ctx.lineTo(
          cx + Math.cos(a) * w * (r + length),
          cy + Math.sin(a) * h * (r + length),
        );
        ctx.stroke();
      }
      const glow = ctx.createRadialGradient(
        cx,
        cy,
        h * 0.35,
        cx,
        cy,
        Math.max(w, h) * 0.7,
      );
      glow.addColorStop(0, "rgba(90,235,230,0)");
      glow.addColorStop(1, `rgba(80,225,220,${intensity * 0.22})`);
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    },
  };
}
