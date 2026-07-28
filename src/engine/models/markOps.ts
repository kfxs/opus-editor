/**
 * THE MARKS A SLOT WEARS — articulation side, tie direction, tremolo, two-note tremolo, fanned
 * beam, beam-over-rest — extracted from {@link ScoreModel}, which keeps thin public delegators to
 * these free functions (docs/modularity-plan-2026-07-28.md Phase 3).
 *
 * What files them together: each is an **authored statement about one slot**, stored ON that slot,
 * with no length and no position of its own. `setTremolo(id, 3)` says "play this note as a
 * tremolo"; the strokes, the stem stretch and the playback period are all consequences the renderer
 * and the player derive — never written back. That is the same shape as `setFan` (one note, drawn
 * as many) and `flipArticulationPlacement` (a side, not a coordinate), and it is why they belong in
 * one module rather than beside whatever mechanism happens to draw them.
 *
 * ⚠️ The `tremoloPair` mark is the exception that proves it: a two-note tremolo is a RELATION
 * between adjacent slots, so its validity is not local — {@link tremoloPairAcceptsJoined} and
 * `pairIsValid` (utils/tremoloPair) answer by looking at the neighbour, and
 * {@link dropStaleTremoloPairs} sweeps pairs whose partner has gone. The mark is still stored on
 * the one slot; only its MEANING needs two.
 */
import type {
  Score, Note, Chord, Measure, Fraction, TremoloMark, FanMark,
} from '@/types/music'
import { laneOfSlot, pairAcceptsJoined, pairIsValid } from '@/utils/tremoloPair'
import { normalizeFan } from '@/utils/fannedBeam'
import { spellingDiatonicPos } from '@/utils/pitchSpelling'
import { effectiveClefAt, middleLineDiatonicPos } from '@/utils/clefUtils'
import { voiceOf } from '@/utils/lanes'
import { staffIndexOfId } from './staffContent'
import { fracEq } from '@/utils/fraction'
import { findSlot, attackOf } from './slotLookup'
import { flatNoteOf } from './noteProjection'
import { clearFanMemberOffsets } from './overrideOps'

/** Find a measure by its number (mirrors `ScoreModel.getMeasure`). */
function getMeasure(score: Score, measureNumber: number): Measure | undefined {
  return score.measures.find(m => m.number === measureNumber)
}

/**
 * Flip the side (above/below) of the articulations on the slot containing
 * `noteId`. The first flip resolves the current auto side (stem-derived, the
 * default) and stores the opposite; a further flip toggles back. No-op for
 * rests or slots without articulations. Returns the flat note, or null.
 */
export function flipArticulationPlacement(score: Score, noteId: string): Note | null {
  // ⭐ `fanMembers: true` + `attackOf`: ONE body for both, because a flip is a fact about the ATTACK
  // and a fan has N of those. A member flips itself and nothing else — his report was that flipping
  // the owner flipped all six, which is what one side per gesture means.
  const found = findSlot(score, noteId, { fanMembers: true })
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found
  const attack = attackOf(found)
  if (!attack?.articulations?.length) return null
  // Sibelius-style `x` toggle: auto ↔ flipped (mirrors flipTuplet/flipSlur/flipTie).
  // An explicit override returns to the context-aware auto default; an auto mark pins
  // the opposite of the side it's currently drawn on, so the first press always visibly
  // flips and two presses round-trip back to auto. Crucially this lets a mark that was
  // flipped-and-flipped-back follow the voice-aware default again when a 2nd voice is
  // later added (the old absolute flip pinned a side forever).
  //
  // The auto side is the CHORD's either way: a member hangs off the same stem in the same voice, so
  // the side it toggles against is the group's. Only the flip itself is private to the attack.
  if (attack.articulationPlacement !== undefined) {
    delete attack.articulationPlacement
  } else {
    attack.articulationPlacement = autoArticulationPlacement(score, chord) === 'above' ? 'below' : 'above'
  }
  return flatNoteOf(score, chord, pitch)
}

/**
 * Set whether the slot's stem-side articulations align to the stem (modern)
 * rather than the notehead (traditional default). No-op for rests or slots
 * without articulations. Stores the flag only when true; clears it when false
 * so the default state serializes clean. Returns the flat note, or null.
 */
export function setArticulationStemAlign(score: Score, noteId: string, align: boolean): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found
  if (!chord.articulations?.length) return null
  if (align) chord.articulationStemAlign = true
  else delete chord.articulationStemAlign
  return flatNoteOf(score, chord, pitch)
}

