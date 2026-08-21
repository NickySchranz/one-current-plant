/**
 * Pixel-art frames for "Dot" — the ladybug who tends your plant.
 *
 * Grid: 12 wide × 16 tall (rows 0-15). PX = 2.2 → ~26×35px.
 * Rows 0-1  = antennae
 * Rows 2-4  = black head with two light eyes
 * Rows 5-12 = dome shell (elytra) with center seam + dark spots
 * Rows 13-14 = tiny legs
 * Row 15 = ground shadow
 *
 * All three MascotTypes are the SAME ladybug — only the shell color differs:
 *   chronicler → scarlet, wisp → amber, wanderer → dusk-blue.
 * The shared layouts below use shell tokens ('_B' base, '_K' dark, '_H' shine)
 * which `paint()` substitutes with a per-mascot ColorKey triple.
 *
 * ColorKey (renderer palette should resolve to):
 *   D    dark outline / head / legs (#1a1a1a)
 *   A    accent          (theme — sparkles)
 *   Ad   accent dark     (theme)
 *   Ah   accent highlight(theme — sparkles)
 *   S    scarlet shell   (#c65a4a)
 *   Sd   scarlet shadow  (#9c4437)
 *   Ss   shell shine     (soft cream, e.g. #fdeccd)
 *   W    wing / eye light(white)
 *   P    shell spot      (#1a1a1a)
 *   R    rosy blush      (#e8836a)
 *   G    amber shell     (#d9a14e)
 *   Gd   amber shadow    (#a87a2f)
 *   Bl   dusk-blue shell (#7a8fb5)
 *   Bd   dusk-blue shadow(#56698c)
 *   Bh   dusk-blue mist  (#a6b5d0)
 *   Sh2  shadow          (rgba 0,0,0,0.20)
 */

export type ColorKey =
  | 'D' | 'A' | 'Ad' | 'Ah'
  | 'S' | 'Sd' | 'Ss'
  | 'W' | 'P' | 'R'
  | 'G' | 'Gd'
  | 'Bl' | 'Bd' | 'Bh'
  | 'Sh2';

export type Pixel      = { c: number; r: number; k: ColorKey };
export type MascotType = 'chronicler' | 'wisp' | 'wanderer';
export type FrameName  =
  | 'IDLE_A' | 'IDLE_B'
  | 'RUN_A'  | 'RUN_B'
  | 'LAND_A'
  | 'INSPECT_A' | 'INSPECT_B'
  | 'TALK_A'    | 'TALK_B'
  | 'REACT';

export const PX = 2.2;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const dy = (px: Pixel[], d: number): Pixel[] =>
  d === 0 ? px : px.map(p => ({ ...p, r: p.r + d }));

const dx = (px: Pixel[], d: number): Pixel[] =>
  d === 0 ? px : px.map(p => ({ ...p, c: p.c + d }));

const clip = (px: Pixel[]): Pixel[] =>
  px.filter(p => p.r >= 0 && p.r <= 15 && p.c >= 0 && p.c <= 11);

/** Later entries in layer list win on same cell (for overrides). */
function merge(...layers: Pixel[][]): Pixel[] {
  const map = new Map<string, Pixel>();
  for (const layer of layers)
    for (const p of layer)
      map.set(`${p.c},${p.r}`, p);
  return [...map.values()];
}

// ─── Shell color mapping ──────────────────────────────────────────────────────
// One ladybug, three shell colors. Layouts are shared templates whose shell
// tokens are painted with a per-mascot key triple.

type ShellTok  = '_B' | '_K' | '_H';               // base / dark seam-shade / shine
type TPixel    = { c: number; r: number; k: ColorKey | ShellTok };
type ShellKeys = { base: ColorKey; dark: ColorKey; shine: ColorKey };

const SHELL_KEYS: Record<MascotType, ShellKeys> = {
  chronicler: { base: 'S',  dark: 'Sd', shine: 'Ss' },  // scarlet
  wisp:       { base: 'G',  dark: 'Gd', shine: 'Ss' },  // amber
  wanderer:   { base: 'Bl', dark: 'Bd', shine: 'Bh' },  // dusk-blue
};

function paint(tpl: TPixel[], s: ShellKeys): Pixel[] {
  return tpl.map(p => ({
    c: p.c, r: p.r,
    k: p.k === '_B' ? s.base : p.k === '_K' ? s.dark : p.k === '_H' ? s.shine : p.k,
  }));
}

// ─── Antennae (rows 0-1) ──────────────────────────────────────────────────────

