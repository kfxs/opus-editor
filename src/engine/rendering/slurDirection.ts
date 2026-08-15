/**
 * ⭐⭐ **WHICH SIDE A SLUR SITS ON, from the stems of every note it covers — not just its first.**
 *
 * The rule is Gould's notehead-side principle, and everyone implements the same two halves of it:
 * a slur goes on the side away from the stems, and when the stems disagree it goes **above**. What
 * differs between engines is only how many notes they look at, and the answer there is unanimous:
 * all of them.
 *
 * | engine | where |
 * |---|---|
 * | LilyPond | `Slur::calc_direction` — `d = DOWN`, then over every note column: `if (!has_rests(col) && dir(col) == DOWN) { d = UP; break; }` |
 * | MuseScore | `SlurTieLayout::computeUp` — `setUp(!startCR->up())`, then `else if (isDirectionMixture(chord1, chord2, ctx)) setUp(true)`, which walks every chord segment between the two |
 * | Verovio | `CalcSlurDirectionFunctor` — `if (system->HasMixedDrawingStemDir(start, end))` force above |
 *
 * ⭐ **MuseScore's is literally what this file replaces, plus the scan**: `!startCR->up()` was our
 * whole rule. So this is not a different rule, it is the same one evaluated on the right sample —
 * and until now the answer depended on which END of the slur you happened to start from, which is
 * not a property a slur should have.
 *
 * ⛔ **Not the voice rule.** A multi-voice bar puts the upper voice's slurs above and the lower
 * voice's below regardless of stems (Gould), and that decision outranks this one — it stays in
 * `SlurRenderer`, where the same branch already handles it. This module answers only the
 * single-voice question.
 *
 * ⚠️ **Resolved stem directions, never the model's.** Beaming forces the stems of a whole group, so
 * a note's natural direction and its drawn one differ; LilyPond reads `Note_column::dir` and
 * MuseScore `Chord::up()`, both post-layout. The caller passes what VexFlow actually drew.
 */
import type { Score, ChordRest } from '@/types/music'
import { voiceOf } from '@/utils/lanes'
import { fracCompare } from '@/utils/fraction'

/** Which side of the notes the arc sits on: **−1 above**, **+1 below** — `SlurRenderer`'s sign. */
export type SlurSide = -1 | 1

/**
 * ⭐ **THE RULE: any down stem puts the slur above; otherwise it goes below.**
 *
 * `stems` is one entry per covered note, as drawn — `1` up, `-1` down, anything else (a whole note,
 * a rest) meaning *no opinion* and skipped, the same exclusion LilyPond states as
 * `!Note_column::has_rests(col)`.
 *
 * Two cases are folded together on purpose, and all three engines fold them the same way: **all
 * stems down** and **stems mixed** both give above. For all-down that is just the notehead-side
 * rule; for mixed it is the only side that is free, since a down stem is ink hanging below its
 * notehead and an up stem is ink standing above a different one.
 *
 * ✅ **And the mixed half is Gould's, not just theirs** — *Behind Bars* p. 110: *"When groups of
 * **mixed stem direction** are encompassed by a slur, place the slur **above the stave**, except when
 * a beam may be in the way."* The scan itself is hers too, p. 112: *"**Take all the notes within the
 * slur into account** when determining whether the slur goes above or below the stave."* ⏭️ Her
 * beam exception is the one part none of the three engines implements, and neither do we.
 *
 * ⚠️ **No opinion anywhere → above, and this branch is UNREACHABLE through the real pipeline** —
 * kept as a defence, not as a rule. A stemless note still carries a stem DIRECTION: `NoteBuilder`
 * assigns every note one from its pitch, drawn or not, so a whole note answers `getStemDirection()`
 * like any other and the pitch decides. Measured in the browser (2026-08-15): two high whole notes
 * slur ABOVE, two low ones slur BELOW — which is Verovio's `isAboveStaffCenter` and Gould p. 110's
 * *"For stemless notes, place the slur as if the notes were stemmed"*, arriving for free. `e2e/slur.e2e.ts`
 * pins it. The branch fires only if a covered chord is missing from `staveNoteMap` entirely.
 */
export function slurSideFromStems(stems: readonly number[]): SlurSide {
  const stemmed = stems.filter(d => d === 1 || d === -1)
  if (stemmed.length === 0) return -1
  return stemmed.some(d => d === -1) ? -1 : 1
}

/** A slot's position in the score, for ordering a span that crosses barlines. */
function isBetween(
  at: { measure: number; beat: ChordRest['beat'] },
  from: { measure: number; beat: ChordRest['beat'] },
  to: { measure: number; beat: ChordRest['beat'] },
): boolean {
  const after = at.measure > from.measure || (at.measure === from.measure && fracCompare(at.beat, from.beat) >= 0)
  const before = at.measure < to.measure || (at.measure === to.measure && fracCompare(at.beat, to.beat) <= 0)
  return after && before
}

/** Where a note id lives, including inside a FANNED MEMBER — the same three places
 *  `SlurRenderer.measureOfNoteId` walks, because a slur may be anchored to any of them. */
function locate(score: Score, noteId: string): { measure: number; slot: ChordRest } | undefined {
  for (const m of score.measures) {
    for (const s of m.slots) {
      if (s.type === 'chord' && s.notes.some(p => p.id === noteId)) return { measure: m.number, slot: s }
      if (s.type === 'rest' && s.id === noteId) return { measure: m.number, slot: s }
      if (s.type === 'chord' && (s.fan?.members ?? []).some(mm => mm.pitches.some(p => p.id === noteId))) {
        return { measure: m.number, slot: s }
      }
    }
  }
  return undefined
}

/**
 * ⭐ **The ids of every CHORD the slur arcs over, in order** — one per covered note column, keyed
 * the way `staveNoteMap` is (a chord by its first pitch's id), so the caller can ask VexFlow what
 * it actually drew.
 *
 * ⚠️ **Scoped to the slur's own lane.** Only slots in the start slot's (voice, staff) count, which
 * is MuseScore's `c1->track()` and LilyPond's note-column set: a slur in voice 1 must not read the
 * stems of voice 2, or every multi-voice bar would look mixed. (That case is settled before this
 * module is reached anyway — see the file note — but the scoping has to be right regardless.)
 *
 * ⛔ RESTS are skipped, not merely stemless: LilyPond excludes them explicitly, and a rest under a
 * slur says nothing about which side is free.
 *
 * Returns `[]` if either end cannot be found, which the caller must treat as "no opinion" rather
 * than as an answer.
 */
export function coveredChordIds(score: Score, startNoteId: string, endNoteId: string): string[] {
  const from = locate(score, startNoteId)
  const to = locate(score, endNoteId)
  if (!from || !to) return []

  const lane = { voice: voiceOf(from.slot), staffId: from.slot.staffId }
  const start = { measure: from.measure, beat: from.slot.beat }
  const end = { measure: to.measure, beat: to.slot.beat }

  const ids: string[] = []
  for (const m of [...score.measures].sort((a, b) => a.number - b.number)) {
    if (m.number < start.measure || m.number > end.measure) continue
    for (const s of [...m.slots].sort((a, b) => fracCompare(a.beat, b.beat))) {
      if (s.type !== 'chord') continue
      if (voiceOf(s) !== lane.voice || s.staffId !== lane.staffId) continue
      if (!isBetween({ measure: m.number, beat: s.beat }, start, end)) continue
      const id = s.notes[0]?.id
      if (id) ids.push(id)
    }
  }
  return ids
}
