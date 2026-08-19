/**
 * TEMPO MARKS — **moving one through the music**, as a SCORE operation. Free functions on a `Score`,
 * in the `dynamicOps` / `hairpinOps` / `pedalOps` idiom, with {@link ScoreModel} keeping a thin
 * delegator (DESIGN-PRINCIPLES principle 5 — the score is independent of the editor, so none of this
 * may live on `MusicEngine`).
 *
 * ⚠️ The tempo API that already existed — add / update / remove / look up / the tempo map — stays on
 * `ScoreModel` and `utils/tempoMap`; this module is the STEP, the one piece of tempo logic that has
 * to know where the music's onsets are.
 *
 * ## ⭐⭐ A tempo mark has NO LANE — it governs the CLOCK
 *
 * `dynamicOps` walks the mark's own voice on its own staff, because a dynamic speaks for one stream;
 * `pedalOps` walks a whole staff, because there is one damper. A tempo mark carries neither a voice
 * nor a staff ({@link TempoMark}), and it is drawn once per SYSTEM rather than once per staff: what
 * it governs is the clock, which belongs to nobody. So its stops are **every onset in the score**,
 * whatever staff or voice sounds it, deduplicated by `(measure, beat)` and taken in reading order.
 *
 * ⚠️ **Which can name a beat the TOP staff has nothing at** — a left-hand chord under a right-hand
 * rest. The mark then draws at the first element at-or-after its beat on the staff it is engraved
 * above (`rendering/TempoLayout.anchorX`, Gould p. 183), which is a hair right of where a hand
 * engraver would put it. ⏭️ The honest fix is to anchor the drawing to the COLUMN rather than to the
 * top staff's slots; nothing here needs to change for it.
 *
 * ## ⭐ At most ONE mark per beat, so a stop that is taken is REFUSED
 *
 * Two tempo marks on one beat is not a thing (`docs/tempo-marks-plan.md` §4, and the rule
 * `rebarOps.restoreBeatAnchors` already enforces on the way back in). ⛔ The step therefore neither
 * overwrites the sitting mark (silent data loss) nor stacks beside it (a contradiction the tempo map
 * would have to resolve by array order): it declines, and the walk stops there exactly as it stops
 * at the end of the score.
 */
import type { Score, TempoMark, Measure, Fraction, TempoOffsetOverride } from '@/types/music'
import { fracCompare } from '@/utils/fraction'
import { clearEngravingOverride, setEngravingOverride } from './overrideOps'
import { tempoOffsetOverrideOf } from './engravingOverrides'

/** An address in the score's reading order — an onset, or where the mark is now. */
export interface Stop {
  measure: number
  beat: Fraction
}

/** Reading order: measure number first, then beat within the bar. Negative when `a` is earlier. */
function compare(a: Stop, b: Stop): number {
  return a.measure !== b.measure ? a.measure - b.measure : fracCompare(a.beat, b.beat)
}

/** The measure a tempo mark is stored in, with the live mark itself; null if no such mark. */
function locate(score: Score, id: string): { mark: TempoMark; measure: Measure } | null {
  for (const measure of score.measures) {
    const mark = measure.tempos?.find(t => t.id === id)
    if (mark) return { mark, measure }
  }
  return null
}

/**
 * Every onset in the score, in reading order, each appearing once.
 *
 * ⭐ Every staff and every voice, unlike the dynamic's lane — see the header. A column sounded by
 * three voices is ONE stop: the clock changes at a moment, not at a notehead.
 */
function onsets(score: Score): Stop[] {
  const stops: Stop[] = []
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      if (stops.some(s => s.measure === measure.number && fracCompare(s.beat, slot.beat) === 0)) continue
      stops.push({ measure: measure.number, beat: slot.beat })
    }
  }
  return stops.sort(compare)
}

/** Re-file a mark under a different measure, keeping the SAME object (and so the same id, which is
 *  what the selection holds — a re-created mark would deselect itself mid-gesture). `dynamicOps`'
 *  twin, including the ⭐ `delete` of an emptied array: an absent `tempos` and an empty one must not
 *  both be reachable, or the JSON round trip has two spellings of "none".
 *  @returns false if the target measure does not exist. */