/** Set the explicit tie-curve direction (-1 up / +1 down) on the tie starting at
 *  `fromNoteId`. No-op (returns false) if the id isn't a chord head with a tie. */
export function setTieDirection(score: Score, fromNoteId: string, direction: -1 | 1): boolean {
  const found = findSlot(score, fromNoteId)
  if (!found || found.type === 'rest' || !found.pitch.tiedTo) return false
  found.pitch.tieDirection = direction
  return true
}

/** Remove any explicit tie-curve override on `fromNoteId` (revert to auto). */
export function clearTieDirection(score: Score, fromNoteId: string): void {
  const found = findSlot(score, fromNoteId)
  if (found && found.type === 'chord') delete found.pitch.tieDirection
}

/**
 * Set — or with `null`, remove — the single-note tremolo on the slot containing `noteId`.
 *
 * SINGLE-VALUED: a note carries one tremolo, so a different mark REPLACES the one there rather
 * than stacking (articulations are the additive kind). Refuses a REST outright — you cannot
 * tremolo silence — which is why {@link Rest} has no such field to write. Returns the flat note,
 * or null when the id is not a chord pitch.
 *
 * The mark lives on the slot, so a chord takes it as a chord — passing any pitch id in the chord
 * marks the whole event, which is the same call {@link setArticulationStemAlign} makes.
 *
 * ⭐ REMOVING THE COUNT REMOVES A TWO-NOTE PAIR WITH IT — and the pair's stroke STYLE too — and
 * that is the model rather than a courtesy: a pair needs a stroke COUNT
 * (docs/two-note-tremolo-plan.md §0), so `tremoloPair` with no `tremolo` is a mark with nothing to
 * draw, and `tremoloPairStyle` with no pair is a setting for a mark that is not there. Putting it
 * here rather than in each caller is what makes Delete, the palette's re-press and anything added
 * later agree for free. CHANGING the count leaves both alone — that is the same mark re-read.
 */
export function setTremolo(score: Score, noteId: string, tremolo: TremoloMark | null): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found
  if (tremolo === null) {
    delete chord.tremolo
    delete chord.tremoloPair
    delete chord.tremoloPairStyle
  } else {
    chord.tremolo = tremolo
    // The other expansion of one slot into many attacks stands down — see {@link setFan}. Only
    // when a mark is being SET: removing a tremolo is not a statement about the fan.
    delete chord.fan
  }
  return flatNoteOf(score, chord, pitch)
}

/**
 * Set — or with `false`, remove — the TWO-NOTE tremolo on the slot containing `noteId`.
 *
 * Refuses (returns null) whenever {@link pairIsValid} says this slot cannot be the first note of a
 * pair — the §0 list, read off the slot's own lane. The ONE predicate: the button asks it here,
 * the renderer asks it before drawing, the beam grouper before excluding. It is checked at APPLY
 * time and again at DRAW time on purpose; neither alone is enough (docs/two-note-tremolo-plan.md
 * §1).
 *
 * ⭐ THE COUNT COMES FROM THE NOTE, and with none there the press sets THREE. The pair is a
 * separate field from the stroke count, so a press on a note carrying no `tremolo` would otherwise
 * be a mark with nothing to draw. Three strokes is the ordinary two-note tremolo. Refusing instead
 * would make the button dead on exactly the note you pressed it on — the trap the tie stamp
 * already had and fixed (docs/tie-stamp-plan.md §1.3).
 *
 * Removing takes ALL of it off — the count, the pair and the STROKE STYLE. The pair is ONE mark,
 * and half of it is not a notation; and a style left behind on a plain note is the same
 * resurrection trap the flag itself is, silently re-joining the strokes the day the note is paired
 * again (his catch).
 *
 * Nothing is written to the SECOND slot, in either direction. That is the model (§1) — "mark just
 * the first note" is true in the data too, and it is why deleting the partner cannot leave a
 * dangling half-mark.
 */
export function setTremoloPair(score: Score, noteId: string, on: boolean): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found

  if (!on) {
    if (!chord.tremoloPair) return null
    delete chord.tremoloPair
    delete chord.tremolo
    delete chord.tremoloPairStyle
    return flatNoteOf(score, chord, pitch)
  }

  const measure = score.measures.find(m => m.number === chord.measure)
  if (!measure) return null
  const lane = laneOfSlot(measure.slots, chord)
  if (!pairIsValid(lane, lane.indexOf(chord))) return null

  chord.tremoloPair = true
  if (!chord.tremolo) chord.tremolo = 3
  delete chord.fan // the third expansion stands down — see {@link setFan}
  return flatNoteOf(score, chord, pitch)
}

