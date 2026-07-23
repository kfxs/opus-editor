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
 * NOTES/RESTS/TUPLETS do NOT use these — they select in their own voice's colour (voiceColors). And the
 * slur-editing handles keep their own orange/blue language (orange = open join, blue = true endpoint),
 * because there the colour distinguishes handle KIND, not "selected".
 */

/** The non-voice indicator blue (Tailwind blue-700). One home for what were three copies of this hex:
 *  the gutter ink, the Keypad's mode arrow, and the fill of every non-note element selection below. */
export const INDICATOR_INK = '#1D4ED8'

/** Fill for a selected NON-note element (clef, time signature, barline, dynamic, tempo/expression text). */
export const ELEMENT_SELECTION_FILL = INDICATOR_INK

/** Stroke/outline for the same — a shade darker (blue-800), mirroring how the voice colours pair a
 *  lighter fill with a darker stroke. */
export const ELEMENT_SELECTION_STROKE = '#1E40AF'
