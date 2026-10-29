const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function balanceAtSpeed(speed) { return 1 - Math.exp(-Math.abs(speed) / 12); }
export function steeringLimit(speed, tuning = 1) {
  const v = Math.abs(speed);
  // Tight low-speed turns, progressively smaller steering angles at racing speed.
  return Math.min(0.55, Math.atan(1.7 * (34 + v * 0.8) * tuning / Math.max(25, v * v)));
}
export function cornerLean(forwardSpeed, yawRate) {
  return clamp(-Math.atan2(-forwardSpeed * yawRate, 9.81) * 0.55, -0.42, 0.42);
}
