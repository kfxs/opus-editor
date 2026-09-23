/**
 * ⭐⭐ **BRACKETED GRACES — the ROOM they take, and WHERE each head and bracket stands**
 * (`docs/plans/bracketed-grace-plan.md` P1). Pure, in the host staff's OWN staff spaces, measured from
 * the host chord's notehead anchor, so a bracketed grace BEFORE stands at NEGATIVE x.
 *
 * ⭐ Like a grace group, it is UNFIXED LEFT INK of its host's column: `measureColumns.slotInk` folds it
 * into the one `'grace'` box, and the drawing (`rendering/BracketedGracePass`) stands where this says —
 * ⭐⭐ ONE function answers the room AND the ink ({@link beforeSideLayout}, `graceRoom`'s rule).
 * The before side reads, left to right: `[grace group] [bracketed graces] main note`.
 *
 * ⛔ Every number is one house style's DEFAULT, a changeable row (`CLAUDE.md`). The research is
 * `docs/research/grace-notes-research.md` §0.9 and §G.4 (Gould's two drawings, measured).
 */
import type { BracketedGrace, Chord, ChordRest, Clef, GraceNote, NotePitch } from '@/types/music'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { glyphBox, noteheadInk, type GlyphName } from '@/engine/fonts/fontMetrics'
import { INK, accidentalExtent, dotExtent } from './spacingPadding'
import { graceLayout, type GraceLayout, type GraceRow, type SignOf } from './graceRoom'

/**
 * ⭐ **The size of the head, against a full note** (B7) — its OWN row, so choosing Gould's trill note
 * does not resize every grace. `house` is the grace's `house` value (D5).
 */
export const BRACKETED_SIZE_RULES = {
  house: { value: 2 / 3, source: 'the grace’s house row (D5) — B7' },
  gouldTrill: { value: 0.75, source: 'Gould p. 139, the trilling note: 1.02 sp head against ≈1.35 (research §G.4)' },
  gouldBend: { value: 0.65, source: 'Gould p. 378, the bend target: 0.85 sp head against ≈1.3 (research §G.4)' },
  musescore: { value: 0.7, source: 'MuseScore’s trill cue note, 0.7 (research §H.1.4)' },
  lilypond: { value: 0.63, source: 'LilyPond \\pitchedTrill, font-size −4 (research §H.3.2)' },
  sibelius: { value: 0.6, source: 'Sibelius’s pre-bend note, 60% (docs/research/sibelius-keypad.md)' },
} as const satisfies Record<string, GraceRow>

export type BracketedSizeRuleName = keyof typeof BRACKETED_SIZE_RULES

/**
 * ⭐ **Which brackets, and at what size** (B9). Two of the font's own glyph pairs:
 * - `notehead` — SMuFL's NOTEHEAD brackets, drawn to wrap a head (E0F5/E0F6), at the head's size;
 * - `gould` — the ACCIDENTAL brackets (E26A/E26B) at FULL size: Gould's trill and bend brackets measure
 *   2.04–2.11 sp tall and 0.56–0.68 wide (§G.4), which is this pair (1.98 × 0.564 in Bravura), not the
 *   notehead pair at her head's size (≈1.1 sp).
 * `headGap` is the white between a bracket and a head with no accidental, staff spaces.
 * ✅ **`gould` is ARMED** (his call, 2026-09-23, after both on the page).
 */
export const BRACKET_FORMS = {
  notehead: {
    left: 'noteheadParenthesisLeft', right: 'noteheadParenthesisRight', fullSize: false, headGap: 0,
    source: 'SMuFL noteheadParenthesisLeft/Right — drawn to wrap a head; ink touches the head’s box',
  },
  gould: {
    left: 'accidentalParensLeft', right: 'accidentalParensRight', fullSize: true, headGap: 0.48,
    source: 'Gould pp. 139 / 378 measured: brackets ≈2.07 sp tall; head → “)” 0.45–0.52 sp',
  },
} as const satisfies Record<string, { left: GlyphName; right: GlyphName; fullSize: boolean; headGap: number; source: string }>

export type BracketFormName = keyof typeof BRACKET_FORMS