/**
 * Set how a two-note tremolo's strokes MEET the stems — `'joined'` (stem tip to stem tip, like a
 * beam) or `'open'` (floating clear of both, the default).
 *
 * Refuses (returns null) unless the slot actually carries a pair AND that pair's drawn value is a
 * BLANCA — {@link pairAcceptsJoined}, the restriction MuseScore states. Refusing is the point: on a
 * drawn negra the joined strokes would read as two beamed corcheas, a different rhythm; on a
 * corchea or shorter the joining line is a real beam; a redonda has no stems to join. Writing the
 * field there and quietly ignoring it would leave a setting that does nothing and looks broken.
 *
 * `'open'` is stored rather than deleted when chosen explicitly — absent and `'open'` draw the same
 * today, but the field is the per-mark OVERRIDE of a project-wide default that does not exist yet
 * (§2), and "I chose open" will have to outrank that default when it does.
 */
export function setTremoloPairStyle(score: Score, noteId: string, style: 'joined' | 'open'): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found
  if (!chord.tremoloPair) return null

  const measure = score.measures.find(m => m.number === chord.measure)
  if (!measure) return null
  const lane = laneOfSlot(measure.slots, chord)
  const index = lane.indexOf(chord)
  if (!pairIsValid(lane, index) || !pairAcceptsJoined(lane, index)) return null

  chord.tremoloPairStyle = style
  return flatNoteOf(score, chord, pitch)
}

/**
 * Does the two-note tremolo on `noteId` accept the `'joined'` stroke style? The read-only twin of
 * {@link setTremoloPairStyle}'s own gate, so the palette can dark its control without attempting an
 * edit to find out.
 */
export function tremoloPairAcceptsJoined(score: Score, noteId: string): boolean {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest' || !found.chord.tremoloPair) return false
  const measure = score.measures.find(m => m.number === found.chord.measure)
  if (!measure) return false
  const lane = laneOfSlot(measure.slots, found.chord)
  const index = lane.indexOf(found.chord)
  return pairIsValid(lane, index) && pairAcceptsJoined(lane, index)
}

/**
 * Sever every two-note tremolo in `measureNumber` that is no longer one — the model half of
 * docs/two-note-tremolo-plan.md §1's *"a broken pair is DROPPED, not carried"*.
 *
 * Draw-time validation already keeps a stale flag from being DRAWN, and the plan is explicit that
 * this is not enough on its own: the dead flag sits in the JSON and silently comes back to life the
 * day a note of the right length lands next to it again. The relay gets the drop for free (a
 * `RebarEvent` has no such field); every other structural edit needs this.
 *
 * ⚠️ CALL IT ONCE THE EDIT HAS SETTLED, never mid-batch. Moving both notes of a pair moves them one
 * at a time, so between the two the pair is genuinely invalid — pruning there would kill a mark
 * that is about to be whole again. Hence the callers: a single move prunes at its end, and
 * `moveSelectionToVoice` prunes after its loop.
 *
 * Takes the STYLE with the flag, for the same reason removing the mark does: a style with no pair
 * is a setting for a mark that is not there.
 */
export function dropStaleTremoloPairs(score: Score, measureNumber: number): void {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return
  for (const slot of measure.slots) {
    if (slot.type !== 'chord' || !slot.tremoloPair) continue
    const lane = laneOfSlot(measure.slots, slot)
    if (pairIsValid(lane, lane.indexOf(slot))) continue
    delete slot.tremoloPair
    delete slot.tremoloPairStyle
  }
}

/**
 * Set — or with `null`, remove — the FANNED (feathered) beam on the slot containing `noteId`:
 * "play this one event as N notes, speeding up (or slowing down) across exactly its own
 * duration". See {@link FanMark} and docs/fanned-beams-plan.md §0.
 *
 * On the SLOT, like the tremolo and for the same reason: a chord accelerates as a chord.
 *
 * ⭐ **Three refusals, and each is the notation talking, not a guard:**
 * - a REST — you cannot accelerate silence, the same sentence that keeps {@link Rest} free of a
 *   `tremolo` field;
 * - a TUPLET member — a ramp inside a ratio is a second normalization of the same span, and
 *   nobody has asked for one (docs/fanned-beams-plan.md §3);
 * - nothing to remove — removing a fan that is not there is not an edit, so it reports null
 *   rather than minting an undo entry, exactly as {@link setTremoloPair} does when switching off.
 *
 * ⭐ **Setting a fan takes the tremolo off** (and a pair, and its style). Those are the OTHER two
 * ways one slot becomes many attacks, and a slot carrying two of them asks playback a question
 * with two answers — `playbackSchedule` would take whichever it happened to test first and the
 * loser would vanish with no sign. Arming IS clearing, the rule the marking tools already follow.
 */
