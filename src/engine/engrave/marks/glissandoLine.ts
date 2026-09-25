/**
 * ⭐⭐ **WHERE A GLISSANDO LINE STANDS** — two heads in, one straight stroke out
 * (docs/plans/glissando-plan.md P1, G12 + G13). Pure arithmetic: no DOM, no score.
 *
 * ## ⭐ Every number is a NAMED, SOURCED row — Gould armed, the others beside her
 *
 * His words, 2026-09-25: *"gould is our preset default (but we need other values like in the other
 * projects)"* — so, `layout/dotGap`'s shape: a table of rows, one ARMED, switched from the console
 * (`__gliss`, `dev/glissandoConsole`). ⛔ Never a lone constant.
 *
 * The research is `docs/research/glissando-books-research.md` §0.3 (Gould's plates, measured) and
 * `docs/research/glissando-engines-research.md` §4 (the three engines, from source). The two schools:
 *
 * - **Gould** does NOT join the head centres: each end leans TOWARD the other note (p. 141 (a): the
 *   line's slope 0.72 where the centres' join is 0.59), stands a little clear of the heads, and stops
 *   well short of an accidental on the target.
 * - **The engines** join the head CENTRES, a fixed gap off the ink — MuseScore horizontally,
 *   Verovio and LilyPond along the line itself.
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { staveLineWidthPx } from '@/engine/engrave/staff/staffLines'
import { distanceToInk, type InkRect } from '@/engine/engrave/glyphInkShape'

/** How a row measures its gaps: across the page, or along the slanted line itself. */
export type GapMeasure = 'x' | 'along'

/** One house style's answer to *"where does the line meet a head?"* — staff spaces throughout. */
export interface GlissandoEndRule {
  /** Clear space between the source note's ink (head, dots, ledger) and the line's start. */
  startGap: number
  /** Clear space between the line's end and the target head's ink (head, ledger). */
  endGap: number
  /** Clear space before a target ACCIDENTAL — used instead of {@link endGap} when the target has one. */
  accidentalGap: number
  /**
   * ⭐ What the line does before a target's accidental — Gould p. 141 gives BOTH: *"Stop the line short of
   * an accidental, or angle it to the left of the accidental."*
   * - `truncate` — the line still AIMS AT THE HEAD and is cut short of the sign: carried on, it would
   *   reach the notehead (his report, 2026-09-25: *"if I imaginary continue the line it does not end in
   *   the notehead"*).
   * - `reangle` — it ends at the accidental's left, at the HEAD's height: a different, steeper line.
   * - `slide` — Verovio: truncated, then walked FORWARD along itself in ½-space steps while its end
   *   still clears the sign (below it rising, above it falling), so it may run under the accidental.
   * - `clear` — OURS (his report, 2026-09-25: *"the line empty space is inconsistent"*): aimed at the head,
   *   and it stops {@link accidentalGap} before the point where, carried on, it would touch the sign's REAL
   *   INK (`fonts/glyphOutline`, the font file's outline — *"use ink for measure"*): the space AHEAD of the
   *   line, the same at every angle. Before the outline has loaded: its nearest distance to the box less
   *   the font's cut-outs. `truncate`'s gap is taken in x, so a steep line (still low where it stops)
   *   showed more empty space than a shallow one; this shows the same space at every angle.
   */
  accidental: 'truncate' | 'reangle' | 'slide' | 'clear' | 'clearBox'
  /**
   * ⭐ **Where the ANGLE comes from** — checked against each engine's source, 2026-09-25 (his ask:
   * *"double check all angles"*):
   * - `edges` — from the source head's right edge to the target head's left edge, at their heights (plus
   *   the row's leans). Gould's plates (steeper than the centres' join) and LilyPond's bounds.
   * - `centres` — through the two head CENTRES, then cut back along itself at each end: MuseScore
   *   (`tlayout.cpp`: y shortened in proportion to x) and Verovio (`atan2` of the two positions).
   */
  aim: 'edges' | 'centres'
  /**
   * ⭐ The TARGET HEAD as ink (his idea, 2026-09-25: *"the end target should be the base of the notehead and
   * not the side"*): from the row's own START (fixed — his call), aim at the target head's CENTRE and stop
   * the gap before its REAL OUTLINE — a steep line then arrives under the head, a shallow one at its side.
   * Needs the head's outline (`fonts/glyphOutline`); without it the row falls back to its `aim`.
   */
  headInk?: boolean
  /**
   * ⭐ A NEAR MISS counts too: the line never comes closer than {@link accidentalGap} to the sign's real ink,
   * even when it would pass it by — his flat report, 2026-09-25: a steep line brushed 0.18 sp under a ♭'s
   * bowl, because `clear` only guards what the line runs INTO.
   */
  nearMiss?: boolean
  /**
   * ⭐ Neither END of the line may sit on a staff line — within this many staff spaces of one, the end slides
   * along the line (the start forward, the end back) until it is clear (his report, 2026-09-25: a line
   * started on a staff line and merged into it). LilyPond's `tip-staff-line-clearance` **0.225 sp** — the
   * same rule for a tie's tips (`rendering/curves/tieStaffLineClearance`). Absent = no check.
   */
  lineClearance?: number
  /** How the three gaps are measured. */
  gapMeasure: GapMeasure
  /** How far the START leans off its head's centre TOWARD the target's height. */
  startBias: number
  /** How far the END leans off its head's centre TOWARD the source's height. */
  endBias: number
  /** Two heads at ONE height but different pitches (F → F♯): each end is pushed this far apart so the
   *  line still says which way it goes. */
  sameLineTilt: number
  source: string
}

