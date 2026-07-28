/**
 * FANNED BEAMS, drawn — the whole family, extracted from {@link VexFlowRenderer}
 * (docs/refactor-plan-2026-07-27.md Phase 6a). Free functions over the passed-in {@link RenderPass},
 * like {@link TieRenderer} / {@link SlurRenderer} / {@link DynamicsLayout}: nothing here reads
 * renderer-instance state, and the two maps it fills (`fanMemberGroupMap`, `fanMemberAnchorMap`) are
 * carried on the pass as references to the renderer's own fields, exactly as `staveNoteMap` is.
 *
 * The geometry itself is NOT here — {@link FannedBeam} owns it, and is pure arithmetic with its own
 * spec. This module is the DRAWING: what the ramp, the members, the prefix's stems and the join gap
 * are inked as, and what of it is registered for hit-testing.
 *
 * Two entry points, one body:
 *  - {@link drawFannedBeams} — the fans of ONE LANE of one bar, inside that bar's measure group;
 *  - {@link drawCrossBarFanBeams} — the fans whose beam LEAVES its bar, drawn outside every one.
 * Both build {@link FanSlotDrawing}s and hand them to {@link drawFanGroups}.
 */
import { Stave, StaveNote, NoteHead, Accidental, Stem, type SVGContext } from 'vexflow'
import type { Score, Clef, Chord, ChordRest, FanMemberChord, Fraction, NotePitch } from '@/types/music'
import { fracToNumber } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { staffLineForSpelling } from '@/utils/clefUtils'
import { spellingToVexflowKey } from '@/utils/pitchSpelling'
import { displayedAccidentals } from '@/utils/accidentalState'
import { slotLength } from '@/utils/durations'
import { FAN_GROUP, fanMembers, fanMemberPitches } from '@/utils/fannedBeam'
import {
  fannedBeamGeometry,
  fanBeamFarEdge,
  fanJoinQuads,
  fanStemExtension,
  FAN_MIN_HEAD_GAP_RATIO,
  FAN_MIN_STEM_SPACES,
  type FanGeometry,
  type FanGeometryOptions,
  type FanQuad,
} from './FannedBeam'
import { CROSS_SYSTEM_BEAM_WIDTH, fillBeamQuad } from './beamInk'
import type { CrossBarFanJoin } from './CrossBarBeams'
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { RenderPass } from './RenderPass'
import { fracAdd } from '@/utils/fraction'
import { fanMemberBeats } from '@/utils/fannedBeam'
import { drawFanMemberArticulations, fanArticulationPosition } from './fanArticulations'
import { chordHeadDisplacement, displacedHeadShiftPx } from './chordHeadLayout'
import { chordAccidentalLayout, chordAccidentalWidth } from './chordAccidentalColumns'
import { measureLeadingSpaces, noteOffsetOverrideOf, VEXFLOW_DEFAULT_STAFF_SPACE_PX } from '@/engine/models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'

/**
 * A fanned slot JOINED to the group on its left (docs/fan-beam-join-plan.md), as INDICES into one
 * lane's parallel `slots` / `staveNotes` arrays.
 *
 * The one fact the pre-format pass (`VexFlowRenderer.buildBeams`) learns and the post-draw pass
 * ({@link drawFannedBeams}) needs: which notes the fan's beam has to reach back over. Computed once,
 * because re-deriving it in the second pass would mean re-grouping the lane and two answers that
 * could drift apart.
 */
export interface FanJoin {
  /** The ordinary notes in front of the first fan, in order — may be empty (P2: a fan chain). */
  prefix: number[]
  /** Every fanned slot on this beam, in order. At least one, and more once fans chain (P2). */
  fans: number[]
}

/** One fanned slot's resolved drawing inputs — see {@link fanSlotDrawing}. */
interface FanSlotDrawing {
  index: number
  slot: Extract<ChordRest, { type: 'chord' }>
  note: StaveNote
  /** The note's OWN stave — a synthetic cross-barline lane (P3) has more than one. */
  stave: Stave
  /** The clef this fan's pitches are read against — its own bar's. */
  clef: Clef
  /** The multi-voice stem the lane forced, if any — only ever consulted to pick the side a MEMBER's
   *  own articulation sits on when member 0 has none to copy. Absent on the cross-barline path. */
  forcedStemDirection?: number
  /** Where this fan's members register — its own bar, which a synthetic lane does not share. */
  measureNumber: number
  staffIndex: number
  headX: number
  baseY: number
  stemDirection: number
  /** Per member, per notehead: the pitch, its staff line and the sign it displays (null for none). */
  heads: { pitch: NotePitch; line: number; sign: string | null }[][]
  /** The mark's stored MEMBERS — `stored[k - 1]` is member k, member 0 being the note itself. */
  stored: FanMemberChord[]
  prefixNotes: StaveNote[]
  options: FanGeometryOptions
}

/**
 * The SVG group ONE fanned member's ink is painted into — class `vf-fanhead`, id
 * `vf-fanhead-<slotId>-<k>`, nested inside the group's own `vf-fan`.
 *
 * ⭐ Cheap to open here, and it is what turns a member into a thing on the page: the head, its
 * accidental and its ledger lines land in one group, so P3 can highlight a member by an ordinary
 * recolour instead of painting a rectangle over it. (The barline's "paint, don't recolour" lesson is
 * about ink you do not own; this ink is ours.)
 *
 * ⚠️ `openGroup` PREFIXES both with `vf-`, so the bare name is what goes in, and the id carries the
 * name because `getElementById` is document-wide.
 */
const FAN_HEAD_GROUP = 'fanhead'

/** How far a member's ledger line overhangs its notehead on each side, in px (VexFlow's `strokePx`). */
const FAN_LEDGER_OVERHANG = 3

