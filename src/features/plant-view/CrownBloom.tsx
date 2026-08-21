import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Circle, Ellipse, G, Path } from "react-native-svg";
import { PLANT_PALETTE as P } from "@/visualization/plant/palette";
import { mix } from "@/ui/color";

const AnimatedG = Animated.createAnimatedComponent(G);
const easeInOut = Easing.inOut(Easing.ease);

/**
 * How open the crown flower is for a given wholeness share: soft rain keeps
 * it a near-closed bud, a sunlit day opens it fully. Never fully shut —
 * there is always a bloom waiting.
 */
function opennessFor(mainShare: number): number {
  return Math.max(0.12, Math.min(1, (mainShare - 0.35) / 0.55));
}

type Props = {
  x: number;
  y: number;
  /** How much of you rests with the plant (energySplit().mainShare). */
  mainShare: number;
  reducedMotion: boolean;
};

/**
 * The flower at the crown of the stem. It opens over four slow seconds as
 * decisions clear the sky, closes as gently when the day scatters, and
 * breathes the whole time — the plant's health, worn where you look first.
 */
export function CrownBloom({ x, y, mainShare, reducedMotion }: Props) {
  const open = useSharedValue(opennessFor(mainShare));
  useEffect(() => {
    open.value = withTiming(opennessFor(mainShare), {
      duration: reducedMotion ? 400 : 4000,
      easing: easeInOut,
    });
  }, [mainShare, reducedMotion, open]);

  const breath = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2600, easing: easeInOut }),
        withTiming(0, { duration: 2600, easing: easeInOut }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(breath);
  }, [reducedMotion, breath]);

  const headProps = useAnimatedProps(() => ({
    scale: (0.45 + 0.55 * open.value) * (1 + 0.04 * breath.value),
    opacity: 0.55 + 0.45 * open.value,
  }));

  return (
    <G transform={`translate(${x}, ${y})`} pointerEvents="none">
      {/* two sepals cradling the bloom */}
      <Path d="M 0 7 Q -13 3 -17 -7 Q -6 -5 0 3 Z" fill={P.stem} opacity={0.85} />
      <Path d="M 0 7 Q 13 3 17 -7 Q 6 -5 0 3 Z" fill={P.stem} opacity={0.85} />
      {/* six petals opening around a warm heart */}
      <AnimatedG animatedProps={headProps}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Ellipse
            key={i}
            transform={`rotate(${i * 60})`}
            cx={0}
            cy={-9.5}
            rx={5.2}
            ry={9.5}
            fill={mix(P.petal, "#ffffff", i % 2 === 0 ? 0 : 18)}
            stroke={P.petalDeep}
            strokeWidth={0.8}
          />
        ))}
        <Circle r={4.5} fill={P.flowerHeart} />
        <Circle r={2} fill={mix(P.flowerHeart, "#ffffff", 40)} opacity={0.9} />
      </AnimatedG>
    </G>
  );
}
