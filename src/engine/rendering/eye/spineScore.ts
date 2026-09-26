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
 * - The FIRST staff only, every voice of it (two voices take the page's up/down stems). ⭐ A bar is BUILT whole
 *   first; with more than one voice the page's column pass runs over all of them together (the voice rule, dots
 *   and accidentals stacked across a beat) and the page's re-assert follows (`format/voiceIntent`); a
 *   multi-voice rest stands where the page puts it (`engraved/restShift`) — port map #11.
 * - The header is the PAGE's, per bar (`./spineHeader`): clef · key signature · meter at the staff's
 *   head, and the small clef / key change / new meter wherever one changes. A bar's notes stand on
 *   the clef its bar OPENS with (⛔ not yet a clef change in the MIDDLE of a bar).
 * - Every boundary carries the score's own SIGN (`models/boundarySign`): plain, final, either repeat,
 *   the back-to-back `:||:`, wings — painted by the page's `paintBarlineSign` in a block.
 * - ⭐ A GROUP is one block (`./spineStaff.drawGroupBlock`): the notes a beam joins, the notes a TUPLET
 *   joins, and any run those two overlap into — one block, its beams and its tuplet marks drawn inside
 *   (port map #5, #8). The tuplet is the page's own `ScoreTuplet`, built by the page's rules: its side
 *   (`resolveTupletLocation`), its bracket (`tupletBracketed` — none where a beam already shows the
 *   group), its mark (`tupletMarkRuns`, meter-aware) and where its bracket ends (`tupletBracketEnd`).
 *   WHERE a column stands is the page's spacing asked for one justified line (`./spineSpacing`).
 * - ⭐ TIES and SLURS (port map #13, `./spineCurves`): re-solved in the path's plane with the page's rules,
 *   their ink bent through `pointAt` (`engrave/curves/curveOnPath`) — the auto arch, no obstacles yet.
 * - ⭐ GRACES, bracketed graces and a parenthesised head's BRACKETS (port map #21–#23): the page's `GracePass`,
 *   one note at a time, inside that note's block. A slur can start or end on a grace (its recorded anchor).
 * - ⭐ FANNED BEAMS (port map #29): the page's `FanPass`, inside the block — a lone fan in its note's, a fan
 *   JOINED to a group in that group's. Solved in distance ALONG the path, each member then moved to the path's
 *   own point at its own depth and turned there, like a note. ⛔ Not yet: a fan across a barline.
 * - ⚠️ KNOWN ISSUE (plan §6.1): a long group's END stems lean against the lines by `≈ L / 2R` — his proposed
 *   fix (stems take a share of the local turn) is recorded, not built.
 * - ⭐ DYNAMICS, expression words and TEMPO marks (port map #16, `./spineMarks`): the page's lines, asked
 *   with the spine's columns; each mark a rigid block on its lane. ⛔ No hairpins yet (#15).
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { innerLengthRatio } from '@/engine/engrave/staff/staffSpine'
import { HEADER_TO_REPEAT, barlineSignExtent } from '@/engine/layout/barlineSign'
import { signAtBoundary } from '@/engine/models/boundarySign'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { keyStaffId, staffMeasureView } from '@/engine/models/staffContent'
import type { ChordRest, Measure, Score } from '@/types/music'
import { resolveStaffClefs } from '@/utils/clefUtils'
import { fracToNumber } from '@/utils/fraction'
import { resolveStaffKeys } from '@/utils/keySignature'
import { voiceOf } from '@/utils/lanes'
import { getMeterInfo } from '@/utils/meter'
import { createStaveNotesFromSlots, resolveTupletLocation, stemMajorityTupletLocation } from '../engraved/NoteBuilder'
import { ScoreTuplet } from '../engraved/ScoreTuplet'
import { staveFrame, staveOf } from '../staff/staveFrame'
import { noteRuler } from '../engraved/noteRuler'
import { drawGraceNotes } from '../GracePass'
import { gracePitchesOf } from '@/utils/graceNotes'
import type { FanPassContext } from '../RenderPass'
import { applyFanStemStretch, drawFannedBeams, type FanJoin } from '../beams/FanPass'
import { INK } from '@/engine/layout/spacingPadding'
import { ElementRegistry } from '@/engine/ElementRegistry'
import { tupletYOffsetPx } from '../marks/tupletPass'
import { restShiftResolver } from '../engraved/restShift'
import { BarVoice } from '../format/barVoice'
import { formatColumns } from '../format/columnFormat'
import { attachModifierColumns } from '../format/modifierColumns'
import { captureVoiceIntent, reassertVoiceIntent } from '../format/voiceIntent'
import { tupletBracketEnd, tupletBracketed, tupletMarkRuns } from '@/utils/musicUtils'
import { boundaryWinged } from '../staff/BarlineRenderer'
import { buildBeams } from '../beams/beamGroups'
import type { EngravedNote } from '../engraved/EngravedNote'
import { deepestInkPx, spaceBarsOnSpine } from './spineSpacing'
import { drawSpineBarHeader, spineBarHeader, spineHeaderMeterAt } from './spineHeader'
import { drawSpineMarks, type SpineMarkBar } from './spineMarks'
import { type BlockFrame, type WithNote, drawGroupBlock, drawNoteBlock, drawSpineBarline, drawSpineStaffLines, type GroupBlockInk, type SpineNotePlace } from './spineStaff'
import { drawSpineCurves, type SpinePitchPlace } from './spineCurves'

/**
 * ⭐ On a CLOSED spine the music stops this far short of where it began, so the LAST barline stands
 * clear in front of the clef — ⛔ not on top of it, which is where `s = length` is. A changeable default.
 */
const CLOSED_SEAM_PX = 16

/** The width the shared column pass formats a bar into — only its MODIFIER answers survive (the blocks
 *  set every column's x themselves), so the number is a stand-in, not a choice. */
const SHARED_COLUMN_FORMAT_PX = 400

/** ⭐ The page's `BRACKET_END_GAP` (`ScoreRenderer`, a `beforeNext` bracket stops this short of the next note), px
 *  along the spine. ⚠️ A copy of a private literal; the page's is the source. */
const BRACKET_END_GAP_PX = 6

/**
 * ⭐ The GROUPS a voice's notes fall into — the notes each beam joins and the notes each tuplet joins, merged
 * wherever they overlap (a beamed triplet is one group; a beam across two tuplets, one group with two marks).
 * Returns each note's group index; a note in no group is a group of its own.
 */
function groupNotes(count: number, joins: readonly (readonly number[])[]): number[] {
  const parent = Array.from({ length: count }, (_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (const join of joins) for (const i of join.slice(1)) parent[find(join[0])] = find(i)
  return parent.map((_, i) => find(i))
}

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
  // ⭐ Where every PITCH landed on the path — what the curves (`./spineCurves`) are drawn between.
  const pitches = new Map<string, SpinePitchPlace>()
  const remember = (places: readonly SpineNotePlace[], slots: readonly ChordRest[], measureNumber: number) => {
    places.forEach((place, i) => {
      const slot = slots[i]
      if (slot?.type !== 'chord') return
      slot.notes.forEach((pitch, headIndex) => pitches.set(pitch.id, { place, headIndex, measureNumber }))
    })
  }
  const markBars: SpineMarkBar[] = []
  // What the page's grace and fan passes use of a render — this surface, a registry and maps of the spine's
  // own (⚠️ thrown away: the panel is not clicked into yet, §9), and each bar's columns AS THE SPINE SPACED
  // THEM (filled per bar below — where a fan's members spread).
  const pagePass: FanPassContext = {
    context: ctx, score, elementRegistry: new ElementRegistry(), fanMemberGroupMap: new Map(), fanMemberAnchorMap: new Map(),
    solvedColumns: new Map(),
  }
  score.measures.forEach((measure, i) => {
    const bar = bars[i]
    // The clef, key signature and meter this bar draws — the staff's head, or a CHANGE (`./spineHeader`).
    const header = spineBarHeader(score, staffClefs, staffKeys, i)
    const headerEnd = header ? drawSpineBarHeader(ctx, spine, bar.start, header) : bar.start
    const lane = staffMeasureView(measure, staffId, score)
    markBars.push({ view: lane, tempos: measure.tempos ?? [], bar, meterAt: header && spineHeaderMeterAt(bar.start, header) })
    const clef = clefs.get(measure.number) ?? 'treble'
    const voices = [...new Set(lane.slots.map(voiceOf))].sort()
    // ⭐ Where a rest stands in a multi-voice bar — the page's answer (`engraved/restShift`: derived from
    //    every voice of the staff, plus the hand's nudge). ⚠️ The bar's OPENING clef, as its notes read.
    const restShift = restShiftResolver(score, measure.id, lane.slots, () => clef, voices.length > 1)
    // ── 1. BUILD every voice — notes, beams, tuplets — before any of them is formatted or drawn.
    const multiVoice = voices.length > 1
    const built = voices.map(voice => {
      const slots = lane.slots
        .filter(slot => voiceOf(slot) === voice)
        .sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
      const forcedStem = multiVoice ? (voice % 2 === 0 ? 1 : -1) : undefined
      const notes = createStaveNotesFromSlots(slots, clef, forcedStem, restShift, keys.get(measure.number))
      return { voice, slots, forcedStem, notes }
    })
    // What the voice model says each note is, kept across the voice rule (`format/voiceIntent`) — captured
    // where the page captures it: after the notes, before the beams and tuplets.
    const intent = captureVoiceIntent(built.flatMap(b => b.notes), multiVoice)
    const voiceInk = built.map(({ voice, slots, forcedStem, notes }) => {
      const at = slots.map(slot => {
        // A whole-bar rest stands in the MIDDLE of its bar, as on the page.
        return slot.type === 'rest' && slot.isMeasureRest ? (bar.start + bar.end) / 2 : bar.columnAt(slot.beat)
      })
      // ⭐ WHICH notes beam together is the PAGE's answer (`beams/beamGroups`) — asked BEFORE any
      //    note is formatted, so a beamed note reserves no room for a flag it will not draw.
      //    ⭐ A group holding a FAN gets no `Beam` there (the page draws it by hand, `FanPass`): its notes
      //    and fans come back as a `fanJoins` entry, drawn as ONE block below (port map #29).
      const { beams, fanJoins } = buildBeams(notes, slots, getMeterInfo(measure.timeSignature), () => clef, forcedStem)
      // A beam gives its group ONE stem direction — the re-assert must keep what the BEAM decided.
      for (const note of notes) if (intent.stemDir.has(note) && note.hasBeam()) intent.stemDir.set(note, note.getStemDirection())
      // ⭐ The TUPLETS (port map #8) — the page's own, built by the page's rules, AFTER the beams (the
      //    bracket asks whether a beam already shows the group; `hasBeam()` only answers once one exists).
      const tuplets = tupletsOf(measure, slots, notes, voice, multiVoice, at, bar.end, score)
      return { slots, notes, at, beams, tuplets, fanJoins, forcedStem }
    })
    // ── 2. ⭐ THE SHARED COLUMN (port map #11): with more than one voice, the page's column pass runs over
    //    EVERY voice of the bar together — the voice rule, then the dots and accidentals stacked across
    //    the voices of one beat — and the page's re-assert follows. The blocks below then keep that
    //    answer (they do not re-attach a note that already has its column).
    if (multiVoice) {
      const barVoices = built.map(b => new BarVoice(measure.timeSignature, 'soft').addAll(b.notes))
      attachModifierColumns(barVoices)
      formatColumns(barVoices, SHARED_COLUMN_FORMAT_PX)
      reassertVoiceIntent(built.flatMap(b => b.notes), intent)
    }
    // ⭐ The bar's columns as the SPINE spaced them — in staff spaces from its first column, the page's
    //    `SpacedColumns` — for a fan's members (`FanPass`, `fanRampRoomSpaces`). The columns hold the members'.
    const firstColumn = bar.columns[0] ? bar.columnAt(bar.columns[0].beat) : 0
    pagePass.solvedColumns.set(measure.number, {
      columns: [...bar.columns],
      xs: bar.columns.map(column => (bar.columnAt(column.beat) - firstColumn) / STAFF_SPACE_PX),
    })
    // ── 3. DRAW — each group one block, each lone note one block.
    for (const { slots, notes, at, beams, tuplets, fanJoins, forcedStem } of voiceInk) {
      // A fan's stem holds its beam levels — the page's own stretch, post-format, pre-draw (`FanPass`).
      applyFanStemStretch(slots, notes)
      /** Where the room of the fan at `n` ends along the path: the NEXT note's head (its left), else the barline. */
      const nextHeadS = (n: number) => (n + 1 < at.length ? at[n + 1] - (INK.notehead / 2) * STAFF_SPACE_PX : bar.end)
      /**
       * ⭐ The page's `FanPass` for the fans `only` names, in a block whose frame is `frame`: the room ends at the
       * next head along the path, and each MEMBER rides the path — lowered by how far the path runs below the
       * owner's under it (the beams' option (b), §6: heads on the path, stems parallel, the ramp straight).
       */
      const drawFans = (joins: FanJoin[], only: (i: number) => boolean, frame: BlockFrame) =>
        drawFannedBeams(pagePass, slots, notes, measure.number, 0, () => clef, joins, [], forcedStem, 1, keys.get(measure.number), {
          only,
          // ⭐ The fan is solved in DISTANCE ALONG THE PATH from its owner — its room ends that far on — and each
          //    member is then moved to where the path truly is (`memberPlace`): on a circle a point s along the
          //    arc stands only R·sin(s/R) along the tangent, so a ramp left on the tangent overshoots, the last
          //    member onto the next note (seen 2026-09-26, his rit fan).
          nextHeadX: i => frame.xAt(at[i]) + (nextHeadS(i) - at[i]),
          memberPlace: i => {
            const owner = at[i]
            const ruler = noteRuler(notes[i])
            const halfHead = (ruler.headRightX - ruler.headLeftX) / 2
            const ownerCentreX = frame.xAt(owner)
            const ownerTopLineY = staveFrame(staveOf(notes[i])).topLineY
            return (x, y) => {
              // The head's CENTRE, that far along the path from the owner's, at its own depth below the lines.
              const s = owner + (x + halfHead - ownerCentreX)
              const target = frame.pointAt(s, y - ownerTopLineY)
              return { dx: target.x - (x + halfHead), dy: target.y - y }
            }
          },
          // ⭐ …and TURNS with the path there, as any note's head does on the spine (his report, 2026-09-26:
          //    *"the noteheads are not following the circle path, they should behave like normal notes"*).
          memberTilt: i => {
            const owner = at[i]
            const ownerX = frame.xAt(owner)
            return x => frame.turnAt(owner + (x - ownerX))
          },
        })
      // ⭐ A note's GRACES, BRACKETED graces and PARENTHESIS brackets (port map #21–#23): the page's own pass
      //    (`GracePass.drawGraceNotes`), asked for THIS note, drawn inside its block — read against the whole
      //    lane, so a grace's sign knows the bar's earlier notes.
      //    ⭐ …and a LONE fan (port map #29), in its note's block too.
      const withNote: WithNote = (note, frame) => {
        const n = notes.indexOf(note)
        drawGraceNotes(pagePass, slots, notes, measure.number, 0, () => clef, keys.get(measure.number), i => i === n)
        if (!fanJoins.some(join => join.fans.includes(n))) drawFans([], i => i === n, frame)
      }
      const groups = groupNotes(notes.length, [
        ...beams.map(beam => beam.notes.map(note => notes.indexOf(note))),
        ...tuplets.map(t => t.tuplet.getNotes().map(note => notes.indexOf(note))),
        // ⭐ A fan JOINED to the group on its left: the group and its fans are ONE block (the page's one beam).
        ...fanJoins.map(join => [...join.prefix, ...join.fans]),
      ])
      const drawn = new Set<number>()
      const places: SpineNotePlace[] = []
      notes.forEach((note, n) => {
        const members = notes.map((_, i) => i).filter(i => groups[i] === groups[n])
        if (members.length === 1) { places[n] = drawNoteBlock(ctx, spine, note, at[n], withNote); return }
        if (drawn.has(groups[n])) return
        drawn.add(groups[n])
        const inBlock = (ids: readonly EngravedNote[]) => ids.every(id => members.includes(notes.indexOf(id)))
        const joins = fanJoins.filter(join => join.fans.every(i => members.includes(i)))
        const ink: GroupBlockInk = {
          beams: beams.filter(beam => inBlock(beam.notes)),
          tuplets: tuplets.filter(t => inBlock(t.tuplet.getNotes())),
          ...(joins.length ? {
            extra: (frame: BlockFrame) => drawFans(joins, i => joins.some(join => join.fans.includes(i)), frame),
            upright: new Set(joins.flatMap(join => join.fans.map(i => notes[i]))),
          } : {}),
        }
        drawGroupBlock(ctx, spine, members.map(i => notes[i]), members.map(i => at[i]), ink, withNote).forEach((place, k) => { places[members[k]] = place })
      })
      remember(places, slots, measure.number)
      // ⭐ …and every GRACE head the blocks drew (port map #21): the host's place on the path, with the
      //    grace's own anchor (`GracePass` recorded it, in the host's stave px) — so a slur can start or end
      //    on a grace, as on the page (his report, 2026-09-26: *"i dont see the slur in the graces"*).
      slots.forEach((slot, i) => {
        const place = places[i]
        if (!place) return
        for (const pitch of gracePitchesOf(slot)) {
          const anchor = pagePass.fanMemberAnchorMap.get(pitch.id)
          if (anchor) pitches.set(pitch.id, { place, headIndex: 0, measureNumber: measure.number, anchor })
        }
      })
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
  // ⭐ The curves last, over every placed note — as the page draws its ties and slurs after the bars.
  drawSpineCurves(ctx, spine, score, pitches)
  // ⭐ And the marks on their lanes — dynamics, expression words, tempo (`./spineMarks`, port map #16).
  drawSpineMarks(ctx, spine, score, markBars)
}

/**
 * ⭐ One voice's tuplets as the page builds them (`ScoreRenderer.buildScoreTuplets` + its pre-draw pass), for
 * the spine: the notes of each `tupletId` (two or more), the mark's SIDE, its BRACKET, its MARK, and where
 * the bracket ENDS along the spine — the next column's `s` (`division`), a gap before it (`beforeNext`), the
 * bar's end when nothing follows, or the last note (`lastNote`, undefined) — and its vertical nudges, to run
 * just before it draws.
 */
function tupletsOf(
  measure: Measure, slots: readonly ChordRest[], notes: readonly EngravedNote[], voice: number, multiVoice: boolean,
  at: readonly number[], barEnd: number, score: Score,
): { tuplet: ScoreTuplet; endS?: number; beforeDraw: () => void }[] {
  const out: { tuplet: ScoreTuplet; endS?: number; beforeDraw: () => void }[] = []
  for (const data of measure.tuplets ?? []) {
    const idx = slots.map((slot, i) => (slot.tupletId === data.id ? i : -1)).filter(i => i >= 0)
    if (idx.length < 2) continue
    const members = idx.map(i => notes[i])
    const location = resolveTupletLocation(data.placement, multiVoice, voice, stemMajorityTupletLocation(members))
    const tuplet = new ScoreTuplet(members, { numNotes: data.numNotes, notesOccupied: data.notesOccupied, location })
    const bracketed = tupletBracketed(data, members.every(note => note.hasBeam()))
    tuplet.options.bracketed = bracketed
    tuplet.setMarkRuns(tupletMarkRuns(data, data.numberStyle, { meter: measure.timeSignature, beat: data.startBeat }))
    let endS: number | undefined
    const mode = tupletBracketEnd(data)
    if (bracketed && mode !== 'lastNote') {
      const next = idx[idx.length - 1] + 1
      endS = next < slots.length ? at[next] - (mode === 'beforeNext' ? BRACKET_END_GAP_PX : 0) : barEnd - BRACKET_END_GAP_PX
    }
    // ⭐ The page's vertical nudges — the inner flip and the HAND's offset (`marks/tupletPass.tupletYOffsetPx`,
    //    port map #27) — asked once the block has formatted the notes, just before the draw.
    const beforeDraw = () => {
      const nudge = tupletYOffsetPx(score, data.id, tuplet, (tuplet.options.location ?? 1) as 1 | -1, voice, multiVoice)
      if (nudge !== 0) tuplet.options.yOffset = (tuplet.options.yOffset ?? 0) + nudge
    }
    out.push({ tuplet, endS, beforeDraw })
  }
  return out
}

