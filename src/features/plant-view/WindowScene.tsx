import { useEffect } from "react";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Circle, ClipPath, Defs, G, Line, Rect } from "react-native-svg";
import { PLANT_PALETTE as P } from "@/visualization/plant/palette";

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);

export type Weather = "sunlit" | "light-clouds" | "overcast" | "rain";

/** The wholeness share, read as weather. Same thresholds as the energy bar. */
export function weatherFor(mainShare: number): Weather {
  if (mainShare >= 0.85) return "sunlit";
  if (mainShare >= 0.65) return "light-clouds";
  if (mainShare >= 0.45) return "overcast";
  return "rain";
}

const easeInOut = Easing.inOut(Easing.ease);

/** A weather layer that is always mounted and cross-fades in and out slowly. */
function FadeLayer({
  active,
  reducedMotion,
  children,
}: {
  active: boolean;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    opacity.value = withTiming(active ? 1 : 0, {
      duration: reducedMotion ? 800 : 4000,
      easing: easeInOut,
    });
  }, [active, reducedMotion, opacity]);
  const props = useAnimatedProps(() => ({ opacity: opacity.value }));
  return (
    <AnimatedG animatedProps={props} pointerEvents="none">
      {children}
    </AnimatedG>
  );
}

/** The sun: a warm disc with a halo that breathes very slowly. */
function Sun({ cx, cy, dimmed, reducedMotion }: {
  cx: number;
  cy: number;
  dimmed: boolean;
  reducedMotion: boolean;
}) {
  const halo = useSharedValue(0.14);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(halo);
      halo.value = 0.14;
      return;
    }
    halo.value = 0.1;
    halo.value = withRepeat(
      withSequence(
        withTiming(0.18, { duration: 2600, easing: easeInOut }),
        withTiming(0.1, { duration: 2600, easing: easeInOut }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(halo);
  }, [reducedMotion, halo]);
  const haloProps = useAnimatedProps(() => ({ opacity: halo.value }));
  return (
    <G opacity={dimmed ? 0.5 : 1}>
      <AnimatedCircle animatedProps={haloProps} cx={cx} cy={cy} r={30} fill={P.sunHalo} />
      <Circle cx={cx} cy={cy} r={16} fill={P.sun} />
    </G>
  );
}

/** One soft cloud: three overlapping ellipse-ish circles drifting sideways. */
function Cloud({ cx, cy, scale, tint, drift, periodMs, reducedMotion }: {
  cx: number;
  cy: number;
  scale: number;
  tint: string;
  drift: number;
  periodMs: number;
  reducedMotion: boolean;
}) {
  const dx = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) {
      cancelAnimation(dx);
      dx.value = 0;
      return;
    }
    dx.value = -drift;
    dx.value = withRepeat(
      withSequence(
        withTiming(drift, { duration: periodMs / 2, easing: easeInOut }),
        withTiming(-drift, { duration: periodMs / 2, easing: easeInOut }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(dx);
  }, [reducedMotion, drift, periodMs, dx]);
  const props = useAnimatedProps(() => ({
    transform: `translate(${cx + dx.value}, ${cy}) scale(${scale})`,
  }));
  return (
    <AnimatedG animatedProps={props}>
      <Circle cx={-14} cy={2} r={10} fill={tint} />
      <Circle cx={0} cy={-3} r={13} fill={tint} />
      <Circle cx={14} cy={3} r={10} fill={tint} />
      <Rect x={-20} y={2} width={40} height={9} rx={5} fill={tint} />
    </AnimatedG>
  );
}

/** One gentle raindrop: a short line falling slowly, drifting a touch. */
function RainDrop({ index, x, y0, fall }: {
  index: number;
  x: number;
  y0: number;
  fall: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = 0;
    p.value = withDelay(
      (index * 180) % 2200,
      withRepeat(withTiming(1, { duration: 2200, easing: Easing.linear }), -1, false),
    );
    return () => cancelAnimation(p);
  }, [index, p]);
  const props = useAnimatedProps(() => {
    const y = y0 + fall * p.value;
    const dx = Math.sin(p.value * Math.PI * 2 + index) * 2;
    return {
      x1: x + dx,
      y1: y,
      x2: x + dx + 1,
      y2: y + 7,
      opacity: p.value < 0.08 ? p.value * 4 : Math.min(0.35, (1 - p.value) * 0.6),
    };
  });
  return (
    <AnimatedLine animatedProps={props} stroke={P.rain} strokeWidth={1.2} strokeLinecap="round" />
  );
}

/** Warmth or dusk laid gently over the sky, following the app's clock. */
function timeTint(hour: number): { color: string; opacity: number; night: boolean } {
  if (hour >= 21 || hour < 5) return { color: "#31456b", opacity: 0.25, night: true };
  if (hour < 10) return { color: "#f2d98c", opacity: 0.12, night: false };
  if (hour < 17) return { color: "#ffffff", opacity: 0, night: false };
  return { color: "#e0a45e", opacity: 0.15, night: false };
}

type Props = {
  width: number;
  height: number;
  /** The sill surface the pot stands on — the window ends here. */
  sillY: number;
  /** How much of you rests with the plant (energySplit().mainShare). */
  mainShare: number;
  /** Hour of the app's clock (fast time makes the day cycle visible). */
  hour: number;
  reducedMotion: boolean;
};

