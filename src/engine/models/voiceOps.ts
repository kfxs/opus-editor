/**
 * MOVING A NOTE BETWEEN VOICES — extracted from {@link ScoreModel}, which keeps thin public
 * delegators to these free functions (docs/modularity-plan-2026-07-28.md Phase 3).
 *
 * A voice is a LANE, not a container: `voice` is a field on the slot (absent = voice 0), so moving
 * a note between voices is not a re-parent — it is a field change plus the repairs that field
 * change implies. Those repairs are the module:
 *
 *  - the source lane may be left with a hole (fill it) or empty (collapse it, so a one-voice bar
 *    goes back to having no voice tags at all);
 *  - the target lane may already have something at that beat — it chords, and the SHORTER duration
 *    wins (docs/move-note-to-voice-plan.md);
 *  - a tie or a two-note tremolo is a RELATION and cannot span voices, so a move can leave one
 *    broken: `dropCrossVoiceTies` and `markOps.dropStaleTremoloPairs` sever exactly those, and
 *    both are careful about a BATCH — a partner moving in the same gesture is not a break;
 *  - a slur is stored with a voice, so once BOTH its anchors have moved, the stored voice follows.
 *
 * ⚠️ A note inside a TUPLET is its own case, and a big one ({@link moveTupletNoteToVoice}): the
 * group is atomic, so the note cannot simply leave — a matching tuplet is created in the target
 * voice and the ordinal slots are poured across.
 */
import type { Score, Measure, Chord, NotePitch, Tuplet, Fraction, PitchInsert } from '@/types/music'
import { v4 as uuidv4 } from 'uuid'
import { dbg } from '@/utils/debug'
import { voiceOf } from '@/utils/lanes'
import { fracCompare, fracEq, fracAdd, fracSub, fracMul, fracCreate, fracToNumber, fracGte, fracLt } from '@/utils/fraction'
import { tupletSpan, tupletSlotDuration } from '@/utils/musicUtils'
import { alterToString } from '@/utils/pitchSpelling'
import { staffIndexOfId } from './staffContent'
import { findSlot } from './slotLookup'
import * as markOps from './markOps'
import * as tupletOps from './tupletOps'

/**
 * The `ScoreModel` callbacks these free functions call back into — the {@link rebarOps.RebarDeps}
 * idiom, and for its reason: rest-fill and pitch insertion are core note-entry machinery that a
 * voice move USES but does not own, so they are handed in rather than duplicated or dragged along.
 */
export interface VoiceDeps {
  /** Fill any hole a departure left in the source lane. */
  fillGapsWithRests(measure: Measure): void
  /** Put the pitch into the target lane — merging into a same-beat chord, or making a new slot. */
  insertPitch(measure: Measure, payload: PitchInsert): void
  /** Fill the remainder of a freshly made tuplet with rests. */
  refillTupletRemainder(measureNumber: number, tuplet: Tuplet, voice?: number): void
}

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/**
 * Drop any secondary voice (model voice ≠ 0) in a measure that has no notes left
 * — only rests — so the bar reverts to a single stream. Voice 0 is the primary
 * stream and is never collapsed (an empty bar stays one voice of rests). Called
 * after deletions; a no-op for single-voice bars.
 */
export function collapseEmptyVoices(score: Score, measureNumber: number): void {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return

  const secondaryVoices = new Set<number>()
  for (const slot of measure.slots) {
    const v = voiceOf(slot)
    if (v !== 0) secondaryVoices.add(v)
  }

  for (const voice of secondaryVoices) {
    const hasNote = measure.slots.some(s => voiceOf(s) === voice && s.type === 'chord')
    if (!hasNote) {
      measure.slots = measure.slots.filter(s => voiceOf(s) !== voice)
    }
  }
}