/** The gap between a member's accidental and its notehead, in px. PROVISIONAL, like every fan number. */
const FAN_ACCIDENTAL_GAP = 2

/**
 * Measured accidental glyph widths, by sign — what a member's sign needs to the left of its head.
 *
 * Measured from the glyph itself rather than assumed, so it follows the font; jsdom cannot measure
 * and answers 0, which is the one environment where nothing is drawn anyway. Module-level because it
 * is a fact about the FONT, not about a renderer: a second editor on the page measures the same ♯.
 */
const accidentalWidths = new Map<string, number>()

function accidentalWidth(sign: string): number {
  const hit = accidentalWidths.get(sign)
  if (hit !== undefined) return hit
  const width = new Accidental(sign).getWidth() || 0
  accidentalWidths.set(sign, width)
  return width
}

/**
 * The authored leading space before each MEMBER of a fanned slot, in pixels — the §7 half of client
 * #10 (docs/note-spacing-plan.md). Entry k is the space before member k; entry 0 is always 0,
 * because the space before member 0 is the space before the fan's own column and
 * `applyLeadingSpaces` has already spent it on the tick context.
 *
 * A member's address is an ORDINARY `spacingPositionKey` at the member's own beat — the key takes
 * any rational and `fanMemberBeats` hands out exact ones — so this is a lookup, not a second
 * storage scheme. The beats are compared by cross-multiplication rather than as floats: both sides
 * come out of the same expander, and an exact match is the whole reason the address works.
 *
 * Returns an empty array when nothing in the bar is spaced, which is the ordinary case.
 */
function fanMemberSpacesPx(score: Score, measureNumber: number, slot: Chord): number[] {
  if (!slot.fan) return []
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return []
  const spaces = measureLeadingSpaces(score, measure.id)
  if (spaces.length === 0) return []

  const beats = fanMemberBeats(slot.fan, slotLength(slot), slot.beat)
  return beats.map((beat, k) => {
    if (k === 0) return 0 // member 0's space IS the column's, already applied
    const hit = spaces.find(s => s.beat.num * beat.den === beat.num * s.beat.den)
    return (hit?.space ?? 0) * VEXFLOW_DEFAULT_STAFF_SPACE_PX
  })
}

/**
 * ⭐ The authored leading space, in pixels, before the column that FOLLOWS a fanned slot — the room
 * the ramp must NOT spend (his report: *"the distance between the last element of the fan and the
 * rest should increase; instead the fan enlarges and that gap stays constant"*).
 *
 * The space is authored on the NEXT note's own column, so `applyLeadingSpaces` moved that note and
 * every tick context after it — which means `spanEndX` (the next note's head) arrives already
 * carrying it. Left in, it becomes part of `usable` and the proportional ramp shares it out among
 * every gap in the group: the fan grows, and the one gap the user was widening does not. Taken back
 * out, the ramp keeps exactly the shape it had and the whole of the space lands where it was asked
 * for — between the last member and the note after it.
 *
 * ⚠️ The same lever from the other end as {@link fanMemberSpacesPx}: a space authored INSIDE the
 * group opens one member's gap (that one comes off the top and the ramp shares what is left), a
 * space authored just AFTER it opens the gap the group does not own at all.
 *
 * The address is the group's own end — `slot.beat + its full duration`, the column the next note
 * starts at. Nothing there (the fan runs to the barline, or nothing is spaced) ⇒ 0.
 */
function fanTrailingSpacePx(score: Score, measureNumber: number, slot: Chord): number {
  if (!slot.fan) return 0
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure) return 0
  const spaces = measureLeadingSpaces(score, measure.id)
  if (spaces.length === 0) return 0
  const end = fracAdd(slot.beat, slotLength(slot))
  const hit = spaces.find(s => s.beat.num * end.den === end.num * s.beat.den)
  // ⚠️ The SAME px-per-staff-space `applyLeadingSpaces` shifted the context by — this undoes exactly
  // that shift, so it has to be measured in exactly that unit.
  return (hit?.space ?? 0) * VEXFLOW_DEFAULT_STAFF_SPACE_PX
}

/**
 * ⭐ The authored horizontal OFFSET of each member of a fanned slot, in pixels — the fan's half of
 * client #12 (docs/note-offset-plan.md §"Inside a FAN"). Entry k is member k's own offset, entry 0
 * the OWNER's (which `applyNoteOffsets` has already spent on the `StaveNote`, and which
 * `fannedBeamGeometry` therefore takes back OUT of `headX` to find the natural column).
 *
 * ⚠️ **The twin of {@link fanMemberSpacesPx} with the opposite arithmetic** — a space is width the
 * bar already grew for, an offset is no width at all. The keys differ for the same reason: a space is
 * addressed by the member's own BEAT (a column exists there), an offset by the member's own first
 * pitch ID (`ScoreModel.offsetTargetOf`), because it is a property of that head and not of a column.
 *
 * Returns an empty array when nothing in the group is offset, which is the ordinary case.
 */
function fanMemberOffsetsPx(score: Score, slot: Chord, stave: Stave): number[] {
  if (!slot.fan) return []
  const count = Math.max(1, Math.round(slot.fan.count))
  const out: number[] = []
  let any = false
  for (let k = 0; k < count; k++) {
    // Member 0 IS the slot; members 1…n are keyed by their own first pitch. ⚠️ A member with no
    // stored pitches (a mark that never went through `normalizeFan`) has no id to be offset by and
    // cannot be selected either — it draws on the slot's own pitch, so it answers 0 here.
    const key = k === 0 ? slot.id : slot.fan.members?.[k - 1]?.pitches[0]?.id
    const x = key ? noteOffsetOverrideOf(score, key)?.x ?? 0 : 0
    if (x !== 0) any = true
    out.push(x === 0 ? 0 : staffSpacesToPixels(x, stave))
  }
  return any ? out : []
}

