export const BEAK_ACTION_TIME = 0.55;
export const BEAK_WINDUP = 0.12;
export const BEAK_SWEEP_TIME = 0.24;

const smooth = t => t * t * (3 - 2 * t);

// The rider faces local -Z. A negative Y rotation swings toward its right.
export function beakSwingAngle(age, direction) {
  if ((direction !== -1 && direction !== 1) || age <= 0 || age >= BEAK_ACTION_TIME) return 0;
  if (age < BEAK_WINDUP) return -direction * 0.12 * smooth(age / BEAK_WINDUP);
  const elapsed = age - BEAK_WINDUP;
  if (elapsed <= BEAK_SWEEP_TIME) return -direction * (0.12 + 1.55 * smooth(elapsed / BEAK_SWEEP_TIME));
  const recovery = elapsed - BEAK_SWEEP_TIME;
  return -direction * 1.67 * (1 - smooth(recovery / (BEAK_ACTION_TIME - BEAK_WINDUP - BEAK_SWEEP_TIME)));
}
