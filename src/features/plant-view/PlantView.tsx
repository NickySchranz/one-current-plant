import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from "react-native";
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import Svg, { Ellipse, G, Path, Rect, Text as SvgText } from "react-native-svg";
import { filterBranches, useAppStore } from "@/stores/app-store";
import { useLayoutStore } from "@/stores/layout-store";
import { buildPlantLayout } from "@/visualization/plant/layout";
import { PLANT_PALETTE as P } from "@/visualization/plant/palette";
import { describePlant } from "@/visualization/a11y/describe";
import { effectiveLoudness, isClosed, mostActivated } from "@/domain/branches/logic";
import { decidedToday, energySplit } from "@/domain/feelings/logic";
import type { Loudness } from "@/domain/branches/types";
import { Leaf } from "./Leaf";
import { PaywallPrompt, useThreadGate } from "@/features/paywall/PaywallPrompt";
import { TimelineHelp } from "@/features/timeline-help/TimelineHelp";
import { SkyPanel } from "./SkyPanel";
import { WindowScene } from "./WindowScene";
import { branchColor } from "@/visualization/branch-lines/style";
import { useT } from "@/i18n/i18n";
import { useTheme } from "@/ui/theme";
import { alpha } from "@/ui/color";
import { Hint, Prompt, shadow, T, Tag } from "@/ui/primitives";
import {
  AnimatedPath,
  LEAF_FALL_MS,
  LeafFall,
  LungeG,
  MergePreviewTarget,
  NudgeFx,
  ReclaimFly,
  SmokeFly,
  useDashFlow,
} from "./fx";
import { Mascot } from "./Mascot";
import { useMascot, randomFrom } from "./useMascot";

/** Movement below this is still a tap; beyond it the gesture picks an axis. */
const DECIDE_PX = 8;
/** Vertical pixels per wilt step — up is heavier, down is lighter. */
const STEP_PX = 36;

function clampLevel(level: number): number {
  return Math.max(1, Math.min(5, level));
}

/** Works on native handles and raw DOM nodes alike. */
function measureNode(
  node: unknown,
  cb: (x: number, y: number, w: number, h: number) => void,
) {
  const n = node as {
    measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void;
    getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
  } | null;
  if (!n) return;
  if (typeof n.measureInWindow === "function") {
    n.measureInWindow(cb);
  } else if (typeof n.getBoundingClientRect === "function") {
    const r = n.getBoundingClientRect();
    cb(r.left, r.top, r.width, r.height);
  }
}

/**
 * A number that glides to its target over ~a third of a second (ease-out
 * cubic). Instant when motion is reduced.
 */
