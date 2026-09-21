/**
 * ⭐⭐ **THE FONT, AS DATA** — what Bravura says a glyph is, in staff spaces, synchronously.
 *
 * F1 of `docs/plans/font-metrics-plan.md`. Pure lookup: no DOM, no canvas, no VexFlow, no `await`. That
 * list is the whole point of the module and every item on it is load-bearing:
 *
 * - **No canvas.** The ink table's numbers were obtained by rendering in Chrome and reading back
 *   (`layout/spacingPadding.ts`'s header). That works, and it cannot be repeated for a glyph nobody
 *   has drawn yet, cannot run in a unit test, and produces numbers whose source is a session.
 * - **No `await`.** ⚠️ This is why the metrics are a checked-in module and not a fetch of the
 *   1.26 MB metadata, and the reason is NOT size — we already serve 500 KB of SMuFL JSON that way
 *   (`public/smufl`, fetched by the Symbols window on first open). It is that `measureColumns`
 *   reads the ink table **inside the layout path and inside jsdom unit tests**, where there is
 *   nothing to await and no `fetch` to await it with. A chart nobody has opened can wait; a column
 *   being measured cannot (plan §F1).
 *
 * ## ⛔ What this module does NOT do: decide anything
 *
 * It reports what the font says. It does not say how much room a note earns, what may tuck under
 * what, or how far a flag reaches past a notehead — those are `layout/`'s, and the last one is not
 * even a lookup ({@link flagReachFromHead}). ⭐ **Naming the quantity is the whole discipline here**
 * (plan §3.1): an ink extent, an advance width, an anchor and a distance measured off VexFlow's
 * behaviour are four different things, and a table that mixes them reads as one.
 *
 * ## The compositions live here, the judgements do not
 *
 * A few of `spacingPadding.ts`'s rows are not glyph boxes but arithmetic ON glyph boxes — a flag's
 * reach is a head, a stem and a flag added up (plan §3.1b). Those belong here, where the operands
 * are, and they are marked ⭐ COMPOSITION. A row that adds a number the font never stated — an
 * accidental's column padding, a pair's air — stays in `layout/`, because it is a judgement and
 * this module has no opinions.
 *
 * ⭐ Everything is in **staff spaces**, in and out. ⛔ Never pixels: the conversion is the caller's,
 * against the stave it is drawing on, exactly as `thinLineWeight.ts` does it.
 */

import {
  BRAVURA,
  ENGRAVING_DEFAULTS,
  GLYPH_ANCHORS,
  GLYPH_BOXES,
  GLYPH_CODEPOINTS,
  type GlyphName,
} from './bravuraMetrics'
import * as leipzig from './leipzigMetrics'
import * as sebastian from './sebastianMetrics'
import { DEFAULT_MUSIC_FONT, activeMusicFont, type MusicFontId } from './musicFont'
import type { NoteDuration } from '@/types/music'

export { BRAVURA }

/**
 * ⭐⭐ **ONE TABLE PER MUSIC FACE, and every lookup below reads the ACTIVE one** — Phase B2 of
 * `docs/plans/music-font-switch-plan.md`. The tables are generated to one shape and are TOTAL over
 * {@link GlyphName}: a glyph a face does not draw is Bravura's row, whole (box and anchors, because
 * the drawing is Bravura's too), and the face's table says which ({@link fallbackGlyphs}).
 *
 * ⚠️ So nothing that calls this module may FREEZE an answer at import — a module-level
 * `const X = engravingDefault(…)` is Bravura's forever. Ask per use.
 *
 * ⛔ The codepoints are not per face: a SMuFL name is one codepoint in every font.
 */
interface FontTable {
  boxes: Record<GlyphName, GlyphBox>
  anchors: Partial<Record<GlyphName, Record<string, readonly [number, number]>>>
  defaults: Record<keyof typeof ENGRAVING_DEFAULTS, number>
  fallbackGlyphs: readonly GlyphName[]
  fallbackDefaults: readonly string[]
}