export const GLISSANDO_END_RULES = {
  /** (Armed until houseBase replaced it, same day.) HIS, 2026-09-25: *"for the default I like gould angle but the empty space should be
   *  shorter, so we need a house preset"*, then *"the empty space is inconsistent"*: Gould's angle, and
   *  before an accidental the `clear` mode — 0.3 sp (the clearance she leaves before a plain HEAD) from the
   *  sign's BOX at every angle. ⚠️ A taste number, his eye's to move (`__gliss.accidentalGap`). */
  house: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.3, accidental: 'clear', aim: 'edges', gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0,
    source: 'his: Gould\'s angle; the line clears an accidental\'s box by her head gap (0.3), at every angle',
  },
  /** `house` with the SIMPLE measure (`clearBox`): the gap to where the line enters the sign's box. To
   *  compare with `house` by eye — `__gliss.end('houseBox')`. */
  houseBox: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.3, accidental: 'clearBox', aim: 'edges', gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0,
    source: 'house, measured to the accidental\'s ink BOX instead of its outline',
  },
  /** `house` + {@link GlissandoEndRule.nearMiss}: a sign the line passes close by stops it too. */
  houseClear: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.3, accidental: 'clear', aim: 'edges', gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0, nearMiss: true,
    source: 'house, and never closer than the gap to an accidental\'s ink (his ♭ report)',
  },
  /** ✅ ARMED — his call, 2026-09-25: *"make houseBase default"*. His idea: `house`'s START, fixed (*"the starting point should be fixed"*); the END aimed at the target
   *  head's CENTRE and stopped the gap before its real ink — a steep line meets the head's base, a shallow
   *  one its side. Accidentals as `house`, ⭐ plus the NEAR-MISS guard (his go, 2026-09-25: a line brushing under a
   *  ♭'s bowl is the stem's and the ledger's fault again). */
  houseBase: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.3, accidental: 'clear', aim: 'edges', gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0, headInk: true, lineClearance: 0.225, nearMiss: true,
    source: 'his: house\'s start; the end aimed at the target head\'s centre, stopped off its ink (side or base)',
  },
  /** Her plate p. 141 (a), measured at 600 dpi: start ≈0.2 sp after the head (after the ledger when there
   *  is one — the right-hand figure), end 0.2–0.45 sp before the target head (0.3 taken, the plate's
   *  middle); start ≈0.25 sp off-centre toward the target, end ≈0.25 toward the source. Before an
   *  accidental: ⭐ MEASURED 2026-09-25, p. 141 *With accidentals*, left figure at 600 dpi (sp = 26.5 px):
   *  the line stops 21 px = **0.79 sp** left of the ♯ (≈0.9 sp to its lower-left corner), still AIMED AT THE
   *  HEAD — carried on it reaches the F♯'s centre. (It was 0.7, read by eye.) Her other figure re-angles
   *  the line right up to the ♯'s corner, gap ≈0 — the `reangle` value. */
  gould: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.8, accidental: 'truncate', aim: 'edges', gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0,
    source: 'Gould p. 141 (a) + With accidentals, plates measured (glissando-books-research §0.3)',
  },
  /** ⭐ SOURCE-CHECKED 2026-09-25 (`tlayout.cpp` ~4990–5070): laid out through the two heads' CENTRES, then
   *  each end cut back along the line (`startOffset.ry() = ipos2.y × startOffset.x / ipos2.x`) to 0.25 sp
   *  (`lineNoteDist`, "TODO: style") off the chord's ink — the accidental included where the line
   *  approaches (the half of the head it comes from). Same-line pitches pushed ±0.25 sp.
   *  ⚠️ Our first row RE-ANGLED here — a misreading, now `truncate`. */
  musescore: {
    startGap: 0.25, endGap: 0.25, accidentalGap: 0.25, accidental: 'truncate', aim: 'centres', gapMeasure: 'x',
    startBias: 0, endBias: 0, sameLineTilt: 0.25,
    source: 'MuseScore tlayout.cpp layoutGlissando: centres, lineNoteDist 0.25',
  },
  /** ⭐ SOURCE-CHECKED 2026-09-25 (`view_control.cpp` ~2170–2215): the angle through the two heads'
   *  positions; each end `radius + unit` (½ sp past the head) along the line; before an accidental, 0.25 sp
   *  (`0.5 × unit`) left of its content, ON the line, then `slide`. ⚠️ Its extra 0.75 sp per dot on a
   *  shallow line is not ported. */
  verovio: {
    startGap: 0.5, endGap: 0.5, accidentalGap: 0.25, accidental: 'slide', aim: 'centres', gapMeasure: 'along',
    startBias: 0, endBias: 0, sameLineTilt: 0,
    source: 'Verovio view_control.cpp DrawGliss: centres, 0.5 along, 0.25 before an accidental, slide',
  },
  /** ⭐ SOURCE-CHECKED 2026-09-25 (`line-spanner.cc` ~160–230, `define-grobs.scm` Glissando): X from the
   *  source head's RIGHT edge to the target head's LEFT edge (`attach-dir`), Y at each head's centre;
   *  `end-on-accidental #t` moves the end X to the accidental's left edge at the SAME Y — a re-angle;
   *  `padding` 0.5 sp at each end along the line. */
  lilypond: {
    startGap: 0.5, endGap: 0.5, accidentalGap: 0.5, accidental: 'reangle', aim: 'edges', gapMeasure: 'along',
    startBias: 0, endBias: 0, sameLineTilt: 0,
    source: 'LilyPond line-spanner.cc + Glissando bound-details: edges, end-on-accidental, padding 0.5',
  },
} as const satisfies Record<string, GlissandoEndRule>

export type GlissandoEndRuleName = keyof typeof GLISSANDO_END_RULES

/** A line's weight — either a number of staff spaces, or "a staff line's", whatever the staff draws at. */
export interface GlissandoThicknessRule {
  spaces: number | 'staffLine'
  source: string
}

export const GLISSANDO_THICKNESS_RULES = {
  /** ✅ ARMED. Her plates measure 0.11–0.12 sp against a 3 px staff line — the staff line's own weight,
   *  so it follows the staff's (`staffLines.staveLineWidthPx`, 0.11 sp under Bravura). */
  gould: { spaces: 'staffLine', source: 'Gould pp. 141–142, measured 0.11–0.12 sp' },
  musescore: { spaces: 0.15, source: 'MuseScore glissandoLineWidth (styledef.cpp)' },
  verovio: { spaces: 0.15, source: 'Verovio 1.5 × stemWidth' },
  lilypond: { spaces: 0.1, source: 'LilyPond line-thickness' },
} as const satisfies Record<string, GlissandoThicknessRule>

export type GlissandoThicknessRuleName = keyof typeof GLISSANDO_THICKNESS_RULES

/**
 * ⭐ **WHEN THE HEADS ARE TOO CLOSE FOR THE LINE'S OWN GAPS** — a squeezed bar (his rule, 2026-09-25: the
 * spacing's minimum *"should not avoid the user to make it shorter"*), so a shorter line must still show.
 */
