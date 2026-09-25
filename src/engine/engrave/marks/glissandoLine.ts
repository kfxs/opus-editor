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
  /** ✅ ARMED. Her plate p. 141 (a), measured at 600 dpi: start ≈0.2 sp after the head (after the ledger
   *  when there is one — the right-hand figure), end 0.2–0.45 sp before the target head (0.3 taken, the
   *  plate's middle); start ≈0.25 sp off-centre toward the target, end ≈0.25 toward the source. Before
   *  an accidental she stops ≈0.7 sp short (read off the plate; her other drawing re-angles the line
   *  to the accidental's corner instead — a later row). */
  gould: {
    startGap: 0.2, endGap: 0.3, accidentalGap: 0.7, gapMeasure: 'x',
    startBias: 0.25, endBias: 0.25, sameLineTilt: 0,
    source: 'Gould p. 141 (a), plates measured (glissando-books-research §0.3)',
  },
  /** Head centres; 0.25 sp off the chord's ink either side (`lineNoteDist`, "TODO: style"), same-line
   *  pitches pushed ±0.25 sp. ⚠️ It clears an accidental only where the line would hit it — here it is
   *  always cleared, which at head-centre height is where the line would hit it anyway. */
  musescore: {
    startGap: 0.25, endGap: 0.25, accidentalGap: 0.25, gapMeasure: 'x',
    startBias: 0, endBias: 0, sameLineTilt: 0.25,
    source: 'MuseScore glissando.cpp lineNoteDist / vertOffset (glissando-engines-research §1)',
  },
  /** Head centres; 0.5 sp off the heads ALONG the line; 0.25 sp before an accidental (then slid forward
   *  while it clears — ⏳ not ported, the stop is kept). ⚠️ Its extra 0.75 sp per dot on a shallow line
   *  is not ported either. */
  verovio: {
    startGap: 0.5, endGap: 0.5, accidentalGap: 0.25, gapMeasure: 'along',
    startBias: 0, endBias: 0, sameLineTilt: 0,
    source: 'Verovio view_control.cpp DrawGliss (glissando-engines-research §2)',
  },
  /** Head centres; `padding` 0.5 sp at each end, measured ALONG the line; `end-on-accidental` ends at
   *  the accidental's left edge, padded the same. */
  lilypond: {
    startGap: 0.5, endGap: 0.5, accidentalGap: 0.5, gapMeasure: 'along',
    startBias: 0, endBias: 0, sameLineTilt: 0,
    source: 'LilyPond Glissando padding / end-on-accidental (glissando-engines-research §3)',
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
export const ACTIVE_GLISSANDO_END_RULE: GlissandoEndRuleName = 'gould'
export const ACTIVE_GLISSANDO_THICKNESS_RULE: GlissandoThicknessRuleName = 'gould'
export const ACTIVE_GLISSANDO_SQUEEZE_RULE: GlissandoSqueezeRuleName = 'shrinkGaps'

const state: {
  end: GlissandoEndRuleName; thickness: GlissandoThicknessRuleName; squeeze: GlissandoSqueezeRuleName; generation: number
} = {
  end: ACTIVE_GLISSANDO_END_RULE, thickness: ACTIVE_GLISSANDO_THICKNESS_RULE, squeeze: ACTIVE_GLISSANDO_SQUEEZE_RULE, generation: 0,
}

export function armedGlissandoEndRule(): GlissandoEndRule {
  return GLISSANDO_END_RULES[state.end]
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
}

/** The target note, as the line arrives — px. */
export interface GlissandoTo {
  y: number
  /** The leftmost ink of the HEAD the line must clear: the head, its ledger line. */
  inkLeftX: number
  /** The target head's accidental's left edge, when it has one. */
  accidentalLeftX?: number
}

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
 * @returns null when the gaps leave no line to draw (the two heads are too close) — ⏳ Gould p. 141
 *   then moves the line above or below the notes, a later rule.
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

  const endX = to.accidentalLeftX ?? to.inkLeftX
  let endGap = (to.accidentalLeftX !== undefined ? rule.accidentalGap : rule.endGap) * space
  let startGap = rule.startGap * space

  // The room the gaps and the line share — across the page, or along the line, as the row measures.
  const dx = endX - from.inkRightX
  if (dx <= 0) return null
  const room = rule.gapMeasure === 'x' ? dx : Math.hypot(dx, y2 - y1)
  // ⭐ Squeezed: the gaps give way, in proportion, so the line keeps its share of the room.
  const gaps = startGap + endGap
  if (squeeze.lineShare > 0 && gaps > room * (1 - squeeze.lineShare)) {
    const f = (room * (1 - squeeze.lineShare)) / gaps
    startGap *= f
    endGap *= f
  }

  let stroke: GlissandoStroke
  if (rule.gapMeasure === 'x') {
    stroke = { x1: from.inkRightX + startGap, y1, x2: endX - endGap, y2 }
  } else {
    const len = room
    if (len <= startGap + endGap) return null
    const ux = dx / len
    const uy = (y2 - y1) / len
    stroke = {
      x1: from.inkRightX + ux * startGap, y1: y1 + uy * startGap,
      x2: endX - ux * endGap, y2: y2 - uy * endGap,
    }
  }
  return stroke.x2 > stroke.x1 ? stroke : null
}
