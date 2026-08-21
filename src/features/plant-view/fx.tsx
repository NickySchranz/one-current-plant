import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  type EasingFunction,
  type EasingFunctionFactory,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { Circle, G, Path } from "react-native-svg";
import type { PathProps } from "react-native-svg";
import type { LeafGeometry } from "@/visualization/plant/layout";
import { bladePath, midribPath, petiolePath } from "@/visualization/plant/leaf-shape";
import { PLANT_PALETTE } from "@/visualization/plant/palette";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedG = Animated.createAnimatedComponent(G);
export const AnimatedPath = Animated.createAnimatedComponent(Path);

/** Run a CSS-keyframe-like multi-stop loop on a shared value. `at` is 0–1. */
function runStops(
  sv: SharedValue<number>,
  stops: { at: number; v: number }[],
  durationMs: number,
  easing: EasingFunction | EasingFunctionFactory,
) {
  sv.value = stops[0].v;
  const segments = stops
    .slice(1)
    .map((s, i) =>
      withTiming(s.v, { duration: (s.at - stops[i].at) * durationMs, easing }),
    );
  sv.value = withRepeat(
    segments.length === 1 ? segments[0] : withSequence(...segments),
    -1,
    false,
  );
}

const easeInOut = Easing.inOut(Easing.ease);

/** A travelling dash offset (rising sap on the stem, marching merge dashes). */
export function useDashFlow(
  active: boolean,
  from: number,
  to: number,
  durationMs: number,
): Partial<PathProps> {
  const sv = useSharedValue(from);
  useEffect(() => {
    if (!active) {
      cancelAnimation(sv);
      sv.value = from;
      return;
    }
    sv.value = from;
    sv.value = withRepeat(
      withTiming(to, { duration: durationMs, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(sv);
  }, [active, from, to, durationMs, sv]);
  return useAnimatedProps(() => ({ strokeDashoffset: sv.value }));
}

/** A soft breathing ring while a heal (merge) is being considered. */
export function MergePreviewTarget({
  cx,
  cy,
  stroke,
  reducedMotion,
}: {
  cx: number;
  cy: number;
  stroke: string;
  reducedMotion: boolean;
}) {
  const opacity = useSharedValue(0.55);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0.55;
      scale.value = 1;
      return;
    }
    runStops(opacity, [{ at: 0, v: 0.1 }, { at: 0.5, v: 0.28 }, { at: 1, v: 0.1 }], 2400, easeInOut);
    runStops(scale, [{ at: 0, v: 0.85 }, { at: 0.5, v: 1.15 }, { at: 1, v: 0.85 }], 2400, easeInOut);
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [reducedMotion, opacity, scale]);
  const props = useAnimatedProps(() => ({ opacity: opacity.value, r: 12 * scale.value }));
  return (
    <AnimatedCircle
      animatedProps={props}
      cx={cx}
      cy={cy}
      r={12}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
    />
  );
}

/**
 * A feeling flying home from a decided leaf back to the plant
 * (1.7s ease-in-out, staggered 0.14s apart).
 */
export function ReclaimFly({
  index,
  x0,
  y0,
  dx,
  dy,
  children,
}: {
  index: number;
  x0: number;
  y0: number;
  dx: number;
  dy: number;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    const delay = index * 140;
    p.value = 0;
    opacity.value = 0;
    p.value = withDelay(delay, withTiming(1, { duration: 1700, easing: easeInOut }));
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(1, { duration: 204, easing: easeInOut }),
        withTiming(0.9, { duration: 1071, easing: easeInOut }),
        withTiming(0, { duration: 425, easing: easeInOut }),
      ),
    );
    return () => {
      cancelAnimation(p);
      cancelAnimation(opacity);
    };
  }, [index, p, opacity]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value },
      { scale: 1 - 0.55 * p.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: x0, top: y0 }, style]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A released word drifting up and out of the open window, greying out.
 * The inverse of ReclaimFly, which carries feelings home.
 */
export function SmokeFly({ index, x0, y0, children }: {
  index: number;
  x0: number;
  y0: number;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(index * 180, withTiming(1, { duration: 1900, easing: easeInOut }));
    return () => cancelAnimation(p);
  }, [index, p]);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.12 ? p.value * 7 : (1 - p.value) * 0.9,
    transform: [
      { translateX: Math.sin(p.value * 5 + index) * 10 },
      { translateY: -70 * p.value },
      { scale: 1 - 0.3 * p.value },
    ],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x0, top: y0 }, style]}>
      {children}
    </Animated.View>
  );
}

// ─── Leaf fall ────────────────────────────────────────────────────────────────

/** Total time from the first gold tint to the leaf resting out of sight. */
export const LEAF_FALL_MS = 3800;
const GOLD_MS = 1200;
const FALL_MS = LEAF_FALL_MS - GOLD_MS;

/**
 * A worry let go: the whole leaf turns gold, detaches, and drifts down past
 * the pot — slow and quiet, an autumn moment rather than a loss. A few gold
 * motes rise as it goes. Purely visual — finalizeBurn does the removing.
 * Caller gates reduce motion.
 */
