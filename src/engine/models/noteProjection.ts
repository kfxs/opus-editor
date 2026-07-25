/**
 * Projection from the internal voice-ready model (`Chord` / `NotePitch` / `Rest`)
 * to the public flat `Note` shape used by the engine's public API and JSON.
 *
 * Extracted from {@link ScoreModel} (it keeps thin private delegators to these).
 * These are pure field-mappers — no score/instance state — and document the
 * internal↔public boundary in one named home. See `src/types/music.ts` for the
 * authoritative model/flat definitions.
 */
import type { Note, Chord, NotePitch, Rest } from '@/types/music'

/**
 * Assemble a flat Note from one pitch of a Chord.
 *
 * `staffIndex` is the 0-based staff ordinal (the `staffId → index` projection resolved by
 * the caller against {@link Score.staves}); it defaults to 0, the single-staff case. See
 * docs/multi-staff-plan.md §4.
 */
export function toFlatNote(chord: Chord, pitch: NotePitch, staffIndex = 0): Note {
  return {
    id: pitch.id,
    step: pitch.step,
    alter: pitch.alter,
    octave: pitch.octave,
    duration: chord.duration,
    measure: chord.measure,
    beat: chord.beat,
    isRest: false,
    forceAccidental: pitch.forceAccidental,
    stemDirection: chord.stemDirection,
    beam: chord.beam,
    secondaryBreak: chord.secondaryBreak,
    tiedTo: pitch.tiedTo,
    tiedFrom: pitch.tiedFrom,
    dots: chord.dots,
    tupletId: chord.tupletId,
    actualDuration: chord.actualDuration,
    articulations: chord.articulations,
    articulationPlacement: chord.articulationPlacement,
    articulationStemAlign: chord.articulationStemAlign,
    tremolo: chord.tremolo,
    voice: chord.voice,
    // Mirror voice: the default (0) staff is left absent, so N=1 Notes are unchanged.
    staff: staffIndex === 0 ? undefined : staffIndex,
  }
}

/** Assemble a flat Note from a Rest. `staffIndex` defaults to 0 (single staff). */
export function restToFlatNote(rest: Rest, staffIndex = 0): Note {
  return {
    id: rest.id,
    duration: rest.duration,
    measure: rest.measure,
    beat: rest.beat,
    isRest: true,
    isMeasureRest: rest.isMeasureRest,
    dots: rest.dots,
    tupletId: rest.tupletId,
    actualDuration: rest.actualDuration,
    tiedFrom: rest.tiedFrom,
    beamOver: rest.beamOver,
    voice: rest.voice,
    staff: staffIndex === 0 ? undefined : staffIndex,
  }
}
