import {
  RIDER_MASS,
  MAX_DRIVE_FORCE,
  MAX_SPEED_KMH,
  STOCK_SPEED_KMH,
  DRAG_COEFFICIENT,
  ROLLING_RESISTANCE,
} from "../physics/config.js?v=combat-48";

// Game balance weights in kg; these are designed values, not material measurements.
// Equipped parts replace the stock parts. Performance multipliers combine.
export const SLOTS = [
  {
    id: "weapon", name: "攻击武器", owner: "武器",
    items: [
      { id: "standard", name: "空武器架", weightKg: 0, effect: "不携带攻击武器。火箭筒、小炮、双加特林与攻击长喙只能选择一种。", changes: "无武器", modifiers: {} },
      { id: "launcher", name: "小炮", weightKg: 4, effect: "E 举起小炮，向车头直射，不自动瞄准、不追踪；已击飞的角色再次命中仍会再次击飞，碰撞即爆炸。命中炸飞，5 秒恢复；当前模式弹药不限。", changes: "冷却 1.6 秒 · 爆炸半径 13.5 m", modifiers: {} },
      { id: "homing-launcher", name: "火箭筒", weightKg: 4, effect: "按 E 从右侧举起火箭筒，瞄准附近选手发射轻度追踪弹；可追踪被击飞的选手，碰到物体立即爆炸。未找到目标时向前发射。", changes: "冷却 1.6 秒 · 爆炸半径 13.5 m", modifiers: {} },
      { id: "gatling", name: "双加特林", weightKg: 8, effect: "按住 E 持续射击，松开停止；向车头直射、不自动瞄准、不追踪；命中扣除对应部位耐久，连续命中可使对手翻车，已击飞的角色再次命中仍受到击飞冲量。损坏部位5秒修复。", changes: "20 发/秒 · 单发伤害 8 · 射程 180 m", modifiers: {} },
      { id: "attack-beak", name: "攻击长喙", weightKg: 3, effect: "Q 向左摆喙，E 向右摆喙；近距离扫击对手并击飞，已击飞的角色再次命中仍受到冲量。每次挥击只对同一角色造成一次伤害。", changes: "伤害 25 · 攻击长度 4 m · 冷却 0.75 s", modifiers: {} },
    ],
  },
  {
    id: "rocket", name: "火箭", owner: "道具",
    items: [
      { id: "standard", name: "空载支架", weightKg: 0, effect: "保留安装支架，不提供助推。", changes: "驱动力 ×1.00", modifiers: {} },
      { id: "boost", name: "双联助推火箭", weightKg: 6, effect: "踩下油门时助推，增强加速；提高低速齿组上限，整车最高 500 km/h。", changes: "驱动力 +60% · 速度上限 +80 km/h（封顶 500）", modifiers: { drive: 1.6, speedBonus: 80 } },
    ],
  },
  {
    id: "handlebar", name: "车把", owner: "自行车",
    items: [
      { id: "standard", name: "经典车把", weightKg: 1, effect: "常规转向配置。", changes: "转向 ×1.00", modifiers: {} },
      { id: "precision", name: "精准操控车把", weightKg: 2, effect: "加强转向响应，保留原握持位置。", changes: "转向 +25%", modifiers: { steering: 1.25 } },
      { id: "agile", name: "竞技转向车把", weightKg: 3, effect: "强化高速变向，搭配抓地胎更易控制。", changes: "转向 +45%", modifiers: { steering: 1.45 } },
    ],
  },
  {
    id: "head",
    name: "头盔",
    owner: "鹈鹕",
    items: [
      {
        id: "standard",
        name: "骑行头盔", weightKg: 1,
        effect: "标准保护，保持平衡配置。",
        changes: "脱轨救援 5 秒",
        modifiers: {},
      },
      {
        id: "guard",
        name: "缓冲护盔", weightKg: 9,
        effect: "提高失控门槛，额外重量拖慢加速。脱轨后 5 秒救援，落回赛道直接接续。",
        changes: "失控门槛 +35%",
        modifiers: { crash: 1.35 },
      },
      {
        id: "aero",
        name: "流线头盔", weightKg: 0.7,
        effect: "减小迎风阻力，但抗撞能力略弱。",
        changes: "空气阻力 −25% · 失控门槛 −15%",
        modifiers: { drag: 0.75, crash: 0.85 },
      },
    ],
  },
  {
    id: "wings",
    name: "翅膀",
    owner: "鹈鹕",
    items: [
      {
        id: "standard",
        name: "原生羽翼", weightKg: 4,
        effect: "常规空气阻力与转向响应。",
        changes: "空中重力 ×1.00 · 转向 ×1.00",
        modifiers: {},
      },
      {
        id: "glide",
        name: "滑翔翼片", weightKg: 5,
        effect: "撞飞时下落更慢，地面转向更缓。",
        changes: "腾空重力 −35% · 空阻 −15% · 转向 −15%",
        modifiers: { airGravity: 0.65, drag: 0.85, steering: 0.85 },
      },
      {
        id: "sprint",
        name: "助推翼甲", weightKg: 6,
        effect: "强化蹬踏推力，代价是更大的空气阻力。",
        changes: "驱动力 +12% · 空气阻力 +18%",
        modifiers: { drive: 1.12, drag: 1.18 },
      },
    ],
  },
  {
    id: "thighs",
    name: "腿部",
    owner: "鹈鹕",
    items: [
      {
        id: "standard",
        name: "原生双腿", weightKg: 12,
        effect: "大腿、小腿和脚蹼保持原生形态，提供常规蹬踏能力。",
        changes: "驱动力 ×1.00",
        modifiers: {},
      },
      {
        id: "power",
        name: "轻制动力腿", weightKg: 13,
        effect: "轻量动力护甲覆盖整腿与脚蹼，小幅改善加速。",
        changes: "驱动力 +20%",
        modifiers: { drive: 1.2 },
      },
      {
        id: "agile",
        name: "轻巧腿甲", weightKg: 10,
        effect: "轻量腿甲覆盖大腿、小腿和脚蹼，以部分推力换取灵活转向。",
        changes: "转向 +18% · 驱动力 −10%",
        modifiers: { steering: 1.18, drive: 0.9 },
      },
      {
        id: "golden",
        name: "黄金腿", weightKg: 42,
        effect:
          "厚重黄金护甲覆盖整腿，抗撞更强，但加速和变向更迟缓。腿部增重最高。",
        changes: "驱动力 +30% · 失控门槛 +60% · 转向 −20%",
        modifiers: { drive: 1.3, crash: 1.6, steering: 0.8 },
      },
      {
        id: "diamond",
        name: "钻石腿", weightKg: 32,
        effect:
          "晶体切面覆盖大腿、小腿和脚蹼，兼顾推力与抗撞。重量仅次于黄金腿。",
        changes: "驱动力 +25% · 失控门槛 +35% · 转向 −10%",
        modifiers: { drive: 1.25, crash: 1.35, steering: 0.9 },
      },
      {
        id: "mechanical",
        name: "机械腿", weightKg: 22,
        effect: "金属骨架和液压连杆强化蹬踏，增加重量，转向略慢。",
        changes: "驱动力 +40% · 转向 −8%",
        modifiers: { drive: 1.4, steering: 0.92 },
      },
      {
        id: "hormone",
        name: "激素腿", weightKg: 14,
        effect: "游戏强化肌肉提供高推力、低增重，但重撞更易失控。",
        changes: "驱动力 +55% · 失控门槛 −35%",
        modifiers: { drive: 1.55, crash: 0.65 },
      },
    ],
  },
  {
    id: "beak",
    name: "喙",
    owner: "鹈鹕",
    items: [
      {
        id: "standard",
        name: "原生长喙", weightKg: 2,
        effect: "常规外形，保持原有空气阻力和抗撞能力。",
        changes: "空阻 ×1.00 · 失控门槛 ×1.00",
        modifiers: {},
      },
      {
        id: "streamlined",
        name: "破风长喙", weightKg: 1.5,
        effect: "更细长的外形降低风阻，转向响应略慢。",
        changes: "空气阻力 −15% · 转向 −8%",
        modifiers: { drag: 0.85, steering: 0.92 },
      },
      {
        id: "cushion",
        name: "缓冲喙套", weightKg: 5,
        effect: "增强碰撞保护，但会增加负重。",
        changes: "失控门槛 +35%",
        modifiers: { crash: 1.35 },
      },
    ],
  },
  {
    id: "frame",
    name: "车架",
    owner: "自行车",
    items: [
      {
        id: "standard",
        name: "合金车架", weightKg: 16,
        effect: "重量与抗撞之间的均衡方案。",
        changes: "失控门槛 ×1.00",
        modifiers: {},
      },
      {
        id: "carbon",
        name: "轻量碳架", weightKg: 4,
        effect: "减轻整车重量，但更容易被撞翻。",
        changes: "失控门槛 −20%",
        modifiers: { crash: 0.8 },
      },
      {
        id: "reinforced",
        name: "防撞车架", weightKg: 32,
        effect: "更能承受碰撞带来的速度突变，重量增加。",
        changes: "失控门槛 +65%",
        modifiers: { crash: 1.65 },
      },
    ],
  },
  {
    id: "tires",
    name: "轮胎",
    owner: "自行车",
    items: [
      {
        id: "standard",
        name: "公路胎", weightKg: 3,
        effect: "常规抓地、滚动阻力与制动。",
        changes: "抓地 ×1.00 · 滚阻 ×1.00",
        modifiers: {},
      },
      {
        id: "slick",
        name: "低阻光头胎", weightKg: 2,
        effect: "滑行更省力，但更容易侧滑。",
        changes: "滚动阻力 −45% · 抓地 −25%",
        modifiers: { rolling: 0.55, grip: 0.75 },
      },
      {
        id: "grip",
        name: "高抓地宽胎", weightKg: 4,
        effect: "增强抓地和制动，代价是更高滚动阻力。",
        changes: "抓地 +50% · 制动 +20% · 滚阻 +60%",
        modifiers: { grip: 1.5, braking: 1.2, rolling: 1.6 },
      },
    ],
  },
  {
    id: "drive",
    name: "传动",
    owner: "自行车",
    items: [
      {
        id: "standard",
        name: "标准齿组", weightKg: 2,
        effect: "普通装备的初始速度上限为 220 km/h。",
        changes: "传动上限 220 km/h · 驱动力 ×1.00",
        modifiers: {},
      },
      {
        id: "balanced",
        name: "均衡齿组", weightKg: 2.5,
        effect: "升级传动，提升速度上限与加速能力。",
        changes: "传动上限 420 km/h · 驱动力 +15%",
        modifiers: { topSpeed: 420, drive: 1.15 },
      },
      {
        id: "torque",
        name: "爬坡齿组", weightKg: 3,
        effect: "起步与撞击后再加速更有力，极速较低。",
        changes: "传动上限 320 km/h · 驱动力 +40%",
        modifiers: { topSpeed: 320, drive: 1.4 },
      },
    ],
  },
];
export function normalizeParts(parts) {
  // Migrate the old separate gun slot; conflicting old saves keep the explicit cannon.
  if (parts?.gatling === "dual" && !["launcher", "homing-launcher", "gatling", "attack-beak"].includes(parts?.weapon))
    parts = { ...parts, weapon: "gatling" };
  return Object.fromEntries(
    SLOTS.map((slot) => [
      slot.id,
      slot.items.some((item) => item.id === parts?.[slot.id])
        ? parts[slot.id]
        : "standard",
    ]),
  );
}
export function getInstalled(parts) {
  const valid = normalizeParts(parts);
  return SLOTS.map((slot) => ({
    slot,
    item: slot.items.find((item) => item.id === valid[slot.id]),
  }));
}
export const BODY_WEIGHT_KG = RIDER_MASS - SLOTS.reduce(
  (total, slot) => total + slot.items.find((item) => item.id === "standard").weightKg, 0,
);