/**
 * Draw each fanned slot's OTHER members and its feathered beam (docs/fanned-beams-plan.md §3, P1),
 * for ONE LANE of one bar.
 *
 * ⭐ **The slot's own `StaveNote` is member 0 and is NOT suppressed** — it has already been drawn
 * by `voice.draw`, wearing a quarter's filled head (NoteBuilder swaps the drawn value). Everything
 * the outside world knows about this event hangs off that object — the registry's hit-test, the
 * `staveNoteMap`, the selection recolour's SVG group, tie and slur anchors, articulations, the
 * dynamic's anchor — so what this pass adds is the members VexFlow does not know about and
 * nothing else.
 *
 * ⚠️ AFTER the voices are drawn, like the two-note tremolo's strokes and for the same reason: the
 * stem geometry it reads (including `applyFanStemStretch`'s extension) is only settled then.
 * And inside the measure group, because everything it draws is inside this bar. A group that
 * CROSSES a barline belongs to no bar and is drawn by {@link drawCrossBarFanBeams} instead (P3).
 *
 * ⚠️ THE SPAN is the slot's own x-territory: from its notehead to the next note's in the SAME
 * lane, or to the end of the note area when nothing follows. That is where the width bought by
 * `laneColumns` lands — but only approximately, because inside the bar VexFlow distributes by
 * tick. A fan in a busy bar is the case to look at by eye.
 */
export function drawFannedBeams(
  pass: RenderPass,
  slots: ChordRest[],
  staveNotes: StaveNote[],
  measureNumber: number,
  staffIndex: number,
  clefForBeat: (beat: Fraction) => Clef,
  /** The fans of this lane that are JOINED to the group on their left, from `buildBeams`. */
  fanJoins: FanJoin[],
  /**
   * ⚠️ The slots of this lane whose fan belongs to a group that LEAVES the bar (P3) — skipped
   * here, because {@link drawCrossBarFanBeams} draws those and drawing one twice paints two
   * `vf-fan` groups under ONE id. `getElementById` is document-wide and the first in tree order
   * wins, so the second copy is not merely wasted ink: it steals every lookup the first one owns.
   */
  crossingFans: number[] = [],
  /** The lane's forced stem in multi-voice — see {@link FanSlotDrawing.forcedStemDirection}. */
  forcedStemDirection?: number,
): void {
  // Which sign each pitch of this lane displays — the SAME map NoteBuilder gave the StaveNotes, so
  // a member's accidental obeys one rule with the notes around it, including holding for the rest
  // of the bar (docs/fanned-beam-pitches-plan.md §2). Not free, so not walked for a lane with no
  // fan in it — which is nearly every lane.
  if (!slots.some(s => s.type === 'chord' && s.fan)) return
  const signs = displayedAccidentals(slots)

  const drawings: FanSlotDrawing[] = []
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    if (crossingFans.includes(i)) continue
    const join = fanJoins.find(j => j.fans.includes(i))
    const drawing = fanSlotDrawing({
      index: i,
      slot: slots[i],
      score: pass.score,
      note: staveNotes[i],
      clef: clefForBeat(slots[i].beat),
      forcedStemDirection,
      signs,
      // Only the FIRST fan of a chain has a prefix — behind any other stands a fan, and that gap
      // is `fanJoinQuads`' business.
      prefixNotes: join && join.fans[0] === i ? join.prefix.map(k => staveNotes[k]) : [],
      // Where this slot's room ends: the next note's ink in this lane, or the note area's end. The
      // next slot is the honest boundary — it is what the formatter itself spaced against.
      nextNote: staveNotes[i + 1],
      measureNumber,
      staffIndex,
      joined: !!join,
    })
    if (drawing) drawings.push(drawing)
  }
  drawFanGroups(pass, drawings, fanJoins)
}

/**
 * ⭐ **P3 — the fans whose beam LEAVES its bar** (docs/fan-beam-join-plan.md). One pass per
 * crossing group, drawn OUTSIDE every measure group, exactly as `drawCrossBarBeams` is and
 * for the same two reasons: top-level content is torn down and rebuilt every render while measure
 * groups are REUSED (so a beam drawn into one would vanish on any pass that reuses it), and
 * culling deletes an off-screen bar's group along with anything drawn into it.
 *
 * The whole group comes here, not just the half that reaches over the barline: the joined line's
 * height is a fact about every note on it, so the fan's own ramp and its members cannot be settled
 * inside one bar while the rest of the group lives in another.
 *
 * What it does is exactly what the in-bar pass does — the two build the same
 * {@link FanSlotDrawing}s and hand them to the same {@link drawFanGroups}. All that differs is
 * where the facts come from: the `StaveNote`s by id out of `staveNoteMap` (which is replayed for a
 * reused measure, so this can draw over bars nobody redrew), and the clef, accidental state and
 * following note per member, since a synthetic lane spanning two bars has no single answer to any
 * of them.
 */
