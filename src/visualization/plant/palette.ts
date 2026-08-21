/**
 * Scene colours for the plant-by-a-window visualization. These sit outside
 * the theme tokens because they belong to the picture (sky, pot, soil), not
 * to the UI chrome; there is only one look, so plain constants suffice.
 */
export const PLANT_PALETTE = {
  /** Sky seen through the window, from clear to soft rain. */
  sky: "#cfe3ee",
  skyOvercast: "#b9c6cc",
  skyRain: "#aebcc4",
  sun: "#f2d98c",
  sunHalo: "#f7ead1",
  rain: "#8fa9b8",
  /** The room. */
  windowFrame: "#b9a582",
  sill: "#cbb894",
  wall: "#f3eee1",
  /** The plant. */
  pot: "#b0704f",
  potShadow: "#8d5740",
  soil: "#5d4634",
  stem: "#5a7a4f",
  /** Leaf details. */
  spot: "#6b4a2f",
  gold: "#d9a14e",
  dew: "#eaf4f8",
  /** A heavy wilt dries the green toward this. */
  dryLeaf: "#b3a05e",
  /** Flowers — settled leaves bloom, and the crown flower opens with you. */
  petal: "#e9b8c4",
  petalDeep: "#d391a3",
  flowerHeart: "#e7c26a",
} as const;
