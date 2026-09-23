/**
 * Projection from the internal voice-ready model (`Chord` / `NotePitch` / `Rest`)
 * to the public flat `Note` shape used by the engine's public API and JSON.
 *
 * Extracted from {@link ScoreModel} (it keeps thin private delegators to these).
 * These are pure field-mappers — no score/instance state — and document the
 * internal↔public boundary in one named home. See `src/types/music.ts` for the
 * authoritative model/flat definitions.
 */
import type { BracketedGrace, Note, Chord, GraceNote, NotePitch, Rest, Score } from '@/types/music'
import { projectAttackMarks } from './slotLookup'
import { staffIndexOfId } from './staffContent'

/**
 * Assemble a flat Note from one pitch of a Chord.
 *
 * `staffIndex` is the 0-based staff ordinal (the `staffId → index` projection resolved by
 * the caller against {@link Score.staves}); it defaults to 0, the single-staff case. See
 * docs/plans/multi-staff-plan.md §4.
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
    ...(pitch.enclosure && { enclosure: pitch.enclosure }),
    stemDirection: chord.stemDirection,
    beam: chord.beam,
    secondaryBreak: chord.secondaryBreak,
    fractionalBeamSide: chord.fractionalBeamSide,
    tiedTo: pitch.tiedTo,
    tiedFrom: pitch.tiedFrom,
    dots: chord.dots,
    tupletId: chord.tupletId,
    actualDuration: chord.actualDuration,
    articulations: chord.articulations,
    articulationPlacement: chord.articulationPlacement,
    articulationStemAlign: chord.articulationStemAlign,
    tremolo: chord.tremolo,
    tremoloPair: chord.tremoloPair,
    tremoloPairStyle: chord.tremoloPairStyle,
    fan: chord.fan,
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

/**
 * The two projections above, with the staff ordinal resolved off the score — what a caller holding
 * a `Score` actually wants, and what {@link ScoreModel}'s private `toFlatNote` / `restToFlatNote`
 * were. Split out so the `*Ops` modules (free functions over a score) can project without going
 * back through the model (docs/history/modularity-plan-2026-07-28.md Phase 3).
 */
export function flatNoteOf(score: Score, chord: Chord, pitch: NotePitch): Note {
  return toFlatNote(chord, pitch, staffIndexOfId(score, chord.staffId))
}

/** {@link flatNoteOf}'s rest twin. */
export function flatRestOf(score: Score, rest: Rest): Note {
  return restToFlatNote(rest, staffIndexOfId(score, rest.staffId))
}

/**
 * ⭐ Turn a flat Note projected through a GRACE's main chord into the GRACE's own
 * (docs/plans/grace-notes-plan.md §2): its written value and its marks, and none of the statements
 * about the SLOT — the beam, the fan, the tremolo, the tuplet's recomputed length. The beat, voice
 * and staff stay the main chord's: a grace has none of its own, it stands at its chord's.
 */
/**
 * ⭐ A BRACKETED grace projects as ITSELF (docs/plans/bracketed-grace-plan.md P2b) — its pitch and its
 * written value over its host's flat note; ⛔ none of the host's statements, and no marks: it is
 * information, not an attack (B6).
 */
export function projectBracketedNote(note: Note, pitch: NotePitch, bracketed: BracketedGrace): Note {
  note.id = pitch.id
  note.step = pitch.step
  note.alter = pitch.alter
  note.octave = pitch.octave
  if (pitch.forceAccidental) note.forceAccidental = true
  else delete note.forceAccidental
  delete note.isRest
  delete note.isMeasureRest
  note.duration = bracketed.duration
  for (const k of ['dots', 'fan', 'beam', 'secondaryBreak', 'fractionalBeamSide', 'tremolo', 'tremoloPair', 'tremoloPairStyle', 'actualDuration', 'articulationStemAlign', 'stemDirection', 'articulations', 'articulationPlacement', 'tiedTo', 'tiedFrom', 'enclosure'] as const) delete note[k]
  return note
}

export function projectGraceNote(note: Note, pitch: NotePitch, grace: GraceNote): Note {
  // The PITCH is the grace's own — over a REST host's flat note there is none to inherit.
  note.id = pitch.id
  note.step = pitch.step
  note.alter = pitch.alter
  note.octave = pitch.octave
  if (pitch.forceAccidental) note.forceAccidental = true
  else delete note.forceAccidental
  if (pitch.enclosure) note.enclosure = pitch.enclosure
  else delete note.enclosure
  delete note.isRest
  delete note.isMeasureRest
  note.duration = grace.duration
  if (grace.dots) note.dots = grace.dots
  else delete note.dots
  for (const k of ['fan', 'beam', 'secondaryBreak', 'fractionalBeamSide', 'tremolo', 'tremoloPair', 'tremoloPairStyle', 'actualDuration', 'articulationStemAlign', 'stemDirection'] as const) delete note[k]
  // ⭐ …but ITS OWN beam statement, within its group — what the beam keys read back.
  if (grace.beam) note.beam = grace.beam
  projectAttackMarks(note, grace)
  return note
}
