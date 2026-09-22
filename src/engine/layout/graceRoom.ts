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
 * A grace's stem length, from its HIGHEST head's centre to the tip (the stem is always up), in staff
 * spaces — {@link GRACE_ROWS}.stem, ⭐ lengthened for a grace on ledger lines BELOW the staff until the
 * tip stands {@link GRACE_ROWS}.ledgerClearance beyond the ledger nearest the staff (Gould p. 126).
 * A grace above the staff never needs it: its ledgers are on the head's far side from the stem.
 *
 * @param lines the grace's heads as staff lines (`staffLineForSpelling`: bottom line 1, the first
 *   ledger below it 0). Absent = the plain length (the tool's ghost, which stands on no staff).
 */
export function graceStemSpaces(lines: readonly number[] = []): number {
  const base = GRACE_ROWS.stem.value
  if (lines.length === 0 || Math.min(...lines) > 0) return base
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
  for (let i = group.notes.length - 1; i >= 0; i--) {
    const note = group.notes[i]
    const headWidth = headsWidth(note.pitches) * k
    const headX = right - headWidth
    places.unshift({ note, headX, headWidth })
    leftEdge = headX - leftInk(note.pitches, signOf, clef) * k
    right = leftEdge - GRACE_ROWS.between.value
  }
  return { places, reach: Math.max(0, -leftEdge) }
}