export function drawCrossBarFanBeams(pass: RenderPass, joins: CrossBarFanJoin[]): void {
  for (const join of joins) {
    const staveNotes = join.members.map(m => pass.staveNoteMap.get(m.lookupId)?.staveNote)
    // A bar that was not painted contributes no StaveNote. The planner already refuses a group
    // whose bars are not all drawn; this is the runtime proof of it — half a joined beam would
    // draw stems in mid-air.
    if (staveNotes.some(n => n === undefined)) continue

    const drawings: FanSlotDrawing[] = []
    const fanIndices = join.members.map((m, i) => (m.fan ? i : -1)).filter(i => i >= 0)
    for (const i of fanIndices) {
      const member = join.members[i]
      const drawing = fanSlotDrawing({
        index: i,
        slot: member.slot,
        score: pass.score,
        note: staveNotes[i]!,
        clef: member.clef,
        // Accidental state is a fact about ONE bar, so it is read per bar and merged. Keyed by
        // pitch id, so the merge cannot conflate two bars' answers about one note.
        signs: displayedAccidentals(member.laneSlots),
        prefixNotes: i === fanIndices[0]
          ? join.members.map((m, k) => (!m.fan && k < i ? staveNotes[k]! : null))
            .filter((n): n is StaveNote => n !== null)
          : [],
        // ⚠️ The next note in the fan's OWN bar, not in the synthetic lane — the fan may be the
        // last thing on this beam while its bar carries on past it, and the ramp must not spread
        // over a note the formatter put there.
        nextNote: member.nextLookupId ? pass.staveNoteMap.get(member.nextLookupId)?.staveNote : undefined,
        measureNumber: member.measureNumber,
        staffIndex: join.staffIndex,
        joined: true,
      })
      if (drawing) drawings.push(drawing)
    }
    if (!drawings.length) continue

    const prefix = join.members.map((m, i) => (!m.fan && i < fanIndices[0] ? i : -1)).filter(i => i >= 0)
    drawFanGroups(pass, drawings, [{ prefix, fans: fanIndices }])
  }
}

/**
 * The shared body of both fan passes: settle each joined group's ONE line, then draw every fan —
 * its prefix's stems, its members, its ramp, and the gap back to the fan behind it.
 *
 * ⚠️ `openGroup` PREFIXES the class with `vf-`, so the bare name goes in, and `closeGroup()` lives
 * in a `finally` — an unbalanced pair swallows the rest of the render.
 */
