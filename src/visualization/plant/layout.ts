import type { PsychologicalBranch } from "@/domain/branches/types";
import type { BranchCommit } from "@/domain/moments/types";
import {
  branchEndDate,
  effectiveLoudness,
  isClosed,
  isWaiting,
} from "@/domain/branches/logic";
import { decidedToday } from "@/domain/feelings/logic";
import {
  applyResting,
  loudnessToThickness,
  restingToday,
  statusToLineStyle,
  type LineStyle,
} from "../branch-lines/style";

export type MomentPoint = {
  moment: BranchCommit;
  x: number;
  y: number;
};

/**
 * One leaf on the plant. Keeps the old BranchGeometry field names
 * (branchId, path, endX/endY, labelX/labelY, laneY, inWindow, loudness,
 * thickness, style, momentPoints) so the mascot and fx modules keep working
 * with only an import change — plus the plant-frame fields the leaf needs.
 */
export type LeafGeometry = {
  branchId: string;
  /** Absolute M/C path from the stem node to the leaf tip (mascot slither, fx). */
  path: string;
  laneY: number;
  /** Leaf tip in canvas coordinates. */
  endX: number;
  endY: number;
  thickness: number;
  /** How loud this leaf is today (1–5, drift included). */
  loudness: number;
  style: LineStyle;
  momentPoints: MomentPoint[];
  labelX: number;
  labelY: number;
  inWindow: boolean;
  labelVisible: boolean;
  /** Where the petiole meets the stem. */
  attachX: number;
  attachY: number;
  /** Which side of the stem the leaf grows from. */
  side: -1 | 1;
  /** Rotation of the whole leaf around its node; droop from wilt is baked in. */
  angleDeg: number;
  bladeLength: number;
  bladeWidth: number;
  /** Healed and merged back: small, calm, low on the stem. */
  settled: boolean;
  /** Waiting as a bud: a closed blade, nothing to tend yet. */
  bud: boolean;
};

export type PlantLayout = {
  width: number;
  height: number;
  potX: number;
  /** Top rim of the pot — the soil line the stem grows out of. */
  potY: number;
  stemPath: string;
  crownX: number;
  crownY: number;
  /** The sill surface the pot stands on. */
  sillY: number;
  leaves: LeafGeometry[];
  /** Older settled leaves beyond the ones shown. */
  settledOverflow: number;
};

export type PlantMetrics = {
  width: number;
  /**
   * Leaves that must keep their node no matter what their fork date says —
   * lines created this session (the optimistic draft, then the committed
   * thread). Appended, in creation order, to the topmost nodes so the draft
   * leaf never hops while "since when?" changes or after the form commits.
   */
  pinnedIds?: readonly string[];
};

/** How far the petiole runs from the stem before the blade begins. */
export const PETIOLE_LEN = 22;

const SETTLED_SHOWN = 8;
const TOP_PAD = 120;
const POT_H = 90;
const BOTTOM_PAD = 24;
const BASE_OFFSET = 46;
const STEM_SWAY = 14;
const SWAY_PERIOD_NODES = 5;

function sizes(width: number) {
  const compact = width < 640;
  return {
    nodeGap: compact ? 48 : 56,
    bladeLength: compact ? 52 : 64,
    bladeWidth: compact ? 28 : 34,
  };
}

/** Tip-down droop from felt wilt: level 1 barely dips, level 5 hangs. */
export function droopDegrees(loudness: number): number {
  return 5 + ((loudness - 1) / 4) * 35;
}

