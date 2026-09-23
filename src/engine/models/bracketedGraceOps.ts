/**
 * ⭐ **BRACKETED GRACES — the operations**, free functions over a `Score` (⛔ not methods on
 * `ScoreModel`). `docs/plans/bracketed-grace-plan.md` §2.
 *
 * A bracketed grace belongs to its TARGET (B2, his call 2026-09-23): a main chord
 * (`bracketedBefore` / `bracketedAfter`) or a grace note (`bracketedBefore` only, B5), never a rest
 * (B10). Nothing here touches the bar's arithmetic — it changes no beat, no capacity, no rest.
 *
 * ⭐ **Fail closed.** `findSlot` does not know a bracketed pitch, so every mutator that resolves an id
 * through it REFUSES one instead of half-writing it — the fan member's and the grace's safety rule
 * (`slotLookup`). {@link findBracketed} is the one reader that knows where they live.
 */
import { v4 as uuidv4 } from 'uuid'
import type { BracketedGrace, ChordRest, NotePitch, PitchSpelling, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { chordStoredPitches } from '@/utils/fannedBeam'
import { GRACE_SIDES, graceGroupOf } from '@/utils/graceNotes'
import { BRACKETED_SIDES, bracketedKey, bracketedOf, type BracketedSide, type BracketedTarget } from '@/utils/bracketedGraces'
import { findSlot } from './slotLookup'

/** A bracketed pitch — a spelling, and whether its sign is FORCED (note entry's courtesy). */
export type BracketedSpelling = PitchSpelling & { forceAccidental?: boolean }

/** Where a bracketed pitch lives: its target, the slot holding that target, the side and place. */
export interface FoundBracketed {
  /** The SLOT — the main chord, or the rest whose grace is the target (B10: the grace is, the rest never). */
  slot: ChordRest
  target: BracketedTarget
  side: BracketedSide
  /** Its place in the target's list, left to right. */
  index: number
  bracketed: BracketedGrace
  pitch: NotePitch
}

/** Every target a slot holds: its graces (both groups), then — a chord only — the chord itself. */
function targetsOf(slot: ChordRest): BracketedTarget[] {
  const out: BracketedTarget[] = []
  for (const side of GRACE_SIDES) out.push(...(graceGroupOf(slot, side)?.notes ?? []))
  if (slot.type === 'chord') out.push(slot)
  return out
}

/** ⭐ Where the bracketed pitch `pitchId` lives, or null — the one reader that knows (see the header). */
export function findBracketed(score: Score, pitchId: string): FoundBracketed | null {
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      for (const target of targetsOf(slot)) {
        for (const side of BRACKETED_SIDES) {
          const list = bracketedOf(target, side) ?? []
          for (let index = 0; index < list.length; index++) {
            const pitch = list[index].pitches.find(p => p.id === pitchId)
            if (pitch) return { slot, target, side, index, bracketed: list[index], pitch }
          }
        }
      }
    }
  }
  return null
}

/** Is this id a BRACKETED grace's pitch? */
export function isBracketedGrace(score: Score, pitchId: string): boolean {
  return findBracketed(score, pitchId) !== null
}

/**
 * The target `noteId` names — a main chord (by any of its pitch ids) or a GRACE (by any of its pitch
 * ids, a rest's grace included) — or null. ⛔ A rest, a fan member and a bracketed pitch name none
 * (B10; a member has no sides; a bracket does not carry a bracket, B3).
 */
function targetOf(score: Score, noteId: string): { slot: ChordRest; target: BracketedTarget } | null {
  const found = findSlot(score, noteId, { graceNotes: true })
  if (!found) return null
  if (found.type === 'rest') return found.grace ? { slot: found.rest, target: found.grace.note } : null
  return { slot: found.chord, target: found.grace?.note ?? found.chord }
}

