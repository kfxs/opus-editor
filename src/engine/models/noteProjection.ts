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

/** Assemble a flat Note from one pitch of a Chord. */
export function toFlatNote(chord: Chord, pitch: NotePitch): Note {
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
    tiedTo: pitch.tiedTo,
    tiedFrom: pitch.tiedFrom,
    dots: chord.dots,
    tupletId: chord.tupletId,
    actualDuration: chord.actualDuration,
    articulations: chord.articulations,
    articulationPlacement: chord.articulationPlacement,
    voice: chord.voice,
  }
}

/** Assemble a flat Note from a Rest. */
export function restToFlatNote(rest: Rest): Note {
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
    voice: rest.voice,
  }
}
