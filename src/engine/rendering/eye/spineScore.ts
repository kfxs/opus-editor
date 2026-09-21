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
 * - The header is the PAGE's, per bar (`./spineHeader`): clef · key signature · meter at the staff's
 *   head, and the small clef / key change / new meter wherever one changes. A bar's notes stand on
 *   the clef its bar OPENS with (⛔ not yet a clef change in the MIDDLE of a bar).
 * - Every boundary carries the score's own SIGN (`models/boundarySign`): plain, final, either repeat,
 *   the back-to-back `:||:`, wings — painted by the page's `paintBarlineSign` in a block.
 * - Beamed groups are one block each (`./spineStaff.drawBeamedBlock`); WHERE a column stands is the
 *   page's spacing asked for one justified line (`./spineSpacing`).
 * - ⛔ No ties, slurs, tuplet marks, dynamics or hairpins — the port map is
 *   `docs/plans/bent-staff-plan.md` §5.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio } from '@/engine/engrave/staff/staffSpine'
import { HEADER_TO_REPEAT, barlineSignExtent } from '@/engine/layout/barlineSign'
import { signAtBoundary } from '@/engine/models/boundarySign'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { keyStaffId, staffMeasureView } from '@/engine/models/staffContent'
import type { Score } from '@/types/music'
import { resolveStaffClefs } from '@/utils/clefUtils'
import { fracToNumber } from '@/utils/fraction'
import { resolveStaffKeys } from '@/utils/keySignature'
import { voiceOf } from '@/utils/lanes'
import { getMeterInfo } from '@/utils/meter'
import { createStaveNotesFromSlots } from '../engraved/NoteBuilder'
import { boundaryWinged } from '../staff/BarlineRenderer'
import { buildBeams } from '../beams/beamGroups'
import type { EngravedNote } from '../engraved/EngravedNote'
import { deepestInkPx, spaceBarsOnSpine } from './spineSpacing'
import { drawSpineBarHeader, spineBarHeader } from './spineHeader'
import { drawBeamedBlock, drawNoteBlock, drawSpineBarline, drawSpineStaffLines } from './spineStaff'

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
  const staffClefs = resolveStaffClefs(score, staffId)
  const staffKeys = resolveStaffKeys(score, staffId)
  const clefs = staffClefs.opening
  const keys = staffKeys.opening

  // ⭐ The staff's HEAD is bar 1's own header (`./spineHeader`), so the music starts where the spine
  //    does: the header's room is in bar 1's lead-in, as a change's is in its own bar's.
  const musicStart = 0
  const musicEnd = spine.length - (spine.closed ? CLOSED_SEAM_PX : 0)
  // ⭐ WHERE each column stands is the PAGE's spacing, asked for one endless line (`./spineSpacing`):
  //    the spine is ONE JUSTIFIED SYSTEM — a circle's length is fixed by its radius, and an open
  //    spine's last barline closes its staff lines, as a line's does on the page. Whoever makes the
  //    spine sizes it from `naturalSpineLength`, so the stretch stays small.
  // ⭐ …spaced on the arc where the DEEPEST ink stands — a loop's inside is shorter than its spine.
  const bars = spaceBarsOnSpine(score, musicStart, musicEnd, true, innerLengthRatio(spine, deepestInkPx(score)))
  score.measures.forEach((measure, i) => {
    const bar = bars[i]
    // The clef, key signature and meter this bar draws — the staff's head, or a CHANGE (`./spineHeader`).
    const header = spineBarHeader(score, staffClefs, staffKeys, i)
    const headerEnd = header ? drawSpineBarHeader(ctx, spine, bar.start, header) : bar.start
    const lane = staffMeasureView(measure, staffId, score)
    const clef = clefs.get(measure.number) ?? 'treble'
    const voices = [...new Set(lane.slots.map(voiceOf))].sort()
    for (const voice of voices) {
      const slots = lane.slots
        .filter(slot => voiceOf(slot) === voice)
        .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      const forcedStem = voices.length > 1 ? (voice % 2 === 0 ? 1 : -1) : undefined
      const notes = createStaveNotesFromSlots(slots, clef, forcedStem, 0, keys.get(measure.number))
      const at = slots.map(slot => {
        // A whole-bar rest stands in the MIDDLE of its bar, as on the page.
        return slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
      })
      // ⭐ WHICH notes beam together is the PAGE's answer (`beams/beamGroups`) — asked BEFORE any
      //    note is formatted, so a beamed note reserves no room for a flag it will not draw.
      //    ⚠️ A group holding a FAN gets no `Beam` there (the page draws it by hand): its notes stay
      //    lone blocks here until fans are ported (plan §5 row 10).
      const { beams } = buildBeams(notes, slots, getMeterInfo(measure.timeSignature), () => clef, forcedStem)
      const beamed = new Set<EngravedNote>()
      for (const beam of beams) {
        for (const note of beam.notes) beamed.add(note)
        drawBeamedBlock(ctx, spine, beam.notes, beam, beam.notes.map(note => at[notes.indexOf(note)]))
      }
      notes.forEach((note, n) => { if (!beamed.has(note)) drawNoteBlock(ctx, spine, note, at[n]) })
    }
    // ⭐ WHICH sign a boundary carries is the SCORE's answer (`models/boundarySign`) — final, either
    //    repeat, the back-to-back `:||:` from the two bars that meet there — as on the page.
    // ⚠️ The spine is ONE system, so the only opening edge is bar 1's: a `|:` there stands at the
    //    bar's own start (its room is in the lead-in, `./spineSpacing`).
    // ⭐ A `|:` on a bar that draws a HEADER stands AFTER it (Gould p. 234, the page's
    //    `displacedRepeatX`), and the boundary behind it keeps the sign the bar before it ends with.
    if (measure.repeatStart !== undefined && (i === 0 || header)) {
      const at = header ? headerEnd + (HEADER_TO_REPEAT + barlineSignExtent('repeatStart').left) * STAFF_SPACE_PX : bar.start
      drawSpineBarline(ctx, spine, at, 'repeatStart', boundaryWinged(undefined, measure))
    }
    const next = score.measures[i + 1]
    const nextDisplaced = next?.repeatStart !== undefined && spineBarHeader(score, staffClefs, staffKeys, i + 1) !== undefined
    const kind = signAtBoundary(measure, nextDisplaced ? { ...next, repeatStart: undefined } : next)
    if (kind) drawSpineBarline(ctx, spine, bar.end, kind, boundaryWinged(measure, nextDisplaced ? undefined : next))
  })
}