/** The gaps, staff spaces of the page. */
export const BRACKETED_ROWS = {
  /** White between the last bracket and the host's leftmost ink. */
  toMain: { value: 0.9, source: 'Gould p. 139: 0.90 sp from a minim head to “(” — the AFTER side, mirrored; no book draws the before side' },
  /** White between two bracketed graces on one target. */
  between: { value: 0.4, source: '⏳ unsourced — no book shows two side by side (research §G.8)' },
  /** White between a grace group's last head and the first bracket. */
  toGrace: { value: 0.8, source: '⏳ the grace’s own `between` (GRACE_ROWS) — unsourced for a bracket' },
  /** White between “(” and the accidental inside it (B8). */
  parenToAccidental: { value: 0.2, source: 'Gould pp. 139 / 378: 0.15–0.26 sp' },
  /** ⭐ AFTER a note (P5): white between the host's HEAD and the first “(” — Gould p. 139, measured. */
  afterHead: { value: 0.9, source: 'Gould p. 139: 0.90 sp from a minim head to “(” (600 dpi, research §G.4)' },
  /** …and between the host's last DOT and the first “(” — the bracket follows the dot. */
  afterDot: { value: 0.49, source: 'Gould p. 139: 0.49 sp from a dotted minim’s dot to “(” (research §G.4)' },
  /** …and the air it keeps from what FOLLOWS — on top of the spacing's own 0.3 padding, so the next note
   *  stands 0.9 from its bracket, the distance the bracket keeps from its own note. ⏳ Unsourced: no book
   *  measures it. */
  afterToNext: { value: 0.6, source: '⏳ unsourced — mirrors afterHead (0.9) less the spacing’s 0.3 padding' },
} as const satisfies Record<string, GraceRow>

const state: { size: BracketedSizeRuleName | 'custom'; scale: number; form: BracketFormName; generation: number } = {
  // ⭐ `gould` — HIS CHOICE, 2026-09-23, after seeing both forms on the page.
  size: 'house', scale: BRACKETED_SIZE_RULES.house.value, form: 'gould', generation: 0,
}

/** The size a bracketed head is drawn at — the ARMED row. Read per draw, ⛔ never frozen. */
export function bracketedScale(): number {
  return state.scale
}

/** The armed bracket form. */
export function bracketForm(): BracketFormName {
  return state.form
}

export function bracketedSettings(): { size: string; scale: number; form: BracketFormName } {
  return { size: state.size, scale: state.scale, form: state.form }
}

/** Bumped on every re-arm — a width input (`widthRowGenerations`). */
export function bracketedGeneration(): number {
  return state.generation
}

/** Arm a size row, or a free number 0.3–1. @returns false (and changes nothing) for anything else. */
export function setBracketedSize(rule: BracketedSizeRuleName | number): boolean {
  if (typeof rule === 'number') {
    if (!(rule >= 0.3 && rule <= 1)) return false
    state.size = 'custom'
    state.scale = rule
  } else {
    if (!(rule in BRACKETED_SIZE_RULES)) return false
    state.size = rule
    state.scale = BRACKETED_SIZE_RULES[rule].value
  }
  state.generation++
  return true
}

/** Arm a bracket form. @returns false for an unknown name. */
export function setBracketForm(form: BracketFormName): boolean {
  if (!(form in BRACKET_FORMS)) return false
  state.form = form
  state.generation++
  return true
}

export function resetBracketed(): void {
  state.size = 'house'
  state.scale = BRACKETED_SIZE_RULES.house.value
  state.form = 'gould'
  state.generation++
}

/** One head of a bracketed grace, and its two brackets. x's are GLYPH ORIGINS, staff spaces from the host. */
export interface BracketedHead {
  pitch: NotePitch
  /** Its staff line (`staffLineForSpelling`). */
  line: number
  /** The sign it draws (`displayedAccidentals`, read-only for a bracketed pitch — B6), or null. */
  sign: string | null
  /** The accidental's left edge — where its glyph is stamped. */
  accidentalX: number | null
  leftParenX: number
  rightParenX: number
}

/** Where one bracketed grace stands. */
export interface BracketedPlace {
  bracketed: BracketedGrace
  /** Its notehead anchor (the head's LEFT edge), staff spaces from the host's — negative. */
  headX: number
  /** The head's width, at its size. */
  headWidth: number
  heads: BracketedHead[]
  /** Its ink's left and right edges. */
  left: number
  right: number
}

export interface BracketedLayout {
  places: BracketedPlace[]
  /** How far LEFT of the host's anchor the whole list's ink reaches. */
  reach: number
  /** How far above / below a head's line a bracket reaches — for the ink box's band. */
  up: number
  down: number
}

/** Is this line a ledger line's? The same bound `graceRoom` states (line ≤ 0 or ≥ 6). */
const onLedger = (line: number) => line <= 0 || line >= 6

/**
 * ⭐ **Where each bracketed grace BEFORE a target stands** — right to left from the host, as the
 * graces are packed: the last one's right bracket clears the host's leftmost ink by
 * {@link BRACKETED_ROWS}.toMain, each earlier one clears the next by `between`.
 *
 * Inside one: `( ♭● )` — the accidental INSIDE the brackets (B8), the head black (B7). ⚠️ A CHORD's
 * heads share one column and each takes its own pair (Stone p. 76); two heads a SECOND apart are not
 * displaced, and a chord's accidentals are not stacked into columns (each head's sign is measured on
 * its own) — both are for his eye in use.
 *
 * @param hostReach the host's own left ink, full size (`graceRoom.hostLeftReach`).
 */
