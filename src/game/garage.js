import { normalizeParts } from "./upgrades.js?v=durability-57";
export const CHARACTERS = [
  {
    id: "seabreeze",
    name: "海风信使",
    tag: "经典白羽",
    description: "红色头盔，迎风飘动的围巾。",
    body: "#fffaf0",
    feather: "#e5e9e6",
    helmet: "#d53d45",
    scarf: "#c51f37",
    accent: "#df725b",
  },
  {
    id: "sunset",
    name: "落日漫游者",
    tag: "暖杏羽色",
    description: "带着一身落日的暖色出发。",
    body: "#f3d1ae",
    feather: "#dba77e",
    helmet: "#e69b30",
    scarf: "#248f93",
    accent: "#d89442",
  },
  {
    id: "storm",
    name: "风暴领航员",
    tag: "蓝灰羽色",
    description: "蓝灰羽翼与明亮的薄荷绿装备。",
    body: "#95abbc",
    feather: "#647f96",
    helmet: "#344e69",
    scarf: "#80d6b8",
    accent: "#577f98",
  },
];
export const BICYCLES = [
  {
    id: "coast",
    name: "海岸巡航",
    tag: "经典直把",
    description: "海盐绿车架 · 宽直车把",
    color: "#258d8b",
    dark: "#15656d",
    type: "cruiser",
    barWidth: 1,
  },
  {
    id: "coral",
    name: "珊瑚公路",
    tag: "公路弯把",
    description: "珊瑚橙车架 · 下弯车把",
    color: "#ed7952",
    dark: "#943d30",
    type: "road",
    barWidth: 0.86,
  },
  {
    id: "night",
    name: "午夜疾风",
    tag: "碟轮竞速",
    description: "暮紫车架 · 封闭后轮",
    color: "#8176b4",
    dark: "#42385d",
    type: "aero",
    barWidth: 0.75,
  },
];
const KEY = "pelican-garage-v2";
export function resolveSelection(value = {}) {
  return {
    parts: normalizeParts(value?.parts),
    character:
      CHARACTERS.find((item) => item.id === value?.character) ?? CHARACTERS[0],
    bicycle: BICYCLES.find((item) => item.id === value?.bicycle) ?? BICYCLES[0],
  };
}
export function loadSelection(storage) {
  try {
    return resolveSelection(
      JSON.parse(storage.getItem(KEY) ?? storage.getItem("pelican-garage-v1")),
    );
  } catch {
    return resolveSelection();
  }
}
export function saveSelection(storage, selection) {
  try {
    storage.setItem(
      KEY,
      JSON.stringify({
        parts: normalizeParts(selection.parts),
        character: selection.character.id,
        bicycle: selection.bicycle.id,
      }),
    );
  } catch {
    /* Selection remains usable when browser storage is unavailable. */
  }
}