/**
 * Move a single plain note's pitch into another voice, **preserving its
 * `pitch.id`** so ties/slurs/articulations/selection all stay anchored to it
 * (see the move-note-to-voice plan §2 — choice B, mutate in place). The source
 * voice closes its gap with rests (and collapses if it was a now-empty
 * secondary voice); the target voice opens to receive the note.
 *
 * Plain (non-tuplet) notes only — a tuplet member returns false and is left for
 * the tuplet path (plan Phase 4). Rests and unknown ids are ignored.
 *
 * @returns true if the note actually moved.
 */
export function moveNoteToVoice(score: Score, deps: VoiceDeps, pitchId: string, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
  const found = findSlot(score, pitchId)
  if (!found || found.type !== 'chord') return false // rests / unknown ids ignored

  const { chord, pitch } = found
  const from = voiceOf(chord)
  if (from === targetVoice) return false // no-op: already in the target voice

  const measure = getMeasure(score, chord.measure)
  if (!measure) return false

  // Tuplet member → the ordinal-fill tuplet path (creates a matching tuplet in
  // the target voice). Plain notes continue below.
  if (chord.tupletId) {
    return moveTupletNoteToVoice(score, deps, measure, chord, pitch, targetVoice, movingIds)
  }

  dbg(`[Model.moveNoteToVoice] ${pitch.step}${alterToString(pitch.alter)}${pitch.octave} (id ${pitch.id.slice(0, 8)}) v${from}→v${targetVoice} @ m${chord.measure} b${fracToNumber(chord.beat).toFixed(3)}`)

  // Capture the pitch payload before mutating anything (reuse the SAME id).
  const payload = {
    id: pitch.id,
    step: pitch.step,
    alter: pitch.alter,
    octave: pitch.octave,
    forceAccidental: pitch.forceAccidental,
    tiedTo: pitch.tiedTo,
    tiedFrom: pitch.tiedFrom,
    tieDirection: pitch.tieDirection,
    duration: chord.duration,
    dots: chord.dots,
    beat: chord.beat,
    voice: targetVoice,
    // Articulations live on the SLOT, not the pitch — carry them so an accented note
    // keeps its accent across the voice move. Placement (the explicit `x` flip) is NOT
    // carried: it is voice-aware, so the new voice re-derives the correct auto side.
    articulations: chord.articulations,
    articulationStemAlign: chord.articulationStemAlign,
    // Beaming is a SLOT statement too, and unlike articulation placement it is not
    // voice-derived: `begin`/`continue`/`end`/`single` say how this note groups with its
    // neighbours, and moving the whole group to another voice keeps that grouping. Left
    // behind, an explicitly beamed run would silently fall back to auto beat groups.
    beam: chord.beam,
    secondaryBreak: chord.secondaryBreak,
    // Also a SLOT statement, and not voice-derived: which note you repeat and how finely says
    // nothing about which voice it is in, so the mark travels with the note.
    tremolo: chord.tremolo,
    // ⭐ The TWO-NOTE pair travels too — "I should be able to move what I marked". It is a
    // RELATION, so unlike the others it can arrive broken: moving one note of a pair and not the
    // other leaves nothing to alternate with. {@link dropStaleTremoloPairs}, run once the move (or
    // the whole batch) has settled, is what severs those — the same shape `dropCrossVoiceTies`
    // has for the other relation that cannot span voices.
    tremoloPair: chord.tremoloPair,
    tremoloPairStyle: chord.tremoloPairStyle,
    // A fan is a PROPERTY of the event like the tremolo, not a relation, so it simply comes along
    // — there is no partner it can be torn away from.
    fan: chord.fan,
  }

  // Remove the pitch from the source slot.
  let removedWholeSlot = false
  if (chord.notes.length > 1) {
    // One pitch of a chord leaves; the chord (and the beat it holds) stays.
    chord.notes = chord.notes.filter(n => n.id !== pitch.id)
  } else {
    // Last/only pitch — remove the whole slot; the source voice now has a gap.
    measure.slots = measure.slots.filter(s => s.id !== chord.id)
    removedWholeSlot = true
  }

  // Insert into the target voice (merges into a same-beat chord, or makes a new
  // one and clears the target-voice rest there). Reuses the captured id.
  deps.insertPitch(measure, payload)

  // A tie whose partner stayed behind would now span two voices — drop it (plan
  // §5). A partner that's also moving in this batch (movingIds) is kept: it will
  // land in the same target voice, so the tie survives.
  dropCrossVoiceTies(score, pitch.id, targetVoice, movingIds)

  // Repair the source voice if removing a whole slot left a gap, THEN collapse
  // an emptied secondary voice (order matters — plan Phase 1 step 8).
  if (removedWholeSlot) {
    deps.fillGapsWithRests(measure)
    collapseEmptyVoices(score, measure.number)
  }

  // Keep any slur's stored voice in sync with its (now-moved) anchors.
  resyncSlurVoiceForPitch(score, pitch.id)

  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))

  // A two-note tremolo the move tore in half. ONLY for a lone move: inside a batch the pair is
  // invalid between the two notes' moves, and `moveSelectionToVoice` prunes once the loop is done.
  if (!movingIds) markOps.dropStaleTremoloPairs(score, measure.number)
  return true
}

