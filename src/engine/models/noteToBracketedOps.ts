/**
 * ⭐⭐ **A NOTE BECOMES A BRACKETED GRACE** — his rule (2026-09-23): *"if a note is selected and we press
 * the bracket this note becomes a bracket and we fill the note slot with a rest of it duration, similar
 * to grace"* (`docs/plans/bracketed-grace-plan.md`; the grace's own is `./noteToGraceOps`).
 *
 * The note's SLOT becomes a rest of its own length (`convertToRestOps.swapSlotForRest` — nothing after it
 * moves), and the note's pitches become a bracketed grace BEFORE that rest, nearest it. When a note later
 * takes the rest's place it takes the bracketed grace too (B10 reversed, `restGraceOps`).
 *
 * - ⭐ Written as the note was: its DURATION is the head's value (B7 — the user's value is correct), its
 *   pitches (a chord → a bracketed chord), and ⭐ their IDS. Its ties go (the swap's rule).
 * - ⛔ Its DOTS and ARTICULATIONS go, logged: a bracketed grace has neither — it is information, not an
 *   attack (B6, B7).
 * - The slot's own graces and bracketed graces before stay, in front of the new one; those AFTER go with
 *   the note (a rest takes none — the swap's rule).
 *
 * ⛔ Refused: a rest, a grace, a bracketed pitch, a fanned member, an id that is gone.
 *
 * ⭐ A GRACE becomes one too — {@link graceToBracketed}, his rule (2026-09-23): *"when a grace note is
 * selected and i hit bracket button we convert that into a bracket and the target is what we have to the
 * right, other members of the grace group remains"*.
 *
 * ⭐ And a bracketed grace becomes a GRACE — {@link bracketedToGrace}, his rule (2026-09-23): *"if a bracket
 * is selected and we press any grace button we convert the bracket into a grace maintaining it targets: if
 * the target is a grace we just make the bracket part of the grace group at that position"*.
 *
 * ⭐ And the way BACK, {@link bracketedToNote} — his rule (2026-09-23): *"when a bracket is selected and I
 * toggle of the button then we get the target maintain the duration but repitch it (similar to grace)
 * and then of course the bracket is gone"*.
 */
import { v4 as uuidv4 } from 'uuid'
import type { BracketedGrace, Chord, GraceGroup, GraceNote, NotePitch, Score } from '@/types/music'
import type { GraceForm } from './graceOps'
import { bracketedKey } from '@/utils/bracketedGraces'
import { reanchorSlurs } from './slurOps'
import { pruneGlissandi } from './glissandoOps'
import { dbg } from '@/utils/debug'
import { findSlot } from './slotLookup'
import { clearEngravingOverride } from './overrideOps'
import { graceKey } from '@/utils/graceNotes'
import { swapSlotForRest } from './convertToRestOps'

export interface NoteToBracketed {
  /** The rest that took the note's place — the bracketed grace's target. */
  restId: string
  /** The new bracketed grace's first pitch — the note's own first pitch id. */
  bracketedId: string
}

export function convertNoteToBracketed(score: Score, noteId: string): NoteToBracketed | null {
  const found = findSlot(score, noteId, { fanMembers: true, graceNotes: true, bracketed: true })
  if (!found || found.type !== 'chord' || found.member || found.grace || found.bracketed) {
    dbg(`[noteToBracketed] refused: ${noteId} is not an ordinary note (a rest, a grace, a bracketed grace, a fan member, or gone)`)
    return null
  }
  const chord = found.chord
  // BEFORE the swap — afterwards the chord is gone. The pitches keep their ids; their ties do not.
  const pitches: NotePitch[] = chord.notes.map(p => {
    // ⛔ …nor its own brackets: a bracketed grace IS in brackets (parenthesised-note-plan N5).
    const { tiedTo: _to, tiedFrom: _from, enclosure: _enclosure, ...rest } = p
    return { ...rest }
  })
  const bracketed: BracketedGrace = { pitches, duration: chord.duration, ...(chord.cue && { cue: true as const }) }
  if (chord.dots || chord.articulations?.length) {
    dbg(`[noteToBracketed] its ${[chord.dots && 'dots', chord.articulations?.length && 'articulations'].filter(Boolean).join(' and ')} go — a bracketed grace has none`)
  }

  const rest = swapSlotForRest(score, noteId)
  if (!rest) return null
  rest.bracketedBefore = [...(rest.bracketedBefore ?? []), bracketed]
  dbg(`[noteToBracketed] ${pitches.map(p => `${p.step}${p.octave}`).join('+')} ${bracketed.duration} → a bracketed grace before the rest that took its place`)
  // The heads keep their ids but are no longer a chord's — a glissando on one goes.
  pruneGlissandi(score)
  return { restId: rest.id, bracketedId: pitches[0].id }
}

