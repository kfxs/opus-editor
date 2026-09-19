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
 * | `preFormat` — each context's metrics, a first x walk, then the SOFTMAX | ⭐ {@link formatColumns} → `layout/softmaxSpacing` | S9h-b |
 *
 * ⏸️ **The softmax is kept, and only for ONE x.** `spacingPass` overwrites every x it writes except a
 * context no column names — a clef change after a bar's last onset. ⭐ His call (2026-09-18): keep
 * that clef's picture exactly until the CLEF review decides where it stands (`docs/clef.md` §0,
 * `vexflow-removal-map.md` §9.4 #5); then `layout/softmaxSpacing` is deleted. ⛔ No `Formatter`
 * instance is made any more, and ⭐ S9i: no `Voice` either — a bar's voices are `./barVoice`.
 */
import { ClefNote, Note, StaveNote } from 'vexflow'
import type { TickContext, Tickable } from 'vexflow'
import { addTicks, subtractTicks, ticksGreaterThan, ticksValue, type TickCount } from '@/engine/layout/tickCount'
import { type BarVoice, barVoiceOf, sharedResolution } from './barVoice'
import { alignRestsToNotes } from '@/engine/engrave/notes/restAlign'
import {
  SOFTMAX_FACTOR, softmaxColumns, type SoftmaxColumn, type SoftmaxTickable, type SoftmaxVoice,
} from '@/engine/layout/softmaxSpacing'

/**
 * One tick's context — the tickables of every voice that start there. ⭐ Ours so its METRICS (how
 * wide a column's ink reaches either side of its notes) are computed here.
 */
/** The widths a column keeps — `TickContext.getMetrics`. */
export interface TickColumnMetrics {
  width: number
  glyphPx: number
  notePx: number
  leftDisplacedHeadPx: number
  rightDisplacedHeadPx: number
  modLeftPx: number
  modRightPx: number
  totalLeftPx: number
  totalRightPx: number
}

/** What a tickable offers a column — the members of VexFlow's `Tickable` a column reads. */
type ColumnTickable = Tickable

/**
 * ⭐⭐ **A TICK COLUMN OF OURS — S12j-b** (`docs/vexflow-removal-map.md` S12): the notes that start
 * together, and the room they take. It used to `extend` VexFlow's `TickContext`; what is kept is
 * `TickContext` transcribed as far as anything asks — its x (a base and an offset), padding, the
 * longest and shortest tickables (compared in VexFlow's unreduced tick arithmetic, `layout/tickCount`),
 * the tickables by voice, the widths, the neighbouring columns. ⚠️ A VexFlow NOTE still stands in it:
 * `Tickable.getX`/`getAbsoluteX` ask its `getX()`, `setTickContext` hands it over (the one cast).
 */
export class TickColumn {
  readonly tickID: number
  preFormatted = false
  postFormatted = false
  private x = 0
  private xBase = 0
  private xOffset = 0
  private padding = 1
  private maxTicks: TickCount = { numerator: 0, denominator: 1 }
  private maxTickable?: ColumnTickable
  private minTicks?: TickCount
  private minTickable?: ColumnTickable
  readonly tickables: ColumnTickable[] = []
  private readonly tickablesByVoice: Record<number, ColumnTickable> = {}
  notePx = 0
  glyphPx = 0
  leftDisplacedHeadPx = 0
  rightDisplacedHeadPx = 0
  modLeftPx = 0
  modRightPx = 0
  totalLeftPx = 0
  totalRightPx = 0
  width = 0
  /** Every column of the bar, in order — `TickContext.tContexts`. */
  tContexts: TickColumn[] = []

  constructor(options: { tickID?: number } = {}) {
    this.tickID = options.tickID ?? 0
  }

  getTickID(): number {
    return this.tickID
  }

  getX(): number {
    return this.x
  }

  setX(x: number): this {
    this.x = x
    this.xBase = x
    this.xOffset = 0
    return this
  }

  getXBase(): number {
    return this.xBase
  }

  setXBase(xBase: number): void {
    this.xBase = xBase
    this.x = xBase + this.xOffset
  }

  getXOffset(): number {
    return this.xOffset
  }

  setXOffset(xOffset: number): void {
    this.xOffset = xOffset
    this.x = this.xBase + xOffset
  }

  /** The column's width with its padding either side. */
  getWidth(): number {
    return this.width + this.padding * 2
  }

  setPadding(padding: number): this {
    this.padding = padding
    return this
  }