export interface GlissandoSqueezeRule {
  /** The least share of the room between the two inks the LINE keeps — its gaps give up the rest.
   *  0 = the gaps never give way: a line that does not fit is not drawn. */
  lineShare: number
  source: string
}

export const GLISSANDO_SQUEEZE_RULES = {
  /** ✅ ARMED. ⚠️ OURS — no source states it: the gaps shrink, in proportion, until the line keeps at
   *  least half the room between the inks. A row, so his eye can move it. */
  shrinkGaps: { lineShare: 0.5, source: 'ours (no source) — the gaps give way, the line keeps half the room' },
  /** What P1 drew: the gaps hold, and a line with no room left is not drawn at all. */
  vanish: { lineShare: 0, source: 'P1\'s behaviour — no room, no line' },
} as const satisfies Record<string, GlissandoSqueezeRule>

export type GlissandoSqueezeRuleName = keyof typeof GLISSANDO_SQUEEZE_RULES

/** What ships. */
export const ACTIVE_GLISSANDO_END_RULE: GlissandoEndRuleName = 'houseBase'
export const ACTIVE_GLISSANDO_THICKNESS_RULE: GlissandoThicknessRuleName = 'gould'
export const ACTIVE_GLISSANDO_SQUEEZE_RULE: GlissandoSqueezeRuleName = 'shrinkGaps'

const state: {
  end: GlissandoEndRuleName; thickness: GlissandoThicknessRuleName; squeeze: GlissandoSqueezeRuleName; generation: number
} = {
  end: ACTIVE_GLISSANDO_END_RULE, thickness: ACTIVE_GLISSANDO_THICKNESS_RULE, squeeze: ACTIVE_GLISSANDO_SQUEEZE_RULE, generation: 0,
}

export function armedGlissandoEndRule(): GlissandoEndRule {
  const row = GLISSANDO_END_RULES[state.end]
  return accidentalGapOverride === null ? row : { ...row, accidentalGap: accidentalGapOverride }
}

/** ⚠️ HIS EYE'S KNOB (2026-09-25, *"still too much space between the end of the line and the accidental"*):
 *  the stop before an accidental, in staff spaces, over whatever row is armed. null = the row's own. */
let accidentalGapOverride: number | null = null

export function setGlissandoAccidentalGap(spaces: number | null): boolean {
  if (spaces !== null && !(Number.isFinite(spaces) && spaces >= 0)) return false
  accidentalGapOverride = spaces
  state.generation++
  return true
}

export function glissandoAccidentalGapOverride(): number | null {
  return accidentalGapOverride
}

/** The armed weight in staff spaces. */
export function glissandoThicknessSpaces(): number {
  const spaces = GLISSANDO_THICKNESS_RULES[state.thickness].spaces
  return spaces === 'staffLine' ? staveLineWidthPx() / STAFF_SPACE_PX : spaces
}

export function armedGlissandoSqueezeRule(): GlissandoSqueezeRule {
  return GLISSANDO_SQUEEZE_RULES[state.squeeze]
}

export function glissandoSettings(): {
  end: GlissandoEndRuleName; thickness: GlissandoThicknessRuleName; squeeze: GlissandoSqueezeRuleName; generation: number
} {
  return { ...state }
}

/** 🚨 In `layout/widthRowGenerations` — ⛔ not a width, but a re-arm must redraw (the `dotTie` precedent). */
export function glissandoGeneration(): number {
  return state.generation
}

/** Arm a row. ⛔ An unknown name is REFUSED, never ignored — a typo that seemed to work is the worst instrument. */
export function setGlissandoEndRule(rule: GlissandoEndRuleName): boolean {
  if (!(rule in GLISSANDO_END_RULES)) return false
  state.end = rule
  state.generation++
  return true
}

export function setGlissandoThicknessRule(rule: GlissandoThicknessRuleName): boolean {
  if (!(rule in GLISSANDO_THICKNESS_RULES)) return false
  state.thickness = rule
  state.generation++
  return true
}

export function setGlissandoSqueezeRule(rule: GlissandoSqueezeRuleName): boolean {
  if (!(rule in GLISSANDO_SQUEEZE_RULES)) return false
  state.squeeze = rule
  state.generation++
  return true
}

/** Back to what shipped. */
export function resetGlissandoRules(): void {
  accidentalGapOverride = null
  state.end = ACTIVE_GLISSANDO_END_RULE
  state.thickness = ACTIVE_GLISSANDO_THICKNESS_RULE
  state.squeeze = ACTIVE_GLISSANDO_SQUEEZE_RULE
  state.generation++
}

// ==================== The geometry ====================

/** The source note, as the line leaves it — px, in the space it is drawn in. */
export interface GlissandoFrom {
  /** The head's centre height. */
  y: number
  /** The rightmost ink the line must clear: the head, its dots, its ledger line. */
  inkRightX: number
  /** The head's own centre — where a `centres` row aims from. Absent = the ink's edge. */
  centreX?: number
  /** The head's REAL outline, px, y DOWN — for a `headInk` row. */
  headOutline?: Outline
  /** The note has a stem, and it hangs DOWN (from the head's left) — then a rising line may leave from the
   *  head's top; a stem UP stands on the side a rising line would leave from. */
  hasStem?: boolean
  stemDown?: boolean
  /** The note's own LEDGER LINES (px, y DOWN): each a horizontal stroke — a `headInk` row keeps the gap from
   *  them (Gould p. 141 (a): the line starts where the ledger line ends). */
  ledgers?: ReadonlyArray<Ledger>
  /** The y of each line of this note's own staff (px) — for {@link GlissandoEndRule.lineClearance}. */
  staffLines?: ReadonlyArray<number>
}

