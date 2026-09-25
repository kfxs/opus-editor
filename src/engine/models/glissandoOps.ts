/**
 * GLISSANDI — one line for gliss, portamento, bend and the slide into a note
 * (docs/plans/glissando-plan.md), in the `trillOps` idiom: free functions over a `Score`.
 *
 * A glissando is stored ONCE, at the top of the score (`score.glissandi`), as ONE anchor head. Never on
 * a measure: it crosses barlines and systems freely, as a trill does.
 *
 * ⭐⭐ **THE FAR END IS ASKED, NEVER STORED** (plan G4) — {@link glissandoTarget} finds it every time:
 * the next slot of the anchor's lane. That is what lets an empty slot filled LATER connect with nothing
 * re-written, and why a re-bar only has the anchor to re-find ({@link captureGlissandi}).
 *
 * ⚠️ **Re-attaching across a re-bar is driven by `rebarOps`**, which owns the region's anchors; this
 * module gives it the two halves ({@link captureGlissandi} / {@link restoreGlissandi}) so the
 * glissando's own rule — the anchor is re-found or the line goes — stays here.
 */
import type { Chord, Glissando, NotePitch, Score } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { findSlot } from './slotLookup'
import { clearEngravingOverride } from './overrideOps'
import { staffIndexOfId } from './staffContent'
import { voiceOf } from '@/utils/lanes'
import { fracLt } from '@/utils/fraction'
import { spellingToMidi } from '@/utils/pitchSpelling'
import { dbg } from '@/utils/debug'

/** All glissandi (the live array; empty if none). */
export function getGlissandi(score: Score): Glissando[] {
  return score.glissandi ?? []
}

/** Find a glissando by id (live reference), or null. */
export function getGlissandoById(score: Score, id: string): Glissando | null {
  return score.glissandi?.find(g => g.id === id) ?? null
}

/** The glissando anchored on this head, or undefined. A head carries at most one. */
export function glissandoOn(score: Score, noteId: string): Glissando | undefined {
  return score.glissandi?.find(g => g.noteId === noteId)
}

/**
 * May a glissando anchor here? A chord's own head — ⛔ not a rest, a fanned member or a grace.
 * Graces and members are later (a grace before a glissando is Gould p. 144's figure); refusing them
 * now is what stops an anchor nothing can draw from being half-written.
 */
export function mayAnchorGlissando(score: Score, noteId: string): boolean {
  const found = findSlot(score, noteId, { fanMembers: true, graceNotes: true })
  return found?.type === 'chord' && found.member === undefined && found.grace === undefined
}

/**
 * Add a glissando on one head. **Idempotent and ADD-only**: a head that already carries one gets it
 * back, as `addTrill` does. A chord is one line per head (plan G9), so a chord is several calls.
 *
 * @returns the stored glissando (new or existing), or null when the head may not carry one.
 */
export function addGlissando(score: Score, noteId: string): Glissando | null {
  if (!mayAnchorGlissando(score, noteId)) {
    dbg(`[glissandoOps.addGlissando] refused: ${noteId.slice(0, 8)} is a rest, a fan member, a grace, or missing`)
    return null
  }
  const existing = glissandoOn(score, noteId)
  if (existing) return existing
  const created: Glissando = { id: uuidv4(), noteId }
  if (!score.glissandi) score.glissandi = []
  score.glissandi.push(created)
  return created
}

/** Remove a glissando by id, with its hand-nudges. @returns true if one was removed. */
export function removeGlissando(score: Score, id: string): boolean {
  const list = score.glissandi
  if (!list) return false
  const i = list.findIndex(g => g.id === id)
  if (i < 0) return false
  list.splice(i, 1)
  clearEngravingOverride(score, id)
  if (list.length === 0) delete score.glissandi
  return true
}

/**
 * ⭐ Drop every glissando whose anchor is no longer a head it may stand on — the ONE sweep every op
 * that can remove or silence a head ends with (delete, convert-to-rest, clear, a grace↔note
 * conversion, a removed measure, a re-bar's leftovers). There is no end to repair: it is derived.
 *
 * Deleting the field when the list empties keeps a score that never had one byte-identical.
 */
export function pruneGlissandi(score: Score): void {
  const list = score.glissandi
  if (!list) return
  for (let i = list.length - 1; i >= 0; i--) {
    const g = list[i]
    if (mayAnchorGlissando(score, g.noteId)) continue
    list.splice(i, 1)
    clearEngravingOverride(score, g.id)
    dbg(`[glissandoOps.pruneGlissandi] ${g.id.slice(0, 8)} dropped: its anchor is gone`)
  }
  if (list.length === 0) delete score.glissandi
}

/**
 * ⭐⭐ **WHERE DOES IT GO?** — the head the line runs to, or null when there is none to run to (the
 * next slot of the lane is a rest, or the lane ends): the caller then draws a free end (plan P3).
 *
 * The NEXT slot of the anchor's lane — same staff, same voice — across barlines, graces and tuplets
 * alike (a slot is a slot). ⭐ Asked every time, so a rest replaced by a note answers differently the
 * next time without anything being written (G4).
 *
 * ⭐ **A chord pairs by INDEX FROM THE BOTTOM** (G9; MuseScore and LilyPond both): the anchor's place
 * among its own chord's heads, low to high, picks the target chord's head at that place; a surplus
 * anchor (its chord has more heads than the target) goes to the target's TOP head (MuseScore).
 */
