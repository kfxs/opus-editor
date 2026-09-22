/**
 * ⭐⭐ **GRACE NOTES — the ROOM a group takes, and WHERE its heads stand** (`docs/plans/grace-notes-plan.md`
 * §4). Pure, in the host staff's OWN staff spaces, measured from the host chord's notehead anchor
 * (its column's x), so a grace before stands at NEGATIVE x.
 *
 * ⭐ **A grace group is UNFIXED INK of its host's column** — LEFT ink for a grace before
 * (LilyPond's `strict-grace-spacing`: *"grace notes are put left of the musical columns for the main
 * notes"*). The columns never learn a grace exists: `measureColumns.slotInk` appends ONE `'grace'`
 * box reaching {@link GraceLayout.reach} left, and the spring solve floors the gap before the host.
 *
 * ⭐⭐ **ONE function answers the room AND the ink** (the `dotGap` / `accidentalGap` rule):
 * {@link graceLayout} is what `slotInk` reserves and what `rendering/GracePass` draws at. Walked
 * RIGHT TO LEFT from the host — Verovio and MuseScore both pack from the principal outward.
 *
 * ⛔ Every number here is one house style's DEFAULT, a changeable row (`CLAUDE.md`); the research
 * behind each is `docs/research/grace-notes-research.md` §0.4.
 */
