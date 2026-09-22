/**
 * ⭐⭐ **WHEN A GRACE SOUNDS** — `docs/plans/grace-notes-plan.md` §6, P3. Pure arithmetic in BEATS:
 * `collectScheduledNotes` decides which graces play and what they sound like; this lays them out in
 * time, and says how much of its main note they take.
 *
 * ## The first preset: MuseScore's (read in its SOURCE, 2026-09-22)
 *
 * `src/engraving/playback/renderers/gracechordcontext.cpp` (MuseScore 4's playback):
 *
 * - ⭐ **Each grace plays its WRITTEN value** (`durationTypeTicks` at the tempo) — the value the user
 *   chose is what sounds (his rule), until a CAP below takes over.
 * - **The cap on the whole group** (`graceNotesMaxAvailableDuration`):
 *   - a SINGLE appoggiatura, or graces AFTER: ½ of the main note — ⅔ when the meter is COMPOUND and
 *     the main note is longer than an 8th;
 *   - an ACCIACCATURA (or a GROUP of appoggiaturas before): one 64th per grace
 *     (`DEMISEMIQUAVER_TICKS / 2`), never more than ½ of the main note.
 * - Over the cap, every grace is scaled by ONE factor (`graceNotesDurationFactor`).
 * - Graces BEFORE start ON the beat; the main note starts after them and is shortened by them. Graces
 *   AFTER take the END of the main note; it keeps its start and is shortened.
 *
 * ⭐ Every one of those numbers is a fixed amount of BEATS (a 64th is 1/16 of a quarter at any tempo;
 * half the main note is half its beats), so no tempo map is needed here.
 *
 * ⚠️ The plan's first table (0.065 s per acciaccatura grace, "determined empirically") is ⛔ NOT what
 * this MuseScore does — it predates `gracechordcontext.cpp`. Replaced by the source.
 * ⏭️ Other presets (Stone's *"always before the beat"*, LilyPond's) wait in the plan, not built.
 */
import type { GraceGroup, GraceSide, NoteDuration, TimeSignature } from '@/types/music'
import { durationToBeats } from '@/utils/musicUtils'

/** MuseScore's rows — `gracechordcontext.cpp`, `sig.h`. */
export const GRACE_PLAYBACK = {
  /** An acciaccatura grace's ceiling, in quarter beats: a 64th. */
  crushBeatsPerGrace: { value: 1 / 16, source: 'MuseScore gracechordcontext.cpp: DEMISEMIQUAVER_TICKS / 2 per grace' },
  /** What a single appoggiatura (or a group after) may take of its main note. */
  appoggiaturaShare: { value: 1 / 2, source: 'MuseScore gracechordcontext.cpp: halvedDuration' },
  /** …in a COMPOUND meter, when the main note is longer than an 8th. */
  compoundShare: { value: 2 / 3, source: 'MuseScore gracechordcontext.cpp: twoThirdsDuration (isCompound && > QUAVER)' },
  /** Never more than this of the main note, whatever the kind. */
  maxShare: { value: 1 / 2, source: 'MuseScore gracechordcontext.cpp: min(…, halvedDuration)' },
} as const

/** MuseScore's `isCompound`: a numerator over 3 and divisible by 3 — 6/8, 9/8, 12/8 (⛔ not 3/8). */
export function isCompoundMeter(ts: Pick<TimeSignature, 'numerator'>): boolean {
  return ts.numerator > 3 && ts.numerator % 3 === 0
}

export interface GraceTimingInput {
  group: GraceGroup
  side: GraceSide
  /** The main note's onset and written length, beats. */
  mainStartBeats: number
  mainBeats: number
  compound: boolean
}

export interface GraceTiming {
  /** One entry per grace of the group, in order. */
  graces: { startBeats: number; durationBeats: number }[]
  /** How far the main note's onset moves LATER (graces before), beats. */
  mainDelayBeats: number
  /** How much shorter the main note sounds (the graces' whole time), beats. */
  mainTrimBeats: number
}

const writtenBeats = (g: { duration: NoteDuration; dots?: number }) => durationToBeats(g.duration, g.dots ?? 0)

/** ⭐ The group's timing — see the module header. */
export function graceTiming(input: GraceTimingInput): GraceTiming {
  const { group, side, mainStartBeats, mainBeats, compound } = input
  const count = group.notes.length
  const written = group.notes.map(writtenBeats)
  const total = written.reduce((a, b) => a + b, 0)
  if (count === 0 || total <= 0) return { graces: [], mainDelayBeats: 0, mainTrimBeats: 0 }

  const r = GRACE_PLAYBACK
  // An appoggiatura's share: a single one BEFORE, or any group AFTER (MuseScore's PostAppoggiatura).
  const share = side === 'after' || (!group.slash && count === 1)
    ? (compound && mainBeats > 0.5 ? r.compoundShare.value : r.appoggiaturaShare.value) * mainBeats
    : Math.min(r.crushBeatsPerGrace.value * count, r.maxShare.value * mainBeats)
  const actual = Math.min(share, total)
  const factor = actual / total

  let t = side === 'before' ? mainStartBeats : mainStartBeats + mainBeats - actual
  const graces = written.map(beats => {
    const durationBeats = beats * factor
    const at = { startBeats: t, durationBeats }
    t += durationBeats
    return at
  })
  return { graces, mainDelayBeats: side === 'before' ? actual : 0, mainTrimBeats: actual }
}
