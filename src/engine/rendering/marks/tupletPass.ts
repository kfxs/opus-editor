/**
 * ⭐ **THE TUPLET PASS** — what the renderer does with a bar's tuplets once its notes are formatted and its
 * beams built: the FORMAT applied (`tupletBracketed` · `tupletMarkRuns` · `tupletBracketEnd`), the inner-flip
 * nudge, ⭐ the HAND's vertical nudge (`TupletOffsetOverride`), the draw, and the hit box registered off the
 * drawn geometry. Moved out of `ScoreRenderer.drawAndRegisterTuplets` unchanged (2026-09-25), for the hand
 * offset: the hub was at its ceiling, and a pass this size is a module (`CLAUDE.md`).
 */
import type { Measure, Score, Tuplet } from '@/types/music'
import { fracToNumber } from '@/utils/fraction'
import { tupletBracketEnd, tupletBracketed, tupletMarkRuns } from '@/utils/musicUtils'
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { ElementRegistry, TupletGeometry } from '@/engine/ElementRegistry'
import { tupletOffsetOverrideOf } from '@/engine/models/engravingOverrides'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { EngravedNote } from '../engraved/EngravedNote'
import type { EngravedStave } from '../engraved/EngravedStave'
import { innerFlipTupletYOffset, type TupletNoteStem } from '../engraved/NoteBuilder'
import type { ScoreTuplet } from '../engraved/ScoreTuplet'
import { barFrame } from '../staff/staveFrame'
import { noteRuler } from '../engraved/noteRuler'

/** What the pass needs of the renderer. */
export interface TupletPassContext {
  context: DrawContext
  registry: ElementRegistry
  /** Each drawn tuplet by id — the selection highlight recolours its own group through this. */
  tupletObjectMap: Map<string, ScoreTuplet>
  score: Score
}

