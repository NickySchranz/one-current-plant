import type { PsychologicalBranch } from "@/domain/branches/types";
import { isOpen, isClosed, mostActivated } from "@/domain/branches/logic";
import { energySplit } from "@/domain/feelings/logic";

/** Translator shape: English source string in, translated sentence out. */
type Translate = (s: string, vars?: Record<string, string | number>) => string;

/** English fallback: no lookup, but placeholders still get filled in. */
const fallbackT: Translate = (s, vars) => {
  let out = s;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
};

function monthYear(iso: string): string {
  return new Date(iso.length > 10 ? iso : iso + "T00:00:00").toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/**
 * The weather outside the window mirrors how much of today's energy rests
 * with the plant (energySplit().mainShare). Thresholds match
 * weatherFor() in features/plant-view/WindowScene — inlined here so the
 * a11y layer never has to import UI code.
 */
function weatherWord(mainShare: number, t: Translate): string {
  if (mainShare >= 0.85) return t("sunlit");
  if (mainShare >= 0.65) return t("lightly clouded");
  if (mainShare >= 0.45) return t("overcast");
  return t("soft rain");
}

/**
 * Complete non-visual equivalent of the potted plant.
 * Example: "A potted plant by a window. Three leaves are open. Relationship
 * separation sprouted in February 2026 and wilts at level five. The sky
 * outside is sunlit. Two leaves have healed and settled."
 */
export function describePlant(branches: PsychologicalBranch[], t: Translate = fallbackT): string {
  const open = branches.filter(isOpen);
  const merged = branches.filter(isClosed);

  const parts: string[] = [t("A potted plant by a window.")];

  parts.push(
    open.length === 0
      ? t("No leaves are open.")
      : open.length === 1
        ? t("One leaf is open.")
        : t("{n} leaves are open.", { n: t(numberWord(open.length)) }),
  );

  for (const b of open) {
    parts.push(
      t("{title} sprouted {when} and wilts at level {loudness}.", {
        title: b.title,
        when: b.forkLabel ? b.forkLabel : t("in {month}", { month: monthYear(b.forkDate) }),
        loudness: t(numberWord(b.loudness)).toLowerCase(),
      }),
    );
  }

  const top = mostActivated(branches);
  if (top && open.length > 1) {
    parts.push(t("{title} is currently the most wilted leaf.", { title: top.title }));
  }

  parts.push(
    t("The sky outside is {word}.", { word: weatherWord(energySplit(branches).mainShare, t) }),
  );

  if (merged.length > 0) {
    parts.push(
      merged.length === 1
        ? t("One leaf has healed and settled.")
        : t("{n} leaves have healed and settled.", { n: t(numberWord(merged.length)) }),
    );
  }
  return parts.join(" ");
}

export function describeBranch(branch: PsychologicalBranch, t: Translate = fallbackT): string {
  const parts: string[] = [
    `${branch.title}. ${statusText(branch, t)}.`,
    t("Sprouted {when}.", {
      when: branch.forkLabel ?? t("in {month}", { month: monthYear(branch.forkDate) }),
    }),
    t("Wilts at level {loudness}.", { loudness: t(numberWord(branch.loudness)).toLowerCase() }),
  ];
  if (branch.commits.length > 0) {
    parts.push(
      branch.commits.length === 1
        ? t("One moment recorded.")
        : t("{n} moments recorded.", { n: t(numberWord(branch.commits.length)) }),
    );
  }
  if (branch.storedQualities.length > 0) {
    parts.push(t("Carries {list}.", { list: branch.storedQualities.map((q) => t(q)).join(", ") }));
  }
  return parts.join(" ");
}

function statusText(branch: PsychologicalBranch, t: Translate): string {
  switch (branch.status) {
    case "active": return t("Open leaf");
    case "activated": return t("Open leaf");
    case "explored": return t("Open leaf");
    case "ready-to-merge": return t("Ready to settle");
    case "merge-conflict": return t("Open leaf");
    case "waiting-with-boundaries": return t("A bud, waiting");
    case "converted-to-project": return t("Healed and settled");
    case "partly-integrated": return t("Open leaf");
    case "merged": return t("Healed and settled");
    case "archived": return t("Let fall");
    case "needs-support": return t("May need outside support");
  }
}

const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
export function numberWord(n: number): string {
  // Wilt can be fractional (the dial moves in fine steps): speak the nearest whole number.
  const whole = Math.round(n);
  return whole >= 0 && whole < WORDS.length ? WORDS[whole] : String(whole);
}