export function LeafFall({ leaf, fromColor }: { leaf: LeafGeometry; fromColor: string }) {
  const gold = useSharedValue(0);
  const fall = useSharedValue(0);

  useEffect(() => {
    gold.value = 0;
    fall.value = 0;
    gold.value = withTiming(1, { duration: GOLD_MS, easing: easeInOut });
    fall.value = withDelay(
      GOLD_MS,
      withTiming(1, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
    );
    return () => {
      cancelAnimation(gold);
      cancelAnimation(fall);
    };
  }, [gold, fall]);

  const { attachX, attachY, angleDeg, side, bladeLength, bladeWidth } = leaf;

  const groupProps = useAnimatedProps(() => {
    const p = fall.value;
    const dx = 14 * Math.sin(p * Math.PI * 2) * side;
    const dy = 180 * p;
    const rot = angleDeg + 40 * side * p;
    return {
      transform: `translate(${attachX + dx}, ${attachY + dy}) rotate(${rot})`,
      opacity: p >= 1 ? 0 : 1 - p * 0.85,
    };
  });

  const bladeProps = useAnimatedProps(() => ({
    fill: interpolateColor(gold.value, [0, 1], [fromColor, PLANT_PALETTE.gold]),
  }));
  const lineProps = useAnimatedProps(() => ({
    stroke: interpolateColor(gold.value, [0, 1], [fromColor, PLANT_PALETTE.gold]),
  }));

  return (
    <G pointerEvents="none">
      <AnimatedG animatedProps={groupProps}>
        <AnimatedPath
          d={petiolePath()}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          animatedProps={lineProps}
        />
        <AnimatedPath
          d={bladePath(bladeLength, bladeWidth)}
          opacity={0.85}
          animatedProps={bladeProps}
        />
        <AnimatedPath
          d={midribPath(bladeLength)}
          fill="none"
          strokeWidth={1}
          opacity={0.5}
          animatedProps={lineProps}
        />
      </AnimatedG>
      {[0, 1, 2, 3].map((i) => (
        <GoldMote key={i} index={i} x={leaf.endX} y={leaf.endY} />
      ))}
    </G>
  );
}

/** One gold mote drifting up from a falling leaf. */
function GoldMote({ index, x, y }: { index: number; x: number; y: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(
      GOLD_MS + index * 250,
      withTiming(1, { duration: 2000, easing: easeInOut }),
    );
    return () => cancelAnimation(p);
  }, [index, p]);
  const props = useAnimatedProps(() => {
    const local = p.value;
    return {
      cx: x + Math.sin(local * 5 + index * 2) * 8,
      cy: y - local * (34 + index * 10),
      r: Math.max(0.1, 1.8 * (1 - local * 0.5)),
      opacity: local <= 0 || local >= 1 ? 0 : 0.7 * (1 - local),
    };
  });
  return <AnimatedCircle fill={PLANT_PALETTE.gold} animatedProps={props} />;
}

// ─── Dot's nudge ──────────────────────────────────────────────────────────────

/** One expanding, fading ring. */
function SoftRing({ x, y, color, t, delay, scale = 1 }: {
  x: number;
  y: number;
  color: string;
  t: SharedValue<number>;
  delay: number;
  scale?: number;
}) {
  const props = useAnimatedProps(() => {
    const local = Math.max(0, Math.min(1, (t.value - delay) / (1 - delay)));
    return {
      r: Math.max(0.1, 5 + local * 26 * scale),
      opacity: local <= 0 || local >= 1 ? 0 : (1 - local) * 0.4,
      strokeWidth: Math.max(0.2, 1.8 * (1 - local)),
    };
  });
  return <AnimatedCircle cx={x} cy={y} fill="none" stroke={color} animatedProps={props} />;
}

/**
 * The moment Dot's gentle nudge reaches a leaf: three soft rings ripple out
 * from the touch. No shaking, no flash — the wilt already eased; this only
 * marks where. Caller doubles the leaf's sway briefly alongside.
 */
export function NudgeFx({ x, y, accent, calm }: {
  x: number;
  y: number;
  accent: string;
  calm: boolean;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withTiming(1, { duration: 1150, easing: Easing.out(Easing.quad) });
    return () => cancelAnimation(t);
  }, [t]);

  if (calm) {
    // the leaf had nothing left to give: a single faint ring
    return (
      <G pointerEvents="none">
        <SoftRing x={x} y={y} color={accent} t={t} delay={0} scale={0.5} />
      </G>
    );
  }

  return (
    <G pointerEvents="none">
      <SoftRing x={x} y={y} color={accent} t={t} delay={0} />
      <SoftRing x={x} y={y} color={accent} t={t} delay={0.18} scale={0.8} />
      <SoftRing x={x} y={y} color={accent} t={t} delay={0.36} scale={0.6} />
    </G>
  );
}

const AnimatedGFx = Animated.createAnimatedComponent(G);

/**
 * Dot's little dash at a leaf: windup squash, a hop toward the blade, a soft
 * settle back — all as one transform burst around the sprite.
 */
export function LungeG({ active, dx, dy, children }: {
  active: boolean;
  dx: number;
  dy: number;
  children: React.ReactNode;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!active) {
      cancelAnimation(p);
      p.value = 0;
      return;
    }
    p.value = 0;
    p.value = withSequence(
      withTiming(0.25, { duration: 110, easing: Easing.in(Easing.quad) }), // windup
      withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }), // hop + touch
      withTiming(0.35, { duration: 160, easing: Easing.inOut(Easing.quad) }), // recoil
      withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }), // settle
    );
    return () => cancelAnimation(p);
  }, [active, p]);
  const props = useAnimatedProps(() => {
    const leap = Math.max(0, (p.value - 0.25) / 0.75);
    const squash = p.value <= 0.25 ? 1 - p.value * 0.5 : 1 + leap * 0.08;
    return {
      translateX: dx * leap,
      translateY: dy * leap - Math.sin(leap * Math.PI) * 10,
      scaleY: squash,
      rotation: leap * (dx >= 0 ? 9 : -9),
    };
  });
  return <AnimatedGFx animatedProps={props}>{children}</AnimatedGFx>;
}
