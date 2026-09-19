/**
 * ⭐⭐ **ONE VOICE OF ONE BAR, OURS — S9i** (`docs/vexflow-removal-map.md` §5.1, §5.2).
 *
 * VexFlow's `Voice` did four things for this editor, and each is here:
 *
 * | `Voice` | here |
 * |---|---|
 * | the tick bookkeeping — `ticksUsed`, `totalTicks`, `resolutionMultiplier`, SOFT/FULL | {@link BarVoice}, on `layout/tickCount` |
 * | `Formatter.getResolutionMultiplier` — the voices' shared clock, and the mismatch check | {@link sharedResolution} |
 * | `tickable.setVoice(this)` — read by the multi-voice rule (which voice is which) and the softmax | {@link barVoiceOf} |
 * | `voice.draw(ctx, stave)` — each tickable onto the stave, then drawn with its style | {@link drawBarVoice} |
 *
 * ⚠️ Transcribed, quirks included — see each. ⛔ Not ported: `STRICT` (the editor never asks for it —
 * `utils/restFill.pickVoiceMode`), the softmax cache (ours is `layout/softmaxSpacing`), `preFormat` and
 * the bounding box (nothing called them), `smallestTickCount` / `largestTickWidth` (nothing read them).
 *
 * ⚠️ The TICKS themselves are still VexFlow's: a note says how long it is through `getTicks()`, and a
 * tuplet or a two-note tremolo scales that through `applyTickMultiplier` (`NoteBuilder`). They go when
 * the notes stop being VexFlow tickables (S12).
 */
import { EngravedNote } from './EngravedNote'
import type { EngravedStave } from './EngravedStave'
import type { EngravedClefChange } from './EngravedClefChange'
import type { DrawContext } from '@/engine/paint/DrawContext'
import {
  TICK_RESOLUTION, addTicks, subtractTicks, ticksEqual, ticksGreaterThan, lcm, type TickCount,
} from '@/engine/layout/tickCount'

/**
 * How strict a bar's voice is about its length — `pickVoiceMode`'s answer: `'full'` refuses a voice
 * that runs past the bar (surfaced as corruption, as it always was), `'soft'` keeps every note.
 */
export type BarVoiceMode = 'soft' | 'full'

/** Which voice each tickable was added to — VexFlow's `tickable.voice`, kept beside it instead. */
/**
 * What a bar's voice holds — a note of ours, or an inline clef change of ours (`./EngravedClefChange`).
 * ⭐ S12j-e: nothing of VexFlow's stands in a voice any more.
 */
export type BarTickable = EngravedNote | EngravedClefChange

const voiceOfTickable = new WeakMap<BarTickable, BarVoice>()

/** The {@link BarVoice} a tickable was added to, if any — what `tickable.getVoice()` answered. */
export function barVoiceOf(tickable: BarTickable): BarVoice | undefined {
  return voiceOfTickable.get(tickable)
}

/** One voice of one bar: its tickables, in order, and how many ticks they use of the meter's. */
export class BarVoice {
  readonly tickables: BarTickable[] = []
  /** The meter's length in ticks — `numBeats × (resolution ÷ beatValue)`, then re-denominated. */
  readonly totalTicks: TickCount
  /** The ticks the voice's tickables add up to, ⛔ unreduced (`layout/tickCount`). */
  readonly ticksUsed: TickCount = { numerator: 0, denominator: 1 }
  /** The denominator of {@link ticksUsed} — what a context walk multiplies its keys up by. */
  resolutionMultiplier = 1

  constructor(meter: { numerator: number; denominator: number }, readonly mode: BarVoiceMode) {
    this.totalTicks = { numerator: meter.numerator * (TICK_RESOLUTION / meter.denominator), denominator: 1 }
  }

  /**
   * `Voice.addTickable`, transcribed. A tickless one (an inline clef) joins without counting.
   * ⚠️ `totalTicks` is re-denominated to the running sum's — its VALUE unchanged — exactly as VexFlow
   * does, so a mismatch check between voices compares what it compared there.
   */
  add(tickable: BarTickable): this {
    if (!tickable.shouldIgnoreTicks()) {
      const ticks = tickable.getTicks()
      addTicks(this.ticksUsed, ticks)
      if (this.mode === 'full' && ticksGreaterThan(this.ticksUsed, this.totalTicks)) {
        subtractTicks(this.ticksUsed, ticks)
        throw new Error('BarVoice: Too many ticks.')
      }
      this.resolutionMultiplier = this.ticksUsed.denominator
      addTicks(this.totalTicks, { numerator: 0, denominator: this.ticksUsed.denominator })
    }
    this.tickables.push(tickable)
    voiceOfTickable.set(tickable, this)
    return this
  }

  addAll(tickables: readonly BarTickable[]): this {
    for (const tickable of tickables) this.add(tickable)
    return this
  }
}

/**
 * The voices' shared clock — `Formatter.getResolutionMultiplier`, transcribed: the LCM of every
 * voice's resolution, refusing voices of different lengths.
 */
export function sharedResolution(voices: readonly BarVoice[]): number {
  if (voices.length === 0) throw new Error('sharedResolution: no voices')
  const totalTicks = voices[0].totalTicks
  return voices.reduce((accumulator, voice) => {
    if (!ticksEqual(voice.totalTicks, totalTicks)) {
      throw new Error('sharedResolution: voices should have the same total duration in ticks')
    }
    return Math.max(accumulator, lcm(accumulator, voice.resolutionMultiplier))
  }, 1)
}

/**
 * ⭐ Draw a voice's tickables on `stave` — `Voice.draw(context, stave)`, transcribed: each one is put on
 * the stave, handed the context, and drawn with its style, in order.
 */
export function drawBarVoice(voice: BarVoice, context: DrawContext, stave: EngravedStave): void {
  for (const tickable of voice.tickables) {
    tickable.setStave(stave)
    tickable.setContext(context)
    tickable.drawWithStyle()
  }
}

/** A note of ours, as against an inline clef. */
export function isEngravedNote(tickable: BarTickable): tickable is EngravedNote {
  return tickable instanceof EngravedNote
}
