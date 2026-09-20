/**
 * ⏸️ **VEXFLOW'S SOFTMAX SPACING, KEPT FOR ONE CLEF** — S9h-b of `docs/history/vexflow-removal-map.md`
 * (`Formatter.preFormat`, MIT, transcribed exactly).
 *
 * ## ⚠️ Why this exists at all
 *
 * The spacing rule is OURS (`./spacing`, Gould's): `rendering/spacingPass` writes every column's x
 * after this runs, so for almost everything this file computes is thrown away. **One x survives** —
 * a clef change written AFTER a bar's last onset. It is appended past the last note (its column is
 * the bar's END tick), `spacingPass` has no column there to write (the barline's is a position, not
 * an event), and the room the bar reserves for an inline clef (`headerInk.inlineClefExtent`) is not
 * placed between the last note and the barline — so no column-derived x fits it (measured
 * 2026-09-18: the barline column puts it ON the barline; 3.6 sp before it puts it before a last
 * eighth).
 *
 * ⭐ **His call, 2026-09-18: keep that clef's picture exactly, and review it later.** Where a clef
 * change belongs is a CLEF RULE (`docs/how-it-works/clef.md` §0 — *"the clef always goes before the barline"*,
 * Gould p. 8), which he put outside the VexFlow removal. ⏭️ **When the clef review decides where such
 * a clef stands, this file is deleted** — logged as `vexflow-removal-map.md` §9.4 #5.
 *
 * It also writes a whole-bar rest's centre shift, which `rendering/centerMeasureRests` then ADDS to:
 * the result is the same in exact arithmetic but not in the last floating-point bit, so it is kept
 * for an exact port.
 *
 * ## What it IS (VexFlow's words, our transcription)
 *
 * 1. **A first walk**: each column placed after the last, `x += previous width − its left ink + this
 *    column's left ink`.
 * 2. **The softmax**: each column's ideal distance from the column holding the longest note before it
 *    (in a voice both share) is `softmax(that note's ticks) × the room`; `softmax(t) = 10^(t/T) /
 *    Σ 10^(tᵢ/T)` over that voice's tickables. Columns move right freely and left only as far as their
 *    inks allow; the room is re-solved up to five times until the last column lands inside the end
 *    padding.
 *
 * ⛔ Not ported, because nothing reads it: `evaluate()` (the loss, `contextGaps`, `durationStats`,
 * every tickable's `formatterMetrics` — read only by VexFlow's debug `System` plot), `minTotalWidth`,
 * `lossHistory`, and the `globalSoftmax` option (off).
 */

/** VexFlow's softmax factor — `Tables.SOFTMAX_FACTOR` = 10 (`tables.js:594`). */
export const SOFTMAX_FACTOR = 10
/** The least room kept after the last column — `Stave.endPaddingMin` = 5 (`metrics.js:134`). */
export const END_PADDING_MIN_PX = 5
/** The most — `Stave.endPaddingMax` = 10 (`metrics.js:133`). */
export const END_PADDING_MAX_PX = 10
/** The stave's own padding in the note area — `Stave.padding` = 12 (`metrics.js:132`). */
export const STAVE_PADDING_PX = 12
/** How many times the room is re-solved — `Formatter`'s `maxIterations` default. */
export const MAX_ITERATIONS = 5

/** One tickable, as the softmax reads it. */
export interface SoftmaxTickable {
  /** Index of its column (in tick order). */
  column: number
  /** Index of its voice. */
  voice: number
  /** Its ticks (`getTicks().value()`). */
  ticks: number
  /** Its own x shift — `getX()` is its column's x plus this. */
  xShift: number
  notePx: number
  modLeftPx: number
  modRightPx: number
  leftDisplacedHeadPx: number
  rightDisplacedHeadPx: number
  /** `getWidth()` — read only for the last column's longest note. */
  width: number
  /** A whole-bar rest (`isCenterAligned`). */
  centerAligned: boolean
}

/** One column (a tick context), as the softmax reads it, AFTER its pre-format. */
export interface SoftmaxColumn {
  /** `getWidth()` — the column's ink plus its padding both sides. */
  width: number
  notePx: number
  totalLeftPx: number
  totalRightPx: number
  /** The longest ticks of anything in it. */
  maxTicks: number
  /** Index of the tickable holding them, if anything counts ticks. */
  maxTickable: number | undefined
  /** Voice → the tickable of that voice here (the LAST one added), in ascending voice order. */
  byVoice: ReadonlyArray<readonly [voice: number, tickable: number]>
  /** Every tickable of the column, in the order added. */
  tickables: readonly number[]
}

/** One voice, as its softmax needs it. */
export interface SoftmaxVoice {
  /** Its ticks used (`getTicksUsed().value()`). */
  ticksUsed: number
  /** Its total ticks (`getTotalTicks().value()`). */
  totalTicks: number
  /** Σ over its tickables, in order, of `factor^(ticks / ticksUsed)` — `reCalculateExpTicksUsed`. */
  expTicksUsed: number
}

/** Where the softmax put every column, and the centre shift of each whole-bar rest (by tickable index). */
export interface SoftmaxPlacement {
  xs: number[]
  centerXShifts: Map<number, number>
}

/**
 * ⭐ `Formatter.preFormat(justifyWidth)` after each column's own pre-format — the walk and the softmax.
 * The columns come in tick order.
 */
