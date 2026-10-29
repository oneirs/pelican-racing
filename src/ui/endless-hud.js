import THREE from "../core/three.js?v=combat-48";
import { createDurabilityHud } from "./durability-hud.js?v=durability-57";
export function createEndlessHud() {
  const canvas = document.getElementById("minimap"),
    ctx = canvas.getContext("2d");
  canvas.width = 240;
  canvas.height = 270;
  const distance = document.getElementById("distance"),
    speed = document.getElementById("velocity"),
    crash = document.getElementById("crash-notice");
  const aimPoint = new THREE.Vector3();
  const durability = createDurabilityHud();
  return function update(state, path, camera) {
    durability(state);
    document.getElementById("camera-label").textContent = state.collisionView ? "碰撞观察" : state.cameraMode === "third" ? "第三人称" : "第一人称";
    crash.hidden = !state.crashed && !state.directionCorrecting;
    document.getElementById("pedal-cadence").textContent = String(Math.round(state.cadenceRpm ?? 0));
    document.getElementById("destroyed-count").textContent = String(
      state.destroyedCount ?? 0,
    );
    if (state.crashed)
      crash.textContent = state.recoverySuspended
        ? "赛道上方腾空 · 等待落地 · 不触发重置"
        : `轻微辅助摆正 · ${state.crashRemaining.toFixed(1)} 秒后仍未恢复则重置`;
    if (!state.crashed && state.directionCorrecting) crash.textContent = "持续倒车 5 秒 · 正在校正赛道朝向";
    if (state.balanceAssisting) { crash.hidden = false; crash.textContent = state.crashed ? `${crash.textContent} · W 接地后缓慢加速并回正` : "W 缓慢加速并回正中"; }
    distance.textContent = (Math.max(0, state.distance) / 1000).toFixed(2);
    speed.textContent = String(
      Math.round(state.running ? (state.forwardVelocity ?? state.velocity) * 3.6 : 0),
    );
    const kmh = (state.forwardVelocity ?? state.velocity) * 3.6;
    const maximum = state.tuning?.maxSpeedKmh ?? 220;
    const ratio = Math.min(1, Math.abs(kmh) / maximum);
    speed.textContent = String(Math.round(kmh));
    document.getElementById("gauge-fill").style.strokeDasharray = `${ratio * 75} 100`;
    document.getElementById("gauge-needle").setAttribute("transform", `rotate(${-135 + ratio * 270} 110 104)`);
    document.getElementById("gauge-max").textContent = String(maximum);
    document.getElementById("gauge-mid").textContent = String(Math.round(maximum / 2));
    document.getElementById("speedometer").setAttribute("aria-label", `当前速度 ${Math.round(kmh)} 公里每小时，上限 ${maximum}`);
    document.getElementById("race-result").textContent = state.raceResult || "";
    document.getElementById("pickup-status").textContent = state.pickupNotice || (state.pickupBoostRemaining > 0 ? `加速道具 ${state.pickupBoostRemaining.toFixed(1)}s` : "");
    const rival = state.rival;
    const position = !rival || Math.abs(rival.gap) < 0.5 ? "并列" : rival.gap > 0 ? "第 2 / 2 名" : "第 1 / 2 名";
    document.getElementById("rival-status").textContent = !rival ? (state.training ? "单人训练 · 无 AI 对手" : "AI 选手 · 等待加入") : `${position} · AI ${rival.gap >= 0 ? "领先" : "落后"} ${Math.round(Math.abs(rival.gap))}m · ${rival.recovery > 0 ? `翻车 ${rival.recovery.toFixed(1)}s` : `${Math.round(rival.speed * 3.6)} km/h`}`;
    const weaponName = state.weaponKind === "homing-launcher" ? "火箭筒" : "小炮";
    const firingMode = state.weaponKind === "homing-launcher" ? (state.weaponLocked ? "目标已锁定 · 追踪弹" : "无目标 · 向前发射") : "向前直射";
    const beak = !!state.beakEquipped;
    const ranged = !beak && state.weaponEquipped;
    const gatling = !beak && state.gatlingEquipped;
    document.getElementById("weapon-status").textContent = beak
      ? `${state.beakAttack ? `攻击长喙 · ${state.beakAttack.direction < 0 ? "左" : "右"}摆中` : "当前武器：攻击长喙"} · Q 左摆 / E 右摆${state.beakCooldown > 0 ? ` · 冷却 ${state.beakCooldown.toFixed(1)}s` : ""}`
      : !ranged ? (gatling ? "当前武器：双加特林" : "未装备攻击武器") : state.weaponAction && !state.weaponAction.fired ? `举起${weaponName} · ${firingMode}` : state.weaponCooldown > 0 ? `${weaponName}冷却 ${state.weaponCooldown.toFixed(1)}s` : `E ${weaponName} · ${firingMode}`;
    document.getElementById("gatling-status").textContent = gatling ? `${state.gatlingFiring ? "双加特林射击中" : "E 按住双加特林连射"} · 命中 ${state.gatlingHits ?? 0}` : "";
    document.getElementById("weapon-hits").textContent = beak ? `命中 ${state.beakHits ?? 0} 次` : ranged ? `命中 ${state.weaponHits ?? 0} 次` : "";
    const reticle = document.getElementById("weapon-reticle");
    reticle.hidden = !ranged && !gatling;
    reticle.dataset.locked = String(!!ranged && !!state.weaponLocked);
    if ((ranged || gatling) && state.physicsPose && camera) {
      const pose = state.physicsPose;
      aimPoint.set(state.weaponEquipped && !state.gatlingFiring ? 0.527 : 0, state.weaponEquipped && !state.gatlingFiring ? 1.355 : 0.735, -60).applyQuaternion(pose.rotation).add(new THREE.Vector3(pose.x, pose.y, 0)).project(camera);
      if (state.weaponLocked && state.weaponTarget) {
        aimPoint.set(state.weaponTarget.x, state.weaponTarget.y, state.weaponTarget.z + state.distance).project(camera);
      }
      reticle.hidden = aimPoint.z < -1 || aimPoint.z > 1 || Math.abs(aimPoint.x) > 1 || Math.abs(aimPoint.y) > 1;
      reticle.style.left = `${(aimPoint.x + 1) * 50}%`; reticle.style.top = `${(1 - aimPoint.y) * 50}%`;
    } else {
      reticle.style.left = "50%";
      reticle.style.top = state.cameraMode === "third" ? "32%" : "46%";
    }
    const current = path.sample(state.distance),
      t = current.tangent,
      n = current.normal;
    function map(p) {
      const dx = p.x - current.point.x,
        dz = p.z - current.point.z;
      return [
        120 + (dx * n.x + dz * n.z) * 1.55,
        240 - (dx * t.x + dz * t.z) * 0.86,
      ];
    }
    ctx.clearRect(0, 0, 240, 270);
    ctx.beginPath();
    for (let d = 0; d <= 250; d += 3) {
      const [x, y] = map(path.sample(state.distance + d).point);
      d ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.strokeStyle = "#24576226";
    ctx.lineWidth = 22;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.strokeStyle = "#5f9497";
    ctx.lineWidth = 3;
    ctx.stroke();
    const [x, y] = map(path.sample(state.distance, state.lane).point);
    ctx.fillStyle = "#e58d55";
    ctx.strokeStyle = "#fff6dc";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y - 8);
    ctx.lineTo(x - 6, y + 6);
    ctx.lineTo(x + 6, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
}