function drawFanGroups(pass: RenderPass, drawings: FanSlotDrawing[], fanJoins: FanJoin[]): void {
  reconcileFanJoinLines(drawings, fanJoins)

  const geometries = new Map<number, FanGeometry>()
  for (const drawing of drawings) {
    const { index: i, slot, note, stave, clef, headX, baseY, stemDirection, heads, stored, prefixNotes, options } = drawing
    const { measureNumber, staffIndex } = drawing
    const geometry = fannedBeamGeometry(options)
    geometries.set(i, geometry)

    // ⭐ P2 — THE GAP TO THE FAN BEHIND IT. Only the lines both ramps have cross it; the rest stop
    // at their own stem, which is what a partial beam looks like anywhere else.
    const join = fanJoins.find(j => j.fans.includes(i))
    const at = join ? join.fans.indexOf(i) : -1
    const behind = at > 0 ? geometries.get(join!.fans[at - 1]) : undefined
    const joinQuads = behind && geometry.stems.length
      ? fanJoinQuads({
          left: behind,
          right: geometry,
          toX: geometry.stems[0].stemX,
          thickness: CROSS_SYSTEM_BEAM_WIDTH * stemDirection,
          // THIS fan's spread — the crossing lines land on its stems, so they keep its gap.
          spread: slot.fan?.spread,
        })
      : []

    if (geometry.beams.length === 0) {
      // The fan had no room to draw at all (a collapsed span). Its prefix is still wearing the
      // PLACEHOLDER beam, so `StaveNote.draw` skipped those stems and nobody else is coming for
      // them — put them back at their natural length rather than leave a row of stemless heads.
      // Degraded either way (the flag is suppressed too), but a stem is not missing ink.
      drawFanPrefixStems(pass.context, prefixNotes, [])
      continue
    }

    // ⚠️ The group's own ink rect goes in FIRST, before the member heads — `getAt` returns the
    // LAST matching element, so whatever is registered later wins the click. The rect spans the
    // whole fan, so registering it after the heads would swallow every one of them and a member
    // could never be selected. The heads are added in the draw loop below.
    registerFanInk(pass.elementRegistry, geometry, headX, baseY, measureNumber, staffIndex, prefixNotes, joinQuads)

    const ctx = pass.context
    ctx.openGroup('fan', `${FAN_GROUP}-${slot.id}`)
    try {
      // ⭐ THE REAL NOTE'S STEM, TOPPED UP. When a member's pitch pushes the beam line away, the
      // line leaves member 0's own tip behind — and that stem is VexFlow's, already drawn.
      // Extending it would mean deciding the geometry BEFORE the draw, where the note's x and stem
      // extents are not yet settled (they answer 0 and a tip 110px too high). So the missing piece
      // is simply drawn here, from the tip VexFlow gave it to the line. Never a shortening: the
      // line only ever moves AWAY from the heads.
      if (geometry.stemLift > 0) {
        ctx.beginPath()
        ctx.setLineWidth(Stem.WIDTH)
        ctx.moveTo(geometry.stems[0].stemX, note.getStemExtents().topY)
        ctx.lineTo(geometry.stems[0].stemX, geometry.stems[0].tipY)
        ctx.stroke()
      }
      // The joined group's own stems, re-aimed onto the line.
      drawFanPrefixStems(ctx, prefixNotes, geometry.prefixStems)
      // The DEFAULT side a member takes when it has not been flipped itself — the stem's, never
      // member 0's (see `fanArticulationPosition` for why that distinction is the whole bug).
      const articulationPosition = fanArticulationPosition(stemDirection, drawing.forcedStemDirection)
      // The members VexFlow did not draw — member 0 is the real note, already on the page.
      for (let k = 1; k < geometry.stems.length; k++) {
        const member = geometry.stems[k]
        // ⭐ ONE GROUP PER MEMBER, so a member is a thing on the page and not a rectangle of
        // painted ink: the head, its sign and its ledger lines land inside it together, which is
        // what lets P3 highlight one by an ordinary recolour. ⚠️ `openGroup` prefixes `vf-`.
        const memberGroup = ctx.openGroup(FAN_HEAD_GROUP, `${FAN_HEAD_GROUP}-${slot.id}-${k}`)
        try {
          const memberHeads = heads[k] ?? []
          const glyphWidth = note.getGlyphWidth()
          // ⭐⭐ THE CHORD RULES, applied to a member. A member IS a chord (`FanMemberChord`), and
          // everything a `StaveNote` would have done for it — seconds across the stem, accidentals
          // in columns, one ledger line under both heads — has to be done here, because these heads
          // are ours. `displaced` is handed to `NoteHead`, which owns the arithmetic that turns it
          // into an x; we only ask where it landed.
          const displaced = chordHeadDisplacement(memberHeads.map(mh => mh.line), stemDirection)
          const noteHeads = memberHeads.map((mh, h) => new NoteHead({
            duration: 'q', line: mh.line, stemDirection, displaced: displaced[h], x: member.headX,
          }))
          // ⚠️ READ BEFORE THE DRAW: `NoteHead.draw` writes its own absolute x back into `x`, so a
          // displaced head asked twice displaces twice.
          const headXs = noteHeads.map(h => h.getAbsoluteX())
          // The chord's left EDGE, not its column: with a stem down it is the displaced head, and
          // that is what the accidentals have to clear.
          const chordLeftX = headXs.length ? Math.min(...headXs) : member.headX
          const signedHeads = memberHeads.map((_, h) => h).filter(h => memberHeads[h].sign)
          const accidentals = chordAccidentalLayout(
            signedHeads.map(h => ({ line: memberHeads[h].line, width: accidentalWidth(memberHeads[h].sign as string) })),
            chordLeftX,
            FAN_ACCIDENTAL_GAP,
          )
          // 🚨 LEDGER LINES BY HAND. `drawLedgerLines` belongs to `StaveNote`; a bare `NoteHead`
          // only swaps to the ledger glyph. Members off the staff drew as floating heads before
          // they had their own pitches — a bug then, the ordinary case now. Once per MEMBER, not
          // once per head: a ledger line is a fact about the level, and it has to reach across
          // every head standing on it.
          drawFanLedgerLines(ctx, stave, memberHeads.map((mh, h) => ({ line: mh.line, x: headXs[h] })), glyphWidth)
          for (let h = 0; h < memberHeads.length; h++) {
            const { pitch, line, sign } = memberHeads[h]
            const y = stave.getYForNote(line)
            const head = noteHeads[h]
            head.setStave(stave) // resolves y from the line, and hands it the context
            head.setContext(ctx).draw()
            // ⭐ P3: the member becomes CLICKABLE and HIGHLIGHTABLE — but only when it is a member
            // of its own (a fallback head is the slot's pitch, and that id is already the real
            // note's). Registered as a `note` because that is what it is; ⚠️ it carries the SLOT's
            // beat, which is what keeps `pixelXToBeat` unmoved — that walk dedups anchors by beat
            // and keeps the leftmost x, so the members collapse onto the note's own column.
            if (stored[k - 1]) {
              pass.elementRegistry.addGlyph(head, {
                type: 'note',
                id: pitch.id,
                measure: measureNumber,
                staff: staffIndex,
                beat: fracToNumber(slot.beat),
                pitch: spellingToMidi(pitch.step, pitch.alter, pitch.octave),
                duration: slot.duration,
                // ⚠️ The head's OWN x, not the member's column — a head displaced across the stem
                // is where the click has to land, or a second selects its neighbour.
                headX: headXs[h] + glyphWidth / 2,
              })
              // The group is this member's whole ink — head, sign, ledgers, stem — so the highlight
              // is an ordinary recolour of ink we own, not a rectangle painted over someone else's.
              pass.fanMemberGroupMap.set(pitch.id, { group: memberGroup as unknown as SVGGElement, noteIndex: h })
              // …and WHERE it landed, so a slur can spring from it. Measured from the geometry that
              // placed the head, not re-derived — the same rule the ink rect follows.
              pass.fanMemberAnchorMap.set(pitch.id, {
                staveNote: note,
                leftX: headXs[h],
                rightX: headXs[h] + glyphWidth,
                headY: y,
                tipY: member.tipY,
                stemDirection,
              })
            }
            if (sign) {
              // Hand-placed for the same reason the head is: there is no `StaveNote` here to hang
              // a modifier on, and a `Modifier` drawn at explicit coordinates without its own x/y
              // set drags a note's bbox to zero (reference_vexflow_modifier_bbox_needs_x_y).
              // ⭐ Its place in the member's own accidental COLUMNS — the topmost sign nearest the
              // chord, the lowest in the next column out, the rest working inwards (Gould's
              // zig-zag; `chordAccidentalColumns`). One x for all of them printed two signs on top
              // of each other the moment a member became a real chord.
              const acc = new Accidental(sign)
              acc.setContext(ctx)
              acc.setX(accidentals.xs[signedHeads.indexOf(h)]).setY(y)
              acc.renderText(ctx, 0, 0)
            }
          }
          ctx.beginPath()
          ctx.setLineWidth(Stem.WIDTH)
          ctx.moveTo(member.stemX, member.baseY)
          ctx.lineTo(member.stemX, member.tipY)
          ctx.stroke()
          // The slot's articulation, on THIS head. The mark belongs to the gesture and playback
          // already spends it across the whole group, so drawing it once on member 0 made the
          // picture disagree with the sound — see `fanArticulations`. Inside the member's group,
          // so it recolours with the member it marks; after the stem, whose tip it may clear.
          // ⭐ THIS member's own articulations — not the slot's, which are member 0's. A fan writes
          // N attacks and a mark belongs to an attack, so the sixth note can be the accented one.
          const types = stored[k - 1]?.articulations ?? []
          if (types.length && memberHeads.length) {
            const placed = drawFanMemberArticulations(ctx, stave, {
              types,
              keys: memberHeads.map(mh => spellingToVexflowKey(mh.pitch.step, mh.pitch.alter, mh.pitch.octave)),
              clef,
              headX: member.headX,
              // ⭐ To the outside of the BEAM, not to the stem tip. A stem tip is where the stem
              // meets the innermost ramp line, and the group has up to `beams` bands stacked past
              // it — a mark measured off the tip lands inside the feathering. Member 0 escapes this
              // only because its own stem was already stretched to the ramp, which is why it was the
              // one that looked right.
              stemLengthPx: Math.abs(
                (fanBeamFarEdge(geometry.beams, member.stemX, stemDirection) ?? member.tipY) - member.baseY,
              ),
              placement: stored[k - 1]?.articulationPlacement,
            }, { position: articulationPosition, stemDirection })
            // ⭐ REGISTERED like the owner's, keyed on the member's own first pitch — that id is
            // what `selectArticulation` / delete / flip all take, so registering it is the whole of
            // what makes a member's mark clickable. Without this the only selectable articulation in
            // a fan was the owner's, however many were drawn.
            for (const { type, rect } of placed) {
              pass.elementRegistry.add({
                type: 'articulation',
                noteId: memberHeads[0].pitch.id,
                articulationType: type,
                measure: measureNumber,
                staff: staffIndex,
                beat: fracToNumber(slot.beat),
                bbox: rect,
              })
            }
          }
        } finally {
          ctx.closeGroup()
        }
      }
      // The gap to the fan behind belongs to THIS fan's ink — it is the one wearing the `continue`.
      for (const q of [...joinQuads, ...geometry.beams]) {
        fillBeamQuad(ctx, q.startX, q.startY, q.endX, q.endY, q.thickness)
      }
    } finally {
      ctx.closeGroup()
    }
  }
}

