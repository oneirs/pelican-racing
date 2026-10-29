// Labels let the item viewer reuse the exact installed model geometry.
export function tagPartsSince(parent, first, slot) {
  for (const child of parent.children.slice(first))
    child.userData.partSlot = slot;
}