/**
 * The room: a warm wall, a window with a sky whose weather follows the
 * wholeness share, and the sill the pot stands on. All four weather layers
 * stay mounted and cross-fade over four slow seconds — the sky never
 * startles, it only turns.
 */
export function WindowScene({ width, height, sillY, mainShare, hour, reducedMotion }: Props) {
  const weather = weatherFor(mainShare);
  const tint = timeTint(hour);

  // Window geometry: generous, centred, ending at the sill.
  const margin = Math.max(18, width * 0.06);
  const winX = margin;
  const winW = width - margin * 2;
  const winTop = 20;
  const winH = sillY - winTop;
  const frame = 10;
  const skyX = winX + frame;
  const skyY = winTop + frame;
  const skyW = winW - frame * 2;
  const skyH = winH - frame * 2;

  const sunX = skyX + skyW * 0.72;
  const sunY = skyY + Math.min(72, skyH * 0.3);

  const rainXs = Array.from({ length: 12 }, (_, i) => skyX + skyW * ((i * 83 + 31) % 100) / 100);

  return (
    <G pointerEvents="none">
      {/* the wall behind everything */}
      <Rect x={0} y={0} width={width} height={height} fill={P.wall} />

      {/* window frame */}
      <Rect x={winX} y={winTop} width={winW} height={winH} rx={6} fill={P.windowFrame} />
      {/* the sky */}
      <Rect x={skyX} y={skyY} width={skyW} height={skyH} fill={P.sky} />

      <Defs>
        <ClipPath id="window-sky">
          <Rect x={skyX} y={skyY} width={skyW} height={skyH} />
        </ClipPath>
      </Defs>

      <G clipPath="url(#window-sky)">
        {/* sunlit: the sun alone in a clear sky */}
        <FadeLayer active={weather === "sunlit" && !tint.night} reducedMotion={reducedMotion}>
          <Sun cx={sunX} cy={sunY} dimmed={false} reducedMotion={reducedMotion} />
        </FadeLayer>

        {/* lightly clouded: two soft clouds, the sun behind them */}
        <FadeLayer active={weather === "light-clouds" && !tint.night} reducedMotion={reducedMotion}>
          <Sun cx={sunX} cy={sunY} dimmed reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.32} cy={skyY + 48} scale={1.15} tint="#ffffff"
            drift={8} periodMs={18000} reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.68} cy={skyY + 92} scale={0.85} tint="#f4f8fa"
            drift={8} periodMs={22000} reducedMotion={reducedMotion} />
        </FadeLayer>

        {/* overcast: the sky greys, four slow clouds */}
        <FadeLayer active={weather === "overcast"} reducedMotion={reducedMotion}>
          <Rect x={skyX} y={skyY} width={skyW} height={skyH} fill={P.skyOvercast} opacity={0.85} />
          <Cloud cx={skyX + skyW * 0.24} cy={skyY + 42} scale={1.2} tint="#d3dce0"
            drift={8} periodMs={20000} reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.6} cy={skyY + 70} scale={1.4} tint="#c8d2d7"
            drift={6} periodMs={26000} reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.82} cy={skyY + 34} scale={0.9} tint="#dde5e8"
            drift={8} periodMs={17000} reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.42} cy={skyY + 110} scale={1.05} tint="#cfd9dd"
            drift={7} periodMs={23000} reducedMotion={reducedMotion} />
        </FadeLayer>

        {/* soft rain: a darker sky and twelve quiet drops — never a storm */}
        <FadeLayer active={weather === "rain"} reducedMotion={reducedMotion}>
          <Rect x={skyX} y={skyY} width={skyW} height={skyH} fill={P.skyRain} opacity={0.9} />
          <Cloud cx={skyX + skyW * 0.3} cy={skyY + 36} scale={1.3} tint="#c0ccd2"
            drift={6} periodMs={24000} reducedMotion={reducedMotion} />
          <Cloud cx={skyX + skyW * 0.72} cy={skyY + 52} scale={1.1} tint="#b7c4cb"
            drift={6} periodMs={28000} reducedMotion={reducedMotion} />
          {!reducedMotion &&
            rainXs.map((x, i) => (
              <RainDrop key={i} index={i} x={x} y0={skyY + 60 + (i % 3) * 14} fall={skyH - 70} />
            ))}
        </FadeLayer>

        {/* the hour laid over the sky: morning warmth, evening amber, night blue */}
        {tint.opacity > 0 && (
          <Rect x={skyX} y={skyY} width={skyW} height={skyH} fill={tint.color} opacity={tint.opacity} />
        )}
        {tint.night && (
          <>
            {/* a few stars so the night window still feels kind */}
            {[0.18, 0.38, 0.55, 0.66, 0.84].map((f, i) => (
              <Circle
                key={i}
                cx={skyX + skyW * f}
                cy={skyY + 26 + ((i * 47) % 60)}
                r={1.1}
                fill="#f4f0dd"
                opacity={0.7}
              />
            ))}
          </>
        )}
      </G>

      {/* mullions over the sky */}
      <Rect x={winX + winW / 2 - 3} y={winTop} width={6} height={winH} fill={P.windowFrame} />
      <Rect x={winX} y={winTop + winH * 0.42} width={winW} height={6} fill={P.windowFrame} />
    </G>
  );
}
