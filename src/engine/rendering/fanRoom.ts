/**
 * ⭐⭐ **THE ROOM A FAN GETS, decided by its MEMBERS rather than by its duration.**
 *
 * His report, with two screenshots: seven typed sixteenths space out across the bar and read
 * perfectly; collapse them into one fanned slot and the same seven heads land 11px apart —
 * *"too contracted and unreadable… maybe because we are using just the space of that slot in
 * time?"* Exactly that, and it gets worse the shorter the group's total is, because the share
 * shrinks while the number of heads does not.
 *
 * ⚠️ **The bar was already made wide enough. The room went somewhere else.** `laneColumns` widens
 * the measure by `fanColumns` (docs/fanned-beams-plan.md §3), but VexFlow then distributes that
 * width across the bar's tick contexts *by tick*, and a fanned slot is ONE tick context holding one
 * event's worth of ticks. Seven sixteenths under a dotted-quarter carrier claim 44% of a 4/4 bar,
 * so 44% of the extra width is all the fan ever saw — the rest was handed to the rest after it.
 * Measured before the fix: 28px gaps typed, 11px collapsed.
 *
 * ⭐ **So the fan asks the FORMATTER for its width, not the bar.** A tick context is at least as
 * wide as its widest tickable, and `Formatter.preFormat` lays the contexts out at those minimums
 * before it justifies anything (`maxNegativeShiftPx` is what stops justification pulling one back
 * inside another). Telling the fanned `StaveNote` how wide it really is therefore lands the room on
 * the fan itself — and the *same* number the bar was widened by, so the two cannot disagree.
 *
 * ⭐ **And the other direction is the same fact.** A three-note fan on a whole note used to sprawl
 * across the bar for the mirror-image reason: its share was far more than its ramp needs. A ramp has
 * ONE natural size — the size at which its tightest gap is an ordinary note's column, which is what
 * `fanColumns` has always computed — so the drawing caps its span there too ({@link fanMaxSpanPx}),
 * and what it does not use stays as air before the next note.
 *
 * ⚠️ Both numbers are `fanColumns × MIN_NOTE_SPACING`, deliberately: *one* answer to "how much room
 * does this gesture want", read as a floor by the formatter and as a ceiling by the drawing.
 */
import { StaveNote, type StaveNoteStruct } from 'vexflow'
import type { ChordRest, FanMark } from '@/types/music'
import { fanColumns, laneColumns } from '@/utils/fannedBeam'
import { LAYOUT_CONFIG } from './layoutConfig'

/**
 * How far past its natural size a fan may be stretched by a justified system.
 *
 * Not 1: a bar stretches to fill its line and the music in it spreads, so a group frozen at its
 * natural width inside a stretched bar reads as a mistake. Not unbounded either — that is the
 * sprawl this exists to stop. ⚠️ PROVISIONAL, like every other number in this feature
 * (docs/fanned-beams-plan.md §1).
 */
export const FAN_MAX_SPAN_STRETCH = 1.5

/**
 * The horizontal room one fanned slot wants, in pixels: one ordinary note's column per column the
 * ramp asks for.
 *
 * ⚠️ The unit is `MIN_NOTE_SPACING` because that is the unit `fanColumns` counts in — *a fanned
 * note takes the room of this many notes* — and because it is the number that actually spaces this
 * editor's music (`MeasureLayout`: "the floor is what actually spaces music"). Reading it from
 * `LAYOUT_CONFIG` rather than pinning a pixel count keeps a fan spaced like the notes beside it the
 * day that number moves.
 */
export function fanRoomPx(fan: FanMark): number {
  return fanColumns(fan) * LAYOUT_CONFIG.MIN_NOTE_SPACING
}

/** The widest a fan's span may be drawn, however much room its slot was given. */
export function fanMaxSpanPx(fan: FanMark): number {
  return fanRoomPx(fan) * FAN_MAX_SPAN_STRETCH
}

