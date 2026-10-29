const ease = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

// Grip first; then lift clear of the saddle, turn, and lower onto the mattress.
export function workshopGrab(progress) {
  return {
    grip: ease(progress / 0.25),
    lift: 0.65 * ease((progress - 0.22) / 0.3) * (1 - ease((progress - 0.62) / 0.38)),
    turn: ease((progress - 0.38) / 0.62),
    transfer: ease((progress - 0.25) / 0.75),
  };
}