/**
 * Put a bracketed grace of `spelling` beside the target `targetNoteId` names, on `side`.
 * @returns the new bracketed grace, or null when refused:
 *
 * - **no target** — a rest (B10), a fan member, a bracketed pitch, or an id that is gone;
 * - **AFTER a grace** — a grace takes a bracketed grace BEFORE only (B5);
 * - **before a tied CONTINUATION / after a note TIED ON** — the graces' rule for the graces' reason:
 *   what leads into the attack stands at the chain's head, what follows the note at its last piece.
 *
 * @param index its place in the list, left to right. Absent = beside the target (the end of a
 *   `before` list, the start of an `after` one); clamped to the list.
 */
export function addBracketed(
  score: Score, targetNoteId: string, side: BracketedSide, spelling: BracketedSpelling, index?: number,
): BracketedGrace | null {
  const at = targetOf(score, targetNoteId)
  if (!at) {
    dbg(`[bracketedGraceOps.addBracketed] refused: ${targetNoteId} names no target (a rest, a fan member, a bracketed grace, or gone)`)
    return null
  }
  const onGrace = at.target !== at.slot
  const chord = at.slot.type === 'chord' ? at.slot : null
  if (onGrace && side === 'after') {
    dbg(`[bracketedGraceOps.addBracketed] refused: a bracketed grace AFTER a grace — a grace takes one before only`)
    return null
  }
  if (chord && !onGrace && side === 'before' && chord.notes.every(p => p.tiedFrom)) {
    dbg(`[bracketedGraceOps.addBracketed] refused: BEFORE a tied continuation — the attack is at the chain's head`)
    return null
  }
  if (chord && !onGrace && side === 'after' && chord.notes.every(p => p.tiedTo)) {
    dbg(`[bracketedGraceOps.addBracketed] refused: AFTER a note tied on — the note ends at the chain's last piece`)
    return null
  }
  const bracketed: BracketedGrace = { pitches: [newPitch(spelling)] }
  const key = bracketedKey(side)
  const holder = at.target as { bracketedBefore?: BracketedGrace[]; bracketedAfter?: BracketedGrace[] }
  const list = holder[key] ?? []
  const beside = side === 'before' ? list.length : 0
  const place = index === undefined ? beside : Math.max(0, Math.min(index, list.length))
  list.splice(place, 0, bracketed)
  holder[key] = list
  dbg(`[bracketedGraceOps.addBracketed] ${side} ${onGrace ? `a grace of ${at.slot.type}` : 'chord'} ${at.slot.id}: +${spelling.step}${spelling.octave} at ${place} (${list.length} in the list)`)
  return bracketed
}

/**
 * A second head in an existing bracketed grace — a double-stop pre-bend (one bracket pair per head,
 * B9). @returns the new pitch, or null: not a bracketed pitch, or ⛔ a pitch it already HAS (by sound —
 * note entry's same-pitch rule).
 */
export function addBracketedPitch(score: Score, bracketedPitchId: string, spelling: BracketedSpelling): NotePitch | null {
  const found = findBracketed(score, bracketedPitchId)
  if (!found) return null
  const midi = spellingToMidi(spelling.step, spelling.alter, spelling.octave)
  if (found.bracketed.pitches.some(p => spellingToMidi(p.step, p.alter, p.octave) === midi)) {
    dbg(`[bracketedGraceOps.addBracketedPitch] refused: it already shows ${spelling.step}${spelling.octave}`)
    return null
  }
  const pitch = newPitch(spelling)
  found.bracketed.pitches.push(pitch)
  return pitch
}

/**
 * Take a bracketed PITCH out; its last pitch takes the bracketed grace, the last one takes the list
 * (⛔ never stored as `[]`). ⭐ Inside a grace group that IS the merge (B4): the split was only ever
 * drawn, so nothing else is owed. @returns whether anything was removed.
 */