const FONT_TABLES: Record<MusicFontId, FontTable> = {
  bravura: { boxes: GLYPH_BOXES, anchors: GLYPH_ANCHORS, defaults: ENGRAVING_DEFAULTS, fallbackGlyphs: [], fallbackDefaults: [] },
  leipzig: { boxes: leipzig.GLYPH_BOXES, anchors: leipzig.GLYPH_ANCHORS, defaults: leipzig.ENGRAVING_DEFAULTS, fallbackGlyphs: leipzig.FALLBACK_GLYPHS, fallbackDefaults: leipzig.FALLBACK_DEFAULTS },
  sebastian: { boxes: sebastian.GLYPH_BOXES, anchors: sebastian.GLYPH_ANCHORS, defaults: sebastian.ENGRAVING_DEFAULTS, fallbackGlyphs: sebastian.FALLBACK_GLYPHS, fallbackDefaults: sebastian.FALLBACK_DEFAULTS },
}

/** Set only inside {@link differenceFromDefault}, while it asks the DEFAULT face the same question. */
let pinnedTable: FontTable | null = null

function activeTable(): FontTable {
  return pinnedTable ?? FONT_TABLES[activeMusicFont().id]
}

/**
 * ⭐ **How much a font quantity differs, in the active face, from the DEFAULT face's** — `quantity`
 * is any expression over this module's lookups (`() => noteheadInk('q')`), asked of both tables.
 *
 * It exists for tables whose rows are the default face's numbers PLUS a judgement — `layout/
 * spacingPadding`'s ink table, measured off a Bravura drawing and rounded by hand. Such a row cannot
 * be re-derived from another face's box without losing its judgement; it CAN be moved by exactly how
 * much that face's glyph differs (`docs/plans/music-font-switch-plan.md`, follow-up 1).
 *
 * ⭐ **Exactly 0 for the default face — not "nearly"**: the question is not even asked, so no row
 * moves by a float's last digit while Bravura is selected.
 */
/**
 * ⭐ **The same question as a RATIO** — active ÷ default — for the quantities that scale rather than
 * shift: a line WEIGHT. Where a house style set its own weight against Bravura's (the staff line is
 * Gould's 0.11 where Bravura says 0.13; the stem 0.15 where it says 0.12), another face keeps that
 * proportion: `house × ratioToDefault(() => engravingDefault('staffLineThickness'))`.
 * ⭐ Exactly 1 for the default face, the question not asked. ⛔ 1 too if the default states 0.
 */
export function ratioToDefault(quantity: () => number): number {
  if (activeMusicFont().id === DEFAULT_MUSIC_FONT) return 1
  const here = quantity()
  pinnedTable = FONT_TABLES[DEFAULT_MUSIC_FONT]
  try {
    const there = quantity()
    return there === 0 ? 1 : here / there
  } finally {
    pinnedTable = null
  }
}

export function differenceFromDefault(quantity: () => number): number {
  if (activeMusicFont().id === DEFAULT_MUSIC_FONT) return 0
  const here = quantity()
  pinnedTable = FONT_TABLES[DEFAULT_MUSIC_FONT]
  try {
    return here - quantity()
  } finally {
    pinnedTable = null
  }
}

/** The glyphs the ACTIVE face does not draw — Bravura's, whole. Empty for Bravura itself. */
export function fallbackGlyphs(): readonly GlyphName[] {
  return activeTable().fallbackGlyphs
}

/** The engraving defaults the ACTIVE face's metadata does not state — Bravura's values. */
export function fallbackDefaults(): readonly string[] {
  return activeTable().fallbackDefaults
}
export type { GlyphName }

/**
 * One glyph's ink, in staff spaces from its own origin.
 *
 * ⚠️ **`left` is a REACH, so it is positive when the glyph extends left of its origin** — the same
 * convention as `layout/kerning.ts`'s {@link InkBox}, and the reason it may be NEGATIVE: a time
 * signature digit starts 0.08 spaces to the *right* of its origin, so its left reach is −0.08.
 * ⛔ Do not clamp that to zero. A digit that claims to start at its origin claims 0.08 spaces of
 * ink that is not there, which is how a column gains width nobody can see.
 *
 * `advance` is what the font would step by if it were setting text — ⚠️ **not the same as
 * `left + right`**, and not what an engraver spaces by. It is here so that the distinction the plan
 * insists on stays visible rather than being quietly unavailable.
 */
