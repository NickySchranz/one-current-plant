import { Platform } from "react-native";
import { useAppStore } from "@/stores/app-store";
import type { ThemeId } from "@/visualization/theme";

/**
 * The design tokens for the single "Soft daylight room" look. Colours are
 * plain hex so they work in react-native-svg and StyleSheet alike; durations
 * are milliseconds; dash patterns are arrays. Every animation runs slower
 * than a typical UI on purpose — the whole app is meant to lower the pulse.
 */
export type ThemeTokens = {
  id: ThemeId;
  mode: "light" | "dark";
  bg: string;
  bgRaised: string;
  bgSunken: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  lineMain: string;
  lineAxis: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  danger: string;
  focus: string;
  radius: number;
  radiusLg: number;
  btnRadius: number;
  /** Font stacks: full CSS stacks on web, closest single family on native. */
  fontBody: string | undefined;
  fontDisplay: string | undefined;
  /** Leaf sap-flow animation: duration (ms) and dash pattern. */
  flowDuration: number;
  flowDash: [number, number];
  /** Stem sap-flow animation. */
  mainFlowDuration: number;
  mainFlowDash: [number, number];
  /** Whether surfaces cast shadows. */
  shadows: boolean;
};

const webFont = (stack: string) => (Platform.OS === "web" ? stack : undefined);

const FONT_ROUNDED = webFont(
  'ui-rounded, "Hiragino Maru Gothic ProN", "Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
);

export const THEME_TOKENS: Record<ThemeId, ThemeTokens> = {
  daylight: {
    id: "daylight",
    mode: "light",
    bg: "#f8f5ec",
    bgRaised: "#fffdf6",
    bgSunken: "#efe9db",
    ink: "#33322a",
    inkSoft: "#6f6d5f",
    inkFaint: "#a5a291",
    lineMain: "#4a5a44",
    lineAxis: "#e2ddcc",
    accent: "#6a8f6b",
    accentInk: "#f6fbf4",
    accentSoft: "#e2ecdf",
    danger: "#a3563f",
    focus: "#4d7a58",
    radius: 14,
    radiusLg: 22,
    btnRadius: 12,
    fontBody: FONT_ROUNDED,
    fontDisplay: FONT_ROUNDED,
    flowDuration: 4200,
    flowDash: [1, 14],
    mainFlowDuration: 5200,
    mainFlowDash: [2, 26],
    shadows: true,
  },
};

/** The active theme's tokens. */
export function useTheme(): ThemeTokens {
  const id = useAppStore((s) => s.theme);
  return THEME_TOKENS[id];
}
