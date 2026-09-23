/**
 * ⭐ **BRACKETED GRACES — the pure reads and the copy**, shared by the relay (`utils/rebar`), the
 * materialisers (`engine/models/rebarOps`, `slotPlacementOps`), the grace copy (`utils/graceNotes`) and
 * the operations (`engine/models/bracketedGraceOps`). `docs/plans/bracketed-grace-plan.md` §1.
 *
 * In `utils/` for `graceNotes`' reason: the relay lives here and may not import `engine/`.
 */
import { v4 as uuidv4 } from 'uuid'
import type { BracketedGrace, Chord, GraceNote, NotePitch } from '@/types/music'

/** Which side of its target a bracketed grace stands on (B5). A GRACE target takes `before` only. */
export type BracketedSide = 'before' | 'after'

/** Both sides, in drawing order. */
export const BRACKETED_SIDES: readonly BracketedSide[] = ['before', 'after']

/** The target's field for one side — the one place the side is spelled as a key. */
export function bracketedKey(side: BracketedSide): 'bracketedBefore' | 'bracketedAfter' {
  return side === 'before' ? 'bracketedBefore' : 'bracketedAfter'
}

/** What a bracketed grace can hang on (B2): a main chord (both sides) or a grace (before only). */
export type BracketedTarget = Chord | GraceNote

/** The target's list on that side, if it has one — a GRACE holds a list BEFORE only (B5). */
export function bracketedOf(target: BracketedTarget, side: BracketedSide): BracketedGrace[] | undefined {
  if (side === 'before') return target.bracketedBefore
  return 'type' in target ? target.bracketedAfter : undefined
}

/**
 * Every bracketed pitch a CHORD carries — its own lists, and those of every grace it holds, left to
 * right (a `(●) [graces] (●) M (●)` reading). The ids a paste must hand back as "the notes that landed".
 */
export function bracketedPitchesOf(chord: Chord): NotePitch[] {
  const out: NotePitch[] = []
  for (const grace of chord.graceBefore?.notes ?? []) pushPitches(out, grace.bracketedBefore)
  pushPitches(out, chord.bracketedBefore)
  pushPitches(out, chord.bracketedAfter)
  for (const grace of chord.graceAfter?.notes ?? []) pushPitches(out, grace.bracketedBefore)
  return out
}

function pushPitches(out: NotePitch[], list: readonly BracketedGrace[] | undefined): void {
  for (const b of list ?? []) out.push(...b.pitches)
}

/**
 * ⭐ A deep copy of a list with FRESH pitch ids — `cloneGraceFresh`'s rule, for its reason: a relay
 * piece is a copy, and a paste can land one payload twice. Two live pitches sharing an id is silent —
 * the first in tree order wins every lookup.
 *
 * Carries exactly the fields the types declare (⛔ never a spread of the source).
 */
export function cloneBracketedFresh(list: readonly BracketedGrace[]): BracketedGrace[] {
  return list.map(b => ({
    pitches: b.pitches.map((p) => {
      const np: NotePitch = { id: uuidv4(), step: p.step, alter: p.alter, octave: p.octave }
      if (p.forceAccidental) np.forceAccidental = true
      return np
    }),
  }))
}