/**
 * ONE fanned slot, resolved: its note, its members' heads and signs, its prefix, and the full
 * option set its geometry is computed from. Null for anything that is not a fanned chord.
 *
 * Split out because P2 has to spend it TWICE — once to ask what line this fan would want, and once
 * to draw it at the line the whole joined group agreed on — and because P3 builds the same thing
 * from a group that has no single bar to read its clef, its accidentals or its next note from.
 *
 * ⭐ The STAVE comes from the note itself. It is the one source that is right in both passes: a
 * synthetic lane spanning two bars has two staves, and each fan belongs to its own.
 */
function fanSlotDrawing(input: {
  index: number
  slot: ChordRest
  /** The score being drawn — read for the members' own authored spaces (client #10, §7). */
  score: Score
  note: StaveNote | undefined
  /** The clef this member's pitches are read against — its own bar's. */
  clef: Clef
  /** `displayedAccidentals` for this member's own bar: which pitch ids show a sign. */
  signs: Map<string, string | null>
  /** The group this fan is joined to on its left; empty for anything but a chain's first fan. */
  prefixNotes: StaveNote[]
  /** The next note in the fan's OWN bar — where its room ends. Absent ⇒ the note area's end. */
  nextNote: StaveNote | undefined
  measureNumber: number
  staffIndex: number
  /** This fan is on a joined beam, so its line is flat even where it has no prefix (a chain). */
  joined: boolean
  /** The lane's forced stem in multi-voice — see {@link FanSlotDrawing.forcedStemDirection}. */
  forcedStemDirection?: number
}): FanSlotDrawing | null {
  const { index, slot, score, note, clef, signs, nextNote, measureNumber, staffIndex, joined } = input
  if (slot.type !== 'chord' || !slot.fan) return null
  if (!note) return null
  const stave = note.getStave()
  if (!stave) return null

  const headX = note.getNoteHeadBeginX()
  const { topY, baseY } = note.getStemExtents()
  const stemDirection = note.getStemDirection()

  const stored = slot.fan.members ?? []
  const heads = fanMemberPitches(slot.notes, slot.fan).map((pitches, k) => pitches.map(p => ({
    pitch: p,
    line: staffLineForSpelling(p.step, p.octave, clef),
    // ⚠️ Only a member with a pitch of its OWN can carry a sign. A member falling back to the
    // slot's pitches (a mark that never went through `normalizeFan`) is the same note, whose
    // sign the real notehead has already shown — looking its id up would re-draw it on every
    // head in the group.
    sign: k > 0 && stored[k - 1] ? signs.get(p.id) ?? null : null,
  })))
  // ⭐ WHAT EACH MEMBER IS WIDER THAN ITS COLUMN BY, both ways — the chord rules cost room, and the
  // width pass cannot see any of it (it counts head columns and cannot measure glyphs), so the
  // group buys it out of its own span. To the LEFT: the accidental columns, plus a head displaced
  // that way (stems down). To the RIGHT: a head displaced that way (stems up), which nothing else
  // reserves — the gap arithmetic measures between head columns, so without this the next member
  // walks into a displaced head.
  const glyphWidth = note.getGlyphWidth()
  const headShift = displacedHeadShiftPx(glyphWidth)
  const memberDisplaced = heads.map(pitches => chordHeadDisplacement(pitches.map(h => h.line), stemDirection))
  // Member 0's own signs are VexFlow's business — real modifiers on a real note, already inside the
  // formatter's width — but its displaced head reaches past `headX` like anyone else's.
  const accidentalRoom = heads.map((pitches, k) => {
    if (k === 0) return 0
    const signs = pitches.filter(h => h.sign).map(h => ({ line: h.line, width: accidentalWidth(h.sign as string) }))
    const headRoom = stemDirection < 0 && memberDisplaced[k].some(Boolean) ? headShift : 0
    return headRoom + chordAccidentalWidth(signs, FAN_ACCIDENTAL_GAP)
  })
  const headRightRoom = heads.map((_, k) => (
    stemDirection > 0 && (k === 0 ? note.isDisplaced() : memberDisplaced[k].some(Boolean)) ? headShift : 0
  ))

  // ⭐ THE PREFIX — the group this fan is JOINED to on its left (docs/fan-beam-join-plan.md P1).
  // Their x's and head y's are the FORMATTER's, settled and read here like everything else in this
  // pass; what the join changes is only where their stems end.
  const prefixNotes = input.prefixNotes.filter(n => !!n && !!n.getStem())
  // The lines they ask for: the count their own duration carries, the MINIMUM across them so a
  // mixed prefix draws only what they all agree on.
  const prefixBeams = prefixNotes.length ? Math.min(...prefixNotes.map(n => n.getBeamCount())) : 0

  return {
    index, slot, note, stave, clef, forcedStemDirection: input.forcedStemDirection, measureNumber, staffIndex,
    headX, baseY, stemDirection, heads, stored, prefixNotes,
    options: {
      members: fanMembers(slot.fan, slotLength(slot)),
      memberSpaces: fanMemberSpacesPx(score, measureNumber, slot),
      // ⚠️ Same array shape as the spaces above, opposite arithmetic — the geometry SUBTRACTS entry
      // 0 (already inside `headX`) and adds the rest without touching the span. See
      // `FanGeometryOptions.memberOffsets`.
      memberOffsets: fanMemberOffsetsPx(score, slot, stave),
      memberHeadYs: heads.map(pitches => pitches.map(h => stave.getYForNote(h.line))),
      direction: slot.fan.direction,
      beams: slot.fan.beams,
      // The wedge's own ends, RAW — `fannedBeamGeometry` clamps them against the member list it
      // will index, which is the array that actually has to be in range.
      rampFrom: slot.fan.rampFrom,
      rampTo: slot.fan.rampTo,
      spread: slot.fan.spread,
      headX,
      // Where the ramp's room ends — the next note's ink, MINUS whatever space the user authored
      // before that note. Its px are already in the head x (the tick context moved), and spending
      // them on the ramp is what made the fan grow instead of the gap after it.
      spanEndX: (nextNote ? nextNote.getNoteHeadBeginX() : stave.getNoteEndX())
        - fanTrailingSpacePx(score, measureNumber, slot),
      stemOffset: note.getStemX() - headX,
      // MEASURED from the notehead itself, like the two-note tremolo's flag clearance: heads a
      // whole glyph apart cannot touch, and the number follows the staff size instead of pinning
      // a pixel count that would be wrong the day the scale changes. The bar has already been
      // asked for the room this implies (`fanColumns`); this is what SPENDS it.
      minHeadGap: glyphWidth * FAN_MIN_HEAD_GAP_RATIO,
      accidentalRoom,
      headRightRoom,
      prefix: prefixNotes.map(n => ({ stemX: n.getStemX(), headYs: n.getYs() })),
      prefixBeams,
      // Every fan on a joined beam draws flat, prefix or no prefix — a chain's FIRST fan has none.
      joined,
      tipY: topY,
      // ⚠️ The LARGER of the two extensions: the beam levels eat into every stem in the group, and
      // a 32nd prefix joined to a one-beam fan is the case that under-reserves otherwise.
      minStemLength: stave.getSpacingBetweenLines() * FAN_MIN_STEM_SPACES
        + Math.max(
          fanStemExtension(slot.fan.beams, CROSS_SYSTEM_BEAM_WIDTH, slot.fan.spread),
          // ⚠️ No spread: the prefix's levels are ORDINARY beams at the ordinary gap.
          fanStemExtension(prefixBeams, CROSS_SYSTEM_BEAM_WIDTH),
        ),
      stemDirection,
      beamWidth: CROSS_SYSTEM_BEAM_WIDTH,
    },
  }
}