/** Build the whole plant: stem, node placement, and one leaf per branch. */
export function buildPlantLayout(
  branches: PsychologicalBranch[],
  metrics: PlantMetrics,
  now: Date = new Date(),
): PlantLayout {
  const { nodeGap, bladeLength, bladeWidth } = sizes(metrics.width);
  const pinnedSet = new Set(metrics.pinnedIds);
  const pinned = (metrics.pinnedIds ?? [])
    .map((id) => branches.find((b) => b.id === id))
    .filter((b): b is PsychologicalBranch => !!b);

  // Settled leaves take the lowest nodes, oldest first; only the most
  // recently settled few stay on the plant.
  const closed = branches
    .filter((b) => !pinnedSet.has(b.id) && isClosed(b))
    .sort((a, b) =>
      branchEndDate(a, now).localeCompare(branchEndDate(b, now)) || a.id.localeCompare(b.id),
    );
  const settled = closed.slice(Math.max(0, closed.length - SETTLED_SHOWN));
  const settledOverflow = closed.length - settled.length;

  // Open leaves climb the stem in fork order: oldest low, newest near the crown.
  const open = branches
    .filter((b) => !pinnedSet.has(b.id) && !isClosed(b))
    .sort((a, b) => a.forkDate.localeCompare(b.forkDate) || a.id.localeCompare(b.id));

  const ordered = [...settled, ...open, ...pinned];
  const nodeCount = ordered.length;

  const height = TOP_PAD + nodeCount * nodeGap + BASE_OFFSET + POT_H + BOTTOM_PAD;
  const potX = metrics.width / 2;
  const potY = height - BOTTOM_PAD - POT_H;
  const sillY = height - BOTTOM_PAD;

  const stemX = (y: number): number =>
    potX + STEM_SWAY * Math.sin(((potY - y) / (nodeGap * SWAY_PERIOD_NODES)) * Math.PI * 2);

  const topAttachY = potY - BASE_OFFSET - Math.max(0, nodeCount - 1) * nodeGap;
  const crownY = nodeCount > 0 ? topAttachY - 48 : potY - 80;
  const crownX = stemX(crownY);

  // The stem is a gentle S-curve sampled finely; round joins keep it smooth.
  let stemPath = `M ${round(stemX(potY + 6))} ${potY + 6}`;
  for (let y = potY - 8; y > crownY; y -= 8) stemPath += ` L ${round(stemX(y))} ${round(y)}`;
  stemPath += ` L ${round(crownX)} ${round(crownY)}`;

  const leaves = ordered.map((branch, i): LeafGeometry => {
    const settledLeaf = isClosed(branch);
    const bud = !settledLeaf && isWaiting(branch);
    const side: -1 | 1 = i % 2 === 0 ? 1 : -1;
    const attachY = potY - BASE_OFFSET - i * nodeGap;
    const attachX = stemX(attachY);

    const loudness = effectiveLoudness(branch, now);
    const scale = settledLeaf ? 0.7 : bud ? 0.6 : 1;
    const len = bladeLength * scale;
    const wid = bladeWidth * scale;

    // Settled leaves rest slightly upturned; open leaves droop with their wilt.
    const droop = settledLeaf ? -18 : droopDegrees(loudness);
    const angleDeg = side === 1 ? droop : 180 - droop;

    const rad = (angleDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const rot = (px: number, py: number): [number, number] => [
      attachX + px * cos - py * sin,
      attachY + px * sin + py * cos,
    ];

    const [endX, endY] = rot(PETIOLE_LEN + len, 0);
    const [labelX, labelY] = rot(PETIOLE_LEN + len + 10, 0);

    // Node → tip in absolute coordinates: petiole curve, then along the
    // midrib. M/C only, so samplePath can walk it.
    const path =
      `M ${xy(rot(0, 0))}` +
      ` C ${xy(rot(7, -1.5))}, ${xy(rot(15, -0.5))}, ${xy(rot(PETIOLE_LEN, 0))}` +
      ` C ${xy(rot(PETIOLE_LEN + len * 0.4, -wid * 0.06))},` +
      ` ${xy(rot(PETIOLE_LEN + len * 0.8, -wid * 0.03))},` +
      ` ${xy(rot(PETIOLE_LEN + len, 0))}`;

    // Moments sit along the midrib in the order they were written.
    const commits = branch.commits;
    const momentPoints: MomentPoint[] = commits.map((m, k) => {
      const f = 0.3 + (0.5 * k) / Math.max(1, commits.length - 1);
      const [x, y] = rot(PETIOLE_LEN + len * f, 0);
      return { moment: m, x, y };
    });

    return {
      branchId: branch.id,
      path,
      laneY: attachY,
      endX,
      endY,
      thickness: loudnessToThickness(loudness),
      loudness,
      style:
        restingToday(branch, now) || (!settledLeaf && decidedToday(branch, now))
          ? applyResting(statusToLineStyle(branch.status))
          : statusToLineStyle(branch.status),
      momentPoints,
      labelX,
      labelY,
      inWindow: true,
      labelVisible: true,
      attachX,
      attachY,
      side,
      angleDeg,
      bladeLength: len,
      bladeWidth: wid,
      settled: settledLeaf,
      bud,
    };
  });

  return {
    width: metrics.width,
    height,
    potX,
    potY,
    stemPath,
    crownX,
    crownY,
    sillY,
    leaves,
    settledOverflow,
  };
}

function round(v: number): number {
  return Math.round(v * 100) / 100;
}

function xy([x, y]: [number, number]): string {
  return `${round(x)} ${round(y)}`;
}
