/**
 * ⭐⭐ **WHERE A REST INSIDE A BEAM SITS** — S9h of `docs/vexflow-removal-map.md`
 * (`Formatter.AlignRestsToNotes`, MIT, transcribed; §5.1 #2).
 *
 * ## ⭐ What the rule IS
 *
 * > **A rest under a beam leaves the middle line for the height of the notes around it.** A rest on
 * > the middle line (line 3) that belongs to a beam takes the line of the next note after it; if it
 * > follows a note, it takes the midpoint between that note and the next one; if it follows a rest,
 * > it takes that rest's line.
 *
 * "The line of a note" is the note's own rest line (`getLineForRest`): its only key's line, or the
 * midpoint of a chord's first and last keys. A rest that is not on line 3 is left alone — which is
 * why the rule is idempotent: a moved rest no longer answers 3.
 *
 * ## ⚠️ Only the case this editor runs
 *
 * `Formatter.format` calls it with `alignAllNotes: false` and no `alignTuplets`, so here:
 * - only a BEAMED rest moves (never an unbeamed one);
 * - a rest in a TUPLET is never moved.
 *
 * ⚠️ Transcribed with its quirks intact:
 * - a rest after something that is not a stave note (a mid-bar CLEF) keeps its line — but is still
 *   REWRITTEN with it ({@link RestLineStep} with the same line), because VexFlow's `setKeyLine` resets
 *   the note either way;
 * - "the next note" skips rests and anything that ignores ticks (a clef), but not a non-stave note
 *   that counts ticks.
 */
import { midLine } from './midLine'

/** One tickable of a voice, in order, as the rule needs it. */
export interface VoiceTickable {
  /** A `StaveNote` (a note or a rest); ⛔ not a clef change. */
  isStaveNote: boolean
  /** Any `Note` — a clef change is one, a stave note is one. */
  isNote: boolean
  isRest: boolean
  /** It carries no ticks of its own (a clef change). */
  ignoresTicks: boolean
  /** It is in a tuplet. */
  inTuplet: boolean
  /** It is under a beam. */
  beamed: boolean
  /**
   * Its rest line (`getLineForRest`): a single key's line, or a chord's first and last keys' midpoint.
   * For a rest it is its own line. A non-stave note answers 0.
   */
  restLine: number
}

/** A rest's key line, rewritten — `tickable` indexes the input. */
export interface RestLineStep {
  tickable: number
  line: number
}

/** The middle line — the only line a rest is moved FROM. */
const MIDDLE_LINE = 3

/**
 * ⭐ Every beamed middle-line rest of one voice, moved to the notes around it — in order, because a
 * rest after a rest reads the line the earlier one was just given.
 */
export function alignRestsToNotes(tickables: readonly VoiceTickable[]): RestLineStep[] {
  const steps: RestLineStep[] = []
  // A rest's line as the walk has left it — the later rests read it.
  const lines = tickables.map(t => t.restLine)

  // `getRestLineForNextNoteGroup`: the next sounding note's rest line, or `current` if none.
  const nextNoteLine = (current: number, from: number, compare: boolean): number => {
    let next = current
    for (let i = from + 1; i < tickables.length; i++) {
      const t = tickables[i]
      if (t.isNote && !t.isRest && !t.ignoresTicks) {
        next = t.restLine
        break
      }
    }
    if (compare && current !== next) next = midLine(Math.max(current, next), Math.min(current, next))
    return next
  }

  tickables.forEach((t, index) => {
    if (!t.isStaveNote || !t.isRest) return
    if (t.inTuplet) return
    if (lines[index] !== MIDDLE_LINE) return
    if (!t.beamed) return
    let line = lines[index]
    if (index === 0) {
      line = nextNoteLine(line, index, false)
    } else {
      const prev = tickables[index - 1]
      if (prev.isStaveNote) {
        line = prev.isRest ? lines[index - 1] : nextNoteLine(prev.restLine, index, true)
      }
    }
    lines[index] = line
    steps.push({ tickable: index, line })
  })
  return steps
}
