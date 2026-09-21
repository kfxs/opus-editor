/**
 * ⭐⭐ **WHICH WAY A STEM POINTS, AND WHAT `x` TURNS AROUND** — a SCORE operation, free functions on
 * a `Score` in the `clefOps` / `markOps` / `tempoOps` idiom (DESIGN-PRINCIPLES §5, so none of it may
 * live on `MusicEngine`).
 *
 * ## 🚨🚨 A BEAMED NOTE HAS NO STEM OF ITS OWN — his report, 2026-08-31
 *
 * *"the two notes are beamed and grouped with stem down so im flipin B and nothing hapends… in case
 * is a beamed group what the user expect is to flip the group"*, with a log of the key working
 * perfectly and the picture never changing:
 *
 * ```
 * [Model.updateNote] v0 B4 8 m1 b0.000 ← {stemDirection} {stemDirection: 'up'}
 * [Model.updateNote] v0 B4 8 m1 b0.000 ← {stemDirection} {stemDirection: 'auto'}   ← and repeat
 * ```
 *
 * ⭐ **The flip was asking the wrong thing which way the note is drawn.** It read the note's OWN
 * pitch against the middle line (B4 in treble → down) and wrote the opposite ('up'). But a beam has
 * ONE side, decided over every pitch in the group (`beamGroupStemDirection`), and his group — B4 with
 * a G4 under it — was already drawn UP. So the flip wrote the direction the group already had, twice
 * a press, for ever. ⛔ Nothing was broken in the write, the undo or the render: the DECISION was
 * measured against a note that does not decide.
 *
 * ⭐⭐ **So the group is the unit.** A press on any member reads the GROUP's drawn direction and
 * writes the opposite to every member; a second press clears them all back to auto. A note that is
 * not beamed is a group of one, which is the same rule and the behaviour that was always there.
 *
 * ⭐ **And the group's own rule lives HERE, once** ({@link beamGroupStemDirection}) — moved out of
 * `ScoreRenderer`, which now calls it to draw. Two answers to *"which way does this group point?"*
 * is precisely the bug above: the flip had its own, and it disagreed with the ink.
 */
import type { Chord, ChordRest, Clef, Measure, Score, StemDirection } from '@/types/music'
import { computeBeamGroups } from '@/utils/beaming'
import { getMeterInfo } from '@/utils/meter'
import { effectiveClefAt, middleLineDiatonicPos } from '@/utils/clefUtils'
import { fracCompare } from '@/utils/fraction'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { voiceOf } from '@/utils/lanes'
import { staffIdAtIndex, staffIndexOfId, staffSlots } from './staffContent'
import { displayStaffIndex } from './crossStaffOps'

/**
 * ⭐⭐ **THE SIDE A BEAM GROUP'S STEMS TAKE** — the drawing's rule, and since 2026-08-31 the flip's
 * too. Moved here from `ScoreRenderer.calculateBeamGroupStemDirection` unchanged.
 *
 * In order: an explicit `stemDirection` on ANY slot of the group wins (one member's flip is the
 * group's, which is what makes {@link flipStems}' write legible); then the multi-voice default the
 * lane was handed (V1/V3 up, V2/V4 down); then the pitch FURTHEST from the middle line — the group
 * decides once, over every note in it.
 *
 * @returns VexFlow's convention: 1 up, −1 down. A group with no pitch at all reads as down, which is
 *   the middle-line convention every other stem rule here follows.
 */
export function beamGroupStemDirection(slots: ChordRest[], clef: Clef = 'treble', forced?: number): number {
  for (const slot of slots) {
    if (slot.type === 'chord' && slot.stemDirection === 'up') return 1
    if (slot.type === 'chord' && slot.stemDirection === 'down') return -1
  }

  if (forced !== undefined) return forced

  const middleDiatonic = middleLineDiatonicPos(clef)
  let maxDistance = 0
  let furthestDiatonic = middleDiatonic
  let hasPitch = false

  for (const slot of slots) {
    if (slot.type === 'rest') continue
    for (const p of slot.notes) {
      const dPos = spellingDiatonicPos(p.step, p.octave)
      const distance = Math.abs(dPos - middleDiatonic)
      if (!hasPitch || distance > maxDistance) {
        maxDistance = distance
        furthestDiatonic = dPos
        hasPitch = true
      }
    }
  }

  return furthestDiatonic >= middleDiatonic ? -1 : 1
}

