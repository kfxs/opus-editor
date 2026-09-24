/**
 * ⭐ **CUE-SIZE NOTES — the operations**, free functions over a `Score` (⛔ not methods on `ScoreModel`).
 * A real note drawn small: `cue?: true` on the SLOT (`Chord` / `Rest`), and on a grace or a bracketed
 * grace, which carry their own (docs/plans/cue-size-plan.md C1, C4). The editor's half — the undo
 * entry — is `engine/commands/cueCommands`. The SIZE is not the model's: it is a house-style preset.
 *
 * ⭐ An id names what it is the size OF: a chord's head or a fan member's → its chord (the stem, flag and
 * beam are the chord's, so a head alone cannot be small — C9 is later); a rest's id → the rest; a
 * grace's head → that grace; a bracketed grace's head → that bracketed grace. Heads of one chord name
 * it once.
 *
 * ⛔ Absent is the only spelling of "full size": switching it off DELETES the field (the width-cache key
 * stringifies the slot, `laneFingerprint`). *
 * ⭐⭐ **Cue is the USER's statement, and only a DELETE takes it off** (his rule, 2026-09-24: *"if a user
 * mark a rest as cue it should carry the cue flag unless the user change it, what only can clean the cue
 * without explicit user intervention is delete"*). Every copy carries it (plan §3 P0), and the model's
 * own rest churn — an eviction and its refill, a duration change — keeps a cue SILENCE cue through
 * {@link keepCueSilence}.
 */
import type { BracketedGrace, ChordRest, Fraction, GraceNote, Measure, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { slotLength } from '@/utils/durations'
import { fracAdd, fracGte, fracLt, fracToNumber } from '@/utils/fraction'
import { voiceOf } from '@/utils/lanes'
import { graceGroupOf, GRACE_SIDES } from '@/utils/graceNotes'
import { BRACKETED_SIDES, bracketedOf } from '@/utils/bracketedGraces'
import { findSlot } from './slotLookup'

/** What carries a size: a slot, a grace, or a bracketed grace. */
type CueHolder = ChordRest | GraceNote | BracketedGrace

/** What this id is the size of — see the module note — or undefined for an unknown id. */
function holderOf(score: Score, id: string): CueHolder | undefined {
  const found = findSlot(score, id, { fanMembers: true, graceNotes: true, bracketed: true })
  if (!found) return undefined
  if (found.bracketed) return found.bracketed.note
  if (found.grace) return found.grace.note
  return found.type === 'chord' ? found.chord : found.rest
}

/** The distinct holders these ids name, in the order first named. */
function holdersOf(score: Score, ids: readonly string[]): CueHolder[] {
  const out: CueHolder[] = []
  for (const id of ids) {
    const h = holderOf(score, id)
    if (h && !out.includes(h)) out.push(h)
  }
  return out
}

/** Whether what this id names is drawn at cue size; false for full size or an unknown id. */
export function isCue(score: Score, id: string): boolean {
  return holderOf(score, id)?.cue === true
}

/**
 * Make what each id names cue-sized (`true`) or full-sized (`false`).
 * @returns how many holders CHANGED (0 = nothing to record).
 */
export function setCue(score: Score, ids: readonly string[], on: boolean): number {
  let changed = 0
  for (const h of holdersOf(score, ids)) {
    if ((h.cue === true) === on) continue
    if (on) h.cue = true
    else delete h.cue
    changed++
  }
  if (changed) dbg(`[cue] ${on ? 'cue' : 'full'} size on ${changed} note(s)`)
  return changed
}

/**
 * ⭐ **The button's rule** — the parenthesised note's (`enclosureOps.toggleEnclosure`): if ANY of them
 * is full size, all become cue; if every one is already cue, all return to full size.
 * @returns what was written — `true` for cue, `false` for full — or undefined when no id named a note.
 */
export function toggleCue(score: Score, ids: readonly string[]): boolean | undefined {
  const holders = holdersOf(score, ids)
  if (!holders.length) return undefined
  const next = holders.some(h => h.cue !== true)
  setCue(score, ids, next)
  return next
}

/**
 * ⛔ **Report, never repair** (`docs/plans/json-io-plan.md`) — a loaded `cue` that is not `true` (a
 * `false` is not the spelling of full size: absence is). `MusicEngine.loadJSON` warns each line;
 * nothing is changed.
 */
export function cueProblems(score: Score): string[] {
  const problems: string[] = []
  const check = (what: string, v: unknown, bar: number) => {
    if (v !== undefined && v !== true) problems.push(`bar ${bar}: ${what} has cue ${JSON.stringify(v)} — only \`true\` is written (absent = full size)`)
  }
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      check(`${slot.type} "${slot.id}"`, slot.cue, measure.number)
      for (const side of GRACE_SIDES) {
        for (const g of graceGroupOf(slot, side)?.notes ?? []) {
          check(`grace "${g.pitches[0]?.id}"`, g.cue, measure.number)
          for (const b of g.bracketedBefore ?? []) check(`bracketed grace "${b.pitches[0]?.id}"`, b.cue, measure.number)
        }
      }
      for (const side of BRACKETED_SIDES) {
        for (const b of bracketedOf(slot, side) ?? []) check(`bracketed grace "${b.pitches[0]?.id}"`, b.cue, measure.number)
      }
    }
  }
  return problems
}