export interface GlyphBox {
  /** Reach LEFT of the origin, positive; negative if the ink starts right of it. */
  left: number
  /** Reach RIGHT of the origin. */
  right: number
  /** Reach ABOVE the origin. */
  up: number
  /** Reach BELOW the origin, positive. */
  down: number
  /** The font's own advance width. ⚠️ A typesetting number, not an engraving one. */
  advance: number
}

/**
 * The ink of one glyph, by its SMuFL name.
 *
 * ⭐ **Total, and that is the point of the {@link GlyphName} union**: the generated table declares
 * exactly which glyphs we measured, so there is no "not found" case to invent an answer for. A
 * glyph we have not measured is a compile error, not a zero — and a zero-width fallback is the
 * failure mode `reference_vexflow_measures_glyphs_at_render_time` is about, one layer down.
 */
export function glyphBox(name: GlyphName): GlyphBox {
  return activeTable().boxes[name]
}

/**
 * ⭐⭐ **THE WAY BACK FROM A DRAWN CHARACTER TO A MEASURED GLYPH** — P6's prerequisite.
 *
 * A {@link GlyphBox} is keyed by SMuFL NAME, but a SCENE records what was actually stamped: the
 * CHARACTER. So computing a text primitive's ink box needs this inversion, and it is built from the
 * generated {@link GLYPH_CODEPOINTS} — ⛔ never from a hand-written table, which is the drift
 * `bravuraMetrics` exists to end.
 *
 * ⚠️ **Returns null for a codepoint we have not measured, ⛔ never a plausible box.** We measure 71
 * of Bravura's 3,434 glyphs; everything else — a text annotation, a tuplet numeral in a text font, a
 * glyph a future feature adds — has no box here, and *"no answer"* is the only honest one. A caller
 * that guessed would put a made-up rectangle into the spacing model, which is exactly the failure
 * `reference: vexflow measures glyphs at render time` describes one layer down.
 *
 * @param char the drawn string. ⚠️ A SMuFL glyph is ONE code point but may be a surrogate PAIR in
 *   JS, so this reads a code point rather than a char code — and a run of more than one glyph is not
 *   a glyph and answers null.
 */
export function glyphNameOf(char: string): GlyphName | null {
  const codepoint = char.codePointAt(0)
  if (codepoint === undefined || String.fromCodePoint(codepoint).length !== char.length) return null
  return CODEPOINT_TO_NAME.get(codepoint) ?? null
}

/** Built once: the generated name→codepoint map, inverted. */
const CODEPOINT_TO_NAME = new Map<number, GlyphName>(
  (Object.entries(GLYPH_CODEPOINTS) as [GlyphName, number][]).map(([name, cp]) => [cp, name]),
)

/**
 * A named attachment point on a glyph — `[x, y]` in staff spaces from its origin, **y UP** (the
 * font's axis, not the staff's downward one).
 *
 * ⭐ P3's prerequisite: a stem is drawn at `stemUpSE`, a beamed group's slope is measured between
 * them, a dot tucks in at `cutOutNE`. ⚠️ Returns **null** when the glyph has no such anchor rather
 * than `[0, 0]`, which would be a plausible answer and therefore a believed one.
 */
export function anchor(glyph: GlyphName, which: string): readonly [number, number] | null {
  return activeTable().anchors[glyph]?.[which] ?? null
}

/** The names {@link engravingDefault} answers for — SMuFL's own, all 30 of them. */
type EngravingDefault = keyof typeof ENGRAVING_DEFAULTS

/**
 * One of the font's `engravingDefaults`, in staff spaces — how thick Bravura says a structural line
 * is: `stemThickness`, `beamThickness`, `legerLineThickness`, `slurMidpointThickness`…
 *
 * ⭐ **We already decided the font is the authority here** — `rendering/thinLineWeight.ts` says
 * `THIN_LINE_SPACES = 0.16` *is* the font's one thin-line weight and names the five defaults that
 * share it; `rendering/curves/curveStyle.ts` says 0.22 *is* `slurMidpointThickness`. This makes that
 * mechanical instead of transcribed (plan §F3). ⛔ It does not make it automatic: where his eye has
 * overruled the font — the hairpin, twice — the override stays and keeps its reason.
 */