/** The target note, as the line arrives — px. */
export interface GlissandoTo {
  y: number
  /** The leftmost ink of the HEAD the line must clear: the head, its ledger line. */
  inkLeftX: number
  /** The head's own centre — where a `centres` row aims to. Absent = the ink's edge. */
  centreX?: number
  /** The head's REAL outline, px, y DOWN — for a `headInk` row. */
  headOutline?: Outline
  /** The note's STEM, when it has one: its x and the y span it covers (y DOWN) — a `headInk` row keeps its
   *  line off it (his report: a steep line to a stem-DOWN note came up through the stem). */
  stem?: { x: number; top: number; bottom: number }
  /** The note's own LEDGER LINES — the line ends the gap clear of them (his report, 2026-09-25: the end
   *  touched a ledger line; ⚠️ the books show only the START side, Gould p. 141 (a) — the end is by symmetry). */
  ledgers?: ReadonlyArray<Ledger>
  /** The y of each line of this note's own staff (px) — for {@link GlissandoEndRule.lineClearance}. */
  staffLines?: ReadonlyArray<number>
  /** The target head's accidental's left edge, when it has one. */
  accidentalLeftX?: number
  /** …and its top and bottom (y grows DOWN), for a `slide` row. */
  accidentalTopY?: number
  accidentalBottomY?: number
  /** ⭐ …and its INK as a shape (`engrave/glyphInkShape` — the drawn box less the font's cut-outs), for a
   *  `clear` row. Absent = the box above. */
  accidentalInk?: readonly InkRect[]
  /** ⭐⭐ …and its REAL OUTLINE, px, y DOWN (`fonts/glyphOutline` — read from the font file): what a
   *  `clear` row measures against when it has it. Absent until the face has loaded. */
  accidentalOutline?: Outline
}

/** A ledger line on the page: its height and its two ends, px. */
export interface Ledger { y: number; left: number; right: number }

/** A glyph's real outline on the page: contours of `[x, y]` px, y DOWN. */
export type Outline = ReadonlyArray<ReadonlyArray<readonly [number, number]>>

/** A straight stroke, px. */
export interface GlissandoStroke {
  x1: number
  y1: number
  x2: number
  y2: number
}

/**
 * ⭐ The stroke from one head to the next, under `rule`. `space` is the staff space in px; `rising` is
 * the PITCH direction (+1 up, −1 down, 0 unison) — it only matters when both heads stand at one height.
 *
 * Three steps: the AIM (a line through two points, `rule.aim` + the leans), the ENDS (cut back along that
 * line by the gaps), and the ACCIDENTAL (`rule.accidental`). Squeezed, the gaps give way (`squeeze`).
 *
 * @returns null when there is no room for a line at all.
 */