/** One cue rest's stretch of silence, by lane: what {@link keepCueSilence} restores. */
interface CueSilence { measureId: string; lane: string; start: Fraction; end: Fraction }

const laneOf = (slot: ChordRest) => `${voiceOf(slot)}|${slot.staffId ?? ''}`

function cueSilences(measures: readonly Measure[]): CueSilence[] {
  const out: CueSilence[] = []
  for (const m of measures) {
    for (const s of m.slots) {
      if (s.type === 'rest' && s.cue) out.push({ measureId: m.id, lane: laneOf(s), start: s.beat, end: fracAdd(s.beat, slotLength(s)) })
    }
  }
  return out
}

/**
 * ⭐ **Run a model edit that churns rests, and keep cue SILENCE cue** — the model removes a rest and
 * refills its time whenever something lands on part of it, grows into it, or it is shortened, and the
 * refill mints fresh rests. His rule says only a delete may take cue off, so: every REST that, after
 * `fn`, STARTS inside a stretch a cue rest held before (same bar, same voice and staff) is cue.
 * ⛔ Rests only: a NOTE ENTERED there takes its size from what is ARMED on the palette, and EDITING a note
 * keeps its own (his rule, 2026-09-24: *"for note editing the cue value persist, for note entry what is
 * important is what is armed on the pallette"*). A rest turned into a note IN PLACE is an edit of that
 * slot — `restToChordOps` keeps its cue. ⛔ Not for a delete, which may clear it.
 * Nested calls are harmless (idempotent). The graces' take/re-home (`restGraceOps`) has the same shape.
 * @param within the one bar the edit stays in, when the caller knows it (a placement); absent = the score.
 */
export function keepCueSilence<T>(score: Score, fn: () => T, within?: Measure): T {
  const measures = within ? [within] : score.measures
  const before = cueSilences(measures)
  const result = fn()
  if (!before.length) return result
  for (const m of measures) {
    const spans = before.filter(b => b.measureId === m.id)
    if (!spans.length) continue
    for (const s of m.slots) {
      if (s.type !== 'rest' || s.cue) continue
      const lane = laneOf(s)
      if (spans.some(b => b.lane === lane && fracGte(s.beat, b.start) && fracLt(s.beat, b.end))) {
        s.cue = true
        dbg(`[cue] m${m.number} b${fracToNumber(s.beat).toFixed(3)}: a rest in cue silence keeps it`)
      }
    }
  }
  return result
}
