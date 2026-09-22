/**
 * ⭐⭐ **A GRACE BECOMES A NOTE AGAIN — the inverse of `./noteToGraceOps`** (plan §3 rule 2, his rule of
 * 2026-09-22: *"if a grace is selected and we toggle off the grace palette then we get the parent
 * duration and we override the pitch (and of course the grace is not grace anymore)… if there is a
 * group of graces and just one is selected then we drop all the grace notes that follow that in the
 * group… if a group of grace note is selected and we toggle off i think we simple clear the group"*).
 *
 * - {@link graceToNote}: the grace's MAIN slot keeps its duration and takes the grace's pitches — on the
 *   rest `noteToGraceOps` left, that is the original note back; on a real note, its pitch is replaced.
 *   The graces AFTER it in the group go; the ones BEFORE it stay, the new note's group.
 * - {@link clearGraceGroup}: the whole group goes; the main slot is untouched.
 *
 * ⭐ The new note is written as the grace was: its pitches keep their IDS (a slur to the grace still
 * lands), its articulations replace the slot's (the inverse of P4 carrying them onto the grace). The
 * main note's old pitches go, with their ties; a slur on one of them moves to the new first pitch. A
 * removed grace's offset goes with it.
 */
import { v4 as uuidv4 } from 'uuid'
import type { Chord, GraceGroup, GraceNote, Score } from '@/types/music'
import { dbg } from '@/utils/debug'
import { graceGroupOf, graceKey } from '@/utils/graceNotes'
import { findSlot } from './slotLookup'
import { clearEngravingOverride } from './overrideOps'
import { reanchorSlurs } from './slurOps'

/** The group a grace pitch is in, and where. */
function locate(score: Score, gracePitchId: string) {
  const found = findSlot(score, gracePitchId, { graceNotes: true })
  if (!found?.grace) return null
  const host = found.type === 'chord' ? found.chord : found.rest
  const group = graceGroupOf(host, found.grace.side)
  return group ? { found, host, group, side: found.grace.side, index: found.grace.index } : null
}

/** Take graces out of `group` from `from` on; the group goes when it empties (⛔ never `{ notes: [] }`). */
function dropFrom(score: Score, host: { graceBefore?: GraceGroup; graceAfter?: GraceGroup }, side: 'before' | 'after', group: GraceGroup, from: number): GraceNote[] {
  const gone = group.notes.splice(from)
  for (const g of gone) clearEngravingOverride(score, g.pitches[0]?.id ?? '', 'noteOffset')
  if (group.notes.length === 0) delete host[graceKey(side)]
  return gone
}

/**
 * ⭐ The grace named becomes its main slot's note — see the module header.
 * @returns the new note's first pitch id (the grace's own), or null when `gracePitchId` is not a grace.
 */
export function graceToNote(score: Score, gracePitchId: string): string | null {
  const at = locate(score, gracePitchId)
  if (!at) return null
  const { found, host, group, side, index } = at
  const grace = group.notes[index]
  dropFrom(score, host, side, group, index)
  const pitches = grace.pitches.map(p => ({ ...p }))

  if (found.type === 'rest') {
    // The rest becomes the note — the same slot, wearing the other type (`swapSlotForRest` backwards).
    const rest = found.rest
    const chord: Chord = {
      id: uuidv4(), type: 'chord', beat: rest.beat, duration: rest.duration, measure: rest.measure, notes: pitches,
      ...(rest.dots !== undefined && { dots: rest.dots }),
      ...(rest.voice !== undefined && { voice: rest.voice }),
      ...(rest.tupletId !== undefined && { tupletId: rest.tupletId }),
      ...(rest.actualDuration !== undefined && { actualDuration: rest.actualDuration }),
      ...(rest.staffId !== undefined && { staffId: rest.staffId }),
      ...(grace.articulations?.length && { articulations: [...grace.articulations] }),
      ...(grace.articulationPlacement && { articulationPlacement: grace.articulationPlacement }),
      ...(rest.graceBefore && { graceBefore: rest.graceBefore }),
    }
    for (const measure of score.measures) {
      const i = measure.slots.findIndex(s => s.id === rest.id)
      if (i === -1) continue
      measure.slots[i] = chord
      // A tie that let ring INTO the rest pointed at the rest — the new note is another pitch.
      for (const m of score.measures) {
        for (const s of m.slots) if (s.type === 'chord') for (const p of s.notes) if (p.tiedTo === rest.id) delete p.tiedTo
      }
      reanchorSlurs(score, rest.id, pitches[0].id)
      break
    }
  } else {
    // A real note: its pitches are replaced — their ties go, a slur on one of them moves to the new one.
    const chord = found.chord
    for (const old of chord.notes) {
      for (const link of [old.tiedTo, old.tiedFrom]) {
        const partner = link ? findSlot(score, link) : undefined
        if (partner?.type === 'chord') {
          if (partner.pitch.tiedFrom === old.id) delete partner.pitch.tiedFrom
          if (partner.pitch.tiedTo === old.id) delete partner.pitch.tiedTo
        }
      }
      reanchorSlurs(score, old.id, pitches[0].id)
    }
    chord.notes = pitches
    if (grace.articulations?.length) chord.articulations = [...grace.articulations]
    else delete chord.articulations
    if (grace.articulationPlacement) chord.articulationPlacement = grace.articulationPlacement
    else delete chord.articulationPlacement
  }
  clearEngravingOverride(score, gracePitchId, 'noteOffset')
  dbg(`[graceToNote] ${pitches.map(p => `${p.step}${p.octave}`).join('+')} → the note of its ${found.type} (${group.notes.length} grace(s) left before it)`)
  return pitches[0].id
}

/** ⭐ The whole group the grace named belongs to goes; its main slot is untouched. @returns whether it did. */
export function clearGraceGroup(score: Score, gracePitchId: string): boolean {
  const at = locate(score, gracePitchId)
  if (!at) return false
  dropFrom(score, at.host, at.side, at.group, 0)
  dbg(`[clearGraceGroup] the ${at.side} group of the ${at.found.type} is gone`)
  return true
}

/** Is every grace of `gracePitchId`'s group among `selected`? */
export function wholeGroupSelected(score: Score, gracePitchId: string, selected: ReadonlySet<string>): boolean {
  const at = locate(score, gracePitchId)
  return !!at && at.group.notes.every(n => n.pitches.some(p => selected.has(p.id)))
}

/** The group a grace pitch belongs to — its identity, for "once per group" — and the grace's index. */
export function graceGroupAt(score: Score, gracePitchId: string): { group: GraceGroup; index: number } | null {
  const at = locate(score, gracePitchId)
  return at ? { group: at.group, index: at.index } : null
}
