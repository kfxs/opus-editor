/**
 * A measure's COLUMNS — the bridge from the music to the spacing rule (docs/spacing-model-plan.md
 * P2). Pure: a `Measure` in, {@link Column}s out, no VexFlow and no DOM.
 *
 * ⭐⭐ **A column is a rhythmic position at which something starts, holding every event that starts
 * there — across all voices AND all staves.** One x per column, shared by every staff in the system.
 * That sentence is the whole module, and it is what makes this a *merge* rather than the
 * max-over-staves the width used to take: staff 1's `♩♩♩♩` under staff 2's `𝅗𝅥𝅗𝅥` is four columns, not
 * four-or-two whichever is wider, and a note at beat 2 on both staves is ONE position that must be
 * paid for once.
 *
 * ⚠️ **Two voices at the same beat are ONE column**, which is a visible change on every piano score:
 * the width path used to count SLOTS, so a two-voice bar of `♩♩♩♩` over `♩♩♩♩` claimed 8 columns and
 * now claims 4. One x per beat is the whole point of the model, and the narrowing is the model
 * working — but it is the thing to look at by eye first (plan §P2).
 *
 * ⭐ **A FAN's members are ordinary columns.** `fanMemberBeats` already gives each an exact rational,
 * and that address is the same one the drawing, playback and rebar all use — so a fanned group asks
 * the bar for the room its heads actually take, with no constant of its own. This is what makes
 * `fanColumns`, `FAN_MAX_SPAN_STRETCH` and the rest of §2's list redundant rather than merely
 * unfashionable; P5 deletes them.
 *
 * ⛔ **It does NOT model rest-fill, and does not need to**: `ScoreModel` fills a bar's silent spans
 * with real rest slots, so every drawn column is already in `measure.slots`. The one exception is a
 * bar holding no slots at all, which draws a single measure rest — one column, at beat 0.
 */
import type { Measure, Fraction } from '@/types/music'
import { fracCompare, fracCreate, fracSub } from '@/utils/fraction'
import { slotLength } from '@/utils/durations'
import { measureCapacityFrac } from '@/utils/measureCapacity'
import { fanMemberBeats } from '@/utils/fannedBeam'
import { NO_EXTENT, type Column } from './spacing'

/**
 * ⚠️ **TEMPORARY — the ink half's stand-in until P3.** The least distance between two columns, in
 * staff spaces, while nothing measures a glyph.
 *
 * It is `MIN_NOTE_SPACING` (1.8 spaces) wearing the model's clothes: the plan keeps that constant
 * *exactly* this long, because the duration rule alone has no floor and the ink that should provide
 * one does not exist yet (§1.1). Riding in as the pair PADDING rather than as a separate `max` is
 * deliberate — it puts the interim number in the slot P3's real table takes over, so P3 is a
 * substitution and not a rewrite.
 *
 * ⭐ Where it binds, given the curve: a 16th earns 1.75 and a 32nd 1.24, so this lifts both; an
 * eighth earns 2.475 and everything longer more, so it never touches them. P3's measured floor
 * (~1.43 and up, from a notehead plus its padding) will bind lower still.
 */
export const PROVISIONAL_PAIR_PADDING = 1.8

/** Canonical key for an exact beat — `fracCreate` reduces, so equal beats stringify equally. */
const beatKey = (beat: Fraction): string => `${beat.num}/${beat.den}`

/**
 * Every column in this measure, in order, with the BARLINE as the last one.
 *
 * The barline is a column like any other: it has a position, it can carry ink, and the gap before it
 * is the same question as every other gap. That is what turns `BARLINE_PADDING` from a constant into
 * a row in P3's pair table (note↔barline, rest↔barline).
 *
 * ⚠️ Each column's `duration` is **the distance to the NEXT column, not the event's own written
 * value** — so under a two-voice bar where voice 2 has an eighth beneath voice 1's quarter, the
 * quarter's column earns an eighth's space. It is still a quarter and still drawn as one; space
 * belongs to the gap, not to the notehead.
 */
export function measureColumns(measure: Measure, padding = PROVISIONAL_PAIR_PADDING): Column[] {
  const capacity = measureCapacityFrac(measure)
  const beats = new Map<string, Fraction>()

  const add = (beat: Fraction): void => {
    // At or past the barline is not a column of this bar: the barline itself is the last one, and a
    // ramp that overruns its slot must not mint a column on the far side of it.
    if (fracCompare(beat, capacity) >= 0 || fracCompare(beat, fracCreate(0, 1)) < 0) return
    const key = beatKey(beat)
    if (!beats.has(key)) beats.set(key, beat)
  }

  for (const slot of measure.slots) {
    add(slot.beat)
    if (slot.type === 'chord' && slot.fan) {
      for (const beat of fanMemberBeats(slot.fan, slotLength(slot), slot.beat)) add(beat)
    }
  }

  // A bar holding nothing still draws a measure rest, and it starts at the beginning.
  if (beats.size === 0) add(fracCreate(0, 1))

  const positions = [...beats.values()].sort(fracCompare)
  positions.push(capacity) // the barline

  return positions.map((beat, i) => ({
    beat,
    duration: i + 1 < positions.length ? fracSub(positions[i + 1], beat) : fracCreate(0, 1),
    extent: NO_EXTENT,
    padding,
    authored: 0,
  }))
}