export function formatItemWeight(slot, item) {
  const stock = slot.items.find((option) => option.id === "standard").weightKg;
  const difference = Math.round((item.weightKg - stock) * 10) / 10;
  const delta = difference ? ` · 比原装 ${difference > 0 ? "+" : "−"}${Math.abs(difference)} kg` : "";
  return `重量 ${item.weightKg} kg${delta}`;
}

export function computeTuning(parts) {
  const result = {
    mass: BODY_WEIGHT_KG,
    driveForce: MAX_DRIVE_FORCE,
    maxSpeedKmh: STOCK_SPEED_KMH,
    drag: DRAG_COEFFICIENT,
    rolling: ROLLING_RESISTANCE,
    grip: 3,
    steering: 1,
    recoveryTime: 5,
    crashThreshold: 1,
    airGravity: 1,
    brakeAccel: 18,
  };
  const mapping = {
    drive: "driveForce",
    drag: "drag",
    rolling: "rolling",
    grip: "grip",
    steering: "steering",
    crash: "crashThreshold",
    airGravity: "airGravity",
    braking: "brakeAccel",
  };
  let speedBonus = 0;
  for (const { item } of getInstalled(parts)) {
    const modifiers = item.modifiers;
    result.mass += item.weightKg;
    speedBonus += modifiers.speedBonus ?? 0;
    if (modifiers.topSpeed)
      result.maxSpeedKmh = Math.min(MAX_SPEED_KMH, modifiers.topSpeed);
    for (const [key, target] of Object.entries(mapping))
      result[target] *= modifiers[key] ?? 1;
  }
  result.mass = Math.round(result.mass * 1000) / 1000;
  result.maxSpeedKmh = Math.min(MAX_SPEED_KMH, result.maxSpeedKmh + speedBonus);
  return result;
}
export function buildLoadout(selection) {
  const parts = normalizeParts(selection.parts);
  return {
    ...selection,
    parts,
    tuning: computeTuning(parts),
    character: {
      ...selection.character,
      headPart: parts.head,
      beakPart: parts.beak,
      attackBeak: parts.weapon === "attack-beak",
      wingPart: parts.wings,
      legPart: parts.thighs,
    },
    bicycle: {
      ...selection.bicycle,
      framePart: parts.frame,
      tirePart: parts.tires,
      drivePart: parts.drive,
      rocketPart: parts.rocket,
      weaponPart: ["launcher", "homing-launcher"].includes(parts.weapon) ? parts.weapon : "standard",
      gatlingPart: parts.weapon === "gatling" ? "dual" : "standard",
      handlebarPart: parts.handlebar,
    },
  };
}
