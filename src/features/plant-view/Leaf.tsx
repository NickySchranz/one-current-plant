import { memo, useEffect, useMemo } from "react";
import { Platform } from "react-native";
import type { GestureResponderEvent } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { PsychologicalBranch } from "@/domain/branches/types";
import { droopDegrees, PETIOLE_LEN, type LeafGeometry } from "@/visualization/plant/layout";
import { bladeClosedPath, bladePath, midribPath, petiolePath } from "@/visualization/plant/leaf-shape";
import { leafSpots } from "@/visualization/plant/spots";
import { PLANT_PALETTE } from "@/visualization/plant/palette";
import { branchColor, restingToday } from "@/visualization/branch-lines/style";
import { mix } from "@/ui/color";
import type { ThemeId } from "@/visualization/theme";
import { pathLength } from "@/visualization/path-sample";
import { decidedToday } from "@/domain/feelings/logic";
import { isClosed, isOpen } from "@/domain/branches/logic";
import { describeBranch } from "@/visualization/a11y/describe";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/ui/theme";
import { alpha } from "@/ui/color";
import { useLeafSway } from "./useLeafSway";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedG = Animated.createAnimatedComponent(G);

type Props = {
  branch: PsychologicalBranch;
  geometry: LeafGeometry;
  theme: ThemeId;
  focused: boolean;
  emphasizedId?: string;
  /** The leaf belongs to the action currently shown in the stack. */
  highlighted?: boolean;
  /** Another leaf is in focus; this one steps back. */
  dimmed?: boolean;
  /** Just created: the leaf unfurls from its stem node. */
  born?: boolean;
  /** Being let go: the fall overlay owns the pixels; this leaf steps out. */
  falling?: boolean;
  /** Dot just nudged this leaf: sway twice as wide for a moment. */
  nudged?: boolean;
  /** Comfort setting or system preference: no sway, no pulsing. */
  reducedMotion?: boolean;
  /** The app's current moment (epoch ms) — moves live, jumps on fast-forward. */
  nowMs?: number;
  /** While the wilt dial is being dragged: the level under the thumb. */
  loudnessPreview?: number;
  /** A press starts here; sliding up or down dials this leaf's wilt. */
  onDialTouchStart?: (e: GestureResponderEvent) => void;
  onSelect: () => void;
  onSelectMoment: (momentId: string) => void;
  onSelectMergePoint: () => void;
};