export function engravingDefault(name: EngravingDefault): number {
  return activeTable().defaults[name]
}

// ─────────────────────────────────────────────────────────────────────────────
// The vocabulary: our domain's words → the font's names. ⭐ One place, so a duration or a sign is
// turned into a glyph once and not at every call site that needs to measure one.

/** The notehead a duration is written with. ⚠️ Anything shorter than a half is the same black head. */
export function noteheadGlyph(duration: NoteDuration): GlyphName {
  if (duration === 'w') return 'noteheadWhole'
  if (duration === 'h') return 'noteheadHalf'
  return 'noteheadBlack'
}

/** The rest glyph of a duration — one per `NoteDuration`, which is why the map is total. */
const REST_GLYPHS: Record<NoteDuration, GlyphName> = {
  w: 'restWhole',
  h: 'restHalf',
  q: 'restQuarter',
  '8': 'rest8th',
  '16': 'rest16th',
  '32': 'rest32nd',
}

export function restGlyph(duration: NoteDuration): GlyphName {
  return REST_GLYPHS[duration]
}

/**
 * The accidental glyph of a VexFlow sign string.
 *
 * ⚠️ Keyed by the sign as `spacingPadding.ts` keys its tables (`'#'`, `'b'`, `'n'`, `'##'`, `'bb'`),
 * so the two agree by construction. ⭐ Returns **null** for a sign we do not measure rather than
 * defaulting to a sharp: a table may choose to fall back, but this must not choose for it.
 */
const ACCIDENTAL_GLYPHS: Record<string, GlyphName> = {
  '#': 'accidentalSharp',
  'b': 'accidentalFlat',
  'n': 'accidentalNatural',
  '##': 'accidentalDoubleSharp',
  'bb': 'accidentalDoubleFlat',
}

/**
 * The clef's own glyph — so a caller that needs where a clef's INK ends can ask the font instead of
 * VexFlow's modifier box.
 *
 * ⚠️ **A modifier's `getWidth()` is a LAYOUT box, not ink**, and the two differ by whatever padding
 * the layout chose to carry. Any spacing decision measured against the box is measuring someone
 * else's padding as if it were the drawing (`docs/history/vexflow-boundary.md`'s rule: ink is LOCATED BOXES).
 */
export function clefGlyph(clef: 'treble' | 'bass' | 'alto' | 'tenor'): GlyphName {
  return clef === 'treble' ? 'gClef' : clef === 'bass' ? 'fClef' : 'cClef'
}

export function accidentalGlyph(sign: string): GlyphName | null {
  return ACCIDENTAL_GLYPHS[sign] ?? null
}

/**
 * The flag of a duration and a stem direction — ⚠️ **up and down are different glyphs**, 1.056 and
 * 1.224 spaces wide, which is why a down-flag costs a column nothing and an up-flag costs it a space
 * (`INK.flagReach`'s note).
 *
 * Returns null for a duration that has no flag, which is a real question and not an error.
 */
export function flagGlyph(duration: NoteDuration, stemUp: boolean): GlyphName | null {
  if (duration === '8') return stemUp ? 'flag8thUp' : 'flag8thDown'
  if (duration === '16') return stemUp ? 'flag16thUp' : 'flag16thDown'
  if (duration === '32') return stemUp ? 'flag32ndUp' : 'flag32ndDown'
  return null
}

/** The clef glyphs, by our `Clef` names — C clef for both alto and tenor, at different heights. */
export const CLEF_GLYPHS = {
  treble: 'gClef',
  bass: 'fClef',
  alto: 'cClef',
  tenor: 'cClef',
} as const satisfies Record<string, GlyphName>

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ COMPOSITIONS — arithmetic ON the font's numbers. Named quantities, because the plan's §3.1
//   trap is that "the notehead's width" is three different numbers depending on who is asking.