export function softmaxColumns(
  columns: readonly SoftmaxColumn[],
  tickables: readonly SoftmaxTickable[],
  voices: readonly SoftmaxVoice[],
  justifyWidth: number,
): SoftmaxPlacement {
  const xs: number[] = []
  const centerXShifts = new Map<number, number>()

  let x = 0
  let shift = 0
  for (const column of columns) {
    x = x + shift + column.totalLeftPx
    xs.push(x)
    shift = column.width - column.totalLeftPx
  }
  if (justifyWidth <= 0 || columns.length === 0) return { xs, centerXShifts }

  const tickableX = (i: number): number => xs[tickables[i].column] + tickables[i].xShift
  const softmax = (voice: number, tickValue: number): number => {
    const v = voices[voice]
    return Math.pow(SOFTMAX_FACTOR, tickValue / v.ticksUsed) / v.expTicksUsed
  }

  const first = columns[0]
  const last = columns[columns.length - 1]

  interface Ideal { expectedDistance: number; maxNegativeShiftPx: number; fromTickable: number | undefined }

  const calculateIdealDistances = (width: number): Ideal[] => columns.map((column, i) => {
    if (i > 0) {
      for (let j = i - 1; j >= 0; j--) {
        const back = columns[j]
        const backOf = new Map(back.byVoice)
        const matching = column.byVoice.filter(([v]) => backOf.has(v))
        if (matching.length === 0) continue
        let maxTicks = 0
        let maxNegativeShiftPx = Infinity
        let backTickable: number | undefined
        for (const [v, here] of matching) {
          const there = backOf.get(v) as number
          const ticks = tickables[there].ticks
          if (ticks > maxTicks) {
            backTickable = there
            maxTicks = ticks
          }
          const h = tickables[here]
          const insideLeftEdge = tickableX(here) - (h.modLeftPx + h.leftDisplacedHeadPx)
          const b = tickables[there]
          const insideRightEdge = tickableX(there) + b.notePx + b.modRightPx + b.rightDisplacedHeadPx
          maxNegativeShiftPx = Math.min(maxNegativeShiftPx, insideLeftEdge - insideRightEdge)
        }
        maxNegativeShiftPx = Math.min(maxNegativeShiftPx, xs[i] - (xs[i - 1] + width * 0.05))
        const expectedDistance = backTickable !== undefined
          ? softmax(tickables[backTickable].voice, maxTicks) * width
          : 0
        return { expectedDistance, maxNegativeShiftPx, fromTickable: backTickable }
      }
    }
    return { expectedDistance: 0, maxNegativeShiftPx: 0, fromTickable: undefined }
  })

  const adjustedJustifyWidth = justifyWidth - last.notePx - last.totalRightPx - first.totalLeftPx

  const shiftToIdealDistances = (ideals: Ideal[]): number => {
    const centerX = adjustedJustifyWidth / 2
    let spaceAccum = 0
    columns.forEach((column, index) => {
      if (index > 0) {
        const contextX = xs[index]
        const ideal = ideals[index]
        if (ideal.fromTickable === undefined) throw new Error('softmaxColumns: a column with no tickable to measure from')
        const errorPx = tickableX(ideal.fromTickable) + ideal.expectedDistance - (contextX + spaceAccum)
        if (errorPx > 0) {
          spaceAccum += errorPx
        } else if (errorPx < 0) {
          spaceAccum += -Math.min(ideal.maxNegativeShiftPx, Math.abs(errorPx))
        }
        xs[index] = contextX + spaceAccum
      }
      for (const t of column.tickables) {
        if (tickables[t].centerAligned) centerXShifts.set(t, centerX - xs[index])
      }
    })
    return xs[columns.length - 1] - xs[0]
  }

  let targetWidth = adjustedJustifyWidth
  const distances = calculateIdealDistances(targetWidth)
  let actualWidth = shiftToIdealDistances(distances)
  if (columns.length === 1) return { xs, centerXShifts }

  let minDistance = targetWidth / 2
  for (let di = 1; di < distances.length; ++di) minDistance = Math.min(distances[di].expectedDistance / 2, minDistance)

  const paddingMaxCalc = (curTargetWidth: number): number => {
    let lastTickablePadding = 0
    if (last.maxTickable !== undefined) {
      const t = tickables[last.maxTickable]
      const voice = voices[t.voice]
      if (voice.ticksUsed > voice.totalTicks) {
        return END_PADDING_MAX_PX * 2 < minDistance ? minDistance : END_PADDING_MAX_PX
      }
      lastTickablePadding = softmax(t.voice, last.maxTicks) * curTargetWidth - (t.width + STAVE_PADDING_PX)
    }
    return END_PADDING_MAX_PX * 2 < lastTickablePadding ? lastTickablePadding : END_PADDING_MAX_PX
  }
  let paddingMax = paddingMaxCalc(targetWidth)
  let paddingMin = paddingMax - (END_PADDING_MAX_PX - END_PADDING_MIN_PX)
  const maxX = adjustedJustifyWidth - paddingMin
  let iterations = MAX_ITERATIONS
  while ((actualWidth > maxX && iterations > 0) || (actualWidth + paddingMax < maxX && iterations > 1)) {
    targetWidth -= actualWidth - maxX
    paddingMax = paddingMaxCalc(targetWidth)
    paddingMin = paddingMax - (END_PADDING_MAX_PX - END_PADDING_MIN_PX)
    actualWidth = shiftToIdealDistances(calculateIdealDistances(targetWidth))
    iterations--
  }
  return { xs, centerXShifts }
}