  getMaxTicks(): TickCount {
    return this.maxTicks
  }

  getMinTicks(): TickCount | undefined {
    return this.minTicks
  }

  getMaxTickable(): ColumnTickable | undefined {
    return this.maxTickable
  }

  getMinTickable(): ColumnTickable | undefined {
    return this.minTickable
  }

  getTickables(): ColumnTickable[] {
    return this.tickables
  }

  getTickableForVoice(voiceIndex: number): ColumnTickable | undefined {
    return this.tickablesByVoice[voiceIndex]
  }

  getTickablesByVoice(): Record<number, ColumnTickable> {
    return this.tickablesByVoice
  }

  getMetrics(): TickColumnMetrics {
    const { width, glyphPx, notePx, leftDisplacedHeadPx, rightDisplacedHeadPx, modLeftPx, modRightPx, totalLeftPx, totalRightPx } = this
    return { width, glyphPx, notePx, leftDisplacedHeadPx, rightDisplacedHeadPx, modLeftPx, modRightPx, totalLeftPx, totalRightPx }
  }

  /**
   * `TickContext.addTickable`, transcribed: the longest and shortest are kept (copies, unreduced), the
   * tickable is told its column, and filed by voice.
   */
  addTickable(tickable: ColumnTickable, voiceIndex?: number): this {
    if (!tickable) throw new Error('TickColumn: invalid tickable added.')
    if (!tickable.shouldIgnoreTicks()) {
      const ticks = tickable.getTicks()
      if (ticksGreaterThan(ticks, this.maxTicks)) {
        this.maxTicks = { numerator: ticks.numerator, denominator: ticks.denominator }
        this.maxTickable = tickable
      }
      if (this.minTicks === undefined) {
        this.minTicks = { numerator: ticks.numerator, denominator: ticks.denominator }
        this.minTickable = tickable
      } else if (subtractTicks({ numerator: ticks.numerator, denominator: ticks.denominator }, this.minTicks).numerator < 0) {
        this.minTicks = { numerator: ticks.numerator, denominator: ticks.denominator }
        this.minTickable = tickable
      }
    }
    // ⚠️ The ONE cast: the tickable is typed for VexFlow's `TickContext`, and a column of ours answers
    // every call its code makes of one (`getX`, and the metrics).
    tickable.setTickContext(this as unknown as TickContext)
    this.tickables.push(tickable)
    this.tickablesByVoice[voiceIndex ?? 0] = tickable
    this.preFormatted = false
    return this
  }

