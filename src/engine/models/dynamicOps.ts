/**
 * DYNAMICS — **moving a mark through the music**, as a SCORE operation. Free functions on a
 * `Score`, in the `hairpinOps` / `pedalOps` / `ottavaOps` idiom, with {@link ScoreModel} keeping a
 * thin delegator (DESIGN-PRINCIPLES principle 5 — the score is independent of the editor, so none
 * of this may live on `MusicEngine`).
 *
 * ⚠️ The dynamics that already existed — add / update / remove / look up — stay on `ScoreModel`;
 * this module is the STEP, the one piece of dynamics logic that has to know what a lane is.
 *
 * ## ⭐⭐ A dynamic is a POINT, so its walk is an ORDER — not a timeline
 *
 * Its three sibling families store a start plus an AMOUNT, so every one of them has to lay the
 * score out on one absolute quarter-beat axis before it can step an end (each keeps its own
 * `measureStartOffsets` for exactly that). A `Dynamic` has no extent: nothing is being held still
 * at the other side, nothing has to stay positive. All the step needs is *which slot comes next*,
 * and that is already the score's own reading order — measure number, then beat. ⛔ So there is no
 * fourth copy of the capacity arithmetic here, and adding one would be inventing a question this
 * family does not ask.
 *
 * ## ⭐ The lane is the mark's STAFF — the pedal's rule after all, not the voice's
 *
 * A dynamic walks every slot of the staff it sits on, in any voice. ⚠️ It governs a voice/stream
 * ({@link Dynamic.voice}) — but that says who gets LOUDER, not where the mark may stand, and the two
 * were fused here until 2026-08-19: *"walking should work in general no matter the voice"*. A column
 * is a place, and every column of the staff is a place a mark can be put.
 *
 * ⚠️ Rests are lane stops like any other slot: `p` at the top of a bar that begins with a rest is
 * ordinary, so there is nothing to filter out.
 */
import type { Score, Dynamic, DynamicOffsetOverride, Measure, Fraction } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { onSameStaff, voiceScopeOf, type VoiceScope } from '@/utils/dynamicScope'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { dynamicOffsetOverrideOf } from './engravingOverrides'

/** An address in the score's reading order — a lane stop, or where the mark is now. */
interface Stop {
  measure: number
  beat: Fraction
}

/** Reading order: measure number first, then beat within the bar. Negative when `a` is earlier. */
function compare(a: Stop, b: Stop): number {
  return a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat)
}

/** The measure a dynamic is stored in, with the live mark itself; null if no such dynamic. */
function locate(score: Score, id: string): { dynamic: Dynamic; measure: Measure } | null {
  for (const measure of score.measures) {
    const dynamic = measure.dynamics?.find(d => d.id === id)
    if (dynamic) return { dynamic, measure }
  }
  return null
}

/**
 * Every slot the mark could STAND ON, in reading order — every slot of its **staff**, in any voice.
 *
 * ⛔ **Not the voices it governs** (his call, 2026-08-19: *"walking should work in general no matter
 * the voice"*). Where a mark sits and which streams it makes louder are two questions, and only the
 * second one is about voices — `utils/dynamicScope.onSameStaff` carries the argument.
 *
 * ⚠️ Two voices striking one beat put the SAME address in here twice, and that is deliberately not
 * filtered: both readers ask this list a question about ADDRESSES ({@link compare} `> 0` for the
 * step, `=== 0` for the reachability test), so a repeat is already invisible to them. ⛔ De-duping
 * would be a guard against nothing — and a guard against nothing is the kind that gets kept for
 * years because nobody can tell what would break without it.
 */
function laneStops(score: Score, dynamic: Dynamic): Stop[] {
  const stops: Stop[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (!onSameStaff(score, dynamic, slot)) continue
      stops.push({ measure: measure.number, beat: slot.beat })
    }
  }
  return stops.sort(compare)
}

/** Re-file a dynamic under a different measure, keeping the SAME object (and so the same id, which
 *  is what the selection holds — a re-created mark would deselect itself mid-gesture). `hairpinOps`'
 *  twin, including the ⭐ `delete` of an emptied array: an absent `dynamics` and an empty one must
 *  not both be reachable, or the JSON round trip has two spellings of "none".
 *  @returns false if the target measure does not exist. */
function moveDynamicToMeasure(score: Score, dynamic: Dynamic, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.dynamics?.findIndex(d => d.id === dynamic.id) ?? -1
    if (idx === -1) continue
    measure.dynamics!.splice(idx, 1)
    if (measure.dynamics!.length === 0) delete measure.dynamics
    break
  }
  if (!target.dynamics) target.dynamics = []
  target.dynamics.push(dynamic)
  return true
}