function useEased(target: number, reducedMotion: boolean): number {
  const [value, setValue] = useState(target);
  const sv = useSharedValue(target);
  useEffect(() => {
    cancelAnimation(sv);
    if (reducedMotion) {
      sv.value = target;
      return;
    }
    sv.value = withTiming(target, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [target, reducedMotion, sv]);
  useAnimatedReaction(
    () => sv.value,
    (v, prev) => {
      if (v !== prev) runOnJS(setValue)(v);
    },
    [],
  );
  return value;
}

type LoudnessPreview = { branchId: string; level: number };

export function PlantView() {
  const branches = useAppStore((s) => s.branches);
  const pinnedBranchIds = useAppStore((s) => s.pinnedBranchIds);
  const nowTick = useAppStore((s) => s.nowTick);
  const typeFilter = useAppStore((s) => s.typeFilter);
  const statusFilter = useAppStore((s) => s.statusFilter);
  const setView = useAppStore((s) => s.setView);
  const setOperation = useAppStore((s) => s.setOperation);
  const allBranches = useAppStore((s) => s.branches);
  const theme = useAppStore((s) => s.theme);
  const operation = useAppStore((s) => s.operation);
  const reclaim = useAppStore((s) => s.reclaim);
  const clearReclaim = useAppStore((s) => s.clearReclaim);
  const canOpenThread = useThreadGate();
  const [paywalled, setPaywalled] = useState(false);
  const born = useAppStore((s) => s.born);
  const clearBorn = useAppStore((s) => s.clearBorn);
  const burn = useAppStore((s) => s.burn);
  const hit = useAppStore((s) => s.hit);
  const clearHit = useAppStore((s) => s.clearHit);
  const attackBranch = useAppStore((s) => s.attackBranch);
  const finalizeBurn = useAppStore((s) => s.finalizeBurn);
  const reducedMotion = useAppStore((s) => s.reducedMotion);
  const mascotTypePref = useAppStore((s) => s.mascotType);
  const draftBranchId = useAppStore((s) => s.draftBranchId);
  const dialLoudness = useAppStore((s) => s.dialLoudness);
  const actions = useAppStore((s) => s.actions);
  const language = useAppStore((s) => s.language);
  const t = useT();
  const tk = useTheme();

  // The leaf the current operation concerns stays lit; everything else steps back.
  const focusedBranchId =
    operation.kind === "viewing-integrated" && operation.branchId
      ? operation.branchId
      : "branchId" in operation
        ? operation.branchId
        : operation.kind === "confirming-merge" && operation.branchIds.length === 1
          ? operation.branchIds[0]
          : undefined;

  // A decision just released feelings: let them drift out, then forget the event.
  useEffect(() => {
    if (!reclaim) return;
    const timer = setTimeout(clearReclaim, reducedMotion ? 0 : 2200);
    return () => clearTimeout(timer);
  }, [reclaim, clearReclaim, reducedMotion]);

  // Mascot reactions (wired after mascot is declared below — use ref so the
  // effects can safely reference the function without re-running).
  const mascotReactionRef = useRef<((text: string) => void) | null>(null);

  // Dot just nudged a leaf: let the ripple play, then rest the event.
  useEffect(() => {
    if (!hit) return;
    const pool = hit.calm ? mascot.phrases.attackCalm : mascot.phrases.attack;
    const say = setTimeout(() => mascotReactionRef.current?.(randomFrom(pool)), 520);
    const timer = setTimeout(clearHit, reducedMotion ? 0 : 1400);
    return () => {
      clearTimeout(say);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit, clearHit, reducedMotion]);

  // A worry is being let go: when the gold leaf has drifted out of sight, the
  // leaf is removed from the app for good — only what it left you stays.
  const [lessonFlying, setLessonFlying] = useState(false);
  const [attackCooldownUntil, setAttackCooldownUntil] = useState(0);
  useEffect(() => {
    if (!burn) {
      setLessonFlying(false);
      return;
    }
    const fly = setTimeout(() => setLessonFlying(true), reducedMotion ? 0 : 1900);
    const timer = setTimeout(() => void finalizeBurn(), reducedMotion ? 0 : LEAF_FALL_MS);
    return () => {
      clearTimeout(fly);
      clearTimeout(timer);
    };
  }, [burn, finalizeBurn, reducedMotion]);

  // A just-created leaf unfurls, then settles like the others.
  useEffect(() => {
    if (!born) return;
    const timer = setTimeout(clearBorn, reducedMotion ? 0 : 1600);
    return () => clearTimeout(timer);
  }, [born, clearBorn, reducedMotion]);

  const stageRef = useRef<View>(null);
  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);
  const [scrollH, setScrollH] = useState(0);
  const [size, setSize] = useState({ width: 960, height: 480 });

  // When the quick tray rises over the stage as a bottom sheet, the view
  // scrolls so the selected leaf stays visible above it — the plant itself
  // keeps its place. The tray reports its own height (layout store); a side
  // panel leaves the plant clear.
  const trayHeight = useLayoutStore((s) => s.trayHeight);
  const traySide = useLayoutStore((s) => s.traySide);
  const insetTarget =
    trayHeight > 0 && !traySide ? Math.min(trayHeight, size.height - 130) : 0;
  const bottomInset = useEased(insetTarget, reducedMotion);

  const visible = useMemo(
    () => filterBranches(branches, typeFilter, statusFilter),
    [branches, typeFilter, statusFilter],
  );

  // When the bottom nav shows, its central + takes over — no second one here.
  const { width: winW } = useWindowDimensions();
  const showFab = winW > 760;
  // The app's sense of the present: ticks forward every half minute, jumps
  // when the Testing controls fast-forward time.
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  // The sky chip is pinned over the stage's top corner. Its height feeds the
  // scroll caps so a focused leaf never comes to rest underneath it.
  const [topInset, setTopInset] = useState(0);

  const layout = useMemo(
    () =>
      buildPlantLayout(
        visible,
        {
          width: size.width,
          // Leaves created this session keep their node — through "since
          // when?" changes and past the save, while the quick menu is open.
          pinnedIds: pinnedBranchIds,
        },
        now,
      ),
    [visible, size.width, now, pinnedBranchIds],
  );
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // The canvas grows taller than the stage and scrolls. Whenever its shape
  // changes, settle the view near the crown — the newest leaves are what you
  // see first; from there you scroll down the stem to the settled ones.
  useEffect(() => {
    if (scrollH <= 0) return;
    const overflow = layout.height - scrollH;
    if (overflow > 0) {
      const y = Math.max(0, Math.min(overflow, layout.crownY - 90));
      scrollRef.current?.scrollTo({ y, animated: false });
    }
  }, [layout.height, layout.crownY, scrollH]);

  // The tapped leaf stays in sight: when a panel opens, scroll so its node
  // sits centered in the space the panel leaves free. Runs while the inset
  // animates, so the view follows the sheet as it slides in.
  useEffect(() => {
    if (scrollH <= 0) return;
    if (!focusedBranchId && bottomInset <= 0) return;
    const usable = Math.max(130, scrollH - bottomInset);
    const maxScroll = Math.max(0, layout.height + Math.round(bottomInset) - scrollH);
    let anchor = layout.potY - 60;
    let scrollCap = maxScroll;
    if (focusedBranchId) {
      const g = layout.leaves.find((leaf) => leaf.branchId === focusedBranchId);
      if (g) {
        anchor = g.attachY;
        // A focused leaf comes to rest below the pinned chip, never underneath.
        scrollCap = Math.min(scrollCap, Math.min(g.attachY, g.labelY) - 14 - topInset);
      }
    }
    const y = Math.max(0, Math.min(scrollCap, anchor - usable / 2));
    scrollRef.current?.scrollTo({ y, animated: false });
  }, [focusedBranchId, layout, bottomInset, topInset, scrollH]);

  // ---- gestures: tap / vertical wilt dial -----------------------------------

  const candidateRef = useRef<{ branchId: string; startLevel: number } | null>(null);
  const modeRef = useRef<"idle" | "dial">("idle");
  const dialLevelRef = useRef(0);
  const stagePosRef = useRef({ x: 0, y: 0 });
  const blockTapsUntilRef = useRef(0);
  const previewRef = useRef<LoudnessPreview | null>(null);
  const [preview, setPreviewState] = useState<LoudnessPreview | null>(null);
  const [scrollLocked, setScrollLocked] = useState(false);
  const chipX = useSharedValue(0);
  const chipY = useSharedValue(0);

  const setPreview = (p: LoudnessPreview | null) => {
    previewRef.current = p;
    setPreviewState(p);
  };

  const resetGesture = () => {
    modeRef.current = "idle";
    candidateRef.current = null;
    if (previewRef.current) setPreview(null);
    setScrollLocked(false);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, gs) => {
          if (Math.hypot(gs.dx, gs.dy) <= DECIDE_PX) return false;
          if (candidateRef.current && Math.abs(gs.dy) >= Math.abs(gs.dx)) {
            // Vertical wins: the thumb is dialing wilt now.
            modeRef.current = "dial";
            return true;
          }
          // Anything else: the stage scrolls natively.
          return false;
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (_e, gs) => {
          measureNode(stageRef.current, (x, y) => {
            stagePosRef.current = { x, y };
          });
          if (modeRef.current === "dial" && candidateRef.current) {
            const c = candidateRef.current;
            const level = clampLevel(c.startLevel + Math.round(-gs.dy / STEP_PX));
            dialLevelRef.current = level;
            setPreview({ branchId: c.branchId, level });
          }
        },
        onPanResponderMove: (_e, gs) => {
          if (modeRef.current !== "dial") return;
          const c = candidateRef.current;
          if (!c) return;
          const level = clampLevel(c.startLevel + Math.round(-gs.dy / STEP_PX));
          if (level !== dialLevelRef.current) {
            dialLevelRef.current = level;
            setPreview({ branchId: c.branchId, level });
          }
          // The chip floats up-left of the thumb, never underneath it.
          chipX.value = Math.max(8, gs.moveX - stagePosRef.current.x - 48);
          chipY.value = Math.max(8, gs.moveY - stagePosRef.current.y - 48);
        },
        onPanResponderRelease: () => {
          if (modeRef.current === "dial" && candidateRef.current) {
            // The drag ends here — whatever happens, the tap must not follow.
            blockTapsUntilRef.current = Date.now() + 350;
            const c = candidateRef.current;
            if (dialLevelRef.current !== c.startLevel) {
              void dialLoudness(c.branchId, dialLevelRef.current as Loudness);
            }
          }
          resetGesture();
        },
        onPanResponderTerminate: () => {
          // Taken away by the system: revert the dial, commit nothing.
          if (modeRef.current !== "idle") blockTapsUntilRef.current = Date.now() + 350;
          resetGesture();
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- store actions are stable
    [],
  );

  /** A finished drag must not fire the tap that follows it. */
  const guarded = (fn: () => void) => () => {
    if (Date.now() < blockTapsUntilRef.current) return;
    fn();
  };

  // ---- derived view data ---------------------------------------------------

  const summary = useMemo(
    () => describePlant(visible, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable per language
    [visible, language],
  );
  const top = mostActivated(visible);
  const byId = useMemo(() => new Map(visible.map((b) => [b.id, b])), [visible]);
  const today = now.toISOString().slice(0, 10);

  // Every decision gathers on the sill — steps still ahead, steps already
  // done today (✓), and even "nothing can be done", which is a decision too.
  // Decisions of settled leaves leave with them.
  const futureItems = useMemo(() => {
    const items: { id: string; label: string; done: boolean; color: string }[] = [];
    const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 2) + "…" : s);
    for (const a of actions) {
      const owner = branches.find((b) => b.id === a.branchesIntegrated[0]?.branchId);
      if (owner && isClosed(owner)) continue;
      const doneToday = a.completedAt?.slice(0, 10) === today;
      if (a.completedAt && !doneToday) continue;
      items.push({
        id: a.id,
        label: doneToday ? `✓ ${short(a.title)}` : short(a.title),
        done: !!doneToday,
        color: owner ? branchColor(owner, theme) : tk.accent,
      });
    }
    for (const b of branches) {
      if (isClosed(b) || b.leftOn !== today) continue;
      items.push({
        id: b.id,
        label: `✓ ${t("folded · {title}", { title: short(b.title, 22) })}`,
        done: true,
        color: branchColor(b, theme, "muted"),
      });
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t is stable per language
  }, [actions, branches, theme, today, language, tk.accent]);

  // How the sky reads: open leaves cloud it, decisions clear it.
  const activeLines = visible.filter((b) => !isClosed(b));
  const mainShare = energySplit(branches, now).mainShare;

  // Mascot: visible always unless reduced motion (hides when no open branches).
  const showMascot = !reducedMotion;
  const mascot = useMascot(
    visible,
    layout.leaves,
    -1,
    (branchId) => setOperation({ kind: "quick-touch", branchId }),
    mascotTypePref,
    operation.kind === "idle",
    operation.kind === "viewing-integrated",
    language,
  );

  // Keep reaction ref current so effects below can call it
  mascotReactionRef.current = mascot.showReaction;

  // When user taps an open leaf, run mascot to it.
  // Never run mascot to settled leaves — Dot lives in today.
  const prevFocusedId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!showMascot || !mascot.visible) return;
    if (focusedBranchId && focusedBranchId !== prevFocusedId.current) {
      const b = allBranches.find((br) => br.id === focusedBranchId);
      if (b && !isClosed(b)) {
        mascot.focusBranch(focusedBranchId);
      }
    }
    prevFocusedId.current = focusedBranchId;
  }, [focusedBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the "creating-branch" form opens, run mascot to the optimistic draft
  // leaf. If creation is cancelled, mascot resumes patrol.
  const prevDraftId = useRef<string | null>(null);
  useEffect(() => {
    if (!showMascot || !mascot.visible) return;
    if (draftBranchId && draftBranchId !== prevDraftId.current) {
      mascot.focusBranch(draftBranchId);
    }
    prevDraftId.current = draftBranchId;
  }, [draftBranchId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire mascot reaction on heal (reclaim event)
  const reclaimKey = reclaim?.key;
  useEffect(() => {
    if (!reclaimKey || !showMascot) return;
    const pool = (reclaim?.feelings?.length ?? 0) >= 3 ? mascot.phrases.mergeDeep : mascot.phrases.merge;
    setTimeout(() => mascotReactionRef.current?.(randomFrom(pool)), 600);
  }, [reclaimKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire mascot reaction on new leaf (born event)
  const bornKey = born?.key;
  useEffect(() => {
    if (!bornKey || !showMascot) return;
    setTimeout(() => mascotReactionRef.current?.(randomFrom(mascot.phrases.born)), 800);
  }, [bornKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire mascot reaction when an action/note operation closes
  const prevOpKind = useRef(operation.kind);
  useEffect(() => {
    const prev = prevOpKind.current;
    prevOpKind.current = operation.kind;
    if (operation.kind !== "idle" || !showMascot) return;
    if (prev === "quick-act") {
      setTimeout(() => mascotReactionRef.current?.(randomFrom(mascot.phrases.action)), 400);
    } else if (prev === "quick-note") {
      setTimeout(() => mascotReactionRef.current?.(randomFrom(mascot.phrases.note)), 400);
    }
  }, [operation.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // When the user selects a settled leaf from the list, scroll down to it —
  // it sits low on the stem, already highlighted by focusedBranchId.
  const viewingIntegratedId =
    operation.kind === "viewing-integrated" ? (operation.branchId ?? null) : null;
  useEffect(() => {
    if (!viewingIntegratedId || scrollH <= 0) return;
    const g = layoutRef.current.leaves.find((leaf) => leaf.branchId === viewingIntegratedId);
    if (!g) return;
    const maxScroll = Math.max(0, layoutRef.current.height - scrollH);
    const y = Math.max(0, Math.min(maxScroll, g.attachY - scrollH / 2));
    scrollRef.current?.scrollTo({ y, animated: !reducedMotion });
  }, [viewingIntegratedId, scrollH, reducedMotion]);

  // Rising sap on the stem, and the heal preview's marching dashes.
  const sapFlowProps = useDashFlow(!reducedMotion, 15, 0, tk.mainFlowDuration);
  const mergeFlowProps = useDashFlow(
    operation.kind === "confirming-merge" && !reducedMotion,
    0,
    -26,
    1100,
  );

  const chipStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: chipX.value }, { translateY: chipY.value }],
  }));

  const svgHeight = layout.height + Math.round(bottomInset);
  const previewBranch = preview ? byId.get(preview.branchId) : undefined;

  // Where healing leaves come to rest: low on the stem, just above the soil.
  const settleX = layout.potX;
  const settleY = layout.potY - 26;
  // Released feelings drift out the window, toward the light.
  const skyX = size.width * 0.72;
  const skyY = 70;

  // The tending list sits beside the pot on the sill.
  const listX = Math.max(12, Math.min(layout.potX + 58, size.width - 160));

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      <View
        ref={stageRef}
        style={{ position: "relative", flex: 1, minHeight: 260, overflow: "hidden" }}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          setSize({ width: Math.max(320, width), height: Math.max(240, height) });
        }}
      >
        {/* the canvas is taller than the stage: this container scrolls it,
            while the +, help and sky chip stay pinned to the stage */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, minHeight: 0 }}
          scrollEnabled={!scrollLocked}
          onLayout={(e) => setScrollH(e.nativeEvent.layout.height)}
          onScroll={(e) => {
            scrollYRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator
          overScrollMode="never"
        >
          <View
            {...panResponder.panHandlers}
            onTouchEnd={() => {
              // a candidate that never picked an axis stays a tap
              if (modeRef.current === "idle") resetGesture();
            }}
          >
            <Svg
              width={size.width}
              height={svgHeight}
              accessibilityLabel={summary}
              accessibilityRole="image"
              // drags must never select label text, and the browser keeps
              // vertical panning while we own the dial
              {...(Platform.OS === "web"
                ? { style: { userSelect: "none", touchAction: "pan-y" } as object }
                : null)}
            >
              {/* the room: wall, window, sky and its weather */}
              <WindowScene
                width={size.width}
                height={svgHeight}
                sillY={layout.sillY}
                mainShare={mainShare}
                hour={now.getHours()}
                reducedMotion={reducedMotion}
              />

              {/* the sill surface */}
              <Rect
                x={0}
                y={layout.sillY}
                width={size.width}
                height={svgHeight - layout.sillY}
                fill={P.sill}
              />
              <Rect x={0} y={layout.sillY} width={size.width} height={2.5} fill={alpha("#000000", 0.08)} />

              {/* the pot; tapping it opens the settled leaves */}
              <G
                onPress={guarded(() =>
                  operation.kind === "viewing-integrated"
                    ? setOperation({ kind: "idle" })
                    : setOperation({ kind: "viewing-integrated" }),
                )}
                accessible
                accessibilityLabel={t("The pot. Select to see settled leaves.")}
              >
                <Ellipse
                  cx={layout.potX}
                  cy={layout.sillY + 4}
                  rx={52}
                  ry={5}
                  fill={alpha("#000000", 0.1)}
                />
                <Path
                  d={`M ${layout.potX - 40} ${layout.potY + 12} L ${layout.potX - 29} ${layout.potY + 82} Q ${layout.potX} ${layout.potY + 90} ${layout.potX + 29} ${layout.potY + 82} L ${layout.potX + 40} ${layout.potY + 12} Z`}
                  fill={P.pot}
                />
                <Path
                  d={`M ${layout.potX + 14} ${layout.potY + 12} L ${layout.potX + 40} ${layout.potY + 12} L ${layout.potX + 29} ${layout.potY + 82} Q ${layout.potX + 18} ${layout.potY + 86} ${layout.potX + 8} ${layout.potY + 87} Z`}
                  fill={P.potShadow}
                  opacity={0.45}
                />
                <Rect
                  x={layout.potX - 46}
                  y={layout.potY}
                  width={92}
                  height={13}
                  rx={3}
                  fill={P.pot}
                />
                <Rect
                  x={layout.potX - 46}
                  y={layout.potY + 10}
                  width={92}
                  height={3}
                  fill={P.potShadow}
                  opacity={0.5}
                />
                <Ellipse cx={layout.potX} cy={layout.potY + 1} rx={38} ry={5.5} fill={P.soil} />
                {layout.settledOverflow > 0 && (
                  <SvgText
                    x={layout.potX}
                    y={layout.potY + 52}
                    textAnchor="middle"
                    fontSize={10.5}
                    fontFamily={tk.fontBody}
                    fill={alpha("#ffffff", 0.85)}
                  >
                    {t("+{n} settled", { n: layout.settledOverflow })}
                  </SvgText>
                )}
              </G>

              {/* the stem, with sap rising slowly toward the crown */}
              <Path
                d={layout.stemPath}
                stroke={tk.lineMain}
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <AnimatedPath
                animatedProps={sapFlowProps}
                d={layout.stemPath}
                stroke={tk.accent}
                strokeWidth={2}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={tk.mainFlowDash}
                opacity={0.35}
              />

              {/* every decision gathers on the sill — a calm record of the
                  day. Tapping it opens the actions panel. */}
              {futureItems.length > 0 && (
                <G onPress={guarded(() => setOperation({ kind: "viewing-actions" }))}>
                  <Rect
                    x={listX - 6}
                    y={layout.potY + 4}
                    width={170}
                    height={futureItems.length * 16 + 30}
                    fill="transparent"
                  />
                  <SvgText
                    x={listX}
                    y={layout.potY + 18}
                    fontSize={11}
                    fontWeight="600"
                    fontFamily={tk.fontBody}
                    fill={tk.inkSoft}
                  >
                    {t("Today's tending")}
                  </SvgText>
                  {futureItems.map((it, i) => {
                    const y = layout.potY + 34 + i * 16;
                    return (
                      <G key={it.id}>
                        <Ellipse
                          cx={listX + 4}
                          cy={y - 4}
                          rx={3}
                          ry={3}
                          fill={it.color}
                          opacity={it.done ? 0.35 : 0.55}
                        />
                        <SvgText
                          x={listX + 12}
                          y={y}
                          fontSize={11}
                          fontFamily={tk.fontBody}
                          letterSpacing={0.11}
                          fill={it.done ? tk.inkFaint : tk.inkSoft}
                        >
                          {it.label}
                        </SvgText>
                      </G>
                    );
                  })}
                </G>
              )}

              {/* the leaves */}
              {layout.leaves.map((g) => {
                const branch = byId.get(g.branchId);
                if (!branch) return null;
                // Pending = about to fly there (highlight before moving).
                // Inspected = currently sitting on it.
                const mascotActive = showMascot && mascot.visible && mascot.pos.x > -900 &&
                  operation.kind !== "viewing-integrated";
                const mascotFocusId = mascot.pendingBranchId ?? mascot.inspectedBranchId;
                // User-focused leaf always stays at full opacity regardless of mascot position
                const isUserFocused = branch.id === focusedBranchId;
                const leafOpacity = isUserFocused
                  ? 1
                  : mascotActive && mascotFocusId !== null && branch.id !== mascotFocusId
                    ? 0.38
                    : 1;
                const mascotHighlight = mascotActive && branch.id === mascot.pendingBranchId;
                return (
                  <G key={g.branchId} opacity={leafOpacity}>
                    <Leaf
                      falling={burn?.branchId === g.branchId && !reducedMotion}
                      branch={branch}
                      geometry={g}
                      theme={theme}
                      nowMs={nowTick}
                      loudnessPreview={
                        preview?.branchId === branch.id ? preview.level : undefined
                      }
                      nudged={hit?.branchId === branch.id && !hit.calm}
                      onDialTouchStart={
                        // A decision today settles the wilt too: the dial rests
                        // with the leaf until tomorrow (or until it reopens).
                        isClosed(branch) || decidedToday(branch, now)
                          ? undefined
                          : // The drag moves in whole levels, starting from the
                            // wilt as felt today (drift included).
                            (_e: GestureResponderEvent) => {
                              candidateRef.current = {
                                branchId: branch.id,
                                startLevel: Math.round(effectiveLoudness(branch, now)),
                              };
                              setScrollLocked(true);
                            }
                      }
                      focused={false}
                      emphasizedId={top?.id}
                      highlighted={branch.id === focusedBranchId || mascotHighlight}
                      dimmed={!!focusedBranchId && branch.id !== focusedBranchId}
                      born={!reducedMotion && born?.branchId === branch.id}
                      reducedMotion={reducedMotion}
                      onSelect={guarded(() =>
                        setOperation({ kind: "quick-touch", branchId: branch.id }),
                      )}
                      onSelectMoment={guarded(() =>
                        setOperation({ kind: "quick-touch", branchId: branch.id }),
                      )}
                      onSelectMergePoint={guarded(() => {
                        const mergeId = branch.mergeIds[branch.mergeIds.length - 1];
                        if (mergeId) setView({ kind: "merge-review", mergeId });
                      })}
                    />
                  </G>
                );
              })}

              {/* a leaf being let go turns gold and drifts down */}
              {burn &&
                !reducedMotion &&
                (() => {
                  const g = layout.leaves.find((x) => x.branchId === burn.branchId);
                  const branch = byId.get(burn.branchId);
                  if (!g || !branch) return null;
                  return (
                    <LeafFall key={burn.key} leaf={g} fromColor={branchColor(branch, theme)} />
                  );
                })()}

              {/* the ripple of Dot's nudge */}
              {hit &&
                !reducedMotion &&
                (() => {
                  const g = layout.leaves.find((x) => x.branchId === hit.branchId);
                  if (!g) return null;
                  return (
                    <NudgeFx
                      key={hit.key}
                      x={g.endX}
                      y={g.endY}
                      accent={tk.accent}
                      calm={hit.calm}
                    />
                  );
                })()}

              {/* a heal being considered: dashes march from the leaf down the
                  stem to the settle point, reversibly */}
              {operation.kind === "confirming-merge" && (
                <G>
                  {operation.branchIds.map((id) => {
                    const g = layout.leaves.find((x) => x.branchId === id);
                    const branch = byId.get(id);
                    if (!g || !branch || g.settled) return null;
                    return (
                      <AnimatedPath
                        key={id}
                        animatedProps={mergeFlowProps}
                        d={`M ${g.endX} ${g.endY} C ${g.endX} ${g.endY + 60}, ${settleX} ${settleY - 80}, ${settleX} ${settleY}`}
                        stroke={branchColor(branch, theme)}
                        strokeWidth={2.25}
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={[6, 7]}
                        opacity={0.75}
                      />
                    );
                  })}
                  {operation.branchIds.length > 0 && (
                    <>
                      {operation.branchIds.map((id) => {
                        const g = layout.leaves.find((x) => x.branchId === id);
                        if (!g || g.settled) return null;
                        return (
                          <MergePreviewTarget
                            key={`ring-${id}`}
                            cx={g.endX}
                            cy={g.endY}
                            stroke={tk.accent}
                            reducedMotion={reducedMotion}
                          />
                        );
                      })}
                      <MergePreviewTarget
                        cx={settleX}
                        cy={settleY}
                        stroke={tk.accent}
                        reducedMotion={reducedMotion}
                      />
                    </>
                  )}
                </G>
              )}

              {/* Mascot: the ladybug that flies between leaves and nudges the user */}
              {showMascot && mascot.visible && mascot.pos.x > -900 &&
               operation.kind !== "viewing-integrated" && (
                <LungeG
                  active={Boolean(hit && !hit.calm && !reducedMotion)}
                  dx={(() => {
                    if (!hit) return 0;
                    const g = layout.leaves.find((x) => x.branchId === hit.branchId);
                    return g ? Math.max(-70, Math.min(70, g.endX - mascot.pos.x)) * 0.85 : 0;
                  })()}
                  dy={(() => {
                    if (!hit) return 0;
                    const g = layout.leaves.find((x) => x.branchId === hit.branchId);
                    return g ? Math.max(-44, Math.min(44, g.endY - mascot.pos.y)) * 0.85 : 0;
                  })()}
                >
                <Mascot
                  x={mascot.pos.x}
                  y={mascot.pos.y}
                  frame={hit && !hit.calm ? "LAND_A" : mascot.frame}
                  flip={mascot.flip}
                  mascotType={mascot.mascotType}
                  bubbleOpacity={mascot.bubbleOpacity}
                  bubbleText={mascot.bubbleText}
                  showTapHint={mascot.frame === 'IDLE_A' || mascot.frame === 'IDLE_B'}
                  theme={tk}
                  onPress={mascot.onPress}
                />
                </LungeG>
              )}
            </Svg>
          </View>
        </ScrollView>

        {/* One round +, unmistakable and wordless. */}
        {showFab && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("New leaf")}
          onPress={() =>
            canOpenThread ? setOperation({ kind: "creating-branch" }) : setPaywalled(true)
          }
          style={({ pressed, hovered }: PressableStateCallbackType & {
            hovered?: boolean;
          }) => [
            {
              position: "absolute",
              right: 16,
              bottom: 20,
              zIndex: 20,
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: tk.accent,
              alignItems: "center",
              justifyContent: "center",
              transform: [{ scale: pressed ? 0.96 : 1 }],
              opacity: hovered ? 0.93 : 1,
            },
            tk.shadows ? shadow(tk) : null,
          ]}
        >
          <T style={{ color: tk.accentInk, fontSize: 24, lineHeight: 28 }}>+</T>
        </Pressable>
        )}

        <PaywallPrompt
          reason={paywalled ? "thread-limit" : null}
          onClose={() => setPaywalled(false)}
        />

        <TimelineHelp />

        {/* While Dot inspects a leaf: one quick tap sends her at it. Fixed
            bottom-left (above the help dot) so it never covers anything else
            that is tappable — Dot herself already opens the leaf. */}
        {(() => {
          const targetId = mascot.inspectedBranchId;
          const target = targetId ? branches.find((b) => b.id === targetId) : undefined;
          const show =
            showMascot &&
            mascot.visible &&
            target &&
            !isClosed(target) &&
            operation.kind === "idle" &&
            !hit;
          if (!show) return null;
          const cooling = Date.now() < attackCooldownUntil;
          const verb = "Nudge!";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Have Dot soothe this leaf")}
              disabled={cooling}
              onPress={() => {
                setAttackCooldownUntil(Date.now() + 3200);
                void attackBranch(target.id);
              }}
              style={(st) => [
                {
                  position: "absolute",
                  left: 14,
                  bottom: 64,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: cooling ? alpha(tk.accent, 0.35) : tk.accent,
                  borderRadius: 999,
                  paddingHorizontal: 14,
                  paddingVertical: 9,
                  opacity: (st as PressableStateCallbackType & { hovered?: boolean }).hovered
                    ? 0.92
                    : 1,
                },
                shadow(tk),
              ]}
            >
              <T style={{ color: tk.accentInk, fontWeight: "700", fontSize: 13.5 }}>
                {t(verb)}
              </T>
              <T numberOfLines={1} style={{ color: tk.accentInk, fontSize: 11, opacity: 0.8, maxWidth: 130 }}>
                {target.title}
              </T>
            </Pressable>
          );
        })()}
        {/* the sky today: how gathered you are, read as weather — tap it for
            the day's forecast */}
        <SkyPanel
          activeLines={activeLines}
          onChipHeight={(h) => setTopInset(Math.max(0, Math.round(9.6 + h) + 8))}
        />

        {/* while the thumb dials a leaf's wilt: its name and level, live */}
        {preview && previewBranch && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                left: 0,
                top: 0,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 4,
                paddingHorizontal: 10,
                borderRadius: 6,
                backgroundColor: tk.bgRaised,
                borderWidth: 1,
                borderColor: alpha(tk.lineAxis, 0.55),
              },
              tk.shadows ? shadow(tk) : null,
              chipStyle,
            ]}
          >
            <T style={{ fontSize: 12 }}>
              {previewBranch.title.length > 22
                ? previewBranch.title.slice(0, 20) + "…"
                : previewBranch.title}
            </T>
            <View style={{ flexDirection: "row", gap: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View
                  key={n}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor:
                      n <= preview.level ? tk.accent : alpha(tk.lineAxis, 0.55),
                  }}
                />
              ))}
            </View>
          </Animated.View>
        )}

        {branches.length === 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <View
              style={{
                alignItems: "center",
                gap: 8,
                padding: 24,
                borderRadius: 24,
                backgroundColor: alpha(tk.bg, 0.78),
              }}
            >
              <Prompt style={{ fontSize: 19.2, textAlign: "center" }}>
                {t("Your plant stands quiet in the daylight.")}
              </Prompt>
              <Hint style={{ maxWidth: 480, textAlign: "center" }}>
                {t(
                  "When something begins pulling part of your attention away from the present, add it as a leaf with the + button. You can let it settle when it has given you what it carries.",
                )}
              </Hint>
            </View>
          </View>
        )}

        {/* released words drifting out the window */}
        {burn &&
          !reducedMotion &&
          (() => {
            const g = layout.leaves.find((x) => x.branchId === burn.branchId);
            if (!g) return null;
            const x0 = Math.min(g.labelX, size.width - 80);
            const y0 = g.labelY;
            return (
              <View
                key={burn.key}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  overflow: "hidden",
                  zIndex: 6,
                }}
              >
                {burn.items.map((item, i) => (
                  <SmokeFly key={item} index={i} x0={x0} y0={y0}>
                    <View style={{ opacity: 0.75 }}>
                      <Tag label={item} />
                    </View>
                  </SmokeFly>
                ))}
                {/* the leaf's own name leaves last */}
                {(() => {
                  const title = branches.find((b) => b.id === burn.branchId)?.title;
                  return title ? (
                    <SmokeFly key="title" index={burn.items.length + 1} x0={x0} y0={y0}>
                      <View style={{ opacity: 0.6 }}>
                        <Tag label={title} />
                      </View>
                    </SmokeFly>
                  ) : null;
                })()}
                {/* the one thing that survives stays with the plant: it flies
                    to the crown */}
                {lessonFlying && (
                  <ReclaimFly
                    key="lesson"
                    index={0}
                    x0={x0}
                    y0={y0}
                    dx={layout.crownX - x0}
                    dy={layout.crownY - y0}
                  >
                    <Tag label={burn.lesson} quality />
                  </ReclaimFly>
                )}
              </View>
            );
          })()}

        {/* feelings released by a decision drift out the window, into the light */}
        {reclaim &&
          !reducedMotion &&
          (() => {
            const g = layout.leaves.find((x) => x.branchId === reclaim.branchId);
            if (!g) return null;
            const x0 = Math.min(g.labelX, size.width - 60);
            const y0 = g.labelY;
            return (
              <View
                key={reclaim.key}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                  overflow: "hidden",
                  zIndex: 6,
                }}
              >
                {reclaim.feelings.map((f, i) => (
                  <ReclaimFly
                    key={f}
                    index={i}
                    x0={x0}
                    y0={y0}
                    dx={skyX - x0}
                    dy={skyY - y0}
                  >
                    <Tag label={t(f)} quality />
                  </ReclaimFly>
                ))}
              </View>
            );
          })()}
      </View>
    </View>
  );
}