/**
 * ⭐⭐ **FLIP THE STEM OF THE THING THAT HAS ONE** — the note's beam GROUP, or the note alone when it
 * is not beamed. `x`'s fallback row (`interactions/state/flipSelection`), through
 * `ScoreModel.flipStemDirection`.
 *
 * Two presses round-trip: forced → auto, so a flipped-then-unflipped group follows the engraver
 * again (the rule every other `x` row keeps). ⭐ "Forced" is asked of the WHOLE group — a group with
 * one member pinned and the rest on auto is a half-written state the old per-note flip could
 * produce, and one press tidies it into the direction it is actually drawn with.
 *
 * ⛔ Rests inside the group are left alone: a beam may run over one (`beamOver`), and a rest has no
 * stem to point.
 *
 * @returns the ids of the slots written, or null when there is nothing to flip (no such note, a
 *   rest). ⚠️ The caller commits — this only mutates, like every other op module here.
 */
export function flipStems(score: Score, noteId: string): string[] | null {
  const found = locate(score, noteId)
  if (!found) return null
  const { measure, slot, staffId } = found
  if (slot.type !== 'chord') return null

  const group = beamGroupOf(score, measure, staffId, slot)
  const chords = group.filter((s): s is Chord => s.type === 'chord')
  if (!chords.length) return null

  // ⭐ Already pinned, all of it → back to auto. ⚠️ `every`, not `some`: a group only half-pinned is
  //   still being read from ONE member's write, so the press that follows should turn it around
  //   rather than release it.
  const forced = chords.every(c => c.stemDirection === 'up' || c.stemDirection === 'down')
  let direction: StemDirection | undefined
  if (!forced) {
    const drawn = drawnGroupDirection(score, measure, staffId, slot, group)
    direction = drawn === -1 ? 'up' : 'down'
  }

  for (const chord of chords) chord.stemDirection = direction
  return chords.map(c => c.id)
}

/**
 * ⭐⭐ **WHICH WAY THE GROUP IS DRAWN, as the renderer decides it** — what {@link flipStems} writes
 * the OPPOSITE of. 🚨 His report, 2026-09-21, on a chord split across two staves: *"I'm pressing x
 * to flip the stem but is not possible"*. The flip read the pitches against the HOME staff's middle
 * line (A3·C4·E4 in bass clef → "down") and wrote 'up' — which a split chord already is, because
 * its stem runs TOWARD the staff its other heads are written on. Written, undone on the next press,
 * and never visible: the August bug again, one feature later — ⛔ a flip must be measured against
 * the rule that DRAWS.
 *
 * The renderer's order (`rendering/engraved/NoteBuilder`, `rendering/beams/beamGroups`), mirrored:
 *  - a chord SPLIT across two staves (unbeamed) → toward the other staff, outranking the voice default;
 *  - a chord, or a whole beam group, written ENTIRELY on the other staff → the ordinary rule, read
 *    in THAT staff's clef;
 *  - everything else → the ordinary rule in the home clef.
 *
 * ⚠️ A beam group written on BOTH staves is drawn with stems pointing inward — two directions, so
 * there is no opposite to write. It gets the ordinary rule's answer, which turns the group into
 * Gould's *"beam above or below the system"* (p. 314 b) and is a visible change. ⚠️ Except when the
 * renderer had already declined the cross-staff beam (stems under its 2½-space floor): that needs
 * the staff gap, which the score does not hold, so that one press writes what is already drawn.
 */
function drawnGroupDirection(
  score: Score,
  measure: Measure,
  staffId: string | undefined,
  slot: ChordRest,
  group: ChordRest[],
): number {
  const home = staffIndexOfId(score, staffId)
  const chords = group.filter((s): s is Chord => s.type === 'chord')

  /** The ONE staff a chord is written on, or null when it is split. */
  const writtenOn = (chord: Chord): number | null => {
    const indices = new Set(chord.notes.map(p => displayStaffIndex(score, chord, p.id)))
    return indices.size === 1 ? [...indices][0] : null
  }

  if (chords.length === 1 && writtenOn(chords[0]) === null) {
    const away = chords[0].notes
      .map(p => displayStaffIndex(score, chords[0], p.id))
      .find(index => index !== home) ?? home
    return away < home ? 1 : -1 // the staff ABOVE has the smaller index
  }

  const staves = chords.map(writtenOn)
  const elsewhere = staves[0]
  const clefStaffId = elsewhere !== null && elsewhere !== home && staves.every(i => i === elsewhere)
    ? staffIdAtIndex(score, elsewhere)
    : staffId
  const clef = effectiveClefAt(score, measure.number, slot.beat, clefStaffId)
  return beamGroupStemDirection(group, clef, laneForcedStem(score, measure, staffId, slot))
}