/**
 * ⭐⭐ **RE-ANCHOR A DYNAMIC — move it to the previous (−1) or next (+1) slot of its own lane**, the
 * model write behind `Ctrl+Shift+←/→` with a dynamic selected (his ask, 2026-08-18).
 *
 * ⭐ **The chord says MUSIC, and this is the musical half a dynamic did not have.** Plain arrows and
 * `Ctrl`+arrows already nudge the mark's INK (`overrideOps.nudgeDynamicOffset`); every other family
 * on the dynamics line reads the harder chord as *move this through the music*, and a dynamic's
 * "where in the music" is the beat it applies from — which playback reads, so this is audible where
 * the nudge beside it is not.
 *
 * ⭐ **A mark stepped across a barline MOVES to the bar it now sits in** — the list it is stored in
 * *is* "the dynamics that happen here" — keeping the same object and the same id, so the selection
 * the user is pressing arrows on survives the step ({@link moveDynamicToMeasure}).
 *
 * ⭐⭐ **And the step CLEARS the mark's SIDEWAYS nudge** (his call, 2026-08-18) — in {@link
 * setDynamicAtSlot}, via {@link clearHorizontalOffset} — `setSlurEndpoint`'s rule, arriving here for
 * its reason verbatim: anchor-relative storage makes an offset *transferable*, not *wanted*. It was
 * tuned against the note it used to sit under, and a re-anchor is the user saying "not that note".
 * ⭐ The LIFT stays (his call, 2026-08-19) — it answers to the dynamics line, not to a note.
 *
 * ⚠️ Declines (false) — touching nothing — when there is no such dynamic, or when the walk runs off
 * the end of the lane. Declining is what leaves `Ctrl+Shift+←/→` free for the note offset, so the
 * caller must chain rather than repaint on a false.
 */
export function moveDynamicBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const dest = nextDynamicSlot(score, id, direction)
  return dest ? setDynamicAtSlot(score, id, dest) : false
}

/**
 * ⭐ **THE STOP ONE STEP AWAY** — where {@link moveDynamicBySlot} would put the mark, without
 * putting it there. Null at the end of the lane (or for an id no longer in the score).
 *
 * ⭐ Split out for the INTERPOLATING WALK (`interactions/dynamicWalk`), which has to know what lies
 * ahead — how far away it is drawn — before it decides whether this press re-anchors or only nudges
 * ink. ⛔ Two candidate rules would mean the arrows and `Ctrl+Shift`+arrow landing the mark on
 * different notes, so both roads read this one.
 */
export function nextDynamicSlot(score: Score, id: string, direction: 1 | -1): DynamicSlotTarget | null {
  const found = locate(score, id)
  if (!found) return null
  const { dynamic, measure } = found

  const here: Stop = { measure: measure.number, beat: dynamic.beat }
  const stops = laneStops(score, dynamic)
  const dest = direction === -1
    // Reach BACK: the last stop before the mark.
    ? [...stops].reverse().find(s => compare(s, here) < 0)
    // Step ON: the first stop after it.
    : stops.find(s => compare(s, here) > 0)
  return dest ?? null
}

/** A lane stop named by its address, rather than counted along. `HairpinSlotTarget`'s twin. */
export interface DynamicSlotTarget {
  measure: number
  beat: Fraction
}

/**
 * ⭐ **PUT THE MARK ON `target`** — the keyboard's whole-slot step above runs through it, and so does
 * anything else that lands a mark somewhere by address rather than by counting.
 *
 * ⭐ **One write** — `slurOps.setSlurEndpoint`'s arrangement and its reason: everything that makes a
 * re-anchor more than a `beat` assignment lives here rather than in a caller — the re-file across a
 * barline, the re-sort, and the ⭐⭐ CLEAR of the mark's sideways nudge.

 * ⚠️ Its twin {@link setDynamicAtSlotKeepingOffset} is what the interpolating walk crosses with, on
 * both devices; the difference is the clear and nothing else.
 *
 * ⚠️ Declines (false) when `target` is not a stop of the mark's OWN LANE, or when there is no such
 * dynamic. ⛔ A no-op target
 * (the mark's current address) is refused too: nothing to do, and a caller that repainted on a true
 * would repaint every frame of a drag that has not moved.
 */
export function setDynamicAtSlot(score: Score, id: string, target: DynamicSlotTarget): boolean {
  return placeDynamic(score, id, target, true)
}

