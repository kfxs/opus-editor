/**
 * ⭐ **BRACKETED ACCIDENTALS — the operations**, free functions over a `Score` (⛔ not methods on
 * `ScoreModel`). The brackets a pitch's ACCIDENTAL wears: `NotePitch.accidentalEnclosure`
 * (docs/plans/alteration-signs-plan.md K3 — the Keypad Accidentals page's `Enter`). The editor's half,
 * the undo entry, is `engine/commands/accidentalEnclosureCommands`.
 *
 * ⭐ Sibelius's button (docs/research/sibelius-keypad.md §"The parentheses button"): a toggle over the
 * selection, and on a pitch whose accidental the bar's rule would hide, the implied sign APPEARS in the
 * brackets — that half is the drawing's (`utils/accidentalState.displayedAccidentals` reads the field
 * as a request to show the sign), ⛔ nothing here writes `forceAccidental`.
 *
 * ⚠️ MAIN CHORD heads only in this build: `findSlot` is asked for nothing else, so a grace's, a fan
 * member's or a bracketed grace's pitch is simply not found — the refusal is the lookup's, as in
 * `./enclosureOps`.
 *
 * ⛔ Absent is the only spelling of "none": taking the brackets off DELETES the field.
 */
import type { AccidentalEnclosure, NotePitch, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { findSlot } from './slotLookup'

/** Every shape this build draws (the JSON check reads it). */
export const ACCIDENTAL_ENCLOSURES: readonly AccidentalEnclosure[] = ['round']

/** The main-chord head this id names, or undefined (a rest, a grace's or a fan member's pitch, an unknown id). */
function headOf(score: Score, pitchId: string): NotePitch | undefined {
  const found = findSlot(score, pitchId)
  return found?.type === 'chord' && !found.grace && !found.member && !found.bracketed ? found.pitch : undefined
}

/** The brackets this pitch's accidental wears; undefined for none, or for an id that names no head. */
export function accidentalEnclosureOf(score: Score, pitchId: string): AccidentalEnclosure | undefined {
  return headOf(score, pitchId)?.accidentalEnclosure
}

/**
 * Put `shape` round each pitch's accidental, or take the brackets off (`null`). Ids that name no main
 * head are skipped. @returns how many pitches CHANGED (0 = nothing to record).
 */
export function setAccidentalEnclosure(score: Score, pitchIds: readonly string[], shape: AccidentalEnclosure | null): number {
  let changed = 0
  for (const id of pitchIds) {
    const head = headOf(score, id)
    if (!head || (head.accidentalEnclosure ?? null) === shape) continue
    if (shape) head.accidentalEnclosure = shape
    else delete head.accidentalEnclosure
    changed++
  }
  if (changed) dbg(`[accidental enclosure] ${shape ?? 'none'} on ${changed} pitch(es)`)
  return changed
}

/**
 * ⭐ **The button's rule** — the head enclosure's (`enclosureOps.toggleEnclosure`): if ANY pitch is
 * without brackets, all get `shape`; if every one has them, all lose them. Only ids naming a head vote.
 * @returns what was written — the shape, `null` for "taken off", or undefined when no id named a head.
 */
export function toggleAccidentalEnclosure(score: Score, pitchIds: readonly string[], shape: AccidentalEnclosure = 'round'): AccidentalEnclosure | null | undefined {
  const heads = pitchIds.map(id => headOf(score, id)).filter((h): h is NotePitch => h !== undefined)
  if (!heads.length) return undefined
  const next = heads.some(h => h.accidentalEnclosure !== shape) ? shape : null
  setAccidentalEnclosure(score, pitchIds, next)
  return next
}

/**
 * ⛔ **Report, never repair** (`docs/plans/json-io-plan.md`) — a shape this build cannot draw, or
 * brackets on a pitch this build does not bracket (a grace's, a fan member's). Nothing is changed.
 */
export function signEnclosureProblems(score: Score): string[] {
  const problems: string[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      for (const p of slot.notes) {
        if (p.accidentalEnclosure !== undefined && !ACCIDENTAL_ENCLOSURES.includes(p.accidentalEnclosure)) {
          problems.push(`bar ${measure.number}: pitch "${p.id}" has an unknown accidental enclosure "${String(p.accidentalEnclosure)}"`)
        }
      }
      const others = [
        ...(slot.fan?.members ?? []).flatMap(m => m.pitches),
        ...(slot.graceBefore?.notes ?? []).flatMap(g => g.pitches),
        ...(slot.graceAfter?.notes ?? []).flatMap(g => g.pitches),
      ]
      for (const p of others) {
        if (p.accidentalEnclosure !== undefined) problems.push(`bar ${measure.number}: pitch "${p.id}" brackets its accidental — only a main chord's are drawn so`)
      }
    }
  }
  return problems
}
