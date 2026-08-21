/** One Current Plant wears a single mood: a warm, softly lit room where a
 * plant stands by a window. Colour, type, shape, and the pace of every
 * animation all follow this one look. */
export const THEMES = [
  {
    id: "daylight",
    name: "Soft daylight room",
    hint: "Warm cream and sage; a plant on a sill in morning light.",
    mode: "light",
    paper: "#f8f5ec",
    accent: "#6a8f6b",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export function isThemeId(value: string): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Whether a theme sits on dark ground — line colours pick their lightness from this. */
export function themeMode(id: ThemeId): "light" | "dark" {
  return THEMES.find((t) => t.id === id)?.mode ?? "light";
}
