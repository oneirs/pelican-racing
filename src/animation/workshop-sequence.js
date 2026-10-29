export const WORKSHOP_PHASES = [
  ["appear", 0.4, "两名医生出现在鹈鹕身旁"],
  ["press", 0.9, "医生抓住鹈鹕，按上担架"],
  ["strap", 0.4, "扣紧身体与腿部绑带"],
  ["push", 0.8, "推到帘子后面"],
  ["curtain", 0.4, "两位医生走向帘子"],
  ["close", 0.5, "两位医生拉上帘子"],
  ["work", 1, "骨锯改造中"],
  ["open", 0.4, "改造完成 · 揭帘"],
  ["return", 0.8, "返回自行车"],
];
export function createWorkshopSequence({
  onPhase = () => {},
  onCommit = () => {},
  onFinish = () => {},
} = {}) {
  let index = -1,
    elapsed = 0,
    committed = false;
  const snapshot = () => ({
    busy: index >= 0,
    phase: WORKSHOP_PHASES[index]?.[0] ?? "idle",
    progress: index < 0 ? 0 : Math.min(1, elapsed / WORKSHOP_PHASES[index][1]),
    label: WORKSHOP_PHASES[index]?.[2] ?? "准备就绪",
  });
  const commit = () => {
    if (!committed) {
      committed = true;
      onCommit();
    }
  };
  function finish() {
    commit();
    index = -1;
    elapsed = 0;
    onFinish();
  }
  return {
    start() {
      if (index >= 0) return false;
      index = 0;
      elapsed = 0;
      committed = false;
      onPhase("appear");
      return true;
    },
    update(dt) {
      if (index < 0 || dt <= 0) return snapshot();
      elapsed += dt;
      while (index >= 0 && elapsed >= WORKSHOP_PHASES[index][1]) {
        elapsed -= WORKSHOP_PHASES[index][1];
        index++;
        if (index === WORKSHOP_PHASES.length) {
          finish();
          break;
        }
        if (WORKSHOP_PHASES[index][0] === "open") commit();
        onPhase(WORKSHOP_PHASES[index][0]);
      }
      return snapshot();
    },
    skip() {
      if (index >= 0) finish();
    },
    get state() {
      return snapshot();
    },
  };
}
