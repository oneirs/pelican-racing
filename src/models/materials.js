import THREE from "../core/three.js?v=combat-48";

export function mat(c, rough = 0.85) {
  return new THREE.MeshStandardMaterial({
    color: c,
    flatShading: true,
    roughness: rough,
  });
}

export function createMaterials(character = {}, bicycle = {}) {
  const white = mat(character.body ?? "#fffaf0"),
    cream = mat(character.feather ?? "#eee6d6"),
    wingWhite = mat(character.feather ?? "#e5e9e6"),
    gray = mat("#525e70"),
    dark = mat("#243740"),
    black = mat("#171e25"),
    orange = mat("#ff9a27"),
    gold = mat("#ffc142"),
    billMat = mat("#ffb347"),
    billTop = mat("#ff9942"),
    teal = mat(bicycle.color ?? "#258d8b", 0.5),
    tealDark = mat(bicycle.dark ?? "#15656d"),
    metal = mat("#b9d0c9", 0.45),
    tire = mat("#33494b"),
    rubber = mat("#e9e1c8"),
    saddleMat = mat("#b77a4c");
  return {
    white,
    cream,
    wingWhite,
    gray,
    dark,
    black,
    orange,
    gold,
    billMat,
    billTop,
    teal,
    tealDark,
    metal,
    tire,
    rubber,
    saddleMat,
  };
}
