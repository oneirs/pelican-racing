import { RACE_DISTANCE_METERS } from "./progression.js?v=progress-59";

// Training stays endless; only an active competition awards a result.
export function finishRaceIfNeeded(state) {
  if (!state.running || state.training || state.raceFinished || state.distance < RACE_DISTANCE_METERS || !state.progression) return false;
  const place = state.rival && state.rival.distance >= RACE_DISTANCE_METERS ? 2 : 1;
  const points = state.progression.completeRace(state.raceId, place);
  state.raceFinished = true;
  state.running = false;
  state.raceResult = `比赛完成 · 第 ${place} 名 · +${points} 积分`;
  return true;
}