/**
 * ⭐ **A notehead's INK** — how wide the glyph actually is, 1.18 spaces for a black head.
 *
 * ⛔ **Not the same as {@link secondDisplacement}**, and confusing the two is exactly what plan
 * §3.1a is about: `layout/measureColumns.ts` needs both, twelve lines apart.
 */
export function noteheadInk(duration: NoteDuration): number {
  return glyphBox(noteheadGlyph(duration)).right
}

/**
 * ⭐ **How far a chord displaces the second of two adjacent noteheads** — 1.12 spaces, which is the
 * head's ink **less half a stem**: the two heads share the stem they hang on, so they overlap by its
 * width rather than sitting edge to edge.
 *
 * ⚠️ This is the quantity `INK.notehead = 1.13` has always been. It was obtained by measuring the
 * displaced head of a second in Chrome (11.3 px), which is why it reads as a notehead's width and is
 * not one — the font's head is 1.18. ⭐ **The 0.05 was never an error; it was a different question**
 * (plan §3.1). The two now have two names and the question cannot be asked ambiguously.
 */
export function secondDisplacement(duration: NoteDuration): number {
  return noteheadInk(duration) - engravingDefault('stemThickness') / 2
}

/**
 * ⭐ **How far a FLAG's ink reaches from the NOTEHEAD'S ANCHOR**, in staff spaces — a COMPOSITION of
 * three numbers and not a glyph box (plan §3.1b), and the number `measureColumns` puts in a box's
 * `right` (which is measured from the column's x, i.e. that same anchor).
 *
 * ```
 *   UP:    noteheadInk 1.180  −  stemThickness 0.12  +  flag8thUp   1.056  =  2.116
 *   DOWN:                                                flag8thDown 1.224  =  1.224
 * ```
 *
 * …against the **2.15** measured in Chrome for the up-flag, and a down-flag's measured 1.3 against
 * the head's 1.2. ⛔ **The font's bare 1.056 is NOT this number.** A flag's box is measured from the
 * STEM's own x, so a lookup would place it a stem's width adrift — the down case is the tell, where
 * that same 1.056-shaped number starts at the anchor instead of near the head's right edge.
 *
 * ⚠️ A down-flag's 1.224 is barely past the head's own 1.18 and the ink model has always let the
 * head cover it. ⭐ That is now visible arithmetic instead of a sentence in a comment: the caller
 * takes the wider of head and flag, and for a down-stem the head wins by 0.044 spaces.
 */
export function flagInkRight(duration: NoteDuration, stemUp: boolean): number {
  const flag = flagGlyph(duration, stemUp)
  if (!flag) return 0
  const width = glyphBox(flag).right
  // An UP stem stands at the head's right edge, so the flag hangs from there; a DOWN stem stands at
  // the head's LEFT edge, which IS the anchor, so the flag starts at 0.
  return stemUp ? noteheadInk(duration) - engravingDefault('stemThickness') + width : width
}

/**
 * ⭐ **How far a flag hangs back from the stem TIP toward the notehead** — 3.24 spaces, and the same
 * for the 8th, 16th and 32nd flags (each extra hook thickens the glyph rather than lengthening it).
 *
 * ⚠️ A band from the TIP, not around an anchor — which is why `measureColumns` builds the flag's box
 * from the stem's geometry rather than from a `± height` like the others (`INK_HEIGHT.flagFromTip`).
 */
export function flagDropFromTip(duration: NoteDuration, stemUp: boolean): number {
  const flag = flagGlyph(duration, stemUp)
  if (!flag) return 0
  const box = glyphBox(flag)
  return stemUp ? box.down : box.up
}

/**
 * ⭐ **How far a ledger line runs past the notehead on each side** — the font's own
 * `legerLineExtension`, 0.4 spaces.
 *
 * So a ledgered head reaches `−0.40` to `+1.58` around its anchor against a bare head's `0` to
 * `1.18`: it overhangs on BOTH sides, which is the fact `INK.ledgerLeft`/`ledgerRight` exist for.
 */
export function ledgerExtension(): number {
  return engravingDefault('legerLineExtension')
}
