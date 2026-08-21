import type { PsychologicalBranch } from "@/domain/branches/types";
import { isOpen } from "@/domain/branches/logic";
import type { ThemeId } from "@/visualization/theme";

/** Why the paywall opened — picks the copy the prompt shows. */
export type PaywallReason = "thread-limit" | "share";

/** How many leaves may stay open at once without Pro. */
export const FREE_OPEN_THREAD_LIMIT = 10;

/** The single daylight look is free; there is nothing themed to gate. */
export const FREE_THEME_IDS: readonly ThemeId[] = ["daylight"];

export function isProTheme(_id: ThemeId): boolean {
  return false;
}

/** Leaves still open on the plant, excluding the optimistic draft —
 * the draft is the leaf being created, so counting it would gate one early. */
export function countOpenThreads(
  branches: PsychologicalBranch[],
  draftBranchId?: string | null,
): number {
  return branches.filter((b) => b.id !== draftBranchId && isOpen(b)).length;
}

/** May another leaf open (created or reopened) right now? */
export function canCreateThread(
  branches: PsychologicalBranch[],
  isPro: boolean,
  draftBranchId?: string | null,
): boolean {
  return isPro || countOpenThreads(branches, draftBranchId) < FREE_OPEN_THREAD_LIMIT;
}
