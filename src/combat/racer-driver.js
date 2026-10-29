import { computeTuning } from "../game/upgrades.js?v=durability-57";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Independent race progress: never derived from the player's speed or distance.
export function createRacerDriver(path, spawn) {
  const tuning = computeTuning({});
  let distance = spawn.distance, lane = spawn.lane, speed = 0, phase = 0;
  let targetLane = lane, decisionClock = 0;
  return {
    get distance() { return distance; },
    get lane() { return lane; },
    get speed() { return speed; },
    get phase() { return phase; },
    tuning,
    stop() { speed = 0; },
    update(dt, clearance = () => Infinity, performance = 1) {
      const pose = path.sample(distance, lane);
      const ahead = path.sample(distance + Math.max(12, speed), lane);
      const angle = Math.acos(clamp(pose.tangent.x * ahead.tangent.x + pose.tangent.z * ahead.tangent.z, -1, 1));
      const curveLimit = Math.sqrt(7 * Math.max(12, speed) / Math.max(0.001, angle));
      decisionClock -= dt;
      if (decisionClock <= 0) {
        const margin = path.width / 2 - 1.5;
        const candidates = [targetLane, clamp(lane - 3.5, -margin, margin), clamp(lane + 3.5, -margin, margin)];
        const available = candidates.map(l => ({ lane: l, space: clearance(l) }));
        const current = available[0];
        if (current.space < speed * speed / (2 * tuning.brakeAccel) + 8) {
          const best = available.reduce((a, b) => b.space > a.space + 2 ? b : a);
          targetLane = best.lane;
        }
        decisionClock = 0.15;
      }
      lane += clamp(targetLane - lane, -3 * dt, 3 * dt);
      const obstacleLimit = Math.sqrt(2 * tuning.brakeAccel * Math.max(0, clearance(lane) - 3));
      const targetSpeed = Math.min(tuning.maxSpeedKmh / 3.6 * performance, curveLimit, obstacleLimit);
      const acceleration = (tuning.driveForce * performance - tuning.drag * speed * speed - tuning.rolling) / tuning.mass;
      speed += clamp(targetSpeed - speed, -tuning.brakeAccel * dt, acceleration * dt);
      // Path distance is measured along -Z; normalize travel speed on bends.
      distance += speed * dt * Math.abs(pose.tangent.z);
      phase += speed * dt * 0.8;
      return path.sample(distance, lane);
    },
  };
}