export function glissandoStroke(
  from: GlissandoFrom,
  to: GlissandoTo,
  space: number,
  rising: -1 | 0 | 1,
  rule: GlissandoEndRule = armedGlissandoEndRule(),
  squeeze: GlissandoSqueezeRule = armedGlissandoSqueezeRule(),
): GlissandoStroke | null {
  let y1 = from.y
  let y2 = to.y
  const dy = y2 - y1
  if (Math.abs(dy) < 1e-6) {
    // One height, two pitches: push the ends apart so the line still says which way (y grows DOWN).
    const tilt = rule.sameLineTilt * space * rising
    y1 += tilt
    y2 -= tilt
  } else {
    // Lean each end toward the other note — ⛔ never so far that the two leans cross.
    const toward = Math.sign(dy)
    const lean = Math.min(1, Math.abs(dy) / ((rule.startBias + rule.endBias) * space || Infinity))
    y1 += toward * rule.startBias * space * lean
    y2 -= toward * rule.endBias * space * lean
  }

  const sign = to.accidentalLeftX
  const reangle = sign !== undefined && rule.accidental === 'reangle'
  // The ink the line must stop short of, and by how much.
  const endInkX = reangle ? sign : to.inkLeftX
  if (endInkX - from.inkRightX <= 0) return null
  let startGap = rule.startGap * space
  let endGap = (reangle ? rule.accidentalGap : rule.endGap) * space
  let signGap = rule.accidentalGap * space

  // ⭐ Squeezed: the gaps give way, in proportion, so the line keeps its share of the room.
  const room = (sign ?? endInkX) - from.inkRightX
  const lead = startGap + (sign !== undefined ? signGap : endGap)
  if (squeeze.lineShare > 0 && room > 0 && lead > room * (1 - squeeze.lineShare)) {
    const f = (room * (1 - squeeze.lineShare)) / lead
    startGap *= f
    endGap *= f
    signGap *= f
  }

  // The AIM: two points the line runs through. ⭐ For `edges` measured across the page (Gould's plates)
  // they ARE the ends: her leans were measured at the line's own start and end, gaps already taken.
  const centres = rule.aim === 'centres'
  const edgesX = !centres && rule.gapMeasure === 'x'
  const p = {
    x: centres ? from.centreX ?? from.inkRightX : edgesX ? from.inkRightX + startGap : from.inkRightX, y: y1,
  }
  const q = {
    x: centres && !reangle ? to.centreX ?? endInkX : edgesX ? endInkX - endGap : endInkX, y: y2,
  }
  if (q.x <= p.x) return null
  const len = Math.hypot(q.x - p.x, q.y - p.y)
  const ux = (q.x - p.x) / len
  const uy = (q.y - p.y) / len
  const at = (x: number) => ({ x, y: p.y + (q.y - p.y) * ((x - p.x) / (q.x - p.x)) })
  const along = (d: number) => ({ x: p.x + ux * d, y: p.y + uy * d })

  // The ENDS, cut back along the aim.
  const start = edgesX ? { x: p.x, y: p.y } : rule.gapMeasure === 'x'
    ? at(from.inkRightX + startGap)
    : along(Math.max(0, (from.inkRightX - p.x) / ux) + startGap)
  let end = edgesX ? { x: q.x, y: q.y } : rule.gapMeasure === 'x'
    ? at(endInkX - endGap)
    : along(len - Math.max(0, (q.x - endInkX) / ux) - endGap)

  // ⭐ The START on a `headInk` row (his calls, 2026-09-25): *"when stem down the beginning point is the top of
  //   the note (contrary at base on stem up)"* and *"we need a transition while the angle is changing"*. The
  //   line leaves the source head's REAL outline in its OWN direction (toward the target head's centre), plus
  //   the gap — so a shallow line leaves from the side, a steep one from the top, and every angle between from
  //   between: continuous, no threshold. ⛔ Except a RISING line from a stem-UP note: its stem stands on that
  //   side of the head, so it keeps the row's own start (the one he approved).
  const stemUpRising = !from.stemDown && from.hasStem === true && y2 < from.y
  if (rule.headInk && !stemUpRising && from.headOutline && from.centreX !== undefined && to.centreX !== undefined) {
    const c1 = { x: from.centreX, y: from.y }
    const dist = Math.hypot(to.centreX - c1.x, to.y - c1.y)
    if (dist > 0) {
      const vx = (to.centreX - c1.x) / dist, vy = (to.y - c1.y) / dist
      const out = lastCrossing(c1, vx, vy, from.headOutline)
      if (out !== null) {
        start.x = c1.x + vx * (out + startGap)
        start.y = c1.y + vy * (out + startGap)
      }
    }
  }

  // ⭐ The TARGET HEAD as ink (`headInk`, his idea): the START stays where the row puts it (his call — *"the
  //   starting point should be fixed"*); the line aims from there at the target head's CENTRE and stops the
  //   gap before that head's real outline — the side for a shallow line, the base for a steep one.
  if (rule.headInk && to.headOutline && to.centreX !== undefined) {
    const c2 = { x: to.centreX, y: to.y }
    const d = Math.hypot(c2.x - start.x, c2.y - start.y)
    if (d > 0) {
      const vx = (c2.x - start.x) / d, vy = (c2.y - start.y) / d
      const reach = firstCrossing(c2, -vx, -vy, to.headOutline)
      if (reach !== null) {
        const b = d - reach - endGap
        if (b <= 0) return null
        const candidate = { x: start.x + vx * b, y: start.y + vy * b }
        // ⭐ …unless the target's own STEM stands in that path — or the line would come within the gap of it
        //   (his report: flipped stem-down, the line ended touching the stem): a stem-DOWN note hangs its stem
        //   from the head's left, so the line then arrives at the SIDE, as the row's own end does.
        if (!crossesStem(start, candidate, to.stem) && !nearStem(start, candidate, to.stem, endGap)) {
          end = candidate
          // Re-express the aim for what follows (the accidental reads `at`).
          p.x = start.x; p.y = start.y; q.x = c2.x; q.y = c2.y
        }
      }
    }
  }

  // ⭐ LEDGER LINES (`headInk`): the line keeps the gap from both notes' own ledgers — the end pulled back,
  //   the start pushed on, along the line.
  if (rule.headInk) {
    if (to.ledgers?.length) end = clearOfLedgers(start, end, to.ledgers, endGap, space)
    if (from.ledgers?.length) {
      const pushed = clearOfLedgers(end, start, from.ledgers, startGap, space)
      start.x = pushed.x; start.y = pushed.y
    }
  }

  // The ACCIDENTAL: cut short of it, on the same line — and a `slide` walks forward while it clears.
  const headEnd = end
  if (sign !== undefined && !reangle) {
    const cutX = sign - signGap
    if (end.x > cutX) end = at(cutX)
    if (rule.accidental === 'slide' && to.accidentalTopY !== undefined && to.accidentalBottomY !== undefined) {
      end = slideUnder(end, { ux, uy }, to, space, rising, at(endInkX - endGap).x)
    }
    if (rule.accidental === 'clearBox' && to.accidentalTopY !== undefined && to.accidentalBottomY !== undefined) {
      const box: Array<readonly [number, number]> = [
        [sign, to.accidentalTopY], [to.inkLeftX, to.accidentalTopY], [to.inkLeftX, to.accidentalBottomY], [sign, to.accidentalBottomY],
      ]
      end = aheadOf(start, headEnd, [box], signGap)
    }
    if (rule.accidental === 'clear' && to.accidentalOutline) {
      end = aheadOf(start, headEnd, to.accidentalOutline, signGap)
    } else if (rule.accidental === 'clear' && to.accidentalTopY !== undefined && to.accidentalBottomY !== undefined) {
      // The outline has not loaded yet: the box less the font's cut-outs, for this one render.
      const ink = to.accidentalInk ?? [{ left: sign, top: to.accidentalTopY, bottom: to.accidentalBottomY, right: to.inkLeftX }]
      end = clearOf(start, headEnd, ink, signGap, space)
    }
  }

  // ⭐ A near miss (`nearMiss`): walk the line and stop where it first comes within the gap of the sign.
  if (rule.nearMiss && to.accidentalOutline) end = nearMissStop(start, end, to.accidentalOutline, signGap, space)

  // ⭐ Neither end on a staff line (`lineClearance`): each slides along the line until it is clear.
  if (rule.lineClearance) {
    const clear = rule.lineClearance * space
    if (to.staffLines?.length) end = offLines(end, start, to.staffLines, clear, space)
    if (from.staffLines?.length) {
      const moved = offLines(start, end, from.staffLines, clear, space)
      start.x = moved.x; start.y = moved.y
    }
  }

  const stroke = { x1: start.x, y1: start.y, x2: end.x, y2: end.y }
  return stroke.x2 > stroke.x1 ? stroke : null
}

/**
 * An end at `at`, moved toward `other` along the line in 1/50-space steps until it is at least `clear` from
 * every staff line — at most one space's worth, and ⛔ never past halfway: a line lying ALONG a staff line
 * cannot be cleared by sliding, and is left as it was.
 */
function offLines(
  at: { x: number; y: number },
  other: { x: number; y: number },
  lines: ReadonlyArray<number>,
  clear: number,
  space: number,
): { x: number; y: number } {
  const onLine = (y: number) => lines.some(l => Math.abs(y - l) < clear)
  if (!onLine(at.y)) return at
  const len = Math.hypot(other.x - at.x, other.y - at.y)
  const reach = Math.min(space, len / 2)
  const step = space / 50
  for (let d = step; d <= reach; d += step) {
    const p = { x: at.x + ((other.x - at.x) / len) * d, y: at.y + ((other.y - at.y) / len) * d }
    if (!onLine(p.y)) return p
  }
  return at
}

/** Does the segment `a`→`b` cross a stem (a vertical stroke at `x` from `top` to `bottom`)? */
function crossesStem(
  a: { x: number; y: number },
  b: { x: number; y: number },
  stem: { x: number; top: number; bottom: number } | undefined,
): boolean {
  if (!stem || (a.x - stem.x) * (b.x - stem.x) > 0 || a.x === b.x) return false
  const y = a.y + (b.y - a.y) * ((stem.x - a.x) / (b.x - a.x))
  return y >= stem.top && y <= stem.bottom
}

/**
 * Walking from `from` toward `to` in 1/50-space steps, the last point still at least `gap` from every ledger
 * line — so the end of the line that is `to` stops clear of them. `from` itself is kept whatever it touches.
 */