export function bracketedLayout(list: readonly BracketedGrace[], signOf: SignOf, clef: Clef, hostReach: number): BracketedLayout {
  const places: BracketedPlace[] = []
  let right = -(hostReach + BRACKETED_ROWS.toMain.value)
  let leftEdge = right
  for (let i = list.length - 1; i >= 0; i--) {
    const shape = shapeOf(list[i], signOf, clef)
    const place = placed(shape, right - shape.rightInk)
    places.unshift(place)
    leftEdge = place.left
    right = leftEdge - BRACKETED_ROWS.between.value
  }
  return { places, reach: places.length ? Math.max(0, -leftEdge) : 0, ...band() }
}

/**
 * ⭐ **Where each bracketed grace AFTER its note stands** (P5 — the trill note, a bend's target: every
 * book's case) — LEFT TO RIGHT from the host's right ink ({@link hostRightReach}): the first one's left
 * bracket stands {@link BRACKETED_ROWS}.afterHead past a HEAD, or `afterDot` past a DOT (Gould p. 139: the
 * bracket follows the dot), each later one `between` past the one before.
 * @returns the layout — its `reach` is how far RIGHT of the host's anchor the list's ink reaches.
 */
export function bracketedAfterLayout(list: readonly BracketedGrace[], signOf: SignOf, clef: Clef, host: HostRight): BracketedLayout {
  const places: BracketedPlace[] = []
  let left = host.reach + (host.dotted ? BRACKETED_ROWS.afterDot.value : BRACKETED_ROWS.afterHead.value)
  for (const bracketed of list) {
    const shape = shapeOf(bracketed, signOf, clef)
    const place = placed(shape, left - shape.leftInk)
    places.push(place)
    left = place.right + BRACKETED_ROWS.between.value
  }
  return { places, reach: places.length ? places[places.length - 1].right : 0, ...band() }
}

/** How far RIGHT of its anchor a chord's own ink reaches, and whether that ink is a DOT. */
export interface HostRight {
  reach: number
  dotted: boolean
}

/**
 * ⭐ The HOST's right ink, full size — the column's own rows (`measureColumns.slotInk`): its heads (a
 * displaced second's too), a ledger's overhang, its DOTS, or ⭐ an UP-FLAG (it reaches right of the stem
 * and down to the head: a bracket standing after the head alone ran into it), whichever reaches further.
 * @param upFlag the note DRAWS an up-flag — the beaming rule's answer, which each caller already has
 *   (the column's `flagged` + stem rule; the drawn note's `hasFlag()` + direction).
 */
export function hostRightReach(chord: Chord, clef: Clef, upFlag = false): HostRight {
  const positions = chord.notes.map(p => spellingDiatonicPos(p.step, p.octave)).sort((a, b) => a - b)
  const hasSecond = positions.some((position, i) => i > 0 && position - positions[i - 1] === 1)
  const heads = hasSecond ? INK.secondDisplacement + INK.notehead : INK.notehead
  const ledger = chord.notes.some(p => onLedger(staffLineForSpelling(p.step, p.octave, clef))) ? heads + INK.ledgerRight - INK.notehead : 0
  const dots = dotExtent(chord.dots ?? 0)
  const flag = upFlag ? INK.notehead + INK.flagReach : 0
  return { reach: Math.max(heads, ledger, dots, flag), dotted: dots > 0 && dots >= Math.max(heads, ledger, flag) }
}

/** One bracketed grace's shape, relative to its HEAD's anchor — the same for either side. */
interface Shape {
  bracketed: BracketedGrace
  headWidth: number
  heads: BracketedHead[]
  leftInk: number
  rightInk: number
}

function shapeOf(bracketed: BracketedGrace, signOf: SignOf, clef: Clef): Shape {
  const k = bracketedScale()
  const form = BRACKET_FORMS[state.form]
  const gs = form.fullSize ? 1 : k
  const L = glyphBox(form.left)
  const R = glyphBox(form.right)
  // ⭐ Its OWN head — a half's hollow one is not a quarter's black one (B7 revised).
  const headWidth = noteheadInk(bracketed.duration) * k
  const rightParen = headWidth + form.headGap + R.left * gs
  const rightInk = rightParen + R.right * gs
  let leftInk = 0
  const heads = bracketed.pitches.map((pitch): BracketedHead => {
    const line = staffLineForSpelling(pitch.step, pitch.octave, clef)
    const drawn = signOf(pitch.id)
    const sign = typeof drawn === 'string' ? drawn : null
    const accReach = sign ? accidentalExtent([{ position: spellingDiatonicPos(pitch.step, pitch.octave), sign }]) * k : 0
    const parenInkRight = sign ? -accReach - BRACKETED_ROWS.parenToAccidental.value : -form.headGap
    const leftParen = parenInkRight - L.right * gs
    leftInk = Math.min(leftInk, leftParen - L.left * gs, onLedger(line) ? -INK.ledgerLeft * k : 0)
    return { pitch, line, sign, accidentalX: sign ? -accReach : null, leftParenX: leftParen, rightParenX: rightParen }
  })
  return { bracketed, headWidth, heads, leftInk, rightInk }
}