export function drawAndRegisterTuplets(
ctx: TupletPassContext,
  scoreTuplets: ScoreTuplet[],
  tupletStaveNoteMap: Map<string, { staveNotes: EngravedNote[]; tuplet: Tuplet; voice: number }>,
  measure: Measure,
  multiVoice: boolean,
  /** Every voice's notes, in engraved order — for finding what follows a tuplet. */
  voiceNotes: Map<number, EngravedNote[]>,
  stave: EngravedStave,
): void {
  /**
   * Where the bracket's right end goes, or undefined to leave it at the last notehead.
   *
   * `division` — the default — ends the bracket where the group's TIME ends, which on a formatted
   * stave is where the next note was placed: the formatter has already turned "the end of this
   * duration" into an x, and reading it back is more honest than re-deriving it from beats. Nothing
   * following in this voice means the group runs to the end of the bar, so the bracket does too.
   *
   * `beforeNext` stops a little short of that note, which is the same line with a gap in it.
   */
  const BRACKET_END_GAP = 6
  const bracketEndX = (tupletData: Tuplet, voice: number, lastNote: EngravedNote): number | undefined => {
    const mode = tupletBracketEnd(tupletData)
    if (mode === 'lastNote') return undefined
    const lane = voiceNotes.get(voice) ?? []
    const next = lane[lane.indexOf(lastNote) + 1]
    if (!next) return barFrame(stave).noteEndX - BRACKET_END_GAP
    return mode === 'division' ? noteRuler(next).originX : noteRuler(next).originX - BRACKET_END_GAP
  }

  for (const scoreTuplet of scoreTuplets) {
    try {
      const tupletNotes = scoreTuplet.getNotes() as EngravedNote[]
      if (tupletNotes.length === 0) continue

      for (const [tupletId, { staveNotes: tStaveNotes, tuplet: tupletData, voice }] of tupletStaveNoteMap) {
        if (!tStaveNotes.includes(tupletNotes[0])) continue

        const vt = scoreTuplet
        const notes = vt.getNotes()
        const firstNote = notes?.[0]
        const lastNote = notes?.[notes.length - 1]
        if (!firstNote || !lastNote) break

        const location = (vt.options?.location ?? 1) as 1 | -1

        // THE FORMAT, applied — the first two of its three fields (bracketEnd still to come).
        //
        // Both answers come from the model via a resolver, never from the field: a tuplet that
        // stores no format is the ordinary case, and "absent" is an instruction (engrave by the
        // rules), not a gap. `Ctrl+3` and the dialog therefore arrive at the same code.
        //
        // The bracket's rule needs the beams, which is why this is here and not at construction:
        // `hasBeam()` only answers once the Beam objects exist. VexFlow's own default happens to be
        // the same rule; we state it ourselves so the model's `always`/`never` can override it and
        // so the rule lives in one place we own.
        const beamed = notes.every(n => n.hasBeam?.() ?? false)
        const bracketed = tupletBracketed(tupletData, beamed)
        vt.options.bracketed = bracketed

        // The MARK is ours, not VexFlow's: it can print a bare number or a ratio, but not "ratio +
        // note" and not nothing at all, and its automatic choice is a heuristic we replaced
        // (autoNumberStyle). Same string the GHOST draws — one function, so a preview cannot
        // promise a mark the page will not print.
        // The bar's meter and the group's start go WITH the mark: with no stored style the rule is
        // "a bare number when the meter already says what it is in the time of", so the same
        // tuplet prints `2` in 6/8 and `2:3` in 4/4 — and the ghost, asking the same function with
        // the hovered bar, showed exactly that before the click.
        scoreTuplet.setMarkRuns(
          tupletMarkRuns(tupletData, tupletData.numberStyle, {
            meter: measure.timeSignature,
            beat: tupletData.startBeat,
          }),
        )

        // …and where the bracket stops. Only meaningful with a bracket, but set either way: an
        // unbracketed tuplet's width still centres the number, and a number that drifted when the
        // bracket was switched off would be a second rule nobody asked for.
        scoreTuplet.bracketEndX = bracketed ? bracketEndX(tupletData, voice, lastNote) : undefined

        // A bracket flipped to the INNER side (toward the other voice) would be shoved
        // to the far edge of the system by VexFlow's staff-edge clamp; nudge it back
        // next to its own notes via yOffset. Must be set BEFORE draw(), which reads it.
        const stems: TupletNoteStem[] = notes.map(n => {
          const ext = (n.getStemExtents?.() ?? { topY: 0, baseY: 0 }) as { topY: number; baseY: number }
          return { stemUp: n.getStemDirection?.() === 1, topY: ext.topY, baseY: ext.baseY }
        })
        const flipOffset = innerFlipTupletYOffset(
          stems, location, voice, multiVoice, scoreTuplet.getYPosition()
        )
        if (flipOffset !== 0) vt.options.yOffset = (vt.options.yOffset ?? 0) + flipOffset
    // ⭐ The HAND's vertical nudge (`TupletOffsetOverride`, staff spaces, + is DOWN — his ask, 2026-09-25:
    //    ↑/↓ on a selected tuplet, `Ctrl+Backspace` resets, a Properties box). Added to the engraver's
    //    own y the way the inner-flip nudge is, BEFORE draw(), which reads it — so the bracket, its
    //    number and the registered hit box all move together.
    const hand = tupletOffsetOverrideOf(ctx.score, tupletId)?.y ?? 0
    if (hand !== 0) vt.options.yOffset = (vt.options.yOffset ?? 0) + hand * STAFF_SPACE_PX

        scoreTuplet.draw(ctx.context)

        // Use VexFlow's OWN post-draw geometry so the registered hit-box matches the
        // drawn bracket exactly. VexFlow draws the horizontal bracket line at
        // getYPosition(), the legs hanging toward the notes (length location*10), and
        // the number on the outer side. Our previous stem-extent estimate (fixed
        // gap/height) drifted off the real bracket — badly in multi-voice / flipped
        // tuplets, where VexFlow anchors a top bracket above the whole system.
        const bracketPadding = 5
        const xStart = bracketed ? noteRuler(firstNote).tieLeftX - bracketPadding : noteRuler(firstNote).stemX
        // The END is read back off the tuplet, not recomputed from the last note: with a
        // `division` or `beforeNext` bracket the line runs PAST that note, and a hit-box measured
        // from the notehead would stop where the ink does not. `width` is what draw() just used.
        const xEnd = xStart + scoreTuplet.width
        const tupletWidth = xEnd - xStart

        const bracketLineY = scoreTuplet.getYPosition() // the horizontal bracket line
        const bracketLegLength = 10
        const numberHeight = scoreTuplet.markHeight()
        // The number sits on the outer side of the line, the legs hang inward. Cover
        // both (plus a little padding) so a click anywhere on the visible bracket or
        // its number registers.
        const vPad = 6
        const bboxY = location === 1
          ? bracketLineY - numberHeight - vPad
          : bracketLineY - bracketLegLength - vPad
        const bboxHeight = numberHeight + bracketLegLength + 2 * vPad

        const tupletGeometry: TupletGeometry = {
          x: xStart,
          y: bracketLineY,
          width: tupletWidth,
          bracketed,
          location,
          bracketLegLength,
          bracketThickness: 1,
          bracketPadding,
          notationCenterX: xStart + tupletWidth / 2,
          textYOffset: vt.options?.textYOffset ?? 0,
          yOffset: vt.options?.yOffset ?? 0,
        }

        ctx.registry.add({
          type: 'tuplet',
          tupletId,
          measure: measure.number,
          startBeat: fracToNumber(tupletData.startBeat),
          numNotes: tupletData.numNotes,
          bbox: { x: xStart, y: bboxY, width: tupletWidth, height: bboxHeight },
          tupletGeometry,
        })
        // Keep the VexFlow Tuplet so its own SVG group can be recolored for selection
        // (avoids a document-wide scan that bleeds into neighbouring systems).
        ctx.tupletObjectMap.set(tupletId, scoreTuplet)
        break
      }
    } catch (_e) {
      // Drawing or getBoundingBox may fail
    }
  }
}