function moveTempoToMeasure(score: Score, mark: TempoMark, measureNumber: number): boolean {
  const target = score.measures.find(m => m.number === measureNumber)
  if (!target) return false
  for (const measure of score.measures) {
    const idx = measure.tempos?.findIndex(t => t.id === mark.id) ?? -1
    if (idx === -1) continue
    measure.tempos!.splice(idx, 1)
    if (measure.tempos!.length === 0) delete measure.tempos
    break
  }
  if (!target.tempos) target.tempos = []
  target.tempos.push(mark)
  return true
}

/**
 * ⭐⭐ **WHERE A TEMPO MARK MAY LAND** — the legal anchor for a requested position, which is what
 * makes a paste (or any placement that did not come from the mark's own walk) obey the same rule the
 * walk does. His ask, 2026-08-19: copy/paste one tempo mark, *"but of course you have to take in
 * consideration the real tempo anchor cordinate"*.
 *
 * ⭐ **AT-OR-AFTER, and the drawing is why.** A tempo mark is engraved at the first notational
 * element at-or-after its beat (`rendering/TempoLayout.anchorX`, Gould p. 183); anchoring the MODEL
 * to the onset before it would put the mark's meaning one step behind its ink. So a requested beat
 * that nothing sounds on resolves FORWARD, and only a request past the last onset in the score falls
 * back to that last one — there is nothing after it to move to.
 *
 * ⛔ Never the barline: every stop here is an onset, which is the same list {@link nextTempoSlot}
 * walks. A bar with only a centred measure rest still HAS an onset at its beat 0 — the rest is not
 * an anchor for the DRAWING (which falls back to where the bar's music would start), and that is a
 * question about ink, answered where the ink is.
 */
export function tempoAnchorAt(score: Score, at: Stop): Stop | null {
  const stops = onsets(score)
  if (stops.length === 0) return null
  return stops.find(s => compare(s, at) >= 0) ?? stops[stops.length - 1]
}

/**
 * The tempo mark sitting on a stop, if any — ⚠️ **at most one per beat** is the model's rule
 * (`docs/tempo-marks-plan.md` §4), so a caller placing a mark there has to decide about THIS one.
 * A paste replaces it, which is what `rebarOps.restoreBeatAnchors` does with the clip's own marks.
 */
export function tempoAtStop(score: Score, at: Stop): TempoMark | null {
  const measure = score.measures.find(m => m.number === at.measure)
  return measure?.tempos?.find(t => fracCompare(t.beat, at.beat) === 0) ?? null
}

/**
 * ⭐ **THE STOP ONE STEP AWAY** — where {@link moveTempoBySlot} would put the mark, without putting
 * it there. Null at either end of the score, or for an id no longer in it.
 *
 * ⚠️ It does NOT skip a stop another tempo mark is sitting on: naming it is how the caller comes to
 * refuse, and a candidate rule that quietly hopped over occupied beats would move the mark further
 * than one press asked for.
 */
export function nextTempoSlot(score: Score, id: string, direction: 1 | -1): Stop | null {
  const found = locate(score, id)
  if (!found) return null
  const here: Stop = { measure: found.measure.number, beat: found.mark.beat }
  const stops = onsets(score)
  const dest = direction === -1
    ? [...stops].reverse().find(s => compare(s, here) < 0)
    : stops.find(s => compare(s, here) > 0)
  return dest ?? null
}

