import { getMapDefinition } from "../../game/map-settings.js?v=coast-55";
export const MAX_PLAYERS = 8;
export function createEndlessRaceLayout(path) {
  const training = getMapDefinition(path.options).training;
  return {
    maxPlayers: training ? 1 : MAX_PLAYERS,
    training,
    grid: Array.from({ length: training ? 1 : MAX_PLAYERS }, (_, i) => {
      const row = Math.floor(i / 2),
        distance = -(5 + row * 5.5),
        lane = training ? 0 : ((i % 2 ? -1 : 1) * path.width) / 4,
        pose = path.sample(distance, lane);
      return {
        slot: i + 1,
        row,
        lane,
        distance,
        position: pose.point,
        heading: Math.atan2(-pose.tangent.x, -pose.tangent.z),
      };
    }),
  };
}
