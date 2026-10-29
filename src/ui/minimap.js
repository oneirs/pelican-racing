export function createMinimap(route) {
  const canvas = document.getElementById("minimap"),
    ctx = canvas.getContext("2d");
  canvas.width = 320;
  canvas.height = 240;
  const map = (p) => [160 + p.x * 3, 120 + p.z * 3];
  const path = new Path2D();
  route.samples.forEach((p, i) => {
    const [x, y] = map(p);
    i ? path.lineTo(x, y) : path.moveTo(x, y);
  });
  path.closePath();
  document.getElementById("length").textContent =
    Math.round(route.length) + " m";
  return function update(pose, state) {
    ctx.clearRect(0, 0, 320, 240);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e51522b";
    ctx.lineWidth = 13;
    ctx.stroke(path);
    ctx.strokeStyle = "#548e8b";
    ctx.lineWidth = 5;
    ctx.stroke(path);
    const [sx, sy] = map(route.samples[0]);
    ctx.fillStyle = "#f3b354";
    ctx.fillRect(sx - 5, sy - 5, 10, 10);
    const [x, y] = map(pose.point);
    ctx.fillStyle = "#e77654";
    ctx.strokeStyle = "#fff9e9";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    document.getElementById("lap").textContent = String(
      Math.floor(state.distance / route.length) + 1,
    ).padStart(2, "0");
    document.getElementById("progress").style.width =
      ((state.distance % route.length) / route.length) * 100 + "%";
  };
}