/**
 * ⭐ P2 — ONE LINE FOR THE WHOLE JOINED GROUP. A beam is one straight edge, so two fans sharing one
 * cannot each decide their own height.
 *
 * Asked, not restated: each fan is run through {@link fannedBeamGeometry} exactly as it would be
 * alone, and the OUTERMOST answer wins — the same "largest ask wins, the whole line moves" the
 * floor pass already applies within one fan, one level up. Nothing about the rule is duplicated
 * here, which is the point of doing it by a second call rather than by arithmetic of its own.
 *
 * ⚠️ The outermost is also what keeps every owner's stem GROWABLE: each fan's own answer is at or
 * beyond its own natural tip (the floor only pushes away), so the outermost is beyond all of them
 * — and a fan's owner stem is VexFlow's, which `stemLift` can only lengthen.
 *
 * Only for a joined group: a fan standing alone keeps the lean its members earned.
 */
function reconcileFanJoinLines(drawings: FanSlotDrawing[], fanJoins: FanJoin[]): void {
  for (const join of fanJoins) {
    const members = drawings.filter(d => join.fans.includes(d.index))
    if (members.length < 2) continue // one fan settles its own line; the floor already heard the prefix
    const tentative = members
      .map(d => fannedBeamGeometry(d.options))
      .filter(geometry => geometry.beams.length > 0)
    if (!tentative.length) continue
    const up = members[0].stemDirection > 0
    const lineY = up
      ? Math.min(...tentative.map(geometry => geometry.lineY))
      : Math.max(...tentative.map(geometry => geometry.lineY))
    for (const d of members) d.options.lineY = lineY
  }
}

/**
 * 🚨 The PREFIX's stems — the notes a fan is joined to — drawn as each note's OWN `Stem` object,
 * never as a hand-drawn line whatever it costs: the selection highlight resolves a stem by that
 * object's SVG element (`VexFlowRenderer.getStaveNoteSVGGroup`), so ink drawn any other way could
 * never be selected. `StaveNote.draw` skipped them (they wear the placeholder beam), so this is
 * their only drawing — the same pattern `drawCrossBarLoneFragment` spells out.
 *
 * With `tips`, each stem is re-aimed onto the joined line first. Without (the fan drew nothing),
 * they keep the length they were formatted with.
 */
