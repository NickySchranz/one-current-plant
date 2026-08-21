import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  useWindowDimensions,
  View,
  type PressableStateCallbackType,
} from "react-native";
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useAppStore } from "@/stores/app-store";
import type { PsychologicalBranch } from "@/domain/branches/types";
import { effectiveLoudness } from "@/domain/branches/logic";
import { decidedToday, energySplit } from "@/domain/feelings/logic";
import { PLANT_PALETTE as P } from "@/visualization/plant/palette";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/ui/theme";
import { alpha, mix } from "@/ui/color";
import { Hint, shadow, T } from "@/ui/primitives";
import { weatherFor, type Weather } from "./WindowScene";

const easeInOut = Easing.inOut(Easing.ease);

/** The 56×20 weather glyph inside the chip: sun, clouds, or soft rain. */
function WeatherGlyph({ weather }: { weather: Weather }) {
  return (
    <Svg width={56} height={20} viewBox="0 0 56 20">
      {(weather === "sunlit" || weather === "light-clouds") && (
        <>
          <Circle cx={weather === "sunlit" ? 28 : 22} cy={9} r={8} fill={P.sunHalo} opacity={0.8} />
          <Circle cx={weather === "sunlit" ? 28 : 22} cy={9} r={5} fill={P.sun} />
        </>
      )}
      {weather !== "sunlit" && (
        <>
          <Circle cx={28} cy={10} r={5.5} fill={weather === "light-clouds" ? "#ffffff" : "#c8d2d7"} />
          <Circle cx={35} cy={11} r={4.5} fill={weather === "light-clouds" ? "#f4f8fa" : "#cfd9dd"} />
          <Circle cx={22} cy={11.5} r={4} fill={weather === "light-clouds" ? "#ffffff" : "#c8d2d7"} />
          <Rect x={19} y={11} width={19} height={4.5} rx={2.2}
            fill={weather === "light-clouds" ? "#ffffff" : "#c8d2d7"} />
        </>
      )}
      {weather === "overcast" && (
        <>
          <Circle cx={44} cy={7} r={3.5} fill="#dde5e8" />
          <Circle cx={12} cy={8} r={3} fill="#dde5e8" />
        </>
      )}
      {weather === "rain" &&
        [24, 30, 36].map((x, i) => (
          <Line key={i} x1={x} y1={16} x2={x - 1} y2={19}
            stroke={P.rain} strokeWidth={1.2} strokeLinecap="round" />
        ))}
    </Svg>
  );
}

/** The filled part of the sky track, easing to its new share (0.5s). */
function FillBar({ pct, color, track }: { pct: number; color: string; track: string }) {
  const [width, setWidth] = useState(0);
  const w = useSharedValue(0);
  useEffect(() => {
    w.value = withTiming((pct / 100) * width, { duration: 500, easing: Easing.ease });
  }, [pct, width, w]);
  const style = useAnimatedStyle(() => ({ width: w.value }));
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: track }}
    >
      <Animated.View
        style={[{ height: 4, borderRadius: 2, backgroundColor: color }, style]}
      />
    </View>
  );
}

type Props = {
  /** Open leaves currently on the plant. */
  activeLines: PsychologicalBranch[];
  /** Reports the chip's height so the canvas keeps room above the crown. */
  onChipHeight?: (h: number) => void;
};

/**
 * The sky chip: a small weather glyph that mirrors the window. Tapping it
 * opens a panel that says how the day may feel and suggests where one
 * decision would help most.
 */
