/**
 * ⭐⭐ **PARENTHESISED NOTES — WHERE each bracket stands, and the ROOM they take**
 * (`docs/plans/parenthesised-note-plan.md` P1). Pure, in the staff's OWN staff spaces, measured from the
 * chord's notehead anchor (the head's LEFT edge), so a `(` stands at NEGATIVE x.
 *
 * ⭐⭐ ONE function answers the room AND the ink ({@link enclosureLayout}, the `dotGap` / `accidentalGap`
 * rule): `measureColumns.slotInk` reserves the room from it and `rendering/EnclosurePass` stamps the
 * brackets where it says.
 *
 * What is inside a pair (N4, all three research parts agree): the head, its ACCIDENTAL, its DOTS and its
 * own LEDGER line; the stem and ties outside. ⭐ Each bracketed head takes its own pair (N3's default), and
 * every pair of one chord stands at the same x: the brackets clear the WHOLE chord's ink — MuseScore's
 * rule (research A.3), and what keeps a chord's pairs in two straight columns.
 *
 * ⛔ Every number is one house style's DEFAULT, a changeable row (`CLAUDE.md`). They are Gould's, MEASURED
 * off her full-size drawings (research B.3); no book states one.
 */
import type { Clef, HeadEnclosure, NotePitch } from '@/types/music'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'
import { INK, accidentalExtent, dotExtent } from './spacingPadding'

/** A row: a number and where it came from. */
interface Row { value: number; source: string }

/**
 * ⭐ **Which glyph pair each SHAPE draws** (N8) — one row per member of {@link HeadEnclosure}, so a new
 * shape is a new row. `round` is the ACCIDENTAL pair at FULL size: Gould's brackets round a full-size
 * head measure ≈2.0 sp tall and 0.53–0.55 wide (pp. 308, 337), Bravura's E26A/E26B 1.98 × 0.564. ⛔ Not
 * the notehead pair E0F5/E0F6 (1.45 sp, sized for one bare head), which no engine draws with.
 */
export const ENCLOSURE_GLYPHS: Record<HeadEnclosure, { left: GlyphName; right: GlyphName; source: string }> = {
  round: {
    left: 'accidentalParensLeft', right: 'accidentalParensRight',
    source: 'Gould pp. 308, 337 measured ≈2.0 sp; Verovio and LilyPond draw this pair (research A.3, B.3)',
  },
}

/** ⭐ The white between a bracket's ink and the ink it encloses, by WHAT is at that edge, staff spaces. */
export const ENCLOSURE_ROWS = {
  /** A bare head → `)` (and `(` → a bare head). */
  head: { value: 0.53, source: 'Gould p. 337: head → “)” 0.53 sp (600 dpi, research B.3)' },
  /** `(` → an accidental. */
  accidental: { value: 0.53, source: 'Gould p. 337: “(” → ♭ 0.53 sp (research B.3)' },
  /** `(` → a ledger line's end (and its end → `)`). */
  ledger: { value: 0.38, source: 'Gould p. 308: “(” → ledger 0.38 sp; ⚠️ her ledger → “)” measures 0.15 (p. 337) and 0.6 (p. 308) — the left side’s number, both sides' },
  /** The last dot → `)`. */
  dot: { value: 0.53, source: '⏳ unsourced — Gould p. 497 draws `𝅗𝅥.)` unmeasured; the head’s row' },
} as const satisfies Record<string, Row>

/** One head's pair. x's are GLYPH ORIGINS, staff spaces from the chord's notehead anchor. */
export interface EnclosurePair {
  pitch: NotePitch
  shape: HeadEnclosure
  /** Its staff line (`staffLineForSpelling`) — the pair is centred on it. */
  line: number
  leftParenX: number
  rightParenX: number
}

export interface EnclosureLayout {
  pairs: EnclosurePair[]
  /** How far LEFT of the anchor the brackets' ink reaches (positive). */
  left: number
  /** How far RIGHT of the anchor it reaches. */
  right: number
  /** How far above / below a pair's line its brackets reach. */
  up: number
  down: number
}

/** What a chord's own ink is — the brackets clear it. `signOf` answers the sign a head DRAWS. */
export interface EnclosedChord {
  notes: readonly NotePitch[]
  dots?: number
}

const onLedger = (line: number): boolean => line <= 0 || line >= 6

/**
 * ⭐ **Where each bracketed head's pair stands** — or null when no head wears brackets.
 *
 * Left: past whichever of the chord's inks reaches furthest — its accidentals, a ledger line's end, the
 * head — each with its own row of white. Right: past the heads (a second's displaced one too), a ledger's
 * end, or the dots.
 *
 * ⚠️ P1: a stem-DOWN chord's displaced second (its head LEFT of the anchor) is not counted yet (P2).
 */
export function enclosureLayout(chord: EnclosedChord, signOf: (pitchId: string) => string | null | undefined, clef: Clef): EnclosureLayout | null {
  const enclosed = chord.notes.filter(p => p.enclosure)
  if (!enclosed.length) return null

  const lines = chord.notes.map(p => staffLineForSpelling(p.step, p.octave, clef))
  const ledgered = lines.some(onLedger)
  const signs = chord.notes.flatMap(p => {
    const sign = signOf(p.id)
    return typeof sign === 'string' ? [{ position: spellingDiatonicPos(p.step, p.octave), sign }] : []
  })
  const positions = chord.notes.map(p => spellingDiatonicPos(p.step, p.octave)).sort((a, b) => a - b)
  const hasSecond = positions.some((position, i) => i > 0 && position - positions[i - 1] === 1)
  const heads = hasSecond ? INK.secondDisplacement + INK.notehead : INK.notehead

  // Each candidate edge is (how far its ink reaches) + (the white a bracket keeps from THAT ink).
  const leftEdge = Math.max(
    ENCLOSURE_ROWS.head.value,
    signs.length ? accidentalExtent(signs) + ENCLOSURE_ROWS.accidental.value : 0,
    ledgered ? INK.ledgerLeft + ENCLOSURE_ROWS.ledger.value : 0,
  )
  const rightEdge = Math.max(
    heads + ENCLOSURE_ROWS.head.value,
    ledgered ? heads + INK.ledgerRight - INK.notehead + ENCLOSURE_ROWS.ledger.value : 0,
    chord.dots ? dotExtent(chord.dots) + ENCLOSURE_ROWS.dot.value : 0,
  )

  let left = 0
  let right = 0
  let up = 0
  let down = 0
  const pairs = enclosed.map((pitch): EnclosurePair => {
    const shape = pitch.enclosure!
    const L = glyphBox(ENCLOSURE_GLYPHS[shape].left)
    const R = glyphBox(ENCLOSURE_GLYPHS[shape].right)
    // `GlyphBox.left` is a reach LEFTWARD of the origin: `(`'s ink ends `L.right` past its origin, `)`'s
    // begins `R.left` before its own.
    const leftParenX = -leftEdge - L.right
    const rightParenX = rightEdge + R.left
    left = Math.max(left, L.left - leftParenX)
    right = Math.max(right, rightParenX + R.right)
    up = Math.max(up, L.up, R.up)
    down = Math.max(down, L.down, R.down)
    return { pitch, shape, line: staffLineForSpelling(pitch.step, pitch.octave, clef), leftParenX, rightParenX }
  })
  return { pairs, left, right, up, down }
}
