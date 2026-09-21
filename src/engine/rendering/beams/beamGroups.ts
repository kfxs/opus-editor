/**
 * ⭐ **WHICH NOTES BEAM TOGETHER, and the beams built over them** — a lane's beam groups as
 * `EngravedBeam`s, plus the joined fan groups that get no `Beam` of their own.
 *
 * Moved out of `ScoreRenderer` on 2026-09-21 (`docs/plans/bent-staff-plan.md` §6), unchanged: the body
 * used nothing of the renderer's, and the bent staff (`eye/spineScore`) has to ask the SAME question —
 * two answers to *"what is one beam?"* would draw a different rhythm on the circle than on the page.
 * The decisions themselves were already pure: the groups (`utils/beaming`), the group's one stem
 * direction (`models/stemOps`), the secondary breaks and the fractional sides.
 */
import type { ChordRest, Clef } from '@/types/music'
import type { Fraction } from '@/utils/fraction'
import { computeBeamGroups, secondaryBreakIndices } from '@/utils/beaming'
import type { MeterInfo } from '@/utils/meter'
import { beamGroupStemDirection } from '@/engine/models/stemOps'
import { EngravedBeam, applyFractionalBeamSides } from '../engraved/EngravedBeam'
import type { EngravedNote, NoteBeam } from '../engraved/EngravedNote'
import type { FanJoin } from './FanPass'

/**
 * The stand-in a note wears while its real beam does not exist yet — a note beamed across a barline,
 * between its own bar's draw and the post-measure pass that builds the joined `Beam`
 * (docs/plans/cross-barline-beaming-plan.md).
 *
 * It is never drawn and never asked anything: VexFlow only tests `note.beam` for *existence* when
 * deciding to draw a flag (`shouldDrawFlag`) or a stem (`draw`), and the one method it does call on
 * it — `postFormat`, forwarded by `StemmableNote.postFormat` during formatting — is the no-op below.
 * A real `Beam` cannot serve: its constructor throws on fewer than two notes, and `♪ | ♪` (one note
 * each side of the barline) is the canonical case this feature exists for.
 */
export const PLACEHOLDER_BEAM: NoteBeam = { postFormat: () => {} }

/**
 * This lane's beams — plus the JOINED FAN GROUPS, which get no `Beam` at all.
 *
 * ⭐ A group holding a fanned slot is the fan's (docs/plans/fan-beam-join-plan.md P1): its beam is drawn
 * by hand from end to end, because "VexFlow's beam meets our ramp at the shared stem" would be a
 * polyline of three slopes where a beam group must be one straight edge, and it would put two
 * owners on one stem tip. One line, one owner, one pass. So all this does for such a group is
 * settle the stem direction and suppress the prefix's own stems and flags; {@link drawFannedBeams}
 * draws it once the geometry is real.
 */
export function buildBeams(
  staveNotes: EngravedNote[],
  sortedSlots: ChordRest[],
  meter: MeterInfo,
  clefForBeat: (beat: Fraction) => Clef,
  forcedStemDirection?: number,
  /** This lane's groups, when a cross-barline plan owns them (docs/plans/cross-barline-beaming-plan.md).
   *  A lane whose barline is open cannot be grouped from its own slots alone — a leading
   *  `continue` reads as an orphan — so the plan's answer replaces the per-bar one. */
  inBarGroups?: number[][],
): { beams: EngravedBeam[]; fanJoins: FanJoin[] } {
  const groupIndices = inBarGroups ?? computeBeamGroups(sortedSlots, meter)
  const beams: EngravedBeam[] = []
  const fanJoins: FanJoin[] = []

  for (const indices of groupIndices) {
    try {
      const groupSlots = indices.map(i => sortedSlots[i])
      // A beam group lies within one clef region; use the clef at its first slot.
      const groupClef = groupSlots.length ? clefForBeat(groupSlots[0].beat) : 'treble'

      // ⭐ THE JOINED FAN — or fanS: P2 puts a whole CHAIN of them on one beam, each joined to the
      // one before it, and the fans are always the group's TAIL (nothing but a fan may follow a
      // fan), so everything in front of the first one is the prefix.
      const fans = indices.filter(i => { const slot = sortedSlots[i]; return slot.type === 'chord' && !!slot.fan })
      if (fans.length) {
        // Rests are dropped: a `beamOver` rest is inside the span but has no stem to aim, and the
        // line simply runs over it.
        const prefix = indices.filter(i => i < fans[0] && sortedSlots[i].type === 'chord')
        // A group of one is not a beam. The grouper drops those already; this is the same rule for
        // a group the renderer sees through the cross-barline plan's own `inBarGroups`.
        if (prefix.length + fans.length < 2) continue
        // Every fan's OWNER votes on the direction with its own notes — they are members of this
        // group, and a beam group has one direction.
        // ⏭ Open: whether the fans' MEMBER pitches vote too. They are not in `slot.notes`, so
        // `calculateBeamGroupStemDirection` cannot see them today.
        const stemDirection = beamGroupStemDirection(groupSlots, groupClef, forcedStemDirection)
        for (const i of prefix) {
          // The placeholder goes on AFTER the direction — `setStemDirection` CLEARS `note.beam`.
          staveNotes[i].setStemDirection(stemDirection)
          staveNotes[i].setBeam(PLACEHOLDER_BEAM)
        }
        // ⚠️ THE OWNERS ARE LEFT ALONE, and that is not a shortcut. `StaveNote.draw` skips the stem
        // whenever `note.beam` is set, so a placeholder there would delete the one stem this whole
        // feature anchors its line to; and `getStemExtension()` answers `stemBeamExtension` once
        // `beam` is set, which MOVES the tip and would make a joined fan sit at a different height
        // from an unjoined one. Nothing is bought either way — `NoteBuilder` already builds a
        // fanned slot as a plain quarter, so there is no flag to suppress.
        for (const i of fans) staveNotes[i].setStemDirection(stemDirection)
        fanJoins.push({ prefix, fans })
        continue
      }

      const beamStemDirection = beamGroupStemDirection(groupSlots, groupClef, forcedStemDirection)
      const groupNotes = indices.map(i => staveNotes[i])
      for (const staveNote of groupNotes) {
        staveNote.setStemDirection(beamStemDirection)
      }
      const beam = new EngravedBeam(groupNotes)
      // Secondary beam breaks — VexFlow's own primitive, no geometry of ours. The index translation
      // (our flag is on the note the break is IN FRONT OF; VexFlow wants the note the beam ends
      // AFTER) lives in the pure module beside the grouping.
      const breaks = secondaryBreakIndices(groupSlots)
      if (breaks.length) beam.breakSecondaryAt(breaks)
      applyFractionalBeamSides(beam, groupSlots)
      beams.push(beam)
    } catch (beamError) {
      console.warn(`Could not create beam: ${beamError}`)
    }
  }

  return { beams, fanJoins }
}