export function SkyPanel({ activeLines, onChipHeight }: Props) {
  const t = useT();
  const tk = useTheme();
  const branches = useAppStore((s) => s.branches);
  const setOperation = useAppStore((s) => s.setOperation);
  const nowTick = useAppStore((s) => s.nowTick);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const { width: screenW } = useWindowDimensions();
  const now = useMemo(() => new Date(nowTick), [nowTick]);
  const [open, setOpen] = useState(false);

  // How much of you rests with the plant right now — the sky's clarity.
  // Every decision (an action or "nothing can be done") clears it a little.
  const wholeness = energySplit(branches, now).mainShare;
  const weather = weatherFor(wholeness);
  const undecided = activeLines
    .filter((b) => !decidedToday(b, now))
    .sort((a, b) => effectiveLoudness(b, now) - effectiveLoudness(a, now));

  const word =
    weather === "sunlit"
      ? t("sunlit")
      : weather === "light-clouds"
        ? t("lightly clouded")
        : weather === "overcast"
          ? t("overcast")
          : t("soft rain");
  const tone = wholeness >= 0.65 ? "good" : wholeness >= 0.45 ? "mid" : "low";
  const forecast =
    weather === "sunlit"
      ? t("Nothing is tugging at you. Expect a steady, present day — protect it.")
      : weather === "light-clouds"
        ? t("You may feel an occasional tug today, but the day should hold steady.")
        : weather === "overcast"
          ? t(
              "You might feel restless today, or find it hard to settle into one thing. That is the split — not you.",
            )
          : t(
              "Today can feel foggy and tiring, like living several days at once. One small decision starts clearing the sky.",
            );

  const summary =
    t("The sky is {word} — about {pct} percent of you rests with the plant.", {
      word,
      pct: Math.round(wholeness * 100),
    }) +
    (activeLines.length > 0
      ? " " +
        t("{undecided} of {active} open leaves still undecided today.", {
          undecided: undecided.length,
          active: activeLines.length,
        })
      : "");

  // A rainy sky pulses its border very slowly — present, never alarming.
  const urgent = useSharedValue(0);
  useEffect(() => {
    if (tone !== "low" || reducedMotion) {
      cancelAnimation(urgent);
      urgent.value = 0;
      return;
    }
    urgent.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: easeInOut }),
        withTiming(0, { duration: 1800, easing: easeInOut }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(urgent);
  }, [tone, reducedMotion, urgent]);
  const borderLo = mix(tk.danger, tk.bgSunken, 25);
  const borderHi = mix(tk.danger, tk.bgSunken, 55);
  const urgentStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(urgent.value, [0, 1], [borderLo, borderHi]),
  }));

  const fillColor =
    tone === "low" ? tk.danger : tone === "mid" ? mix(tk.accent, tk.danger, 45) : tk.accent;

  return (
    <View style={{ position: "absolute", top: 9.6, left: 14.4, zIndex: 10 }}>
      {open && (
        <Pressable
          onPress={() => setOpen(false)}
          style={{ position: "absolute", left: -9999, top: -9999, width: 20000, height: 20000 }}
        />
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={summary}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        onLayout={(e) => onChipHeight?.(e.nativeEvent.layout.height)}
      >
        {({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => (
          <Animated.View
            style={[
              {
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 4.8,
                paddingHorizontal: 8.8,
                borderRadius: 6,
                borderWidth: 1,
                backgroundColor: open ? tk.bgRaised : mix(tk.bgSunken, tk.bg, 55),
                borderColor: hovered
                  ? mix(tk.accent, alpha(tk.lineAxis, 0.55), 45)
                  : tk.bgSunken,
              },
              tone === "low" ? urgentStyle : null,
              tk.shadows ? shadow(tk) : null,
            ]}
          >
            <WeatherGlyph weather={weather} />
            <View style={{ gap: 3.2, minWidth: 62 }}>
              <T
                style={{
                  fontSize: 10.9,
                  lineHeight: 11,
                  color: tone === "low" ? tk.danger : tk.inkSoft,
                  letterSpacing: 0.2,
                }}
              >
                {word}
              </T>
              <FillBar
                pct={Math.round(wholeness * 100)}
                color={fillColor}
                track={tk.bgSunken}
              />
            </View>
            <T
              style={{
                fontSize: 9.6,
                color: tk.inkFaint,
                transform: [{ rotate: open ? "180deg" : "0deg" }],
              }}
            >
              ▾
            </T>
          </Animated.View>
        )}
      </Pressable>

      {open && (
        <View
          accessibilityLabel={t("The sky today")}
          style={[
            {
              position: "absolute",
              top: "100%",
              marginTop: 6.4,
              left: 0,
              zIndex: 15,
              gap: 9.6,
              width: Math.min(320, screenW - 32),
              paddingVertical: 11.2,
              paddingHorizontal: 12.8,
              backgroundColor: tk.bg,
              borderWidth: 1,
              borderColor: alpha(tk.lineAxis, 0.55),
              borderRadius: tk.radius,
            },
            tk.shadows ? shadow(tk) : null,
          ]}
        >
          <Hint style={{ margin: 0 }}>
            <T
              style={{
                fontWeight: "700",
                color: tone === "low" ? tk.danger : tk.ink,
              }}
            >
              {t("The sky is {word}.", { word })}
            </T>
            {"\n"}
            {forecast}
          </Hint>

          {undecided.length > 0 ? (
            <>
              <Hint style={{ margin: 0 }}>{t("One decision would clear the sky most here:")}</Hint>
              {undecided.slice(0, 3).map((b, i) => (
                <Pressable
                  key={b.id}
                  onPress={() => {
                    setOpen(false);
                    setOperation({ kind: "quick-touch", branchId: b.id });
                  }}
                  style={({ hovered }: PressableStateCallbackType & { hovered?: boolean }) => ({
                    gap: 1.6,
                    paddingVertical: 7.2,
                    paddingHorizontal: 8.8,
                    borderRadius: 6,
                    borderWidth: 1,
                    borderColor: tk.bgSunken,
                    backgroundColor: hovered ? tk.bgRaised : mix(tk.bgSunken, tk.bg, 55),
                  })}
                >
                  <T style={{ fontWeight: "700" }}>{b.title}</T>
                  <Hint style={{ margin: 0 }}>
                    {i === 0 ? t("weighing heaviest right now") : t("still undecided today")}
                  </Hint>
                </Pressable>
              ))}
              <Hint style={{ margin: 0 }}>
                {t("An action counts. So does deciding that nothing can be done.")}
              </Hint>
            </>
          ) : (
            <Hint style={{ margin: 0 }}>
              {activeLines.length > 0
                ? t("Every open leaf has its decision for today. Nothing more is asked of you.")
                : t("Nothing is open right now. Your plant rests easy in the light.")}
            </Hint>
          )}
        </View>
      )}
    </View>
  );
}