/**
 * ⭐ **A fanned slot's `StaveNote`, which knows how wide it is.**
 *
 * The room has to be asserted from INSIDE `preFormat`, and that is not a style choice: a tickable's
 * `preFormatted` latch is cleared by `TickContext.addTickable` (`setTickContext`), so anything set
 * between `joinVoices` and `format` is recomputed away — measured, after an afternoon of it looking
 * like the formatter was ignoring the number. Asserted here it survives every re-format, and there
 * is nothing for a second call site to forget: `NoteBuilder` is the ONE place a slot becomes a
 * `StaveNote`, and both the width pass and the draw pass go through it.
 *
 * `setWidth` takes the note's OWN width while `getWidth` returns that plus its modifiers', so the
 * modifier width comes back off: a fan with an accidental on member 0 gets the room its ramp asked
 * for *plus* the sign, which is what the two of them need. And it never SHRINKS a note — a fan whose
 * glyphs need more than its ramp does keeps the width VexFlow measured.
 */
export class FanStaveNote extends StaveNote {
  /**
   * The px this note's ramp is to be given. Starts at what it WANTS ({@link fanRoomPx}) — the answer
   * the width pass needs, since it is measuring a bar that does not exist yet — and is cut down to
   * the bar's actual share by {@link shareFanRoom} once the bar has a width. A plain field, not a
   * constructor argument, precisely because the second answer arrives later.
   */
  fanRoom: number

  constructor(struct: StaveNoteStruct, fan: FanMark) {
    super(struct)
    this.fanRoom = fanRoomPx(fan)
  }

  preFormat(): void {
    super.preFormat()
    if (this.getWidth() >= this.fanRoom) return
    this.setWidth(this.fanRoom - (this.getModifierContext()?.getWidth() ?? 0))
  }
}

/**
 * ⭐⭐ **A fan's share of the bar, counted in COLUMNS instead of in ticks** — the whole fix in one
 * line, and the bound that keeps it honest.
 *
 * {@link fanRoomPx} is what a ramp WANTS, and a bar cannot always pay it: `MAX_MEASURE_WIDTH` caps
 * every measure, and eight thirty-seconds under a 1→3 feather ask for 21 columns — 378px inside a
 * 400px bar. Reserved verbatim (the first version did) the notes after the fan are pushed clean
 * through the barline: his screenshot, and measured at rests sitting 56px and 69px OUTSIDE their own
 * bar. Nothing may leave the bar, ever, so the ask is capped at the fan's share of the room the bar
 * actually has: `noteArea × fanColumns / laneColumns`.
 *
 * ⭐ Shares SUM TO ONE, which is why this cannot overflow by construction — and it is the same
 * sentence the feature is: *the room is divided by what is DRAWN, not by what is COUNTED IN TICKS.*
 * A bar wide enough for everyone hands each fan its full ask (the `min`); a clamped one compresses
 * every column of it evenly, and the drawing's own floor then keeps two heads from touching.
 *
 * ⚠️ Called per LANE, with that lane's own slots — each voice fills the bar, so each divides it.
 * And only from the DRAW pass: the width pass is measuring what the bar should be, so there is no
 * share to take yet, and its notes keep the full ask (`MeasureLayout` floors the bar at exactly
 * `laneColumns × MIN_NOTE_SPACING`, which is the same number read from the other end).
 */
export function shareFanRoom(slots: ChordRest[], staveNotes: (StaveNote | undefined)[], noteAreaWidth: number): void {
  const columns = laneColumns(slots)
  if (columns <= 0) return
  for (let i = 0; i < slots.length && i < staveNotes.length; i++) {
    const slot = slots[i]
    const note = staveNotes[i]
    if (!(note instanceof FanStaveNote) || slot?.type !== 'chord' || !slot.fan) continue
    note.fanRoom = Math.min(fanRoomPx(slot.fan), noteAreaWidth * (fanColumns(slot.fan) / columns))
  }
}
