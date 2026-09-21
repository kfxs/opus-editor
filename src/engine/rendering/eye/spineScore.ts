/**
 * ⭐⭐ **THE SCORE, ON A SPINE** (`docs/plans/bent-staff-plan.md` — the bridge from A to B): what is
 * drawn on the path is READ FROM THE SCORE MODEL, so an edit to the score is an edit to the circle.
 *
 * ⭐ **The notes are the score's own.** Each bar's slots go through `engraved/NoteBuilder` — the builder
 * the page uses — so a chord, a rest, an accidental under the bar's key, a dot, an articulation and a
 * stem direction are decided by the page's rules, ⛔ not re-decided here. Each built note is then ONE
 * rigid block (`./spineStaff.drawNoteBlock`).
 *
 * ## ⚠️ What this reads, and what it does not — yet
 *
 * - The FIRST staff only, every voice of it (two voices take the page's up/down stems).
 * - The header is bar 1's clef and meter; a bar's notes stand on the clef its bar OPENS with.
 * - Every boundary is a PLAIN barline — the last one too (⛔ not yet the final bar's thin-thick sign).
 * - ⛔ No beams (an eighth wears its flag), ties, slurs, tuplet marks, dynamics, hairpins or mid-score
 *   header changes. Each is one of plan B's steps, and a beamed group is one BLOCK when it comes.
 *
 * ## ⚠️ The spacing is TIME, ⛔ not the page's spacing rule
 *
 * After the header the spine is shared by the bars in proportion to their length in time, and a slot
 * stands at its beat's share of its bar. That is a placeholder with a name: the page's rule
 * (`layout/spacing` — ink-aware springs) measured ALONG the spine is plan B §4.7's question.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { keyStaffId, staffMeasureView } from '@/engine/models/staffContent'
import type { Score } from '@/types/music'
import { resolveStaffClefs } from '@/utils/clefUtils'
import { fracToNumber } from '@/utils/fraction'
import { resolveStaffKeys } from '@/utils/keySignature'
import { voiceOf } from '@/utils/lanes'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { createStaveNotesFromSlots } from '../engraved/NoteBuilder'
import { thinBarlinePx } from '../staff/barlineInk'
import { drawNoteBlock, drawSpineBarline, drawSpineHeader, drawSpineStaffLines } from './spineStaff'

/** Clear spine after the header, and after each barline, before the first beat. Changeable defaults. */
const HEADER_TO_BAR_PX = 12
const BAR_LEAD_IN_PX = 22

/**
 * ⭐ On a CLOSED spine the music stops this far short of where it began, so the LAST barline stands
 * clear in front of the clef — ⛔ not on top of it, which is where `s = length` is. A changeable default.
 */
const CLOSED_SEAM_PX = 16

/** Draw `score`'s first staff along the whole of `spine`. */
export function drawScoreOnSpine(ctx: DrawContext, score: Score, spine: Spine): void {
  drawSpineStaffLines(ctx, spine)
  const first = score.measures[0]
  if (!first) return

  const staffId = keyStaffId(score, 0)
  const clefs = resolveStaffClefs(score, staffId).opening
  const keys = resolveStaffKeys(score, staffId).opening
  const headerEnd = drawSpineHeader(ctx, spine, 0, {
    clef: clefs.get(first.number) ?? 'treble',
    meter: first.timeSignature,
  })

  const capacities = score.measures.map(m => fracToNumber(measureCapacityFrac(m)))
  const totalTime = capacities.reduce((a, b) => a + b, 0)
  if (totalTime <= 0) return
  const musicStart = headerEnd + HEADER_TO_BAR_PX
  const musicEnd = spine.length - (spine.closed ? CLOSED_SEAM_PX : 0)
  const pxPerQuarter = (musicEnd - musicStart) / totalTime

  let barStart = musicStart
  score.measures.forEach((measure, i) => {
    const barLength = capacities[i] * pxPerQuarter
    const lane = staffMeasureView(measure, staffId, score)
    const clef = clefs.get(measure.number) ?? 'treble'
    const voices = [...new Set(lane.slots.map(voiceOf))].sort()
    for (const voice of voices) {
      const slots = lane.slots
        .filter(slot => voiceOf(slot) === voice)
        .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      const forcedStem = voices.length > 1 ? (voice % 2 === 0 ? 1 : -1) : undefined
      const notes = createStaveNotesFromSlots(slots, clef, forcedStem, 0, keys.get(measure.number))
      notes.forEach((note, n) => {
        const slot = slots[n]
        // A whole-bar rest stands in the MIDDLE of its bar, as on the page.
        const share = slot.type === 'rest' && slot.isMeasureRest ? 0.5 : fracToNumber(slot.beat) / capacities[i]
        drawNoteBlock(ctx, spine, note, barStart + BAR_LEAD_IN_PX + share * (barLength - BAR_LEAD_IN_PX))
      })
    }
    barStart += barLength
    drawSpineBarline(ctx, spine, barStart, thinBarlinePx())
  })
}
