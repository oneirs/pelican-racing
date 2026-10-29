// Physical m/s drives the view; world geometry stays aligned with its colliders.
export function speedFeel(state) {
  if (state.mapSettings?.speedEffects === false || state.crashed) return 0;
  return Math.max(0, Math.min(1, (Math.abs(state.velocity ?? 0) - 5) / 105));
}
