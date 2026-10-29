// The local vendor script is loaded before the module entry point.
const THREE = window.THREE;
if (!THREE)
  throw new Error("Three.js 未加载，请检查 vendor/three/three.min.js");
export default THREE;