function drawFanPrefixStems(ctx: SVGContext, prefixNotes: StaveNote[], tips: { tipY: number }[]): void {
  for (let k = 0; k < prefixNotes.length; k++) {
    const prefixNote = prefixNotes[k]
    const stem = prefixNote.getStem()
    if (!stem) continue
    const target = tips[k]
    if (target) {
      // Signed by the stem direction, so it reads the same either way up: positive GROWS the stem.
      // The line is flat and its floor is a minimum rather than a natural length, so a note that
      // already reached past it shrinks to meet it — which is what a beam does to its notes.
      const grow = prefixNote.getStemDirection() * (prefixNote.getStemExtents().topY - target.tipY)
      stem.setExtension(stem.getExtension() + grow)
    }
    stem.adjustHeightForBeam() // the flag's height fudge swapped for the beam's; the tip stays put.
    stem.setContext(ctx).drawWithStyle()
  }
}

/**
 * The fanned group's ink as ONE hit rect, MEASURED from the geometry that placed it — the same
 * rule the two-note tremolo's click target follows: the code that put the ink there is the only
 * honest source for where it is. Filed as a `beam`, which is what the reader sees and what the fan
 * mostly is.
 *
 * Every member's noteheads count, not just the real note's: with pitches of their own the group's
 * ink reaches wherever they went.
 */
function registerFanInk(
  registry: ElementRegistry,
  geometry: FanGeometry,
  headX: number,
  baseY: number,
  measureNumber: number,
  staffIndex: number,
  /** The joined group in front of it, if any — the rect reaches back over their stems too. */
  prefixNotes: StaveNote[] = [],
  /** The quads bridging the gap to the fan behind it (P2) — its ink as much as the ramp is. */
  joinQuads: FanQuad[] = [],
): void {
  const quads = [...geometry.beams, ...joinQuads]
  const ys = [
    ...quads.flatMap(q => [q.startY, q.endY, q.startY + q.thickness, q.endY + q.thickness]),
    ...geometry.stems.map(s => s.baseY),
    ...prefixNotes.map(n => n.getStemExtents().baseY),
  ]
  const top = Math.min(...ys, baseY)
  const bottom = Math.max(...ys, baseY)
  // ⚠️ LEFT to the first prefix stem, not merely taller: the joined beam is the fan's ink, so
  // clicking any of it must still select the fan. Its ORDER is already right — this runs before
  // `registerSlotElements` and `getAt` returns the LAST match, so the prefix noteheads still win
  // their own clicks.
  // ⚠️ EVERY member's own x on both edges, not `headX`-to-the-last-stem: a member offset by hand
  // (client #12) can sit left of the note that was typed or right of the member after it, and the
  // ramp's own order stops being the ink's order the moment one is nudged.
  const left = Math.min(
    headX,
    ...geometry.stems.map(s => s.headX),
    ...geometry.prefixStems.map(p => p.stemX),
    ...joinQuads.map(q => q.startX),
  )
  const right = Math.max(...geometry.stems.map(s => s.stemX))
  registry.add({
    type: 'beam',
    measure: measureNumber,
    staff: staffIndex,
    bbox: { x: left, y: top, width: right - left, height: bottom - top },
  })
}

/**
 * 🚨 The ledger lines of a hand-drawn member head — the ones `StaveNote.drawLedgerLines` would
 * have drawn if this head belonged to one.
 *
 * A bare `NoteHead` off the staff only swaps to the LEDGER glyph (a slightly wider head); the
 * lines themselves are `StaveNote`'s job, so a fan on a note above or below the staff drew
 * floating heads. Per-note pitch makes that the ordinary case rather than the exception, which is
 * why it is fixed here (docs/fanned-beam-pitches-plan.md §2).
 *
 * VexFlow's own bounds and its own loop: staff lines are 1–5, so a head needs lines from 6 up to
 * its own, or from 0 down to it, at the INTEGER lines only (a head in a space hangs off the last
 * one). The line is drawn a glyph wide plus a little each side — `strokePx`, VexFlow's default.
 *
 * ⭐ The WHOLE member at once, because a ledger line is a fact about the LEVEL and not about one
 * head: every head standing at or beyond it shares the same line, so a chord with a second gets one
 * ledger reaching across both columns rather than two stubs with a gap between them. That is
 * `StaveNote.drawLedgerLines`' own rule (it widens to `doubleWidth` from the leftmost head when a
 * displaced head reaches the same level), stated once here for any number of heads.
 */
function drawFanLedgerLines(
  ctx: SVGContext,
  stave: Stave,
  heads: { line: number; x: number }[],
  glyphWidth: number,
): void {
  if (!heads.length) return
  const highest = Math.max(...heads.map(h => h.line))
  const lowest = Math.min(...heads.map(h => h.line))
  if (highest < 6 && lowest > 0) return
  // The stave's own ledger style, so these are the same ink as every other ledger on the page —
  // save/restore keeps it local (the rest ledgers do exactly this).
  ctx.save()
  stave.applyStyle(ctx, stave.getDefaultLedgerLineStyle())
  const stroke = (l: number, reaching: { x: number }[]): void => {
    const xs = reaching.map(h => h.x)
    const y = stave.getYForNote(l)
    ctx.beginPath()
    ctx.moveTo(Math.min(...xs) - FAN_LEDGER_OVERHANG, y)
    ctx.lineTo(Math.max(...xs) + glyphWidth + FAN_LEDGER_OVERHANG, y)
    ctx.stroke()
  }
  for (let l = 6; l <= highest; l++) stroke(l, heads.filter(h => h.line >= l))
  for (let l = 0; l >= lowest; l--) stroke(l, heads.filter(h => h.line <= l))
  ctx.restore()
}