export function setFan(score: Score, noteId: string, fan: FanMark | null): Note | null {
  const found = findSlot(score, noteId)
  if (!found || found.type === 'rest') return null
  const { chord, pitch } = found

  if (fan === null) {
    if (!chord.fan) return null
    // The members go with the mark, and so do their authored offsets.
    clearFanMemberOffsets(score, chord.fan.members)
    delete chord.fan
    return flatNoteOf(score, chord, pitch)
  }

  if (chord.tupletId) return null
  // ⭐ The ONE place `count` and `members` are held in step (docs/fanned-beam-pitches-plan.md §1).
  // Materialises the members on a fresh mark, grows or shrinks them on an edited one — and does it
  // HERE rather than in the callers so a palette press, a Properties number and anything added
  // later cannot disagree about the off-by-one.
  const before = chord.fan?.members ?? []
  chord.fan = normalizeFan(fan, chord.notes)
  // ⚠️ A LOWERED count truncates the list (`slice(0, want)`), so this is the second way a member
  // dies and it never goes near `deleteNote`. The survivors are the same arrays by identity, so
  // whatever is not in the new list is what left — take its offset with it.
  const kept = new Set(chord.fan.members ?? [])
  clearFanMemberOffsets(score, before.filter(m => !kept.has(m)))
  delete chord.tremolo
  delete chord.tremoloPair
  delete chord.tremoloPairStyle
  return flatNoteOf(score, chord, pitch)
}

/**
 * Set (or clear) `beamOver` on the rest at a given beat/voice/staff.
 *
 * A rest does not itself move between voices — each voice fills its own — so when a beam group that
 * beams over an interior rest changes voice, the flag cannot ride the rest. The move carries it: it
 * captures where a beamed-over rest sat, and after the target voice has been refilled, re-applies the
 * flag to the fresh rest there ({@link MusicEngine.moveSelectionToVoice}). A no-op when no such rest
 * exists — a moved group may decompose its gap into different rests, and a missing target is not an
 * error. Called inside the move's `runBatch`, so no separate undo entry.
 */
export function setRestBeamOver(score: Score, measureNumber: number, beat: Fraction, voice: number, staff: number, value: boolean): void {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return
  const rest = measure.slots.find(s =>
    s.type === 'rest'
    && voiceOf(s) === voice
    && staffIndexOfId(score, s.staffId) === staff
    && fracEq(s.beat, beat))
  if (rest?.type !== 'rest') return
  if (value) rest.beamOver = true
  else delete rest.beamOver
}

/** The side articulations land on by default, mirroring NoteBuilder's auto rule:
 *  - multi-voice measure: the voice's OUTER side — upper voice (0) ABOVE, any lower
 *    voice BELOW — regardless of stem, so the two voices' marks never collide.
 *  - single voice: opposite the stem (the note-head side). */
export function autoArticulationPlacement(score: Score, chord: Chord): 'above' | 'below' {
  const measure = getMeasure(score, chord.measure)
  const multiVoice = measure ? new Set(measure.slots.map(s => voiceOf(s))).size > 1 : false
  if (multiVoice) return voiceOf(chord) === 0 ? 'above' : 'below'
  return resolveStemDirection(score, chord) === 'up' ? 'below' : 'above'
}

/** Resolve a chord's effective stem direction, mirroring the renderer: an explicit
 *  override wins; otherwise the note furthest from the clef's middle line decides. */
export function resolveStemDirection(score: Score, chord: Chord): 'up' | 'down' {
  if (chord.stemDirection === 'up') return 'up'
  if (chord.stemDirection === 'down') return 'down'
  const clef = effectiveClefAt(score, chord.measure, chord.beat, chord.staffId)
  const middle = middleLineDiatonicPos(clef)
  let maxDist = 0
  let dir: 'up' | 'down' = 'down' // middle-line notes follow this convention
  for (const p of chord.notes) {
    const dPos = spellingDiatonicPos(p.step, p.octave)
    const dist = Math.abs(dPos - middle)
    if (dist > maxDist) {
      maxDist = dist
      dir = dPos >= middle ? 'down' : 'up'
    }
  }
  return dir
}
