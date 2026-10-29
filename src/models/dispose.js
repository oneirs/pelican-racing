export function disposeModel(root) {
  const geometries = new Set(),
    materials = new Set();
  root.traverse((node) => {
    if (node.geometry) geometries.add(node.geometry);
    if (node.material)
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        materials.add(material);
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  root.removeFromParent();
}