/**
 * ⭐⭐ **RE-ANCHOR A TEMPO MARK — move it to the previous (−1) or next (+1) onset**, the model write
 * behind `Ctrl+Shift+←/→` with the mark selected (his ask, 2026-08-19).
 *
 * ⭐ **The chord says MUSIC, and this is the musical half a tempo mark did not have.** Plain arrows
 * and `Ctrl`+arrows nudge its INK (client #13); every family on the outside-staff ladder reads the
 * harder chord as *move this through the music*, and a tempo mark's "where in the music" is the beat
 * it applies from — which playback reads, so this is **audible** where the nudge beside it is not.
 * `utils/tempoMap` recomputes from the measures, so nothing else has to be told.
 *
 * ⭐ **A mark stepped across a barline MOVES to the bar it now sits in** — the list it is stored in
 * *is* "the tempo changes that happen here" — keeping the same object and the same id, so the
 * selection the user is pressing arrows on survives the step ({@link moveTempoToMeasure}).
 *
 * ⭐⭐ **And the step CLEARS the mark's sideways nudge while KEEPING its lift** — `dynamicOps`' rule
 * and its reason verbatim (his call, 2026-08-19): the `x` said *"a little to the left of THAT
 * element"* and is stale the moment the mark is on another one, while the `y` says how far off the
 * ladder's row it sits, which every row answers the same way.
 *
 * ⚠️ Declines (false) — touching nothing — when there is no such mark, when the walk runs off either
 * end of the score, or when the stop it would land on already holds a tempo mark. Declining is what
 * leaves `Ctrl+Shift+←/→` free for the note offset behind it, so the caller must chain rather than
 * repaint on a false.
 */
export function moveTempoBySlot(score: Score, id: string, direction: 1 | -1): boolean {
  const dest = nextTempoSlot(score, id, direction)
  return dest ? placeTempo(score, id, dest, true) : false
}

/**
 * ⭐⭐ **THE SAME MOVE, KEEPING THE MARK'S OWN NUDGE** — the crossing of the INTERPOLATING WALK
 * (`interactions/tempoWalk`), `dynamicOps.setDynamicAtSlotKeepingOffset`'s twin and for its reason.
 *
 * The clear above is right for *"not that element"* — a whole stop in one press. It is wrong for a
 * ¼-space press that happens to step the ink over one: there the walk re-bases the offset by the gap
 * it just handed to the anchor, so the two writes cancel and **the crossing is invisible**.
 */
export function setTempoAtSlotKeepingOffset(score: Score, id: string, target: Stop): boolean {
  return placeTempo(score, id, target, false)
}

/**
 * ⭐ **PUT THE MARK ON `target`** — the write a DRAG lands with when it leaves the mark's own system
 * (`interactions/tempoWalk`), where the walk's crossings use the keep-the-nudge twin above. It takes
 * the whole-stop rule: the sideways nudge goes, because a jump is the user saying *"not there"*.
 *
 * ⚠️ Declines (false) for an id no longer in the score, a target that is not a bar of it, the mark's
 * own address (nothing to do — and a caller that repainted on a true would repaint every frame), and
 * a beat another tempo mark already holds.
 */
export function setTempoAtSlot(score: Score, id: string, target: Stop): boolean {
  return placeTempo(score, id, target, true)
}

/** {@link moveTempoBySlot} and its keep-the-nudge twin, which differ by one line. */
function placeTempo(score: Score, id: string, dest: Stop, clearOffset: boolean): boolean {
  const found = locate(score, id)
  if (!found) return false
  const { mark, measure } = found
  if (compare(dest, { measure: measure.number, beat: mark.beat }) === 0) return false

  // ⭐ One mark per beat — see the header. The sitting mark wins by being there first.
  const target = score.measures.find(m => m.number === dest.measure)
  if (!target) return false
  if (target.tempos?.some(t => t.id !== id && fracCompare(t.beat, dest.beat) === 0)) return false

  if (dest.measure !== measure.number && !moveTempoToMeasure(score, mark, dest.measure)) return false
  mark.beat = dest.beat
  locate(score, id)?.measure.tempos?.sort((a, b) => fracCompare(a.beat, b.beat))
  if (clearOffset) clearHorizontalOffset(score, id)
  return true
}

/** Drop the mark's sideways nudge and keep its lift — `dynamicOps.clearHorizontalOffset`'s twin,
 *  including the ⚠️ clear of the WHOLE override when the lift was all that was in it (an absent
 *  override and a `{0,0}` one must not both be reachable). */
function clearHorizontalOffset(score: Score, id: string): void {
  const prev = tempoOffsetOverrideOf(score, id)
  if (!prev) return
  if (prev.y === 0) { clearEngravingOverride(score, id, 'tempoOffset'); return }
  const next: TempoOffsetOverride = { kind: 'tempoOffset', x: 0, y: prev.y }
  setEngravingOverride(score, id, next)
}
