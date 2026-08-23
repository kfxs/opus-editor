/**
 * SOUND — which timbre the music plays as, in the `trillOps` / `hairpinOps` idiom: free functions
 * over a `Score`, with {@link ScoreModel} keeping thin public delegators.
 *
 * ⭐⭐ **THE POINT OF THIS MODULE IS WHERE THE ANSWER LIVES.** Until now the sound was
 * `PlaybackEngine.program` — a field on the editor, absent from the score, the JSON and undo — so
 * choosing one and reloading lost it, and a second score opened in the same editor silently
 * inherited the last one's timbre. It is now a positional statement IN the score value, resolved by
 * walking back from a position, exactly as a clef or a tempo is (principle 6; docs/instruments-plan.md
 * §5). ⛔ Never a `Score.sound` field: that would be, in truth, "the sound at bar 1 beat 0" — the
 * conflation that cost `score.clef`, `score.tempo` and `defaultTimeSignature` their places.
 *
 * ⚠️ **The score layer imports no audio, and that is a rule, not an accident** (principle 5;
 * `lint:boundary` enforces it). So {@link DEFAULT_SOUND} is a constant HERE, ⛔ never
 * `DEV_SOUNDS[0]` — that catalogue is the audio layer's, and reaching for it would make the model's
 * default depend on the picker's first row.
 *
 * ⏭️ **WHAT IS DELIBERATELY NOT HERE.** Lanes. Today one assignment governs every staff and every
 * voice, which is what the editor already did — this change is about persistence, not scope. When
 * `applySound(lane, …)` lands (docs/instruments-plan.md P2) it adds FIELDS to
 * {@link SoundAssignment} and a filter to {@link resolveSound}; nothing here is rewritten, and an
 * absent lane keeps meaning EVERY lane (see the type's note — it is a scope, not a position).
 */
import type { Score, SoundAssignment, SoundRef, Fraction } from '@/types/music'
import { fracCompare, fracFromInt } from '@/utils/fraction'

/**
 * What a note plays when nothing has been said — an implicit piano.
 *
 * ⛔ **A constant, never "the first assignment" or a stored global.** "The score's sound" as a
 * field would be the very bug this compartment avoids (docs/instruments-plan.md §5 rule 3).
 */
export const DEFAULT_SOUND: SoundRef = { kind: 'gm', program: 0 }

/** Beat 0 — where the one assignment written today sits, and the default for every question asked
 *  of a bar rather than of a point in it. */
const SCORE_START_BEAT = fracFromInt(0)

/** Every sound assignment, in the order stored (the live array; empty if none). */
export function getSoundAssignments(score: Score): readonly SoundAssignment[] {
  return score.playback?.sounds ?? []
}

/**
 * The sound in force at a position — the walk BACK that makes this positional rather than global.
 *
 * `measureId` absent (or unknown) answers for the START of the score, which is what every caller
 * wants today: one assignment at bar 1, or the default.
 *
 * ⚠️ Order comes from `score.measures`, never from the assignments' own order: they are anchored by
 * measure ID precisely so that inserting a bar cannot renumber them, and that means the SCORE is the
 * only thing that knows which anchor comes first.
 */
export function resolveSound(score: Score, at?: { measureId?: string; beat?: Fraction }): SoundRef {
  const assignments = getSoundAssignments(score)
  if (assignments.length === 0) return DEFAULT_SOUND

  const order = new Map(score.measures.map((m, i) => [m.id, i]))
  const targetIndex = at?.measureId !== undefined ? order.get(at.measureId) : 0
  // An anchor the score no longer has cannot be placed on the timeline at all. Answering for the
  // start of the score is the honest reading of "I cannot tell where this is" — ⛔ not silently
  // dropping the assignment, which would change what a file MEANS on the way through this function.
  const target = targetIndex ?? 0
  const beat = at?.beat ?? SCORE_START_BEAT

  let best: { index: number; beat: Fraction; sound: SoundRef } | null = null
  for (const a of assignments) {
    const index = order.get(a.measureId)
    if (index === undefined || index > target) continue
    if (index === target && fracCompare(a.beat, beat) > 0) continue
    if (best && (index < best.index || (index === best.index && fracCompare(a.beat, best.beat) < 0))) continue
    best = { index, beat: a.beat, sound: a.sound }
  }
  if (!best) return DEFAULT_SOUND
  // ⚠️ A `kind` this build does not know is KEPT in the file and ignored HERE — report-never-repair
  // (docs/json-io-plan.md). A later version's synth patch must not come back from a round trip
  // through this editor as a piano that overwrote it.
  return isPlayable(best.sound) ? best.sound : DEFAULT_SOUND
}

/** Can this build realise the reference? See {@link SoundRef} — the union will grow past `gm`. */
export function isPlayable(sound: SoundRef): boolean {
  return sound?.kind === 'gm' && Number.isInteger(sound.program)
}

/**
 * Say what the score sounds like from a position on — today always its start.
 *
 * ⭐ **Replaces the assignment at that exact anchor rather than stacking a second one**, the clef's
 * rule: two statements on one beat is a contradiction, not a history. Choosing the sound that is
 * already there is therefore idempotent, and choosing repeatedly (a user auditioning timbres) leaves
 * ONE assignment behind rather than a trail of dead ones.
 *
 * Returns the assignment written, so a caller can log or undo-label it.
 */
export function applySound(
  score: Score,
  sound: SoundRef,
  at?: { measureId?: string; beat?: Fraction },
): SoundAssignment | null {
  const measureId = at?.measureId ?? score.measures[0]?.id
  // No bars, no positions: there is nowhere for the statement to be. (A score always has one today;
  // this is the guard that keeps that from being an assumption.)
  if (measureId === undefined) return null
  const beat = at?.beat ?? SCORE_START_BEAT

  const assignment: SoundAssignment = { measureId, beat, sound }
  const sounds = [...getSoundAssignments(score)].filter(
    a => !(a.measureId === measureId && fracCompare(a.beat, beat) === 0),
  )
  sounds.push(assignment)
  score.playback = { ...score.playback, sounds }
  return assignment
}

/**
 * Take the statement back — the compartment disappears with its last assignment.
 *
 * ⭐ **The N=1 invariant** (docs/instruments-plan.md §10): a score nobody has chosen a sound for must
 * be byte-identical in JSON to one before this feature existed — no `playback: {}`, no
 * `sounds: []`. "Piano" is the ABSENCE of a statement, not a stored one, and a compartment left
 * behind empty would make every fresh file claim otherwise.
 */
export function clearSound(score: Score, at?: { measureId?: string; beat?: Fraction }): boolean {
  const assignments = getSoundAssignments(score)
  if (assignments.length === 0) return false
  const measureId = at?.measureId ?? score.measures[0]?.id
  const beat = at?.beat ?? SCORE_START_BEAT

  const sounds = assignments.filter(
    a => !(a.measureId === measureId && fracCompare(a.beat, beat) === 0),
  )
  if (sounds.length === assignments.length) return false
  if (sounds.length === 0) delete score.playback
  else score.playback = { ...score.playback, sounds }
  return true
}
