// Only changes to the pelican's body require the operating-room sequence.
export const requiresSurgery = (slotId) =>
  ["thighs", "beak", "wings"].includes(slotId);

export const hasBodyChanges = (before, after) =>
  Object.keys(after).some((slot) => requiresSurgery(slot) && before[slot] !== after[slot]);
