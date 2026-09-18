/**
 * ⭐⭐ **A BAR'S VOICES, FORMATTED BY US — S9h** (`docs/vexflow-removal-map.md` §5.1 #2–#4, §5.2).
 *
 * `Formatter.format(voices, width)` did three things once the modifier contexts were attached
 * (`./modifierColumns`, S9b). This file is where they come home:
 *
 * | `Formatter.format` step | here | since |
 * |---|---|---|
 * | `alignRests` — a beamed middle-line rest takes the notes' height | ⭐ {@link alignVoiceRests} → `engrave/notes/restAlign` | S9h-a |
 * | `createTickContexts` — one context per tick, every voice sharing it | ⭐ {@link createTickColumns}, contexts of OUR class {@link TickColumn} | S9h-a |
 * | `preFormat` — each context's metrics, a first x walk, then the SOFTMAX | ⚠️ still VexFlow's `Formatter.preFormat`, run on OUR contexts | ⏭️ S9h-b takes it |
 *
 * ⚠️ **The softmax is kept for ONE step, on purpose.** `spacingPass` overwrites every x it wrote
 * except a context no column names — the clef change appended at a bar's END tick — so dropping it
 * moves that clef, and that is his call (S9h-b). Keeping it here makes this step exact. It reaches
 * VexFlow's `Formatter` through its two protected fields (`voices`, `tickContexts`) — ⛔ a bridge
 * with one step to live, not a pattern.
 */
import { ClefNote, Formatter, Fraction, Note, StaveNote, TickContext } from 'vexflow'
import type { Tickable, Voice } from 'vexflow'
import { alignRestsToNotes } from '@/engine/engrave/notes/restAlign'

/**
 * One tick's context — the tickables of every voice that start there. ⭐ Ours so its METRICS (how
 * wide a column's ink reaches either side of its notes) are computed here.
 */
export class TickColumn extends TickContext {
  /**
   * `TickContext.preFormat`, transcribed: each tickable pre-formats (its modifier context's rules run
   * here, `./modifierColumns`), and the column keeps the widest of each measure.
   *
   * ⚠️ Kept exactly, quirk included: it never sets `preFormatted`, so a second call walks again — the
   * maxima make that harmless.
   */
  override preFormat(): this {
    if (this.preFormatted) return this
    for (const tickable of this.tickables) {
      tickable.preFormat()
      const metrics = tickable.getMetrics()
      this.leftDisplacedHeadPx = Math.max(this.leftDisplacedHeadPx, metrics.leftDisplacedHeadPx)
      this.rightDisplacedHeadPx = Math.max(this.rightDisplacedHeadPx, metrics.rightDisplacedHeadPx)
      this.notePx = Math.max(this.notePx, metrics.notePx)
      this.glyphPx = Math.max(this.glyphPx, metrics.glyphWidth ?? 0)
      this.modLeftPx = Math.max(this.modLeftPx, metrics.modLeftPx)
      this.modRightPx = Math.max(this.modRightPx, metrics.modRightPx)
      this.totalLeftPx = Math.max(this.totalLeftPx, metrics.modLeftPx + metrics.leftDisplacedHeadPx)
      this.totalRightPx = Math.max(this.totalRightPx, metrics.modRightPx + metrics.rightDisplacedHeadPx)
      this.width = this.notePx + this.totalLeftPx + this.totalRightPx
    }
    return this
  }
}

/** A bar's tick columns: by tick, in creation order, the ticks sorted, and the voices' shared resolution. */
export interface TickColumns {
  map: Record<number, TickColumn>
  array: TickColumn[]
  list: number[]
  resolutionMultiplier: number
}

/**
 * ⭐ One {@link TickColumn} per tick, shared by every voice — `Formatter.createTickContexts`,
 * transcribed. ⚠️ Keyed by the running tick NUMERATOR in VexFlow's own non-reducing `Fraction`, at the
 * voices' shared resolution — exactly as `./modifierColumns` keys its contexts, but stave-blind.
 */
export function createTickColumns(voices: readonly Voice[]): TickColumns {
  if (voices.length === 0) return { map: {}, array: [], list: [], resolutionMultiplier: 0 }
  const map: Record<number, TickColumn> = {}
  const array: TickColumn[] = []
  const list: number[] = []
  const resolutionMultiplier = Formatter.getResolutionMultiplier([...voices])
  voices.forEach((voice, voiceIndex) => {
    const ticksUsed = new Fraction(0, resolutionMultiplier)
    for (const tickable of voice.getTickables()) {
      const tick = ticksUsed.numerator
      if (!map[tick]) {
        const column = new TickColumn({ tickID: tick })
        array.push(column)
        map[tick] = column
        list.push(tick)
      }
      map[tick].addTickable(tickable, voiceIndex)
      ticksUsed.add(tickable.getTicks())
    }
  })
  list.sort((a, b) => a - b)
  for (const column of array) column.tContexts = array
  return { map, array, list, resolutionMultiplier }
}

/** What `engrave/notes/restAlign` needs of one tickable. */
function restAlignInput(tickable: Tickable) {
  const isNote = tickable instanceof Note
  const isStaveNote = tickable instanceof StaveNote
  return {
    isStaveNote,
    isNote,
    isRest: isNote && tickable.isRest(),
    ignoresTicks: tickable.shouldIgnoreTicks(),
    inTuplet: !!tickable.getTuplet(),
    beamed: isNote && !!tickable.getBeam(),
    restLine: isNote ? tickable.getLineForRest() : 0,
  }
}

/**
 * ⭐ Every voice's beamed middle-line rests, moved to the notes around them — `Formatter.alignRests`
 * with `alignAllNotes: false`, by `engrave/notes/restAlign`. ⚠️ Only a `StaveNote` or a `ClefNote` is
 * expected in a voice here; anything else is refused rather than guessed at.
 */
export function alignVoiceRests(voices: readonly Voice[]): void {
  for (const voice of voices) {
    const tickables = voice.getTickables()
    for (const t of tickables) {
      if (!(t instanceof StaveNote) && !(t instanceof ClefNote)) {
        throw new Error('alignVoiceRests: a tickable that is neither a StaveNote nor a ClefNote')
      }
    }
    for (const step of alignRestsToNotes(tickables.map(restAlignInput))) {
      (tickables[step.tickable] as StaveNote).setKeyLine(0, step.line)
    }
  }
}

/**
 * ⭐ Format a bar's voices into `width` — what `new Formatter().format(voices, width)` did, with the
 * modifier contexts already attached (`attachModifierColumns`). Returns the tick columns, which
 * `spacingPass` and the leading spaces then place.
 */
export function formatColumns(voices: Voice[], width: number): TickColumns {
  const formatter = new Formatter()
  // `format()` hands every voice the formatter's softmax factor; only the softmax reads it.
  const softmaxFactor = (formatter as unknown as { formatterOptions: { softmaxFactor: number } }).formatterOptions.softmaxFactor
  if (softmaxFactor) voices.forEach(v => v.setSoftmaxFactor(softmaxFactor))
  alignVoiceRests(voices)
  const columns = createTickColumns(voices)
  // ⚠️ S9h-a's bridge: VexFlow's walk + softmax, on OUR columns. Gone in S9h-b.
  Object.assign(formatter as unknown as { voices: Voice[]; tickContexts: TickColumns }, { voices, tickContexts: columns })
  formatter.preFormat(width)
  return columns
}
