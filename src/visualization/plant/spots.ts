import { hash } from "../branch-lines/style";
import { PETIOLE_LEN } from "./layout";

export type LeafSpot = {
  /** Leaf-local frame: x along the midrib from the stem node, y across the blade. */
  x: number;
  y: number;
  r: number;
  opacity: number;
};

/** How many brown spots each wilt level shows (index = rounded level 0..5). */
const SPOTS_BY_LEVEL = [0, 1, 2, 4, 6, 8] as const;
const MAX_SPOTS = 8;

/**
 * Deterministic brown spots for one leaf. Positions are hashed from the
 * branch id, so a spot never jumps: as wilt drifts up day by day new spots
 * join the old ones, and healing clears them from the newest back.
 */
export function leafSpots(
  branchId: string,
  loudness: number,
  bladeLength: number,
  bladeWidth: number,
): LeafSpot[] {
  const level = Math.max(0, Math.min(5, Math.round(loudness)));
  const count = SPOTS_BY_LEVEL[level];
  const spots: LeafSpot[] = [];
  for (let i = 0; i < count; i++) {
    // Two independent pseudo-random draws per position, stable per branch.
    const a = (hash(`${branchId}/spot-x/${i}`) % 1000) / 1000;
    const b = (hash(`${branchId}/spot-y/${i}`) % 1000) / 1000;
    const fx = 0.22 + a * 0.66; // spread over the blade, off the very base and tip
    // Keep the spot inside the teardrop: the blade narrows toward the tip.
    const halfWidthHere = (bladeWidth / 2) * Math.min(1, 1.6 * (1 - fx)) * 0.7;
    spots.push({
      x: PETIOLE_LEN + bladeLength * fx,
      y: (b * 2 - 1) * halfWidthHere,
      r: 1.8 + 0.55 * level,
      opacity: 0.22 + 0.07 * level,
    });
  }
  return spots;
}

/** Most spots a leaf can carry — handy for capped loops in fx. */
export const LEAF_SPOT_MAX = MAX_SPOTS;
