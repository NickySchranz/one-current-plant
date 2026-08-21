import { PETIOLE_LEN } from "./layout";

/**
 * Path builders in the leaf's local frame: the origin is the stem node, the
 * positive x-axis runs out along the petiole and midrib. The consumer renders
 * them inside `<G>` translated to the attach point and rotated by angleDeg.
 */

/** The little stalk from the stem node to the blade base. */
export function petiolePath(): string {
  return `M 0 0 C 7 -1.5, 15 -0.5, ${PETIOLE_LEN} 0`;
}

/** The teardrop blade: base at the petiole end, tip pointing outward. */
export function bladePath(len: number, width: number): string {
  const p = PETIOLE_LEN;
  const bulge = p + len * 0.42;
  return (
    `M ${p} 0` +
    ` Q ${r(bulge)} ${r(-width / 2)} ${r(p + len)} 0` +
    ` Q ${r(bulge)} ${r(width / 2)} ${p} 0 Z`
  );
}

/** A bud's blade: the same teardrop, held closed. */
export function bladeClosedPath(len: number, width: number): string {
  return bladePath(len, width * 0.35);
}

/** The centre vein from blade base to tip. */
export function midribPath(len: number): string {
  const p = PETIOLE_LEN;
  return `M ${p} 0 Q ${r(p + len * 0.5)} ${r(-len * 0.03)} ${r(p + len)} 0`;
}

function r(v: number): number {
  return Math.round(v * 100) / 100;
}