function clearOfLedgers(
  from: { x: number; y: number },
  to: { x: number; y: number },
  ledgers: ReadonlyArray<Ledger>,
  gap: number,
  space: number,
): { x: number; y: number } {
  const len = Math.hypot(to.x - from.x, to.y - from.y)
  const steps = Math.max(1, Math.ceil(len / (space / 50)))
  const near = (x: number, y: number) => ledgers.some(l =>
    Math.hypot(Math.max(l.left - x, 0, x - l.right), y - l.y) < gap)
  let best = from
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = from.x + (to.x - from.x) * t
    const y = from.y + (to.y - from.y) * t
    if (near(x, y)) break
    best = { x, y }
  }
  return best
}

/** Does the segment `a`→`b` come within `gap` of a stem (a vertical stroke at `x` from `top` to `bottom`)? */
function nearStem(
  a: { x: number; y: number },
  b: { x: number; y: number },
  stem: { x: number; top: number; bottom: number } | undefined,
  gap: number,
): boolean {
  if (!stem) return false
  const steps = 64
  for (let i = 0; i <= steps; i++) {
    const x = a.x + (b.x - a.x) * (i / steps)
    const y = a.y + (b.y - a.y) * (i / steps)
    const dy = Math.max(stem.top - y, 0, y - stem.bottom)
    if (Math.hypot(x - stem.x, dy) < gap) return true
  }
  return false
}

/** The LAST crossing of the ray `from + t·(vx, vy)` with an outline — where it leaves the ink for good. */
function lastCrossing(from: { x: number; y: number }, vx: number, vy: number, outline: Outline): number | null {
  let best = -Infinity
  for (const contour of outline) {
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, ay] = contour[j]
      const [bx, by] = contour[i]
      const ex = bx - ax, ey = by - ay
      const denom = vx * ey - vy * ex
      if (Math.abs(denom) < 1e-12) continue
      const t = ((ax - from.x) * ey - (ay - from.y) * ex) / denom
      const u = ((ax - from.x) * vy - (ay - from.y) * vx) / denom
      if (t >= 0 && u >= 0 && u <= 1 && t > best) best = t
    }
  }
  return best === -Infinity ? null : best
}

/** The first crossing, at distance t ≥ 0, of the ray `from + t·(vx, vy)` with an outline's edges — null if none. */
function firstCrossing(from: { x: number; y: number }, vx: number, vy: number, outline: Outline): number | null {
  let best = Infinity
  for (const contour of outline) {
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, ay] = contour[j]
      const [bx, by] = contour[i]
      const ex = bx - ax, ey = by - ay
      const denom = vx * ey - vy * ex
      if (Math.abs(denom) < 1e-12) continue
      const t = ((ax - from.x) * ey - (ay - from.y) * ex) / denom
      const u = ((ax - from.x) * vy - (ay - from.y) * vx) / denom
      if (t >= 0 && u >= 0 && u <= 1 && t < best) best = t
    }
  }
  return best === Infinity ? null : best
}

/** The distance from a point to an outline's nearest edge, px. */
function distanceToOutline(x: number, y: number, outline: Outline): number {
  let best = Infinity
  for (const contour of outline) {
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, ay] = contour[j]
      const [bx, by] = contour[i]
      const dx = bx - ax, dy = by - ay
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    }
  }
  return best
}

/** Walking from `start` to `end` in 1/50-space steps, the last point still at least `gap` from the outline. */
function nearMissStop(
  start: { x: number; y: number },
  end: { x: number; y: number },
  outline: Outline,
  gap: number,
  space: number,
): { x: number; y: number } {
  const len = Math.hypot(end.x - start.x, end.y - start.y)
  const steps = Math.max(1, Math.ceil(len / (space / 50)))
  let best = start
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = start.x + (end.x - start.x) * t
    const y = start.y + (end.y - start.y) * t
    if (distanceToOutline(x, y, outline) < gap) break
    best = { x, y }
  }
  return best
}

/**
 * ⭐⭐ `clear`, against the REAL OUTLINE: the line stops `gap` before the point where, carried on in its own
 * direction, it would first touch the sign's ink — the space the eye reads AHEAD of the line, the same at
 * every angle (his report, 2026-09-25; measured on Bravura's sharp, whose left side is a comb that each
 * angle meets at a different tooth). A line that would pass the sign by stops where it would have: at
 * `headEnd`, the gap before the head.
 */
function aheadOf(
  start: { x: number; y: number },
  headEnd: { x: number; y: number },
  outline: ReadonlyArray<ReadonlyArray<readonly [number, number]>>,
  gap: number,
): { x: number; y: number } {
  const len = Math.hypot(headEnd.x - start.x, headEnd.y - start.y)
  if (len <= 0) return start
  const ux = (headEnd.x - start.x) / len
  const uy = (headEnd.y - start.y) / len
  // The first crossing of the ray start + t·u with any edge of the outline.
  let hit = Infinity
  for (const contour of outline) {
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const [ax, ay] = contour[j]
      const [bx, by] = contour[i]
      const ex = bx - ax, ey = by - ay
      const denom = ux * ey - uy * ex
      if (Math.abs(denom) < 1e-12) continue
      const t = ((ax - start.x) * ey - (ay - start.y) * ex) / denom
      const s = ((ax - start.x) * uy - (ay - start.y) * ux) / denom
      if (t >= 0 && s >= 0 && s <= 1 && t < hit) hit = t
    }
  }
  const stop = Math.min(len, Math.max(0, hit - gap))
  return { x: start.x + ux * stop, y: start.y + uy * stop }
}

/**
 * ⭐ `clear` without the outline (before the face loads): the furthest point on the line from `start` toward `headEnd` whose DISTANCE to the sign's INK
 * (`engrave/glyphInkShape`) is still at least `gap` — found by walking the line in steps of 1/50 of a
 * space from the start (the line only ever closes on the sign). The same visible space at every angle.
 */
function clearOf(
  start: { x: number; y: number },
  headEnd: { x: number; y: number },
  ink: readonly InkRect[],
  gap: number,
  space: number,
): { x: number; y: number } {
  const len = Math.hypot(headEnd.x - start.x, headEnd.y - start.y)
  if (len <= 0) return start
  const steps = Math.max(1, Math.ceil(len / (space / 50)))
  let best = start
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const x = start.x + (headEnd.x - start.x) * t
    const y = start.y + (headEnd.y - start.y) * t
    if (distanceToInk(x, y, ink) < gap) break
    best = { x, y }
  }
  return best
}