/** One leaf: petiole, blade, midrib, wilt spots, moments, dew, label. */
export const Leaf = memo(function Leaf({
  branch,
  geometry: g,
  theme,
  focused,
  emphasizedId,
  highlighted = false,
  dimmed = false,
  born = false,
  falling = false,
  nudged = false,
  reducedMotion = false,
  nowMs,
  loudnessPreview,
  onDialTouchStart,
  onSelect,
  onSelectMoment,
  onSelectMergePoint,
}: Props) {
  const t = useT();
  const tk = useTheme();
  const now = nowMs !== undefined ? new Date(nowMs) : new Date();
  const resting = restingToday(branch, now);
  // A decision was taken on this leaf today: it rests, marked with a dew drop.
  const acted = isOpen(branch) && decidedToday(branch, now);

  // The leaf sways with its wilt — slow and gentle, wider the heavier it is.
  // A decision today stills it; so does folding for the day.
  const loudness = Math.max(1, Math.min(5, loudnessPreview ?? g.loudness));
  const swaying =
    g.inWindow &&
    !reducedMotion &&
    isOpen(branch) &&
    !resting &&
    !acted &&
    !born &&
    !g.settled &&
    !g.bud;

  const emphasized =
    !resting &&
    !acted &&
    !dimmed &&
    (g.style.emphasized || branch.id === emphasizedId || highlighted);

  // While the dial is dragged, the droop follows the thumb live.
  const baseAngle =
    loudnessPreview !== undefined && !g.settled && !g.bud
      ? g.side === 1
        ? droopDegrees(loudness)
        : 180 - droopDegrees(loudness)
      : g.angleDeg;

  const swayProps = useLeafSway({
    swaying,
    level: loudness,
    attachX: g.attachX,
    attachY: g.attachY,
    angleDeg: baseAngle,
    boosted: nudged,
  });

  // The whole group steps back while another leaf holds the focus.
  const groupOpacity = useSharedValue(falling ? 0 : dimmed ? 0.22 : 1);
  useEffect(() => {
    // While falling, the gold overlay draws this leaf instead — vanish at once.
    groupOpacity.value = falling
      ? 0
      : withTiming(dimmed ? 0.22 : 1, {
          duration: 250,
          easing: Easing.inOut(Easing.ease),
        });
  }, [dimmed, falling, groupOpacity]);
  const groupProps = useAnimatedProps(() => ({ opacity: groupOpacity.value }));

  // An emphasized leaf breathes a soft halo instead of pulsing hard.
  const pulsing = g.inWindow && emphasized && !reducedMotion;
  const pulse = useSharedValue(0.16);
  useEffect(() => {
    if (!pulsing) {
      cancelAnimation(pulse);
      pulse.value = 0.16;
      return;
    }
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.28, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.1, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulsing, pulse]);
  const haloProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  // Newborn unfurl: the petiole draws itself out of the stem, then the blade
  // opens from a folded sliver — 1.4s, ease-out, opacity riding along.
  const unfurling = born && !reducedMotion;
  const petioleLen = useMemo(() => (unfurling ? pathLength(petiolePath()) : 0), [unfurling]);
  const unfurl = useSharedValue(unfurling ? 0.15 : 1);
  const petioleOffset = useSharedValue(0);
  useEffect(() => {
    if (!unfurling) {
      cancelAnimation(unfurl);
      unfurl.value = 1;
      return;
    }
    unfurl.value = 0.15;
    unfurl.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
    if (petioleLen > 0) {
      petioleOffset.value = petioleLen;
      petioleOffset.value = withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) });
    }
    return () => {
      cancelAnimation(unfurl);
      cancelAnimation(petioleOffset);
    };
  }, [unfurling, petioleLen, unfurl, petioleOffset]);

  // A leaf left for today folds along its length and holds still.
  const foldedX = resting ? 0.55 : 1;
  const bladeGroupProps = useAnimatedProps(() => {
    const s = unfurl.value;
    return {
      transform: `translate(${PETIOLE_LEN}, 0) scale(${foldedX * s}, ${s}) translate(${-PETIOLE_LEN}, 0)`,
      opacity: 0.25 + 0.75 * s,
    };
  }, [foldedX]);
  const petioleProps = useAnimatedProps(() => {
    if (unfurling && petioleLen > 0) {
      return { strokeDasharray: [petioleLen, petioleLen], strokeDashoffset: petioleOffset.value };
    }
    // Animated props only apply the keys they return, so the draw-in dash
    // must be reset explicitly — otherwise it lingers as a dashed stalk.
    return { strokeDasharray: [1e6, 1e6], strokeDashoffset: 0 };
  }, [unfurling, petioleLen]);

  if (!g.inWindow) return null;

  const color = branchColor(branch, theme, emphasized ? "raised" : g.style.saturation);
  // Health made visible: a tended leaf is fresh green; wilt dries the blade
  // toward straw, and every decision that eases the wilt greens it back.
  const dryness = g.settled || g.bud ? 0 : ((loudness - 1) / 4) * 45;
  const bladeFill = alpha(mix(color, PLANT_PALETTE.dryLeaf, dryness), 0.55);
  // A settled leaf has bloomed: a small flower where the blade used to be.
  const petalR = g.bladeLength * 0.5;
  const flowerCx = PETIOLE_LEN + petalR * 0.9;
  const label = branch.title.length > 18 ? branch.title.slice(0, 17) + "…" : branch.title;
  const labelText =
    label +
    (branch.recurrenceCount > 0 ? t(" · returned") : "") +
    (acted ? t(" · decided today") : "");
  const labelAnchor = g.side === 1 ? ("start" as const) : ("end" as const);

  const blade = g.bud
    ? bladeClosedPath(g.bladeLength, g.bladeWidth)
    : bladePath(g.bladeLength, g.bladeWidth);
  const spots = g.bud || g.settled ? [] : leafSpots(branch.id, loudness, g.bladeLength, g.bladeWidth);
  const petioleWidth = Math.max(1.4, g.thickness * 0.8);

  const hitH = Math.max(44, g.bladeWidth + 16);
  const hitW = Math.max(44, PETIOLE_LEN + g.bladeLength + 12);

  return (
    <AnimatedG
      animatedProps={groupProps}
      accessible
      accessibilityLabel={describeBranch(branch, t)}
      onPressIn={onDialTouchStart}
    >
      {/* the leaf itself, in its local frame: swaying around the stem node */}
      <AnimatedG animatedProps={swayProps}>
        {/* generous invisible hit area — the true footprint, never swayed away.
            react-native-svg on web only maps onPress→onClick, so the wilt
            dial's touch-start needs the DOM pointerdown directly. */}
        <Rect
          x={-6}
          y={-hitH / 2}
          width={hitW}
          height={hitH}
          fill="transparent"
          onPress={g.settled ? onSelectMergePoint : onSelect}
          {...(Platform.OS === "web" && onDialTouchStart
            ? ({ onPointerDown: onDialTouchStart } as object)
            : null)}
        />

        {/* soft halo behind the emphasized or viewed leaf */}
        {(highlighted || emphasized) && (
          <AnimatedPath
            animatedProps={pulsing ? haloProps : undefined}
            d={blade}
            stroke={color}
            strokeWidth={9}
            opacity={pulsing ? undefined : 0.16}
            fill="none"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        )}

        {/* the little stalk; a newborn's draws itself out of the stem */}
        <AnimatedPath
          animatedProps={petioleProps}
          d={petiolePath()}
          stroke={PLANT_PALETTE.stem}
          strokeWidth={petioleWidth}
          opacity={g.style.opacity}
          fill="none"
          strokeLinecap="round"
          pointerEvents="none"
        />

        {/* blade, midrib, spots and dew unfurl (and fold) together */}
        <AnimatedG animatedProps={bladeGroupProps} pointerEvents="none">
          {g.settled ? (
            /* healed and settled: the worry has bloomed */
            <G opacity={g.style.opacity}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Ellipse
                  key={i}
                  transform={`rotate(${i * 72 + 18} ${flowerCx} 0)`}
                  cx={flowerCx + petalR * 0.62}
                  cy={0}
                  rx={petalR * 0.62}
                  ry={petalR * 0.38}
                  fill={mix(PLANT_PALETTE.petal, color, 22)}
                  stroke={PLANT_PALETTE.petalDeep}
                  strokeWidth={0.8}
                />
              ))}
              <Circle cx={flowerCx} cy={0} r={petalR * 0.34} fill={PLANT_PALETTE.flowerHeart} />
            </G>
          ) : (
            <Path
              d={blade}
              fill={bladeFill}
              stroke={color}
              strokeWidth={focused || highlighted ? 1.9 : 1.4}
              strokeLinejoin="round"
              opacity={g.style.opacity}
            />
          )}
          {!g.bud && !g.settled && (
            <Path
              d={midribPath(g.bladeLength)}
              stroke={color}
              strokeWidth={1}
              opacity={g.style.opacity * 0.7}
              fill="none"
              strokeLinecap="round"
            />
          )}
          {spots.map((s, i) => (
            <Circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={s.r}
              fill={PLANT_PALETTE.spot}
              opacity={s.opacity}
            />
          ))}
          {/* a decision was taken here today: a dew drop resting on the blade */}
          {acted && (
            <G opacity={0.9}>
              <Ellipse
                cx={PETIOLE_LEN + g.bladeLength * 0.8}
                cy={-1}
                rx={3}
                ry={4}
                fill={PLANT_PALETTE.dew}
                stroke={alpha(PLANT_PALETTE.rain, 0.6)}
                strokeWidth={0.8}
              />
              <Circle cx={PETIOLE_LEN + g.bladeLength * 0.8 - 1} cy={-2.2} r={0.9} fill="#ffffff" opacity={0.85} />
              <Line
                x1={PETIOLE_LEN + g.bladeLength * 0.8 - 2.4}
                y1={2.6}
                x2={PETIOLE_LEN + g.bladeLength * 0.8 + 2.4}
                y2={2.6}
                stroke="#ffffff"
                strokeWidth={0.6}
                opacity={0.5}
              />
            </G>
          )}
        </AnimatedG>
      </AnimatedG>

      {/* moments along the midrib — still and readable, world coordinates */}
      {!g.bud &&
        g.momentPoints.map((p) => (
          <Circle
            key={p.moment.id}
            cx={p.x}
            cy={p.y}
            r={2.5}
            fill={color}
            stroke={tk.bg}
            strokeWidth={1}
            onPress={() => onSelectMoment(p.moment.id)}
          />
        ))}

      {/* a folded or settled leaf carries no label — it has been answered;
          a folded leaf's label returns tomorrow. paint-order: stroke isn't
          supported here, so a stroked twin sits behind the filled text. */}
      {g.labelVisible && !resting && !isClosed(branch) && (
        <>
          <SvgText
            x={g.labelX}
            y={g.labelY}
            textAnchor={labelAnchor}
            fontSize={11}
            fontWeight={focused ? "700" : "600"}
            fontFamily={tk.fontBody}
            stroke={tk.bg}
            strokeWidth={4}
            fill={tk.bg}
            pointerEvents="none"
          >
            {labelText}
          </SvgText>
          <SvgText
            x={g.labelX}
            y={g.labelY}
            textAnchor={labelAnchor}
            fontSize={11}
            fontWeight={focused ? "700" : "600"}
            fontFamily={tk.fontBody}
            fill={color}
            onPress={onSelect}
          >
            {labelText}
          </SvgText>
        </>
      )}
    </AnimatedG>
  );
});