/**
 * ⭐ **A BRACKETED GRACE toggled OFF — its TARGET takes its pitch** (the inverse of
 * {@link convertNoteToBracketed}; `graceToNoteOps.graceToNote` is the grace's). The target KEEPS its value:
 *
 * - a REST → the rest becomes the note, at the rest's own length — on the rest `convertNoteToBracketed`
 *   left, that is the original note back;
 * - a NOTE → its pitches are replaced (their ties go; a slur on one moves to the new first pitch), its
 *   duration and marks stay;
 * - a GRACE → the grace is re-pitched, its written value kept.
 *
 * The bracketed grace goes; any OTHERS on the same target stay. Its pitches keep their IDS.
 * @returns the re-pitched note's first pitch id (the bracketed grace's own), or null when `pitchId` is not one.
 */
export function bracketedToNote(score: Score, pitchId: string): string | null {
  const found = findSlot(score, pitchId, { bracketed: true })
  const at = found?.bracketed
  if (!found || !at) return null
  // Out of its list first — the list goes when it empties (⛔ never `[]`).
  const holder = (at.onGrace ?? (found.type === 'chord' ? found.chord : found.rest)) as { bracketedBefore?: BracketedGrace[]; bracketedAfter?: BracketedGrace[] }
  const key = bracketedKey(at.side)
  holder[key]!.splice(at.index, 1)
  if (holder[key]!.length === 0) delete holder[key]
  const pitches = at.note.pitches.map(p => ({ ...p }))
  // Its hand offset goes with it — keyed by its FIRST pitch; a note's is keyed by its SLOT.
  clearEngravingOverride(score, at.note.pitches[0].id, 'noteOffset')

  if (at.onGrace) {
    for (const old of at.onGrace.pitches) reanchorSlurs(score, old.id, pitches[0].id)
    at.onGrace.pitches = pitches
    if (at.note.cue) at.onGrace.cue = true // its size joins the target's; ⛔ never takes the target's off
  } else if (found.type === 'rest') {
    // The rest becomes the note — the same slot, wearing the other type (`swapSlotForRest` backwards).
    const rest = found.rest
    const chord: Chord = {
      id: uuidv4(), type: 'chord', beat: rest.beat, duration: rest.duration, measure: rest.measure, notes: pitches,
      ...(rest.dots !== undefined && { dots: rest.dots }),
      ...(rest.voice !== undefined && { voice: rest.voice }),
      ...(rest.tupletId !== undefined && { tupletId: rest.tupletId }),
      ...(rest.actualDuration !== undefined && { actualDuration: rest.actualDuration }),
      ...(rest.staffId !== undefined && { staffId: rest.staffId }),
      ...(rest.graceBefore && { graceBefore: rest.graceBefore }),
      ...(rest.bracketedBefore && { bracketedBefore: rest.bracketedBefore }),
      ...((at.note.cue || rest.cue) && { cue: true as const }), // its own, or the cue silence it lands in
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
    if (at.note.cue) chord.cue = true
  }
  dbg(`[bracketedToNote] ${pitches.map(p => `${p.step}${p.octave}`).join('+')} → its ${at.onGrace ? 'grace' : found.type}, re-pitched; the bracketed grace is gone`)
  return pitches[0].id
}

/**
 * ⭐ **A GRACE becomes a bracketed grace, and its TARGET is what stands to its RIGHT** — the next grace of
 * its group, or, for the last, the slot itself (a chord or a rest). The other graces stay: the group only
 * loses this one — and, if the new bracketed grace lands on a grace, the group's beam SPLITS there (B4).
 *
 * - Written as the grace was: its pitches (ids kept, a grace chord → a bracketed chord) and its written
 *   value (its head, B7). ⛔ Its dots and articulations go, logged (a bracketed grace has neither).
 * - It stands where the grace stood: FIRST in its target's list — left of any bracketed grace already there
 *   — with the brackets that were bent into the grace in front of it, still in their order.
 * - A slur on it moves to the target's first pitch (a slur cannot end on a bracketed grace); one that
 *   collapses to a single note goes (`reanchorSlurs`' rule). Its hand offset goes.
 *
 * ⛔ Refused: not a grace; the LAST grace of a group AFTER (nothing of its own stands to its right —
 * a bracketed grace belongs to what follows it, and a Nachschlag's next note is another slot's).
 * @returns the new bracketed grace's first pitch id (the grace's own), or null.
 */
export function graceToBracketed(score: Score, gracePitchId: string): string | null {
  const found = findSlot(score, gracePitchId, { graceNotes: true })
  if (!found?.grace) return null
  const { side, index, note: grace } = found.grace
  const slot = found.type === 'chord' ? found.chord : found.rest
  const group = side === 'before' ? slot.graceBefore : found.type === 'chord' ? found.chord.graceAfter : undefined
  if (!group) return null
  const next = group.notes[index + 1]
  if (!next && side === 'after') {
    dbg(`[graceToBracketed] refused: the last grace AFTER a note has nothing of its own to its right`)
    return null
  }
  const target: { bracketedBefore?: BracketedGrace[] } = next ?? slot
  if (grace.dots || grace.articulations?.length) {
    dbg(`[graceToBracketed] its ${[grace.dots && 'dots', grace.articulations?.length && 'articulations'].filter(Boolean).join(' and ')} go — a bracketed grace has none`)
  }
  // ⛔ A grace's own brackets do not travel: a bracketed grace IS in brackets (parenthesised-note-plan N5).
  const pitches = grace.pitches.map(({ enclosure: _enclosure, ...p }) => ({ ...p }))
  const bracketed: BracketedGrace = { pitches, duration: grace.duration, ...(grace.cue && { cue: true as const }) }
  target.bracketedBefore = [...(grace.bracketedBefore ?? []), bracketed, ...(target.bracketedBefore ?? [])]

  group.notes.splice(index, 1)
  if (group.notes.length === 0) delete (slot as { graceBefore?: unknown; graceAfter?: unknown })[graceKey(side)]
  clearEngravingOverride(score, gracePitchId, 'noteOffset')
  const targetId = next?.pitches[0]?.id ?? (slot.type === 'chord' ? slot.notes[0]?.id : slot.id) ?? null
  for (const p of grace.pitches) reanchorSlurs(score, p.id, targetId)
  dbg(`[graceToBracketed] ${pitches.map(p => `${p.step}${p.octave}`).join('+')} → a bracketed grace before ${next ? 'the next grace' : `its ${slot.type}`} (${group.notes.length} grace(s) left)`)
  return pitches[0].id
}

/**
 * ⭐ **A BRACKETED grace becomes a GRACE, keeping its target** — a grace button pressed with it selected:
 *
 * - its target a GRACE → it joins that grace's group, just BEFORE it (where it stood);
 * - its target the SLOT, before → it joins the slot's group BEFORE, last (between the group and the note,
 *   where it stood);
 * - ⭐ the group it joins — new or existing — takes the PRESSED `form` (his rule: joining retypes it);
 * - AFTER the chord → it joins the group AFTER, first.
 *
 * ⭐ The picture keeps its order — "the target is what stands to the right", both ways: the bracketed
 * graces that stood LEFT of it in its list are now bent into the new grace; those to its right stay on
 * the old target. Written as it was: its pitches (ids kept) and its written value.
 * @returns the new grace's first pitch id (its own), or null when `pitchId` is not a bracketed grace.
 */
export function bracketedToGrace(score: Score, pitchId: string, form: GraceForm): string | null {
  const found = findSlot(score, pitchId, { bracketed: true })
  const at = found?.bracketed
  if (!found || !at) return null
  const slot = found.type === 'chord' ? found.chord : found.rest
  const holder = (at.onGrace ?? slot) as { bracketedBefore?: BracketedGrace[]; bracketedAfter?: BracketedGrace[] }
  const key = bracketedKey(at.side)
  const list = holder[key]!
  const leftOfIt = list.slice(0, at.index)
  const rightOfIt = list.slice(at.index + 1)
  if (rightOfIt.length) holder[key] = rightOfIt
  else delete holder[key]

  const grace: GraceNote = { pitches: at.note.pitches.map(p => ({ ...p })), duration: at.note.duration, ...(at.note.cue && { cue: true as const }) }
  if (leftOfIt.length && at.side === 'before') grace.bracketedBefore = leftOfIt
  else if (leftOfIt.length) holder[key] = [...leftOfIt, ...(holder[key] ?? [])] // AFTER: they stay between the note and it

  const side = at.side === 'after' && found.type === 'chord' ? 'after' : 'before'
  const owner = slot as { graceBefore?: GraceGroup; graceAfter?: GraceGroup }
  const groupKey = graceKey(side)
  const group: GraceGroup = owner[groupKey] ?? { notes: [] }
  // ⭐ The group takes the PRESSED form — a new one, and an existing one it JOINS (his rule, 2026-09-23:
  //    *"supose the group was appog and i selected bracket and click acciac… when the bracket joins the
  //    group also transfomr it type"*). One slash per group (Gould p. 126), so the whole group is retyped.
  if (form === 'acciaccatura') group.slash = true
  else delete group.slash
  const place = at.onGrace ? group.notes.indexOf(at.onGrace) : side === 'before' ? group.notes.length : 0
  group.notes.splice(Math.max(0, place), 0, grace)
  owner[groupKey] = group
  dbg(`[bracketedToGrace] ${grace.pitches.map(p => `${p.step}${p.octave}`).join('+')} → a grace at ${place} of the ${side} group (${group.notes.length} in it)`)
  return grace.pitches[0].id
}