export function glissandoTarget(score: Score, glissando: Glissando): string | null {
  // ⭐ A free end on purpose (G5), or a line INTO the note (G3): nowhere to go, whatever follows.
  if (glissando.side === 'before' || glissando.end === 'none') return null
  const at = anchorOf(score, glissando.noteId)
  if (!at) return null
  const next = nextLaneChord(score, at)
  if (!next) return null
  const index = lowToHigh(at.chord.notes).findIndex(p => p.id === glissando.noteId)
  const targets = lowToHigh(next.notes)
  if (index < 0 || targets.length === 0) return null
  return targets[Math.min(index, targets.length - 1)].id
}

/**
 * ⭐ Which side of its note (G3). `'after'` DELETES the field — absent is the only spelling of after — and
 * ⛔ `'before'` clears `end`, which it makes meaningless (a line into the note has no far end to pin).
 * @returns false when there is no such glissando or nothing changed.
 */
export function setGlissandoSide(score: Score, id: string, side: 'before' | 'after'): boolean {
  const glissando = getGlissandoById(score, id)
  if (!glissando || (glissando.side ?? 'after') === side) return false
  if (side === 'before') {
    glissando.side = 'before'
    delete glissando.end
  } else {
    delete glissando.side
  }
  return true
}

/**
 * ⭐ A free end on purpose (`'none'`) or back to following the next note (`'next'`, which DELETES the field).
 * ⛔ Refused on a line INTO its note (`side: 'before'`): its far end is always free (G5).
 */
export function setGlissandoEnd(score: Score, id: string, end: 'none' | 'next'): boolean {
  const glissando = getGlissandoById(score, id)
  if (!glissando || glissando.side === 'before') return false
  if ((glissando.end ?? 'next') === end) return false
  if (end === 'none') glissando.end = 'none'
  else delete glissando.end
  return true
}

/** ⭐ A free end's direction (G11). Writing the side's usual one DELETES the field (absent = usual). */
export function setGlissandoDirection(score: Score, id: string, direction: 'up' | 'down'): boolean {
  const glissando = getGlissandoById(score, id)
  if (!glissando || glissandoDirection(glissando) === direction) return false
  if (direction === usualDirection(glissando)) delete glissando.direction
  else glissando.direction = direction
  return true
}

/** A free end's direction, resolved: the stored one, or the side's usual (after falls, before rises). */
export function glissandoDirection(glissando: Glissando): 'up' | 'down' {
  return glissando.direction ?? usualDirection(glissando)
}

function usualDirection(glissando: Glissando): 'up' | 'down' {
  return glissando.side === 'before' ? 'up' : 'down'
}

// ==================== Re-bar: the anchor is re-found, or the line goes ====================

/**
 * Snapshot every glissando whose anchor sits in a re-bar's region, BEFORE its ids are re-minted.
 * `inRegion` is the caller's key for a region head (rebarOps' onset offset + pitch + voice); an anchor
 * outside the region keeps its id and is not captured.
 */
export function captureGlissandi<A>(
  score: Score,
  inRegion: (noteId: string) => A | undefined,
): Array<{ glissando: Glissando; anchor: A }> {
  const captured: Array<{ glissando: Glissando; anchor: A }> = []
  for (const glissando of score.glissandi ?? []) {
    const anchor = inRegion(glissando.noteId)
    if (anchor !== undefined) captured.push({ glissando, anchor })
  }
  return captured
}

/**
 * Re-attach the captured glissandi to the re-barred heads. ⭐ Only the ANCHOR is owed — the far end is
 * derived — so an anchor re-found keeps the glissando (same id), and one that is not drops it
 * (the trill's rule for its start: there is no glissando without its note).
 */
export function restoreGlissandi<A>(
  score: Score,
  captured: ReadonlyArray<{ glissando: Glissando; anchor: A }>,
  resolve: (anchor: A) => string | undefined,
): void {
  for (const { glissando, anchor } of captured) {
    const now = resolve(anchor)
    if (now) glissando.noteId = now
  }
  // Whatever was not re-found still names a re-minted id — the sweep takes it.
  pruneGlissandi(score)
}

// ==================== Private ====================

interface Anchor {
  /** The measure's place in score order (measures sorted by number). */
  order: number
  chord: Chord
  staff: number
  voice: number
}

function measuresInOrder(score: Score) {
  return [...score.measures].sort((a, b) => a.number - b.number)
}

function anchorOf(score: Score, noteId: string): Anchor | null {
  const ordered = measuresInOrder(score)
  for (let order = 0; order < ordered.length; order++) {
    for (const slot of ordered[order].slots) {
      if (slot.type !== 'chord' || !slot.notes.some(p => p.id === noteId)) continue
      return { order, chord: slot, staff: staffIndexOfId(score, slot.staffId), voice: voiceOf(slot) }
    }
  }
  return null
}

/** The first slot of the anchor's lane after it: a chord, or null (a rest, or the lane ends). */
function nextLaneChord(score: Score, at: Anchor): Chord | null {
  const ordered = measuresInOrder(score)
  for (let order = at.order; order < ordered.length; order++) {
    const lane = ordered[order].slots
      .filter(s => voiceOf(s) === at.voice && staffIndexOfId(score, s.staffId) === at.staff)
      .filter(s => order > at.order || fracLt(at.chord.beat, s.beat))
      .sort((a, b) => (fracLt(a.beat, b.beat) ? -1 : fracLt(b.beat, a.beat) ? 1 : 0))
    const next = lane[0]
    if (next) return next.type === 'chord' ? next : null
  }
  return null
}

/** A chord's heads, lowest sounding first. */
function lowToHigh(notes: readonly NotePitch[]): NotePitch[] {
  return [...notes].sort((a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave))
}
