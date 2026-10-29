import THREE from "./three.js?v=combat-48";

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#bce5e7");
  scene.fog = new THREE.Fog("#bce5e7", 220, 600);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  } catch (e) {
    document.getElementById("error").style.display = "block";
    throw e;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(
    42,
    innerWidth / innerHeight,
    0.1,
    1600,
  );
  const target = new THREE.Vector3(-0.05, 2.18, 0);
  const hemi = new THREE.HemisphereLight(0xeefbff, 0xb6a279, 2.2);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1d8, 3.1);
  sun.position.set(-45, 85, 35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -78,
    right: 78,
    top: 70,
    bottom: -70,
    near: 0.5,
    far: 190,
  });
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.06;
  sun.shadow.radius = 5;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xe0f3ff, 0.65);
  fill.position.set(5, 3, -4);
  scene.add(fill);
  function resize() {
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", resize);
  return {
    scene,
    renderer,
    camera,
    target,
    sun,
    dispose() {
      removeEventListener("resize", resize);
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