/**
 * After a pitch changes voice, clear any tie whose partner is NOT in the same
 * voice (a tie spanning two voices is invalid). Clears both reciprocal sides.
 * A partner whose id is in `movingIds` is kept — it is moving to the same target
 * voice in this batch, so the tie survives (plan §5: ties whose both endpoints
 * land in the same target voice survive).
 */
export function dropCrossVoiceTies(score: Score, pitchId: string, voice: number, movingIds?: ReadonlySet<string>): void {
  const found = findSlot(score, pitchId)
  if (!found || found.type !== 'chord') return
  const pitch = found.pitch

  if (pitch.tiedTo) {
    const partner = findSlot(score, pitch.tiedTo)
    const partnerVoice =
      partner?.type === 'chord' ? voiceOf(partner.chord)
      : partner?.type === 'rest' ? voiceOf(partner.rest)
      : undefined
    if (partnerVoice !== voice && !movingIds?.has(pitch.tiedTo)) {
      if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
      else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
      pitch.tiedTo = undefined
      dbg(`[Model.dropCrossVoiceTies] dropped tiedTo (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
    }
  }
  if (pitch.tiedFrom) {
    const partner = findSlot(score, pitch.tiedFrom)
    // A tie's source is always a chord pitch (a rest can't start a tie).
    const partnerVoice = partner?.type === 'chord' ? voiceOf(partner.chord) : undefined
    if (partnerVoice !== voice && !movingIds?.has(pitch.tiedFrom)) {
      if (partner?.type === 'chord') partner.pitch.tiedTo = undefined
      pitch.tiedFrom = undefined
      dbg(`[Model.dropCrossVoiceTies] dropped tiedFrom (partner v${partnerVoice ?? '?'} ≠ v${voice})`)
    }
  }
}

/**
 * Keep a slur's stored `voice` field in sync with its anchors after a move. If
 * both endpoints now sit in the same voice, adopt it (so JSON export and the
 * renderer's fallback path agree with what's drawn — direction/colour already
 * derive from the live start-note voice). A slur left spanning two voices keeps
 * its old field (ambiguous; nothing to reassign).
 */
export function resyncSlurVoiceForPitch(score: Score, pitchId: string): void {
  for (const slur of score.slurs ?? []) {
    if (slur.startNoteId !== pitchId && slur.endNoteId !== pitchId) continue
    const start = findSlot(score, slur.startNoteId)
    const end = findSlot(score, slur.endNoteId)
    const sv = start?.type === 'chord' ? voiceOf(start.chord) : undefined
    const ev = end?.type === 'chord' ? voiceOf(end.chord) : undefined
    if (sv !== undefined && sv === ev && voiceOf(slur) !== sv) {
      dbg(`[Model.resyncSlurVoice] slur ${slur.id.slice(0, 8)} voice ${voiceOf(slur)}→${sv}`)
      slur.voice = sv as 0 | 1 | 2 | 3
    }
  }
}

/**
 * Move a tuplet member into another voice — the "ordinal fill" rule
 * (move-note-to-voice plan, Phase 4). A matching tuplet is created in the target
 * voice over the SAME span; the moved note lands in its own relative slot; any
 * notes the target voice already had in that span are poured into the remaining
 * slots left-to-right (empty → tuplet rests, overflow → dropped, a collision on
 * the moved note's own slot → chorded). The source tuplet's gap is refilled (and
 * the tuplet dropped if it ends up all rests). Ids are preserved throughout.
 */
export function moveTupletNoteToVoice(score: Score, deps: VoiceDeps, measure: Measure, chord: Chord, pitch: NotePitch, targetVoice: number, movingIds?: ReadonlySet<string>): boolean {
  const sourceTuplet = measure.tuplets?.find(t => t.id === chord.tupletId)
  if (!sourceTuplet) return false // defensive: tupletId with no tuplet record

  const from = voiceOf(chord)
  const { startBeat, baseDuration, baseDots, numNotes, notesOccupied } = sourceTuplet
  // Slot spacing is the ACTUAL (scaled) duration, not the written baseDuration.
  const slot = tupletSlotDuration(sourceTuplet)
  const span = tupletSpan(sourceTuplet)
  const spanEnd = fracAdd(startBeat, span)

  // Relative slot index of the moved note within the tuplet grid.
  const rawIdx = Math.round(fracToNumber(fracSub(chord.beat, startBeat)) / fracToNumber(slot))
  const idx = rawIdx >= 0 && rawIdx < numNotes ? rawIdx : 0

  dbg(`[Model.moveTupletNoteToVoice] ${pitch.step}${alterToString(pitch.alter)}${pitch.octave} slot ${idx}/${numNotes} v${from}→v${targetVoice} @ m${measure.number} tuplet b${fracToNumber(startBeat).toFixed(3)}`)

  // The moved pitch, reusing its id (tie/slur/selection anchor).
  const movedPitch: NotePitch = {
    id: pitch.id,
    step: pitch.step,
    alter: pitch.alter,
    octave: pitch.octave,
    forceAccidental: pitch.forceAccidental,
    tiedTo: pitch.tiedTo,
    tiedFrom: pitch.tiedFrom,
    tieDirection: pitch.tieDirection,
  }

  // Capture the target voice's existing notes in the span BEFORE createTuplet
  // wipes them, keeping each chord's beat. Each existing CHORD slot is one unit
  // (keeps its pitches + ids), ordered left-to-right; durations are discarded
  // (the tuplet wins). The beat lets us tell a note already sitting on a grid
  // slot (it KEEPS that slot) from a loose note (ordinal pour).
  const existing = measure.slots
    .filter((s): s is Chord => s.type === 'chord' && voiceOf(s) === targetVoice
      && fracGte(s.beat, startBeat) && fracLt(s.beat, spanEnd))
    .sort((a, b) => fracCompare(a.beat, b.beat))
    .map(c => ({ beat: c.beat, notes: c.notes }))

  // Remove the moved pitch from the source slot.
  let removedSourceSlot = false
  if (chord.notes.length > 1) {
    chord.notes = chord.notes.filter(n => n.id !== pitch.id)
  } else {
    measure.slots = measure.slots.filter(s => s.id !== chord.id)
    removedSourceSlot = true
  }

  // Create the matching tuplet in the target voice, on the note's OWN staff (a
  // voice-move stays on the same staff), so a staff-1 note doesn't drop to staff 0.
  const targetStaffId = chord.staffId
  const targetStaff = staffIndexOfId(score, targetStaffId)
  const targetTuplet = tupletOps.createTuplet(score, measure.number, startBeat, baseDuration, numNotes, notesOccupied, targetVoice, targetStaff, baseDots)

  // Which grid slot a beat lands on exactly (−1 if it's between slots).
  const gridIndexOf = (beat: Fraction): number => {
    for (let g = 0; g < numNotes; g++) {
      if (fracEq(fracAdd(startBeat, fracMul(slot, fracCreate(g, 1))), beat)) return g
    }
    return -1
  }

  // Ordinal-fill assignment. The moved note takes its slot; an existing note
  // already on a grid slot KEEPS it (chord on collision); loose notes pour into
  // the remaining free slots in order, overflow dropped.
  const assignment: (NotePitch[] | undefined)[] = new Array(numNotes).fill(undefined)
  const placeAt = (g: number, pitches: NotePitch[]) => {
    assignment[g] = assignment[g] ? [...assignment[g]!, ...pitches] : pitches
  }
  placeAt(idx, [movedPitch])
  const loose: NotePitch[][] = []
  for (const e of existing) {
    const g = gridIndexOf(e.beat)
    if (g >= 0) placeAt(g, e.notes) // grid-aligned → keep its own slot
    else loose.push(e.notes)        // loose → ordinal pour below
  }
  let k = 0
  for (const pitches of loose) {
    while (k < numNotes && assignment[k] !== undefined) k++
    if (k >= numNotes) break // overflow — drop the rest
    assignment[k] = pitches
    k++
  }

  // Materialise each occupied grid position as a tuplet chord.
  for (let g = 0; g < numNotes; g++) {
    const pitches = assignment[g]
    if (!pitches || pitches.length === 0) continue
    const beatG = fracAdd(startBeat, fracMul(slot, fracCreate(g, 1)))
    const newChord: Chord = {
      id: uuidv4(),
      type: 'chord',
      beat: beatG,
      duration: baseDuration,
      measure: measure.number,
      tupletId: targetTuplet.id,
      actualDuration: slot,
      notes: pitches,
    }
    if (targetVoice) newChord.voice = targetVoice as 0 | 1 | 2 | 3
    if (targetStaffId !== undefined) newChord.staffId = targetStaffId
    // The moved note's own beam statement rides along (same reason as the plain path);
    // the target voice's pre-existing notes are re-poured, so theirs is not carried.
    if (g === idx) {
      if (chord.beam) newChord.beam = chord.beam
      if (chord.secondaryBreak) newChord.secondaryBreak = true
    }
    measure.slots.push(newChord)
  }

  // Fill the target tuplet's empty slots with tuplet rests.
  deps.refillTupletRemainder(measure.number, targetTuplet, targetVoice)

  // Drop any tie of the moved note that would now span two voices (a co-moving
  // partner in movingIds is kept — it lands in the same target voice).
  dropCrossVoiceTies(score, pitch.id, targetVoice, movingIds)

  // Source side: close the source tuplet's gap; drop it if now all rests.
  if (removedSourceSlot) {
    deps.refillTupletRemainder(measure.number, sourceTuplet, from)
    const sourceHasNote = measure.slots.some(s => s.tupletId === sourceTuplet.id && s.type === 'chord')
    if (!sourceHasNote) {
      tupletOps.deleteTuplet(score, sourceTuplet.id, m => deps.fillGapsWithRests(m))
    }
  }

  // Fill any remaining per-voice gaps (e.g. a brand-new target voice's bar
  // outside the tuplet span), collapse an emptied secondary voice, and prune
  // any tuplet left with no member slots.
  deps.fillGapsWithRests(measure)
  collapseEmptyVoices(score, measure.number)
  if (measure.tuplets) {
    measure.tuplets = measure.tuplets.filter(t => measure.slots.some(s => s.tupletId === t.id))
  }

  // Keep any slur's stored voice in sync with its (now-moved) anchors.
  resyncSlurVoiceForPitch(score, pitch.id)

  measure.slots.sort((a, b) => fracCompare(a.beat, b.beat))

  // A two-note tremolo the move tore in half. ONLY for a lone move: inside a batch the pair is
  // invalid between the two notes' moves, and `moveSelectionToVoice` prunes once the loop is done.
  if (!movingIds) markOps.dropStaleTremoloPairs(score, measure.number)
  return true
}