const ANT_REST: Pixel[] = [           // relaxed, tips out
  {c:3,r:0,k:'D'},{c:8,r:0,k:'D'},
  {c:4,r:1,k:'D'},{c:7,r:1,k:'D'},
];
const ANT_SWAY: Pixel[] = [           // gentle inward sway (breathing beat)
  {c:4,r:0,k:'D'},{c:7,r:0,k:'D'},
  {c:4,r:1,k:'D'},{c:7,r:1,k:'D'},
];
const ANT_WIDE: Pixel[] = [           // flung wide — landing / delight
  {c:2,r:0,k:'D'},{c:9,r:0,k:'D'},
  {c:3,r:1,k:'D'},{c:8,r:1,k:'D'},
];
const ANT_LEAN: Pixel[] = [           // both curved toward the leaf (right)
  {c:6,r:0,k:'D'},{c:9,r:0,k:'D'},
  {c:5,r:1,k:'D'},{c:8,r:1,k:'D'},
];

// ─── Head (rows 2-4): black, round, with light eyes + blush ─────────────────

const HEAD: Pixel[] = [
  {c:3,r:2,k:'D'},{c:4,r:2,k:'D'},{c:5,r:2,k:'D'},{c:6,r:2,k:'D'},{c:7,r:2,k:'D'},{c:8,r:2,k:'D'},
  {c:2,r:3,k:'D'},{c:3,r:3,k:'D'},{c:4,r:3,k:'D'},{c:5,r:3,k:'D'},{c:6,r:3,k:'D'},{c:7,r:3,k:'D'},{c:8,r:3,k:'D'},{c:9,r:3,k:'D'},
  {c:2,r:4,k:'D'},{c:3,r:4,k:'D'},{c:4,r:4,k:'D'},{c:5,r:4,k:'D'},{c:6,r:4,k:'D'},{c:7,r:4,k:'D'},{c:8,r:4,k:'D'},{c:9,r:4,k:'D'},
];
const BLUSH: Pixel[] = [
  {c:2,r:4,k:'R'},{c:9,r:4,k:'R'},
];
const EYES_OPEN: Pixel[] = [          // two light eyes on the black head
  {c:3,r:3,k:'W'},{c:4,r:3,k:'W'},
  {c:7,r:3,k:'W'},{c:8,r:3,k:'W'},
];
const EYES_SOFT: Pixel[] = [          // half-lidded contented blink
  {c:3,r:3,k:'Ss'},{c:8,r:3,k:'Ss'},
];

// ─── Sitting shell (rows 5-12): dome, seam at cols 5-6, four spots ──────────

const SHELL_SIT: TPixel[] = [
  // r5: shell shoulder behind head
  {c:2,r:5,k:'D'},{c:3,r:5,k:'_B'},{c:4,r:5,k:'_H'},{c:5,r:5,k:'_K'},{c:6,r:5,k:'_K'},{c:7,r:5,k:'_B'},{c:8,r:5,k:'_B'},{c:9,r:5,k:'D'},
  // r6
  {c:1,r:6,k:'D'},{c:2,r:6,k:'_B'},{c:3,r:6,k:'_H'},{c:4,r:6,k:'_B'},{c:5,r:6,k:'_K'},{c:6,r:6,k:'_K'},{c:7,r:6,k:'_B'},{c:8,r:6,k:'_B'},{c:9,r:6,k:'_B'},{c:10,r:6,k:'D'},
  // r7: widest — upper spots at 3, 8
  {c:0,r:7,k:'D'},{c:1,r:7,k:'_B'},{c:2,r:7,k:'_B'},{c:3,r:7,k:'P'},{c:4,r:7,k:'_B'},{c:5,r:7,k:'_K'},{c:6,r:7,k:'_K'},{c:7,r:7,k:'_B'},{c:8,r:7,k:'P'},{c:9,r:7,k:'_B'},{c:10,r:7,k:'_B'},{c:11,r:7,k:'D'},
  // r8
  {c:0,r:8,k:'D'},{c:1,r:8,k:'_B'},{c:2,r:8,k:'_B'},{c:3,r:8,k:'_B'},{c:4,r:8,k:'_B'},{c:5,r:8,k:'_K'},{c:6,r:8,k:'_K'},{c:7,r:8,k:'_B'},{c:8,r:8,k:'_B'},{c:9,r:8,k:'_B'},{c:10,r:8,k:'_B'},{c:11,r:8,k:'D'},
  // r9: lower spots at 2, 9
  {c:0,r:9,k:'D'},{c:1,r:9,k:'_B'},{c:2,r:9,k:'P'},{c:3,r:9,k:'_B'},{c:4,r:9,k:'_B'},{c:5,r:9,k:'_K'},{c:6,r:9,k:'_K'},{c:7,r:9,k:'_B'},{c:8,r:9,k:'_B'},{c:9,r:9,k:'P'},{c:10,r:9,k:'_B'},{c:11,r:9,k:'D'},
  // r10: narrowing
  {c:1,r:10,k:'D'},{c:2,r:10,k:'_B'},{c:3,r:10,k:'_B'},{c:4,r:10,k:'_B'},{c:5,r:10,k:'_K'},{c:6,r:10,k:'_K'},{c:7,r:10,k:'_B'},{c:8,r:10,k:'_B'},{c:9,r:10,k:'_B'},{c:10,r:10,k:'D'},
  // r11: shaded underside
  {c:2,r:11,k:'D'},{c:3,r:11,k:'_K'},{c:4,r:11,k:'_K'},{c:5,r:11,k:'_K'},{c:6,r:11,k:'_K'},{c:7,r:11,k:'_K'},{c:8,r:11,k:'_K'},{c:9,r:11,k:'D'},
  // r12: bottom rim
  {c:3,r:12,k:'D'},{c:4,r:12,k:'D'},{c:5,r:12,k:'D'},{c:6,r:12,k:'D'},{c:7,r:12,k:'D'},{c:8,r:12,k:'D'},
];

