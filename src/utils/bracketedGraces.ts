/**
 * ⭐ **BRACKETED GRACES — the pure reads and the copy**, shared by the relay (`utils/rebar`), the
 * materialisers (`engine/models/rebarOps`, `slotPlacementOps`), the grace copy (`utils/graceNotes`) and
 * the operations (`engine/models/bracketedGraceOps`). `docs/plans/bracketed-grace-plan.md` §1.
 *
 * In `utils/` for `graceNotes`' reason: the relay lives here and may not import `engine/`.
 */
import { v4 as uuidv4 } from 'uuid'
import type { BracketedGrace, Chord, ChordRest, GraceNote, NotePitch, Rest } from '@/types/music'

/** Which side of its target a bracketed grace stands on (B5). A GRACE target takes `before` only. */
export type BracketedSide = 'before' | 'after'

/** Both sides, in drawing order. */
export const BRACKETED_SIDES: readonly BracketedSide[] = ['before', 'after']

/** The target's field for one side — the one place the side is spelled as a key. */
export function bracketedKey(side: BracketedSide): 'bracketedBefore' | 'bracketedAfter' {
  return side === 'before' ? 'bracketedBefore' : 'bracketedAfter'
}

/** What a bracketed grace can hang on (B2): a main chord (both sides), a grace (before only), or —
 *  B10 REVERSED, his report 2026-09-23 — a REST (before only: entered first, handed to its note). */
export type BracketedTarget = Chord | GraceNote | Rest

/** The target's list on that side, if it has one — a GRACE or a REST holds a list BEFORE only (B5). */
export function bracketedOf(target: BracketedTarget, side: BracketedSide): BracketedGrace[] | undefined {
  if (side === 'before') return target.bracketedBefore
  return 'type' in target && target.type === 'chord' ? target.bracketedAfter : undefined
}

/**
 * Every bracketed pitch a SLOT carries — its own lists, and those of every grace it holds, left to
 * right (a `(●) [graces] (●) M (●)` reading). A REST holds before only (B10 reversed). The ids a paste
 * must hand back as "the notes that landed", and the ids a replayed bar's highlight is filed under.
 */
export function bracketedPitchesOf(slot: ChordRest): NotePitch[] {
  const out: NotePitch[] = []
  for (const grace of slot.graceBefore?.notes ?? []) pushPitches(out, grace.bracketedBefore)
  pushPitches(out, slot.bracketedBefore)
  if (slot.type === 'chord') {
    pushPitches(out, slot.bracketedAfter)
    for (const grace of slot.graceAfter?.notes ?? []) pushPitches(out, grace.bracketedBefore)
  }
  return out
}

/** Every bracketed grace a SLOT carries, in the drawing's left-to-right order — {@link bracketedPitchesOf}'s
 *  walk, one entry per bracketed grace (the redraw key reads each one's offset). */
export function bracketedListsOf(slot: ChordRest): BracketedGrace[] {
  const out: BracketedGrace[] = []
  for (const grace of slot.graceBefore?.notes ?? []) out.push(...(grace.bracketedBefore ?? []))
  out.push(...(slot.bracketedBefore ?? []))
  if (slot.type === 'chord') {
    out.push(...(slot.bracketedAfter ?? []))
    for (const grace of slot.graceAfter?.notes ?? []) out.push(...(grace.bracketedBefore ?? []))
  }
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
    duration: b.duration,
    ...(b.cue && { cue: true as const }),
  }))
}