import type { Clef, GraceGroup, GraceNote, NotePitch } from '@/types/music'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { INK, accidentalExtent } from './spacingPadding'
import { durationFlags } from '@/utils/durations'
import { armedDotGap } from './dotGap'
import { flagGlyph, glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { graceBeamRuns } from '@/engine/engrave/notes/graceBeam'
import { MODIFIER_RIGHT_GAP_PX, VEXFLOW_DOT_SPACING } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/** One row: its value and where it came from. */
export interface GraceRow {
  value: number
  source: string
}

/**
 * ⭐ **The rows.** The size is {@link GRACE_SIZE_RULES} (D5); the gaps are Gould's own drawings, measured
 * (research §C.6) — no book states them in words.
 */
export const GRACE_ROWS = {
  /** White between the LAST grace's head and the host's leftmost ink (its head, or its accidental). */
  toMain: { value: 1.15, source: 'Gould’s drawings, 2.1–2.5 sp centre to centre ⇒ ≈1.15 edge to edge; wider than between graces' },
  /** White between two graces of one group — edge to edge. ⏭️ P2 (groups). */
  between: { value: 0.8, source: 'Gould’s drawings, 0.65–1.0 sp; MuseScore graceToGraceNoteDist 0.3 + the head' },
  /**
   * A grace's STEM, head centre → tip, in SYSTEM staff spaces — ⛔ not `3.5 × scale` (2.33): about
   * ¾ of a full stem, not scaled with the head. ⚠️ The books disagree (Gould's text 2¼, her own
   * plate 2.22–2.67, median 2½ = Stone p. 49) — a preset row.
   */
  stem: { value: 2.5, source: 'Stone p. 49; Gould’s grace plate, median 2½ (her text says 2¼)' },
  /**
   * ⭐ **Gould p. 126** — *"Ensure that a grace note on ledger lines has a sufficiently long stem for the
   * diagonal stroke not to obscure a ledger line"*: the STEM grows, the slash keeps its place under the
   * tip. How far the tip must stand beyond the ledger nearest the staff, staff spaces. ⚠️ DERIVED — no
   * book states a number: it reproduces her drawings (G3 3.25 sp, F3 3.77, B3 2.68 — research §E.2).
   */
  ledgerClearance: { value: 1.8, source: 'derived from Gould’s pp. 126 and 130 drawings (tip ≈ the 2nd staff line)' },
} as const satisfies Record<string, GraceRow>

/**
 * ⭐ **A grace's SIZE against a full note** — head, flag, accidental, ledger, all of it. D5 (decided
 * 2026-09-22) is `house`; the other rows are the research's (§0.4), armed from the console
 * (`dev/graceConsole` — `__grace.size(…)`) so his eye can choose on his own music. A free number is
 * accepted too.
 */
export const GRACE_SIZE_RULES = {
  house: { value: 2 / 3, source: 'D5 — VexFlow’s 2/3; between the fonts’ own grace glyphs and MuseScore' },
  dorico: { value: 0.6, source: 'Dorico 3/5' },
  sibelius: { value: 0.6, source: 'Sibelius 60%' },
  gould: { value: 0.625, source: 'Gould’s drawings measure 0.60–0.65 (her text: “slightly smaller than a cue note”, ¾)' },
  sebastian: { value: 0.64, source: 'Sebastian’s own grace glyph: head 0.816 / 1.280' },
  gerouLusk: { value: 0.65, source: 'Gerou & Lusk p. 72: 65%' },
  bravura: { value: 0.66, source: 'Bravura’s own grace glyph: head 0.780 / 1.180' },
  musescore: { value: 0.7, source: 'MuseScore graceNoteMag 0.7' },
  lilypond: { value: 0.707, source: 'LilyPond font-size −3 = 2^(−½)' },
  verovio: { value: 0.75, source: 'Verovio’s cue size, 0.75' },
} as const satisfies Record<string, GraceRow>

export type GraceSizeRuleName = keyof typeof GRACE_SIZE_RULES

const sizeState: { rule: GraceSizeRuleName | 'custom'; value: number; generation: number } = {
  rule: 'house', value: GRACE_SIZE_RULES.house.value, generation: 0,
}

/** The size a grace is drawn at — the ARMED row ({@link GRACE_SIZE_RULES}). Read per draw, ⛔ never frozen. */
export function graceScale(): number {
  return sizeState.value
}

/** Which row is armed, and its value. */
export function graceSizeSettings(): { rule: GraceSizeRuleName | 'custom'; value: number } {
  return { rule: sizeState.rule, value: sizeState.value }
}

/** 🚨 A WIDTH — in `layout/widthRowGenerations`, so re-arming re-measures every bar. */
export function graceSizeGeneration(): number {
  return sizeState.generation
}

/** Arm a row by name, or a size by number (0.3–1). ⛔ Anything else is REFUSED, not ignored. */
export function setGraceSize(rule: GraceSizeRuleName | number): boolean {
  if (typeof rule === 'number') {
    if (!(rule >= 0.3 && rule <= 1)) return false
    sizeState.rule = 'custom'
    sizeState.value = rule
  } else {
    if (!(rule in GRACE_SIZE_RULES)) return false
    sizeState.rule = rule
    sizeState.value = GRACE_SIZE_RULES[rule].value
  }
  sizeState.generation++
  return true
}

export function resetGraceSize(): void {
  sizeState.rule = 'house'
  sizeState.value = GRACE_SIZE_RULES.house.value
  sizeState.generation++
}

/**
 * A grace's stem length, from the head NEAREST its tip (the highest, stems up; the lowest, stems down)
 * to the tip, in staff spaces — {@link GRACE_ROWS}.stem, ⭐ lengthened when the stem runs THROUGH the
 * ledger lines (a grace BELOW the staff stems up, or ABOVE it stems down) until the tip stands
 * {@link GRACE_ROWS}.ledgerClearance beyond the ledger nearest the staff (Gould p. 126). A stem that
 * runs away from its ledgers never needs it.
 *
 * @param lines the grace's heads as staff lines (`staffLineForSpelling`: bottom line 1, the first
 *   ledger below it 0, the first above it 6). Absent = the plain length (the tool's ghost).
 * @param down the group's stems point DOWN (`GraceGroup.stemDirection`, P6's flip) — the rule mirrored.
 */
export function graceStemSpaces(lines: readonly number[] = [], down = false): number {
  const base = GRACE_ROWS.stem.value
  if (lines.length === 0) return base
  if (down) {
    // The ledger nearest the staff above it is line 6; the tip must reach line 6 − clearance.
    if (Math.max(...lines) < 6) return base
    return Math.max(base, Math.min(...lines) - (6 - GRACE_ROWS.ledgerClearance.value))
  }
  if (Math.min(...lines) > 0) return base
  // The ledger nearest the staff is line 0; the tip must reach line 0 + clearance.
  return Math.max(base, GRACE_ROWS.ledgerClearance.value - Math.max(...lines))
}

/** The drawn sign of each grace pitch — `displayedAccidentals`' answer; absent/null = none drawn. */
export type SignOf = (pitchId: string) => string | null | undefined

/** Is this pitch on a ledger line? The same bound `measureColumns` states (line ≤ 0 or ≥ 6). */
function onLedger(pitch: NotePitch, clef: Clef): boolean {
  const line = staffLineForSpelling(pitch.step, pitch.octave, clef)
  return line <= 0 || line >= 6
}

/** The signs a set of pitches draws, in the shape `accidentalExtent` reads. */
function drawnSigns(pitches: readonly NotePitch[], signOf: SignOf): { position: number; sign: string }[] {
  const out: { position: number; sign: string }[] = []
  for (const p of pitches) {
    const sign = signOf(p.id)
    if (typeof sign === 'string') out.push({ position: spellingDiatonicPos(p.step, p.octave), sign })
  }
  return out
}

/** How far LEFT of its notehead anchor a set of pitches' own ink reaches — its accidentals, or a
 *  ledger line's overhang, whichever is further. Full size: the caller scales. */
function leftInk(pitches: readonly NotePitch[], signOf: SignOf, clef: Clef): number {
  const accidental = accidentalExtent(drawnSigns(pitches, signOf))
  const ledger = pitches.some(p => onLedger(p, clef)) ? INK.ledgerLeft : 0
  return Math.max(accidental, ledger)
}

/** A chord's heads' width, stem up (a second puts its displaced head to the RIGHT — the grace's
 *  stem is always up, research §0.4). Full size. */
function headsWidth(pitches: readonly NotePitch[]): number {
  const positions = pitches.map(p => spellingDiatonicPos(p.step, p.octave)).sort((a, b) => a - b)
  const hasSecond = positions.some((position, i) => i > 0 && position - positions[i - 1] === 1)
  return hasSecond ? INK.secondDisplacement + INK.notehead : INK.notehead
}

/** Where one grace stands. */
export interface GracePlace {
  note: GraceNote
  /** Its notehead anchor (the head's LEFT edge), in staff spaces from the host's anchor — negative. */
  headX: number
  /** How wide its heads are, at the grace's size. */
  headWidth: number
  /** How far RIGHT of its anchor its ink reaches — the heads, or its augmentation DOTS — at the grace's size. */
  rightInk: number
}

/**
 * ⭐ Where a grace's augmentation dots stand (each dot's LEFT edge), in its OWN staff spaces past its
 * head's anchor — ⭐⭐ **the NORMAL note's rule, run at the grace's size** (his ask, 2026-09-22: *"see how
 * the normal note use the dot position and aply to the grace proportionally"*). The rule is
 * `rendering/format/dotPlacement` + `engrave/notes/modifierStart`'s, and it reads the SAME rows:
 * the head's width + VexFlow's `MODIFIER_RIGHT_GAP_PX`, then either the FLAG's width (a stem-up flagged
 * note — `forceFlagRight`; a grace's stem is always up) or what the armed dot gap adds over that base
 * (`layout/dotGap` — `__dots.gap`); each further dot one dot's width + the armed dot→dot gap (never
 * under VexFlow's 1 px). Every px row is divided by `STAFF_SPACE_PX`: the grace's scale is its group's.
 * ⭐ So the ROOM ({@link graceLayout}) and the INK (`rendering/GracePass`) read one answer.
 * ⚠️ "Flagged" is the duration's own count (`durationFlags`) — ⭐ unless the grace is BEAMED (P2b,
 * `engrave/notes/graceBeam`): a beamed grace draws no flag, so its dot has none to clear.
 */
export function graceDotXs(note: Pick<GraceNote, 'duration' | 'dots'>, beamed = false, down = false): number[] {
  const px = (v: number) => v / STAFF_SPACE_PX
  const base = px(MODIFIER_RIGHT_GAP_PX)
  // A stem-DOWN flag hangs under the head from its left edge: nothing for a dot to clear (P6).
  const flag = !beamed && !down && durationFlags(note.duration) > 0 ? flagGlyph(note.duration, true) : null
  const push = flag ? glyphBox(flag).right : Math.max(0, armedDotGap().head - base)
  const first = noteheadInk(note.duration) + base + push
  const step = glyphBox('augmentationDot').right + Math.max(px(VEXFLOW_DOT_SPACING), armedDotGap().dot)
  return Array.from({ length: Math.max(0, note.dots ?? 0) }, (_, i) => first + i * step)
}

/** How far right of its anchor a grace's dots reach, own staff spaces — 0 with none. */
function graceDotReach(note: GraceNote, beamed: boolean, down: boolean): number {
  const xs = graceDotXs(note, beamed, down)
  return xs.length ? xs[xs.length - 1] + glyphBox('augmentationDot').right : 0
}

/** A group's placement and the room it asks for. */
export interface GraceLayout {
  /** Left to right, the group's order. */
  places: GracePlace[]
  /** How far LEFT of the host's anchor the whole group's ink reaches — the `'grace'` box's `left`. */
  reach: number
}

/**
 * How far left of its anchor the HOST chord's own ink reaches — the grace keeps its gap to THAT,
 * not to the bare head (a grace does not stand on its principal's sharp).
 */
export function hostLeftReach(host: readonly NotePitch[], signOf: SignOf, clef: Clef): number {
  return leftInk(host, signOf, clef)
}

/**
 * ⭐ **Where each grace of a BEFORE group stands, and how far the group reaches** — right to left
 * from the host: the last grace's head clears the host's leftmost ink by {@link GRACE_ROWS}.toMain,
 * each earlier one clears the next one's leftmost ink by `between`.
 *
 * @param hostReach the host's own left ink ({@link hostLeftReach}), full size.
 */
export function graceLayout(group: GraceGroup, signOf: SignOf, clef: Clef, hostReach: number): GraceLayout {
  const k = graceScale()
  const places: GracePlace[] = []
  let right = -(hostReach + GRACE_ROWS.toMain.value)
  let leftEdge = right
  const beamed = new Set(graceBeamRuns(group.notes).flat())
  for (let i = group.notes.length - 1; i >= 0; i--) {
    const note = group.notes[i]
    const headWidth = headsWidth(note.pitches) * k
    // A DOT stands between this grace and whatever follows it: the gap is measured to its ink.
    const rightInk = Math.max(headWidth, graceDotReach(note, beamed.has(i), group.stemDirection === 'down') * k)
    const headX = right - rightInk
    places.unshift({ note, headX, headWidth, rightInk })
    leftEdge = headX - leftInk(note.pitches, signOf, clef) * k
    right = leftEdge - GRACE_ROWS.between.value
  }
  return { places, reach: Math.max(0, -leftEdge) }
}