// ─── Legs (rows 13-14) — tiny, black, beneath the shell rim ──────────────────

const LEGS_SIT_A: Pixel[] = [
  {c:2,r:13,k:'D'},{c:5,r:13,k:'D'},{c:6,r:13,k:'D'},{c:9,r:13,k:'D'},
  {c:1,r:14,k:'D'},{c:10,r:14,k:'D'},
];
const LEGS_SIT_B: Pixel[] = [        // alternate step (little shuffle)
  {c:3,r:13,k:'D'},{c:5,r:13,k:'D'},{c:6,r:13,k:'D'},{c:8,r:13,k:'D'},
  {c:2,r:14,k:'D'},{c:9,r:14,k:'D'},
];
const LEGS_SPLAY: Pixel[] = [        // landing squash — feet spread wide
  {c:1,r:14,k:'D'},{c:2,r:14,k:'D'},{c:4,r:14,k:'D'},
  {c:7,r:14,k:'D'},{c:9,r:14,k:'D'},{c:10,r:14,k:'D'},
];
const REACH_A: Pixel[] = [           // one front leg reaching toward the leaf
  {c:10,r:11,k:'D'},{c:11,r:12,k:'D'},
];
const REACH_B: Pixel[] = [           // reach lifted a touch higher
  {c:10,r:10,k:'D'},{c:11,r:11,k:'D'},
];

const SHADOW: Pixel[] = [
  {c:4,r:15,k:'Sh2'},{c:5,r:15,k:'Sh2'},{c:6,r:15,k:'Sh2'},{c:7,r:15,k:'Sh2'},
];

// ─── Flight parts (RUN / REACT): wing cases open, blurred wings beneath ─────

const ELYTRA_OPEN: TPixel[] = [
  // left wing case, tilted out (cols 0-2)
  {c:0,r:5,k:'D'},{c:1,r:5,k:'_H'},{c:2,r:5,k:'_B'},
  {c:0,r:6,k:'D'},{c:1,r:6,k:'_B'},{c:2,r:6,k:'_B'},
  {c:0,r:7,k:'D'},{c:1,r:7,k:'_B'},{c:2,r:7,k:'P'},
  {c:1,r:8,k:'D'},{c:2,r:8,k:'D'},
  // right wing case, mirrored (cols 9-11)
  {c:9,r:5,k:'_B'},{c:10,r:5,k:'_H'},{c:11,r:5,k:'D'},
  {c:9,r:6,k:'_B'},{c:10,r:6,k:'_B'},{c:11,r:6,k:'D'},
  {c:9,r:7,k:'P'},{c:10,r:7,k:'_B'},{c:11,r:7,k:'D'},
  {c:9,r:8,k:'D'},{c:10,r:8,k:'D'},
];
// Blurred wings between the open cases — two shimmer phases for flutter
const WINGS_A: Pixel[] = [
  {c:3,r:5,k:'W'},{c:4,r:5,k:'Ss'},{c:7,r:5,k:'Ss'},{c:8,r:5,k:'W'},
  {c:3,r:6,k:'Ss'},{c:8,r:6,k:'Ss'},
];
const WINGS_B: Pixel[] = [
  {c:3,r:5,k:'Ss'},{c:8,r:5,k:'Ss'},
  {c:3,r:6,k:'W'},{c:4,r:6,k:'Ss'},{c:7,r:6,k:'Ss'},{c:8,r:6,k:'W'},
];
// Small dark abdomen under the open cases
const ABDOMEN_FLY: TPixel[] = [
  {c:4,r:7,k:'D'},{c:5,r:7,k:'D'},{c:6,r:7,k:'D'},{c:7,r:7,k:'D'},
  {c:3,r:8,k:'D'},{c:4,r:8,k:'D'},{c:5,r:8,k:'_K'},{c:6,r:8,k:'_K'},{c:7,r:8,k:'D'},{c:8,r:8,k:'D'},
  {c:3,r:9,k:'D'},{c:4,r:9,k:'D'},{c:5,r:9,k:'D'},{c:6,r:9,k:'D'},{c:7,r:9,k:'D'},{c:8,r:9,k:'D'},
  {c:4,r:10,k:'D'},{c:5,r:10,k:'D'},{c:6,r:10,k:'D'},{c:7,r:10,k:'D'},
];
const LEGS_TUCK_A: Pixel[] = [{c:4,r:11,k:'D'},{c:7,r:11,k:'D'}];
const LEGS_TUCK_B: Pixel[] = [{c:5,r:11,k:'D'},{c:6,r:11,k:'D'}];