/**
 * ⭐ Verovio's slide (`view_control.cpp` DrawGliss), in our y-down coordinates: from the stop before the
 * accidental, step ½ a space along the line while the end — widened by ¼ space × the line's slope, its
 * own allowance — still clears the sign: BELOW its bottom when rising, ABOVE its top when falling.
 * ⚠️ Ported as it is: the loop steps and THEN re-tests, so it may end on the first step that no longer
 * clears. ⛔ Never past the head's own gap (a guard of ours: a flat sign could otherwise let it run on).
 */
function slideUnder(
  end: { x: number; y: number },
  dir: { ux: number; uy: number },
  to: GlissandoTo,
  space: number,
  rising: -1 | 0 | 1,
  limitX: number,
): { x: number; y: number } {
  const step = space / 2
  const allowance = (space / 4) * Math.abs(dir.uy)
  const clears = (y: number) => rising >= 0 ? y - allowance > to.accidentalBottomY! : y + allowance < to.accidentalTopY!
  let current = end
  for (let guard = 0; guard < 64 && clears(current.y); guard++) {
    const next = { x: current.x + dir.ux * step, y: current.y + dir.uy * step }
    if (next.x > limitX) break
    current = next
  }
  return current
}

// ==================== Across a system break (P2) ====================

/**
 * ⭐ **HOW A GLISSANDO CROSSES A SYSTEM BREAK** — two pieces, the target never restated (Gould p. 142;
 * every engine). What differs is the SLOPE, and it is where the sources split (plan G7a):
 *
 * - `wholeInterval` — Gould: *"Reflect the correct interval of a glissando in the gradient of the line"*.
 *   EACH piece runs from the source's height to the target's, so the two slopes differ. Drawing one
 *   straight line cut in two is her WRONG example. Measured p. 142: the first piece stops 0.5 sp before
 *   the barline, the second starts ≈1 sp after the clef.
 * - `continuous` — MuseScore (`tlayout.cpp` one slope `yTot / xTot` over the summed segments) and LilyPond
 *   (when a break is allowed at all): ONE line, cut at the break.
 *
 * ⏳ Verovio's (each piece at HALF the angle) is not ported.
 */
export interface GlissandoBreakRule {
  slope: 'wholeInterval' | 'continuous'
  /** Clear space between the first piece's end and the system's closing barline, staff spaces. */
  beforeBarline: number
  /** Clear space between the new system's header ink (clef, key, meter) and the second piece. */
  afterHeader: number
  source: string
}

export const GLISSANDO_BREAK_RULES = {
  /** ✅ ARMED (his call, 2026-09-25: Gould is the preset). */
  gould: { slope: 'wholeInterval', beforeBarline: 0.5, afterHeader: 1.0, source: 'Gould p. 142, measured (books research §0.3)' },
  /** ⚠️ The break gaps are the engines' own edges (`endingXForOpenEndedLines`, `firstNoteRestSegmentX`) —
   *  not measured here: Gould's 0.5 / 1.0 stand in for them. The SLOPE is theirs. */
  musescore: { slope: 'continuous', beforeBarline: 0.5, afterHeader: 1.0, source: 'MuseScore one slope over the segments (engines research §1); gaps Gould\'s' },
} as const satisfies Record<string, GlissandoBreakRule>

export type GlissandoBreakRuleName = keyof typeof GLISSANDO_BREAK_RULES
export const ACTIVE_GLISSANDO_BREAK_RULE: GlissandoBreakRuleName = 'gould'

const breakState: { rule: GlissandoBreakRuleName } = { rule: ACTIVE_GLISSANDO_BREAK_RULE }

export function armedGlissandoBreakRule(): GlissandoBreakRule {
  return GLISSANDO_BREAK_RULES[breakState.rule]
}

export function glissandoBreakSettings(): { rule: GlissandoBreakRuleName } {
  return { ...breakState }
}

export function setGlissandoBreakRule(rule: GlissandoBreakRuleName): boolean {
  if (!(rule in GLISSANDO_BREAK_RULES)) return false
  breakState.rule = rule
  state.generation++
  return true
}

export function resetGlissandoBreakRule(): void {
  breakState.rule = ACTIVE_GLISSANDO_BREAK_RULE
  state.generation++
}

/** Where the two systems stand — px, each in its own staff's space. */
export interface GlissandoBreak {
  /** The TOP staff line of the source's staff on the first system, and of the target's on the second. */
  fromTopY: number
  toTopY: number
  /** The barline that ends the first system. */
  barlineX: number
  /** Where the header's ink ends on the second system. */
  headerInkX: number
}

/**
 * ⭐ The two pieces of a glissando whose target opens (or sits on) the next system. Heights move between
 * systems by STAFF POSITION: a pitch drawn 1½ spaces below the top line on one system is 1½ below on the
 * other. Either piece may be null when its system has no room for it.
 */