/**
 * ⭐ **WHICH NOTES TO PRESS, to turn a whole SELECTION around** — his report, 2026-09-21: *"i select
 * all that notes, and hit X but only the first is flipping… X should affect all"*.
 *
 * ⚠️ **One note per beam group.** {@link flipStems} is a toggle on the GROUP, so pressing it once
 * per selected head would turn a two-note chord around and back again — every even-sized selection
 * inside one group a silent no-op. This answers the first selected note of each group (a chord that
 * is not beamed is a group of one), in selection order; rests and unknown ids have no stem and are
 * dropped. Each group then answers for ITSELF — a pinned one goes back to auto while an auto one
 * beside it is turned — exactly as a single press does.
 */
export function stemFlipTargets(score: Score, noteIds: readonly string[]): string[] {
  const covered = new Set<string>()
  const targets: string[] = []
  for (const noteId of noteIds) {
    const found = locate(score, noteId)
    if (!found || found.slot.type !== 'chord' || covered.has(found.slot.id)) continue
    for (const member of beamGroupOf(score, found.measure, found.staffId, found.slot)) covered.add(member.id)
    targets.push(noteId)
  }
  return targets
}

/** The slot with this note id (a chord's own id or one of its pitches'), with where it lives. */
function locate(
  score: Score,
  noteId: string,
): { measure: Measure; slot: ChordRest; staffId: string | undefined } | null {
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      const hit = slot.id === noteId
        || (slot.type === 'chord' && slot.notes.some(p => p.id === noteId))
      if (hit) return { measure, slot, staffId: slot.staffId }
    }
  }
  return null
}

/**
 * The slots this one shares a beam with — itself alone when it is not beamed.
 *
 * ⚠️ Grouped over its OWN LANE (this staff, this voice, sorted by beat), which is the slice
 * `utils/beaming` insists on: grouping a voice-2 note against voice 1's slots scores it against
 * music it is not beamed with.
 *
 * ⚠️ **In-bar grouping only.** A beam that crosses a barline is planned over a RUN of bars
 * (`utils/beaming.computeCrossBarBeamGroups`, from marks this bar cannot see alone), so a flip on
 * such a group turns around the half of it that lives in this bar. ⏭️ The honest fix is the run, and
 * it needs the plan the renderer builds; ⛔ not a guess from one bar.
 */
function beamGroupOf(score: Score, measure: Measure, staffId: string | undefined, slot: ChordRest): ChordRest[] {
  const lane = staffSlots(measure, staffId, score)
    .filter(s => voiceOf(s) === voiceOf(slot))
    .sort((a, b) => fracCompare(a.beat, b.beat))
  const index = lane.indexOf(slot)
  if (index === -1) return [slot]
  const group = computeBeamGroups(lane, getMeterInfo(measure.timeSignature))
    .find(indices => indices.includes(index))
  return group ? group.map(i => lane[i]) : [slot]
}

/**
 * The stem this LANE is forced to by the multi-voice convention (V1/V3 up, V2/V4 down), or undefined
 * on a staff with one voice in this bar — the renderer's own gate, mirrored (`ScoreRenderer`:
 * `stemUp = voice % 2 === 0`).
 *
 * 🚨 It is why this is not a pitch question: in a two-voice bar the shown stem is the voice's, so a
 * flip measured against the pitch would target the side the note is already on. (Its repro was a low
 * V2 note that never flipped — the reason the old per-note flip read this in the first place.)
 */
function laneForcedStem(
  score: Score,
  measure: Measure,
  staffId: string | undefined,
  slot: ChordRest,
): number | undefined {
  const voices = new Set(staffSlots(measure, staffId, score).map(s => voiceOf(s)))
  if (voices.size <= 1) return undefined
  return voiceOf(slot) % 2 === 0 ? 1 : -1
}