// Soft theme-accent sparkles for the REACT flourish
const SPARKLES: Pixel[] = [
  {c:0,r:1,k:'Ah'},{c:11,r:1,k:'Ah'},
  {c:1,r:3,k:'A'},{c:10,r:3,k:'A'},
  {c:0,r:12,k:'Ah'},{c:11,r:12,k:'Ah'},
];

// ─── Frame builder ────────────────────────────────────────────────────────────

function buildFrames(s: ShellKeys): Record<FrameName, Pixel[]> {
  const shell   = paint(SHELL_SIT, s);
  const elytra  = paint(ELYTRA_OPEN, s);
  const abdomen = paint(ABDOMEN_FLY, s);
  const head    = merge(HEAD, BLUSH);

  const sit = (
    eyes: Pixel[], antennae: Pixel[], legs: Pixel[], extras: Pixel[] = [],
  ): Pixel[] =>
    clip(merge(SHADOW, antennae, head, eyes, shell, legs, extras));

  const fly = (wings: Pixel[], legs: Pixel[]): Pixel[] =>
    clip(merge(SHADOW, ANT_SWAY, head, EYES_OPEN, wings, elytra, abdomen, legs));

  return {
    // Sitting on a leaf — subtle 2-frame breathe/blink
    IDLE_A: sit(EYES_OPEN, ANT_REST, LEGS_SIT_A),
    IDLE_B: sit(EYES_SOFT, ANT_SWAY, LEGS_SIT_A),

    // Flying between leaves — wing cases open, wings a soft blur, legs tucked
    // (A/B alternate wing shimmer + tucked-leg position so the flutter reads)
    RUN_A: fly(WINGS_A, LEGS_TUCK_A),
    RUN_B: fly(WINGS_B, LEGS_TUCK_B),

    // Touch-down squash: whole bug dips one row, antennae wide, feet splayed
    LAND_A: clip(merge(
      SHADOW,
      dy(merge(ANT_WIDE, head, EYES_SOFT, shell), 1),
      LEGS_SPLAY,
    )),

    // Tilting toward the leaf — head leans over, antennae curl, foreleg reaches
    INSPECT_A: clip(merge(
      SHADOW, ANT_LEAN, dx(merge(head, EYES_OPEN), 1), shell, LEGS_SIT_A, REACH_A,
    )),
    INSPECT_B: clip(merge(
      SHADOW, ANT_LEAN, dx(merge(head, EYES_OPEN), 1), shell, LEGS_SIT_A, REACH_B,
      [{c:11,r:5,k:'Ah' as const}],
    )),

    // Chatting — antennae bob and a foreleg gestures gently
    TALK_A: sit(EYES_OPEN, ANT_REST, LEGS_SIT_A, REACH_A),
    TALK_B: sit(EYES_OPEN, ANT_SWAY, LEGS_SIT_B, REACH_B),

    // Delight — wings flared right out, sparkles, feet spread on the ground
    REACT: clip(merge(
      SHADOW,
      SPARKLES,
      dy(merge(
        ANT_WIDE, head, EYES_OPEN,
        WINGS_A, elytra, abdomen,
        [{c:2,r:4,k:'Ss' as const},{c:9,r:4,k:'Ss' as const}], // wingtip flares
        dy(LEGS_SPLAY, -3), // feet end up at r13, just under the abdomen
      ), 2),
    )),
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export const CHARACTER_FRAMES: Record<MascotType, Record<FrameName, Pixel[]>> = {
  chronicler: buildFrames(SHELL_KEYS.chronicler),
  wisp:       buildFrames(SHELL_KEYS.wisp),
  wanderer:   buildFrames(SHELL_KEYS.wanderer),
};

export const FRAMES = CHARACTER_FRAMES;