export function glissandoPieces(
  from: GlissandoFrom,
  to: GlissandoTo,
  edges: GlissandoBreak,
  space: number,
  rising: -1 | 0 | 1,
  rule: GlissandoEndRule = armedGlissandoEndRule(),
  breakRule: GlissandoBreakRule = armedGlissandoBreakRule(),
  squeeze: GlissandoSqueezeRule = armedGlissandoSqueezeRule(),
): [GlissandoStroke | null, GlissandoStroke | null] {
  const toOnFirst = to.y - edges.toTopY + edges.fromTopY
  const fromOnSecond = from.y - edges.fromTopY + edges.toTopY
  // The break's edges stand in for a head: the barline's gap replaces the END gap, the header's the START gap.
  const firstRule: GlissandoEndRule = { ...rule, endGap: breakRule.beforeBarline, gapMeasure: 'x' }
  const secondRule: GlissandoEndRule = { ...rule, startGap: breakRule.afterHeader, gapMeasure: 'x' }

  if (breakRule.slope === 'wholeInterval') {
    return [
      glissandoStroke(from, { y: toOnFirst, inkLeftX: edges.barlineX }, space, rising, firstRule, squeeze),
      glissandoStroke({ y: fromOnSecond, inkRightX: edges.headerInkX }, to, space, rising, secondRule, squeeze),
    ]
  }

  // ONE line: lay the second system's header ink against the first system's barline, draw it whole, and
  // cut out what falls between `beforeBarline` short of the barline and `afterHeader` past the header.
  const dx = edges.barlineX - edges.headerInkX
  const dy = edges.fromTopY - edges.toTopY
  const whole = glissandoStroke(
    from,
    { y: to.y + dy, inkLeftX: to.inkLeftX + dx, ...(to.accidentalLeftX !== undefined && { accidentalLeftX: to.accidentalLeftX + dx }) },
    space, rising, rule, squeeze,
  )
  if (!whole) return [null, null]
  const cutFirst = edges.barlineX - breakRule.beforeBarline * space
  const cutSecond = edges.barlineX + breakRule.afterHeader * space
  const yAt = (x: number) => whole.y1 + (whole.y2 - whole.y1) * ((x - whole.x1) / (whole.x2 - whole.x1))
  const first = cutFirst > whole.x1 ? { x1: whole.x1, y1: whole.y1, x2: cutFirst, y2: yAt(cutFirst) } : null
  const second = whole.x2 > cutSecond
    ? { x1: cutSecond - dx, y1: yAt(cutSecond) - dy, x2: whole.x2 - dx, y2: whole.y2 - dy }
    : null
  return [first, second]
}

// ==================== A free end (P3) ====================

/**
 * ⭐ **HOW FAR A FREE END REACHES** — a line into nothing (a fall, a doit, a bend) or out of nothing (a scoop, a
 * lift, a plop). Its DIRECTION is the model's (`Glissando.direction` — meaning); how far it is drawn is these
 * rows' (presentation). Staff spaces: `across` the page, `rise` up or down (plan G11).
 */
export interface GlissandoFreeEndRule {
  across: number
  rise: number
  /** The clear space kept between the free tip and whatever stands next (the note or rest after an
   *  `after` line, before a `before` one) — asked of the spacing, so a free line never reads as reaching it. */
  clearance: number
  source: string
}

export const GLISSANDO_FREE_END_RULES = {
  /** ✅ ARMED. ⭐ MEASURED 2026-09-25, Gould p. 411 (c), 600 dpi (sp = 26.8 px): a line from a B♭ into empty
   *  space runs 3.9 sp across and rises 1.5; one toward a rest 3.7 × 1.2 — taken as 3.8 × 1.3. */
  gould: { across: 3.8, rise: 1.3, clearance: 0.6, source: 'Gould p. 411 (c), two free lines measured; the one toward a rest stops 0.6 sp before it' },
  /** `ChordLine`'s default: 1.2 sp across × 1 sp (`tlayout.cpp` ~1660–1683). Clearance: Gould's (MuseScore's
   *  chord line is not spaced for at all). */
  musescore: { across: 1.2, rise: 1.0, clearance: 0.6, source: 'MuseScore ChordLine default (engines research §4)' },
  /** Ross p. 210 SHORT gliss: ≈1.1 sp of rise at ≈55–60° ⇒ ≈0.7 across (read, not measured). */
  rossShort: { across: 0.7, rise: 1.1, clearance: 0.6, source: 'Ross p. 210, SHORT (read)' },
  /** Ross p. 210 LONG gliss: ≈3.2 sp of rise at the same angle ⇒ ≈2.0 across (read, not measured). */
  rossLong: { across: 2.0, rise: 3.2, clearance: 0.6, source: 'Ross p. 210, LONG (read)' },
} as const satisfies Record<string, GlissandoFreeEndRule>

export type GlissandoFreeEndRuleName = keyof typeof GLISSANDO_FREE_END_RULES
export const ACTIVE_GLISSANDO_FREE_END_RULE: GlissandoFreeEndRuleName = 'gould'
const freeState: { rule: GlissandoFreeEndRuleName } = { rule: ACTIVE_GLISSANDO_FREE_END_RULE }

export function armedGlissandoFreeEnd(): GlissandoFreeEndRule {
  return GLISSANDO_FREE_END_RULES[freeState.rule]
}

export function glissandoFreeEndSettings(): { rule: GlissandoFreeEndRuleName } {
  return { ...freeState }
}

export function setGlissandoFreeEndRule(rule: GlissandoFreeEndRuleName): boolean {
  if (!(rule in GLISSANDO_FREE_END_RULES)) return false
  freeState.rule = rule
  state.generation++
  return true
}

export function resetGlissandoFreeEndRule(): void {
  freeState.rule = ACTIVE_GLISSANDO_FREE_END_RULE
  state.generation++
}

/**
 * ⭐ A line with ONE free end, drawn by {@link glissandoStroke} itself against a VIRTUAL partner — a bare point
 * with no ink — so every rule the armed row keeps at its real end (the head, its accidental, its stem, its
 * ledgers, the staff lines) still holds there:
 *
 * - `'after'` — the line LEAVES `note` and runs to a point `across` to the right and `rise` up or down;
 * - `'before'` — it comes FROM a point `across` to the left and `rise` below (rising into the note) or above.
 *
 * `note` is the anchor as a source (`after`) or as a target (`before`); `limitX` clamps an `after` end short of
 * the system's barline.
 */
export function glissandoFreeStroke(
  side: 'after' | 'before',
  note: GlissandoFrom & GlissandoTo,
  direction: 'up' | 'down',
  space: number,
  free: GlissandoFreeEndRule = armedGlissandoFreeEnd(),
  limitX = Infinity,
): GlissandoStroke | null {
  const across = free.across * space
  // y grows DOWN: a rising line ends higher (after) or starts lower (before).
  const dy = free.rise * space * (direction === 'up' ? -1 : 1)
  const rule = armedGlissandoEndRule()
  if (side === 'after') {
    const x = Math.min(note.inkRightX + rule.startGap * space + across, limitX)
    const point = { y: note.y + dy, inkLeftX: x, centreX: x }
    return glissandoStroke(note, point, space, direction === 'up' ? 1 : -1, { ...rule, endGap: 0, endBias: 0 })
  }
  const x = (note.accidentalLeftX ?? note.inkLeftX) - rule.endGap * space - across
  const point = { y: note.y - dy, inkRightX: x, centreX: x }
  return glissandoStroke(point, note, space, direction === 'up' ? 1 : -1, { ...rule, startGap: 0, startBias: 0 })
}