/** A shape stood with its head's anchor at `headX` (staff spaces from the host's anchor). */
function placed(shape: Shape, headX: number): BracketedPlace {
  return {
    bracketed: shape.bracketed,
    headX,
    headWidth: shape.headWidth,
    heads: shape.heads.map(h => ({
      ...h,
      accidentalX: h.accidentalX === null ? null : headX + h.accidentalX,
      leftParenX: headX + h.leftParenX,
      rightParenX: headX + h.rightParenX,
    })),
    left: headX + shape.leftInk,
    right: headX + shape.rightInk,
  }
}

/** How far above / below a head's line the armed brackets reach. */
function band(): { up: number; down: number } {
  const form = BRACKET_FORMS[state.form]
  const gs = form.fullSize ? 1 : bracketedScale()
  const L = glyphBox(form.left)
  const R = glyphBox(form.right)
  return { up: Math.max(L.up, R.up) * gs, down: Math.max(L.down, R.down) * gs }
}

/** The whole BEFORE side of one slot: its bracketed graces, its grace group, and the bracketed graces
 *  bent INTO its graces (P3). */
export interface BeforeSideLayout {
  /** The slot's OWN bracketed graces, next to it. */
  bracketed: BracketedLayout | null
  /** ⭐ Bracketed graces whose target is a GRACE (P3 — the pre-bend into it), left to right. */
  graceBracketed: { grace: GraceNote; layout: BracketedLayout }[]
  /** The grace group — ONE layout, its places in the group's order, however many runs it was split into. */
  graces: GraceLayout | null
  /** How far LEFT of the host's anchor the side's ink reaches — the `'grace'` box's `left`. */
  reach: number
}

/**
 * ⭐⭐ **THE one answer for a slot's before side** — what `measureColumns.slotInk` reserves and what
 * `GracePass` + `BracketedGracePass` draw at. Walked RIGHT TO LEFT from the host:
 *
 * `[run] (●) [run] (●) M` — the slot's own bracketed graces next to it; then the grace group, SPLIT at
 * every grace that carries bracketed graces (B4: the split is drawn, not stored — `graceBeamRuns` breaks
 * the beam at the same grace), each run laid out by `graceLayout` against whatever stands to its right,
 * and that grace's bracketed graces just left of it. A grace clears a bracket by {@link BRACKETED_ROWS}.toGrace;
 * a bracket clears its target by `toMain`; a run with nothing but the host to its right keeps the grace's
 * own `toMain`.
 */
export function beforeSideLayout(slot: ChordRest, signOf: SignOf, clef: Clef, hostReach: number): BeforeSideLayout {
  // A chord's — or a REST's (B10 reversed): entered first, on an empty bar.
  const own = slot.bracketedBefore?.length ? bracketedLayout(slot.bracketedBefore, signOf, clef, hostReach) : null
  const group = slot.graceBefore
  if (!group) return { bracketed: own, graceBracketed: [], graces: null, reach: own?.reach ?? 0 }

  // Where each run begins: the first grace, and every grace that carries bracketed graces.
  const starts = group.notes.flatMap((note, i) => (i === 0 || note.bracketedBefore?.length ? [i] : []))
  const places: GraceLayout['places'] = []
  const graceBracketed: BeforeSideLayout['graceBracketed'] = []
  let reach = own ? own.reach : hostReach
  let gap: number | undefined = own ? BRACKETED_ROWS.toGrace.value : undefined
  for (let r = starts.length - 1; r >= 0; r--) {
    const from = starts[r]
    const notes = group.notes.slice(from, starts[r + 1] ?? group.notes.length)
    const run = graceLayout({ ...group, notes }, signOf, clef, reach, gap)
    run.places.forEach((place, k) => { places[from + k] = place })
    reach = run.reach
    const lead = notes[0]
    if (lead.bracketedBefore?.length) {
      const layout = bracketedLayout(lead.bracketedBefore, signOf, clef, reach)
      graceBracketed.unshift({ grace: lead, layout })
      reach = layout.reach
      gap = BRACKETED_ROWS.toGrace.value
    } else {
      gap = undefined
    }
  }
  return { bracketed: own, graceBracketed, graces: { places, reach }, reach }
}
