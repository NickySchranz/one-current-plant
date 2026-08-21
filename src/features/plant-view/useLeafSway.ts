import { useEffect } from "react";
import {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

// Wilt made visible in movement: a loud leaf trembles gently around its stem
// node while both ends stay anchored. The rhythm is slow on purpose — even a
// level-5 leaf sways rather than shakes. A quiet leaf (1) barely breathes in
// the room's still air, but it is never frozen — the plant is alive.
const A_DEG = [0, 0.55, 0.9, 1.4, 2.2, 3.0]; // degrees, half-arc of the sway
const FREQ_HZ = [0, 0.07, 0.1, 0.16, 0.24, 0.34]; // sway cycles per second

/** Linear blend between neighbouring table entries for fractional levels. */
function lerpTable(table: number[], level: number): number {
  "worklet";
  const clamped = Math.max(0, Math.min(table.length - 1, level));
  const lo = Math.floor(clamped);
  const hi = Math.min(table.length - 1, lo + 1);
  return table[lo] + (table[hi] - table[lo]) * (clamped - lo);
}

/**
 * Animated transform for one leaf's `<G>`: translate to the stem node, then
 * rotate by the base angle plus a slow sine sway. Runs on the UI thread —
 * no React re-renders. When still (resting, decided, newborn, reduced
 * motion), the transform is the static one.
 */
export function useLeafSway(opts: {
  /** Only while the leaf is loud, open, unfolded and settled-in. */
  swaying: boolean;
  level: number;
  attachX: number;
  attachY: number;
  angleDeg: number;
  /** Dot just nudged this leaf: sway twice as wide for a moment. */
  boosted: boolean;
}) {
  const { swaying, level, attachX, attachY, angleDeg, boosted } = opts;

  // Time in seconds, ticking on the UI thread while the sway is active.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (!swaying) {
      cancelAnimation(clock);
      clock.value = 0;
      return;
    }
    clock.value = 0;
    // One long linear ramp, repeated: the sine only cares about elapsed time.
    clock.value = withRepeat(
      withTiming(3600, { duration: 3600_000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(clock);
  }, [swaying, clock]);

  // The nudge boost eases in and out rather than snapping.
  const boost = useSharedValue(0);
  useEffect(() => {
    if (!boosted) {
      boost.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
      return;
    }
    boost.value = withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) });
  }, [boosted, boost]);

  return useAnimatedProps(() => {
    const amp = swaying ? lerpTable(A_DEG, level) * (1 + boost.value) : 0;
    const omega = 2 * Math.PI * lerpTable(FREQ_HZ, level);
    const sway = amp * Math.sin(omega * clock.value);
    return {
      transform: `translate(${attachX}, ${attachY}) rotate(${angleDeg + sway})`,
    };
  }, [swaying, level, attachX, attachY, angleDeg]);
}
