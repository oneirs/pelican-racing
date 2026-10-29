// Shared layout data for future player/AI spawning and ordered race checkpoints.
// This describes the track; it does not simulate or connect multiplayer clients.
export function createRaceLayout(route) {
  const maxPlayers = 6;
  const grid = Array.from({ length: maxPlayers }, (_, i) => {
    const row = Math.floor(i / 2),
      lane = ((i % 2 === 0 ? -1 : 1) * route.width) / 4;
    const distance = -(4.5 + row * 5.5),
      pose = route.sample(distance / route.length);
    return {
      slot: i + 1,
      distance,
      lane,
      position: pose.point.clone().addScaledVector(pose.normal, lane),
      heading: -Math.atan2(pose.tangent.z, pose.tangent.x),
    };
  });
  const checkpoints = Array.from({ length: 8 }, (_, i) => {
    const progress = i / 8,
      pose = route.sample(progress);
    return {
      index: i,
      progress,
      position: pose.point.clone(),
      forward: pose.tangent.clone(),
      left: pose.point.clone().addScaledVector(pose.normal, -route.width / 2),
      right: pose.point.clone().addScaledVector(pose.normal, route.width / 2),
    };
  });
  return { maxPlayers, grid, checkpoints };
}
