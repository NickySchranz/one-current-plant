import type { BranchStatus, Loudness, PsychologicalBranch } from "@/domain/branches/types";
import type { ThemeId } from "../theme";

/** Emotional loudness maps to line thickness: heavier branches are visibly heavier lines. */
export function loudnessToThickness(loudness: Loudness): number {
  return 1.25 + loudness * 0.75; // 2 .. 5 px
}

export type LineStyle = {
  opacity: number;
  /** Whether the line shows subtle directional movement toward the present. */
  animated: boolean;
  /** Extra emphasis for the currently activated branch. */
  emphasized: boolean;
  /** Whether the line curves back to the main line at its end. */
  curvesToMain: boolean;
  saturation: "muted" | "normal" | "raised";
};

/** Status maps to line style; colour is never the only indicator. */
export function statusToLineStyle(status: BranchStatus): LineStyle {
  switch (status) {
    case "active":
      return { opacity: 0.95, animated: true, emphasized: false, curvesToMain: false, saturation: "normal" };
    case "activated":
      return { opacity: 1, animated: true, emphasized: true, curvesToMain: false, saturation: "raised" };
    case "explored":
      return { opacity: 0.85, animated: true, emphasized: false, curvesToMain: false, saturation: "normal" };
    case "ready-to-merge":
      return { opacity: 0.9, animated: true, emphasized: false, curvesToMain: true, saturation: "normal" };
    case "merge-conflict":
      return { opacity: 1, animated: true, emphasized: true, curvesToMain: true, saturation: "raised" };
    case "waiting-with-boundaries": // legacy status: shown as a normal open line
      return { opacity: 0.95, animated: true, emphasized: false, curvesToMain: false, saturation: "normal" };
    case "converted-to-project":
      return { opacity: 0.8, animated: false, emphasized: false, curvesToMain: false, saturation: "normal" };
    case "partly-integrated":
      return { opacity: 0.7, animated: true, emphasized: false, curvesToMain: false, saturation: "muted" };
    case "merged":
      return { opacity: 0.45, animated: false, emphasized: false, curvesToMain: true, saturation: "muted" };
    case "archived":
      return { opacity: 0.3, animated: false, emphasized: false, curvesToMain: true, saturation: "muted" };
    case "needs-support":
      return { opacity: 1, animated: true, emphasized: true, curvesToMain: false, saturation: "normal" };
  }
}

/** True while the branch is deliberately left for today ("nothing can move on this line right now"). */
export function restingToday(
  branch: Pick<PsychologicalBranch, "leftOn">,
  now: Date = new Date(),
): boolean {
  return !!branch.leftOn && branch.leftOn === now.toISOString().slice(0, 10);
}

/** A branch left for today rests: fainter, still, and muted until tomorrow. */
export function applyResting(style: LineStyle): LineStyle {
  return {
    ...style,
    opacity: Math.min(style.opacity, 0.35),
    animated: false,
    emphasized: false,
    saturation: "muted",
  };
}

/**
 * Muted persistent leaf tints. Hue is stable per branch (hashed id), but
 * branches of the same type share a green-family hue so the plant reads as
 * one plant with subtly different leaves.
 */
const TYPE_HUE: Record<PsychologicalBranch["type"], number> = {
  event: 150, // sage
  waiting: 168, // sea green
  projection: 105, // spring
  identity: 88, // lichen
  relationship: 60, // olive
  body: 130, // fern
  project: 75, // moss-yellow
};

export function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function branchColor(
  branch: Pick<PsychologicalBranch, "id" | "type">,
  _theme: ThemeId,
  saturation: LineStyle["saturation"] = "normal",
): string {
  const hue = (TYPE_HUE[branch.type] + (hash(branch.id) % 24) - 12 + 360) % 360;
  const sat = saturation === "raised" ? 42 : saturation === "muted" ? 16 : 30;
  return `hsl(${hue} ${sat}% 40%)`;
}