export function removeBracketed(score: Score, pitchId: string): boolean {
  const found = findBracketed(score, pitchId)
  if (!found) return false
  const { target, side, index, bracketed, pitch } = found
  bracketed.pitches = bracketed.pitches.filter(p => p !== pitch)
  if (bracketed.pitches.length === 0) {
    const holder = target as { bracketedBefore?: BracketedGrace[]; bracketedAfter?: BracketedGrace[] }
    const key = bracketedKey(side)
    const list = holder[key]!
    list.splice(index, 1)
    if (list.length === 0) delete holder[key]
  }
  dbg(`[bracketedGraceOps.removeBracketed] ${side}: −${pitch.step}${pitch.octave}`)
  return true
}

/**
 * ⭐ Re-spell a bracketed pitch in place — its id stays (what the arrows will do in P2).
 * @returns whether it changed.
 */
export function setBracketedPitch(score: Score, pitchId: string, spelling: BracketedSpelling): boolean {
  const found = findBracketed(score, pitchId)
  if (!found) return false
  const p = found.pitch
  const force = !!spelling.forceAccidental
  if (p.step === spelling.step && p.alter === spelling.alter && p.octave === spelling.octave && !!p.forceAccidental === force) return false
  p.step = spelling.step
  p.alter = spelling.alter
  p.octave = spelling.octave
  if (force) p.forceAccidental = true
  else delete p.forceAccidental
  return true
}

function newPitch(spelling: BracketedSpelling): NotePitch {
  const pitch: NotePitch = { id: uuidv4(), step: spelling.step, alter: spelling.alter, octave: spelling.octave }
  if (spelling.forceAccidental) pitch.forceAccidental = true
  return pitch
}

/**
 * ⛔ **Report, never repair** (`docs/plans/json-io-plan.md`) — what a loaded file says about
 * bracketed graces that this build cannot hold as written. `MusicEngine.loadJSON` warns each line.
 */
export function bracketedProblems(score: Score): string[] {
  const problems: string[] = []
  const seen = new Set<string>()
  // Every id the file already uses on a slot or a grace — a bracketed pitch must not repeat one.
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (slot.type === 'rest') { seen.add(slot.id); continue }
      for (const p of chordStoredPitches(slot)) seen.add(p.id)
      for (const side of GRACE_SIDES) for (const g of graceGroupOf(slot, side)?.notes ?? []) for (const p of g.pitches) seen.add(p.id)
    }
  }
  const check = (list: unknown, where: string) => {
    if (list === undefined) return
    if (!Array.isArray(list) || list.length === 0) {
      problems.push(`${where}: an empty bracketed list`)
      return
    }
    list.forEach((b: BracketedGrace, k) => {
      if (!Array.isArray(b?.pitches) || b.pitches.length === 0) {
        problems.push(`${where}: bracketed grace ${k} has no pitches`)
        return
      }
      for (const p of b.pitches) {
        if (seen.has(p.id)) problems.push(`${where}: bracketed grace ${k} pitch id "${p.id}" is not unique`)
        seen.add(p.id)
      }
    })
  }
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      const bar = `bar ${measure.number}`
      if (slot.type === 'rest') {
        const r = slot as unknown as Record<string, unknown>
        if ('bracketedBefore' in r || 'bracketedAfter' in r) problems.push(`${bar}: a REST carries bracketed graces — a rest is no target`)
        for (const g of slot.graceBefore?.notes ?? []) check(g.bracketedBefore, `${bar}, a grace before a rest`)
        continue
      }
      for (const side of GRACE_SIDES) {
        for (const g of graceGroupOf(slot, side)?.notes ?? []) {
          check(g.bracketedBefore, `${bar}, a grace ${side}`)
          if ('bracketedAfter' in (g as object)) problems.push(`${bar}, a grace ${side}: bracketedAfter on a grace — a grace takes one before only`)
        }
      }
      check(slot.bracketedBefore, `${bar}, bracketedBefore`)
      check(slot.bracketedAfter, `${bar}, bracketedAfter`)
    }
  }
  return problems
}
