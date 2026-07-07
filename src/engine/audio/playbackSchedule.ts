/**
 * Pure (Tone-free) note-scheduling for playback. Walks a {@link Score} and returns the flat
 * list of sounding notes with absolute onsets + durations in quarter-note beats — everything
 * {@link PlaybackEngine.play} needs *except* the Tone.js scheduling call itself. Extracting it
 * keeps the timing/tie/legato/dynamics/articulation logic unit-testable (no AudioContext).
 *
 * **Multi-staff:** `Measure.slots` is the FLAT (staffId-discriminated) slot array — it already
 * holds every staff's content interleaved — so a single pass over it schedules all stacked
 * staves against ONE shared per-measure clock. There is no per-staff accumulation (staff 2 bar
 * 3 and staff 1 bar 3 share the same absolute onset), which is exactly the invariant the
 * multi-staff plan (§8) calls for; the flat model gets it for free. Per-staff *dynamics*
 * loudness stays a deferred refinement — {@link resolveChordLevels} is voice-scoped, not
 * staff-scoped, so a staff-2 chord currently inherits its voice's dynamic (never silence).
 */
import type { Score, Chord, NotePitch } from '@/types/music'
import { durationToBeats, measureCapacityQuarters } from '@/utils/musicUtils'
import { fracToNumber } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { DYNAMIC_VELOCITY, DEFAULT_DYNAMIC, resolveChordLevels } from '@/utils/dynamics'
import { legatoChordIds } from '@/utils/slurs'
import { articulationEffect } from '@/utils/articulations'

/** A single sounding note to schedule, in tempo-independent beat units. */
export interface ScheduledNote {
  /** Sounding MIDI pitch (derived from the stored spelling). */
  midi: number
  /** Absolute onset from score start, in quarter-note beats (the shared clock). */
  startBeats: number
  /** Sounding length in beats, after tie-extension, legato overlap and articulation. */
  durationBeats: number
  /** Normalized velocity 0–1 (dynamic level × articulation scale). */
  velocity: number
}

/** Legato (slur) binds a note slightly past its nominal end so it meets the next onset. */
const LEGATO_OVERLAP_BEATS = 0.12

/** Total sounding length of the score in beats (shared spine — sum of per-measure capacity). */
export function scoreTotalBeats(score: Score): number {
  let total = 0
  for (const measure of score.measures) total += measureCapacityQuarters(measure)
  return total
}

/**
 * Flatten a score into the notes to sound, in schedule order. Absolute onsets come from a
 * shared per-measure clock (accumulated ONCE per measure, reused across staves), so parallel
 * staves line up. Same-pitch ties are chased to extend the head note's duration and suppress
 * the continuation's re-attack; a differently-pitched "tie" (a migration artifact) plays
 * normally. Rests produce nothing.
 */
export function collectScheduledNotes(score: Score): ScheduledNote[] {
  // Pass 1: id → owning chord, so a tiedTo/tiedFrom chain can look up its neighbour's pitch.
  // (Global note ids, so this is naturally staff-safe; the chase is also pitch-guarded below.)
  const chordOf = new Map<string, Chord>()
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'chord') {
        for (const np of slot.notes) chordOf.set(np.id, slot)
      }
    }
  }

  // Dynamics as a per-voice step function (chord.id → level); legato set of slurred chords.
  const chordLevels = resolveChordLevels(score)
  const legatoChords = legatoChordIds(score)

  const events: ScheduledNote[] = []
  let currentTimeInBeats = 0
  for (const measure of score.measures) {
    const measureStartBeats = currentTimeInBeats

    for (const slot of measure.slots) {
      if (slot.type === 'rest') continue
      const chord = slot

      // Articulation bends attack (velocity) and length (duration) on top of the dynamic.
      const artic = articulationEffect(chord.articulations)
      const baseVelocity = DYNAMIC_VELOCITY[chordLevels.get(chord.id) ?? DEFAULT_DYNAMIC]
      const velocity = Math.min(1, baseVelocity * artic.velocityScale)
      const startBeats = measureStartBeats + fracToNumber(chord.beat)
      const baseDurationBeats = chord.actualDuration
        ? fracToNumber(chord.actualDuration)
        : durationToBeats(chord.duration, chord.dots || 0)

      for (const np of chord.notes) {
        // Skip a true (same-pitch) tied continuation — its head already carries the length.
        if (np.tiedFrom) {
          const source = chordOf.get(np.tiedFrom)?.notes.find(n => n.id === np.tiedFrom)
          if (source && sameMidi(source, np)) continue
        }

        // Extend across a same-pitch tiedTo chain; stop at a different pitch or a dead link.
        let durationBeats = baseDurationBeats
        let cursor: NotePitch = np
        while (cursor.tiedTo) {
          const nextChord = chordOf.get(cursor.tiedTo)
          const nextNp = nextChord?.notes.find(n => n.id === cursor.tiedTo)
          if (!nextChord || !nextNp || !sameMidi(nextNp, cursor)) break
          durationBeats += nextChord.actualDuration
            ? fracToNumber(nextChord.actualDuration)
            : durationToBeats(nextChord.duration, nextChord.dots || 0)
          cursor = nextNp
        }

        // Legato: bind to the next onset with a small, capped overlap.
        if (legatoChords.has(chord.id)) {
          durationBeats += Math.min(LEGATO_OVERLAP_BEATS, baseDurationBeats * 0.5)
        }

        events.push({
          midi: spellingToMidi(np.step, np.alter, np.octave),
          startBeats,
          durationBeats: durationBeats * artic.durationFactor, // staccato shortens, tenuto holds
          velocity,
        })
      }
    }

    currentTimeInBeats += measureCapacityQuarters(measure)
  }

  return events
}

/** Do two note-pitches sound the same MIDI? (The tie-chase only follows true same-pitch ties.) */
function sameMidi(a: NotePitch, b: NotePitch): boolean {
  return spellingToMidi(a.step, a.alter, a.octave) === spellingToMidi(b.step, b.alter, b.octave)
}
