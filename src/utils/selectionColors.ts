/**
 * Semantic SELECTION / INDICATOR colours for the score — the counterpart to {@link ./voiceColors}
 * (per-voice note selection) and {@link ./chromeColors} (window / menu / keypad neutrals). These MEAN
 * something on the score, so they live apart from the neutral chrome, and apart from the voice map so
 * a retune of one never silently drags the other.
 *
 * Why blue and not orange: orange USED to be the one "something is selected" colour, but orange is now
 * **voice 3** ({@link ./voiceColors}). A selected clef / barline / dynamic drawn in orange now reads as
 * "voice 3", which is wrong — those elements have no voice. So every NON-note element selects in the
 * INDICATOR blue instead: the same non-voice blue the gutter (barline nav) and the Keypad's mode arrow
 * already use, deliberately a step darker than voice-1's blue (`#3B82F6`) so it can never be misread as
 * a voice colour.
 *
 * ⭐⭐ **THE LINE IS "does this ink BELONG to one voice's notes?"** (his call, 2026-08-19), and it is
 * not the same question as "does the model give it a `voice` field":
 *
 *  - **Voice colour** — notes, rests, tuplets, ties, slurs, and the TRILL: *"a trill is always
 *    associated to a note, so the trill has the color of the note voice it is anchored to"*. Its
 *    auxiliary is a step above THAT pitch; it belongs to that note the way an articulation does.
 *  - **This indicator blue** — clef, meter, barline, tempo text, the **8va** and the **pedal**. Each
 *    governs a region — every voice under it — so a voice colour said "this belongs to voice 1"
 *    about a mark that shapes them all.
 *  - **Either one, ASKED OF THE DATA** — the **dynamic** and the **hairpin**, since P2 of
 *    docs/dynamic-voice-scope-plan.md ({@link markSelectionColor}). These two are the only kinds
 *    that carry a real SCOPE: a mark governing the whole staff is a region mark and takes the blue,
 *    a mark narrowed to one voice IS that voice's ink and takes its colour. ⭐ So the rule above
 *    stops being a list of kinds for them and becomes a question the model answers.
 *    ⚠️ It was a list of kinds first, and it had to be: until the scope existed, `Hairpin.voice`
 *    answered 0 for a mark that had never been narrowed at all, so colouring by it said "voice 1"
 *    about a wedge over the whole staff. The field now distinguishes those two cases
 *    (`utils/dynamicScope` — absent means ALL), which is what makes the derived version honest.
 *
 * And the slur-editing handles keep their own orange/blue language (orange = open join, blue = true
 * endpoint), because there the colour distinguishes handle KIND, not "selected".
 */

import { voiceScopeOf, type ScopedMark } from './dynamicScope'
import { voiceFillColor } from './voiceColors'

/** The non-voice indicator blue (Tailwind blue-700). One home for what were three copies of this hex:
 *  the gutter ink, the Keypad's mode arrow, and the fill of every non-note element selection below. */
export const INDICATOR_INK = '#1D4ED8'

/** Fill for a selected NON-note element (clef, time signature, barline, dynamic, tempo/expression text). */
export const ELEMENT_SELECTION_FILL = INDICATOR_INK

/** Stroke/outline for the same — a shade darker (blue-800), mirroring how the voice colours pair a
 *  lighter fill with a darker stroke. */
export const ELEMENT_SELECTION_STROKE = '#1E40AF'

/**
 * ⭐⭐ **THE COLOUR A SELECTED DYNAMICS-FAMILY MARK PAINTS IN — derived from what it GOVERNS.**
 * A mark scoped to one voice takes that voice's colour; one governing the whole staff (an absent
 * `voice`, {@link voiceScopeOf}) takes the element ink. See the module note above.
 *
 * ⭐ **One colour, not a fill/stroke pair**, because the two callers need it in different
 * attributes: a dynamic is FILLED text/paths, a wedge is two STROKED polylines whose triangle must
 * stay empty. The slur does the same with `voiceFillColor` for its stroke, so a voice-coloured
 * hairpin and a voice-coloured slur read as the same ink rather than as two shades of it.
 *
 * ⛔ Not for the 8va, the pedal or the trill: the first two govern a staff and have NO voice field
 * to ask, and the trill takes its ANCHOR NOTE's voice — a different question with a different
 * source. Those three stay stated at their call sites.
 */
export function markSelectionColor(mark: ScopedMark): string {
  const scope = voiceScopeOf(mark)
  return scope === 'all' ? ELEMENT_SELECTION_FILL : voiceFillColor(scope)
}