/**
 * ⭐⭐ **THE SAME MOVE, KEEPING THE MARK'S OWN NUDGE** — the crossing of the INTERPOLATING WALK
 * (`interactions/dynamicWalk`), `slurOps.setSlurEndpointKeepingEdits`' twin and for its reason.
 *
 * The clear above is right for *"not that note"* — a whole slot in one press, the ink landing
 * wherever the engraver puts it. It is wrong for a ¼-space press that happens to step the ink over
 * a notehead: there the walk re-bases the offset by the gap it just handed to the anchor, so the
 * two writes cancel and **the crossing is invisible**. Wiping the offset instead would make the one
 * press in ten that crosses jump the mark, which is precisely what the walk exists to abolish.
 */
export function setDynamicAtSlotKeepingOffset(score: Score, id: string, target: DynamicSlotTarget): boolean {
  return placeDynamic(score, id, target, false)
}

/** {@link setDynamicAtSlot} and its keep-the-nudge twin, which differ by one line. */
function placeDynamic(score: Score, id: string, target: DynamicSlotTarget, clearOffset: boolean): boolean {
  const found = locate(score, id)
  if (!found) return false
  const { dynamic, measure } = found

  const here: Stop = { measure: measure.number, beat: dynamic.beat }
  if (compare(target, here) === 0) return false
  if (!laneStops(score, dynamic).some(s => compare(s, target) === 0)) return false

  if (target.measure !== measure.number && !moveDynamicToMeasure(score, dynamic, target.measure)) return false
  dynamic.beat = target.beat
  locate(score, id)?.measure.dynamics?.sort((a, b) => fracCompare(a.beat, b.beat))
  if (clearOffset) clearHorizontalOffset(score, id)
  return true
}

/**
 * ⭐⭐ **A RE-ANCHOR DROPS THE SIDEWAYS NUDGE AND KEEPS THE LIFT** (his call, 2026-08-19:
 * *"do not reset y when reanchor"*).
 *
 * The clear exists because an anchor-relative offset is *transferable*, not *wanted* — but that is
 * only true of the axis the anchor lives on. The **x** answered "a little to the left of THAT note",
 * so it is stale the moment the mark is on another one. The **y** answered "this far off the
 * dynamics line", which is a statement about the line and the staff, and every note on that line
 * gives the same answer. Wiping it made a mark stepped one slot jump back up to the default height
 * it had been lifted off on purpose.
 *
 * ⚠️ Clears the whole override when nothing is left of it, so an absent override and a `{0,0}` one
 * are not both reachable — `overrideOps.nudgeDynamicOffset`'s rule.
 */
function clearHorizontalOffset(score: Score, id: string): void {
  const prev = dynamicOffsetOverrideOf(score, id)
  if (!prev) return
  if (prev.y === 0) { clearEngravingOverride(score, id, 'dynamicOffset'); return }
  // ⚠️ Through a typed const, `overrideOps`' arrangement: the setter takes the compartment's BASE
  // type, so a fresh literal is excess-property-checked against it and `x` is refused.
  const next: DynamicOffsetOverride = { kind: 'dynamicOffset', x: 0, y: prev.y }
  setEngravingOverride(score, id, next)
}

/**
 * ⭐⭐ **SET WHICH VOICES THE MARK GOVERNS** — the model write behind `Alt+1…4` / `Alt+5` with a
 * dynamic selected, and behind the Keypad's voice row (docs/dynamic-voice-scope-plan.md P4).
 *
 * ⭐ **`'all'` DELETES the field**, and that is why this exists at all rather than being one more
 * `updateDynamic({ voice })` call: `updateDynamic` is an `Object.assign`, so `{ voice: undefined }`
 * would leave an own key holding `undefined` — a second spelling of "governs everything" that
 * `JSON.stringify` drops and `'voice' in d` does not. The emptied-`dynamics`-array rule
 * ({@link moveDynamicToMeasure}) verbatim: two spellings of one state is the bug, not the verbosity.
 *
 * ⚠️ Declines (false) when there is no such mark, and when the scope is already what is asked — a
 * caller that repainted on a true would repaint on every press of the lit button.
 */
export function setDynamicVoiceScope(score: Score, id: string, scope: VoiceScope): boolean {
  const found = locate(score, id)
  if (!found) return false
  if (voiceScopeOf(found.dynamic) === scope) return false
  if (scope === 'all') delete found.dynamic.voice
  else found.dynamic.voice = scope
  return true
}