  /**
   * `TickContext.preFormat`, transcribed: each tickable pre-formats (its modifier context's rules run
   * here, `./modifierColumns`), and the column keeps the widest of each measure.
   *
   * ⚠️ Kept exactly, quirk included: it never sets `preFormatted`, so a second call walks again — the
   * maxima make that harmless.
   */
  preFormat(): this {
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

  /** `TickContext.postFormat`. */
  postFormat(): this {
    if (this.postFormatted) return this
    this.postFormatted = true
    return this
  }
}

export interface TickColumns {
  map: Record<number, TickColumn>
  array: TickColumn[]
  list: number[]
  resolutionMultiplier: number
}

/**
 * ⭐ One {@link TickColumn} per tick, shared by every voice — `Formatter.createTickContexts`,
 * transcribed. ⚠️ Keyed by the running tick NUMERATOR in a non-reducing sum (`layout/tickCount`), at the
 * voices' shared resolution — exactly as `./modifierColumns` keys its contexts, but stave-blind.
 */
export function createTickColumns(voices: readonly BarVoice[]): TickColumns {
  if (voices.length === 0) return { map: {}, array: [], list: [], resolutionMultiplier: 0 }
  const map: Record<number, TickColumn> = {}
  const array: TickColumn[] = []
  const list: number[] = []
  const resolutionMultiplier = sharedResolution(voices)
  voices.forEach((voice, voiceIndex) => {
    const ticksUsed = { numerator: 0, denominator: resolutionMultiplier }
    for (const tickable of voice.tickables) {
      const tick = ticksUsed.numerator
      if (!map[tick]) {
        const column = new TickColumn({ tickID: tick })
        array.push(column)
        map[tick] = column
        list.push(tick)
      }
      map[tick].addTickable(tickable, voiceIndex)
      addTicks(ticksUsed, tickable.getTicks())
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
export function alignVoiceRests(voices: readonly BarVoice[]): void {
  for (const voice of voices) {
    const tickables = voice.tickables
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
 * ⭐ A tuplet's middle-line rests, moved to the notes around them — the `Tuplet` constructor's
 * `Formatter.AlignRestsToNotes(notes, true, true)` (S12a), by `engrave/notes/restAlign`: over the
 * tuplet's own notes, beamed or not, in a tuplet or not.
 */
export function alignTupletRests(notes: readonly StaveNote[]): void {
  for (const step of alignRestsToNotes(notes.map(restAlignInput), { alignAllNotes: true, alignTuplets: true })) {
    notes[step.tickable].setKeyLine(0, step.line)
  }
}

/**
 * What `layout/softmaxSpacing` needs of a bar, read AFTER every column's pre-format — the same values
 * `Formatter.preFormat` read live.
 */
function softmaxInputs(voices: readonly BarVoice[], columns: TickColumns) {
  const voiceIndex = new Map<BarVoice | undefined, number>(voices.map((v, i) => [v, i]))
  const tickables: SoftmaxTickable[] = []
  const order: Tickable[] = []
  const indexOf = new Map<Tickable, number>()
  const softmaxColumnsIn: SoftmaxColumn[] = columns.list.map((tick, c) => {
    const column = columns.map[tick]
    const own = column.getTickables().map(t => {
      const metrics = t.getMetrics()
      const voice = voiceIndex.get(barVoiceOf(t))
      if (voice === undefined) throw new Error('formatColumns: a tickable of a voice it was not given')
      const i = tickables.push({
        column: c,
        voice,
        ticks: t.getTicks().value(),
        xShift: t.getXShift(),
        notePx: metrics.notePx,
        modLeftPx: metrics.modLeftPx,
        modRightPx: metrics.modRightPx,
        leftDisplacedHeadPx: metrics.leftDisplacedHeadPx,
        rightDisplacedHeadPx: metrics.rightDisplacedHeadPx,
        width: t.getWidth(),
        centerAligned: t.isCenterAligned(),
      }) - 1
      indexOf.set(t, i)
      order.push(t)
      return i
    })
    const byVoice = column.getTickablesByVoice()
    const metrics = column.getMetrics()
    const maxTickable = column.getMaxTickable()
    return {
      width: column.getWidth(),
      notePx: metrics.notePx,
      totalLeftPx: metrics.totalLeftPx,
      totalRightPx: metrics.totalRightPx,
      maxTicks: ticksValue(column.getMaxTicks()),
      maxTickable: maxTickable ? indexOf.get(maxTickable) : undefined,
      byVoice: Object.keys(byVoice).map(v => [Number(v), indexOf.get(byVoice[Number(v)]) as number] as const),
      tickables: own,
    }
  })
  const softmaxVoices: SoftmaxVoice[] = voices.map(voice => {
    const ticksUsed = ticksValue(voice.ticksUsed)
    // `Voice.reCalculateExpTicksUsed`, in its order — a sum is not associative in floating point.
    const expTicksUsed = voice.tickables
      .map(t => Math.pow(SOFTMAX_FACTOR, t.getTicks().value() / ticksUsed))
      .reduce((a, b) => a + b, 0)
    return { ticksUsed, totalTicks: ticksValue(voice.totalTicks), expTicksUsed }
  })
  return { tickables, order, columns: softmaxColumnsIn, voices: softmaxVoices }
}

/**
 * ⭐ Format a bar's voices into `width` — what `new Formatter().format(voices, width)` did, with the
 * modifier contexts already attached (`attachModifierColumns`). Returns the tick columns, which
 * `spacingPass` and the leading spaces then place.
 *
 * ⏸️ The softmax still runs (`layout/softmaxSpacing`) — ⭐ his call, 2026-09-18: its ONLY surviving x
 * is a clef change after a bar's last onset, kept exactly until the clef review decides where that
 * clef stands (`vexflow-removal-map.md` §9.4 #5).
 */
export function formatColumns(voices: readonly BarVoice[], width: number): TickColumns {
  alignVoiceRests(voices)
  const columns = createTickColumns(voices)
  // `Formatter.preFormat`'s walk pre-formats each column in tick order — the modifier rules run here.
  for (const tick of columns.list) columns.map[tick].preFormat()
  const inputs = softmaxInputs(voices, columns)
  const { xs, centerXShifts } = softmaxColumns(inputs.columns, inputs.tickables, inputs.voices, width)
  columns.list.forEach((tick, c) => columns.map[tick].setX(xs[c]))
  for (const [t, shift] of centerXShifts) inputs.order[t].setCenterXShift(shift)
  return columns
}
