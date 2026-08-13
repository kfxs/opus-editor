/**
 * Styling constants for the TRILL — the `tr` sign and its wavy extension (docs/trill-plan.md §4).
 *
 * The dynamics' twin (`./dynamicStyle` + `MARK_INK` in `./dynamicsLinePass`), and deliberately the
 * same shape: the family's two clearance numbers, the glyph size, and how far the sign's ink reaches
 * from its own baseline. Everything vertical that is not a measurement of the MUSIC is here, so the
 * renderer holds no numbers of its own.
 *
 * ⚠️ **Codepoints written out, never `Glyphs.xxx`.** VexFlow's `Glyphs` object is CJS-only and
 * resolves to `undefined` in the browser build — a bug that shows as a blank score rather than as an
 * error (`reference_vexflow_glyphs_esm_vs_cjs`). `TempoLayout` writes its SMuFL codepoints out for
 * the same reason.
 */
import type { Clearance, MarkInk } from '@/engine/layout/inkBand'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { DYNAMIC_TEXT_FONT } from './dynamicStyle'

/** SMuFL `ornamentTrill` — the `tr` itself. */
export const TRILL_SIGN_GLYPH = ''

/**
 * SMuFL `wiggleTrill` — ONE segment of the wavy line, repeated to length.
 *
 * ⚠️ **Not VexFlow's `Vibrato`, which defaults to U+EAB0** (`wiggleVibrato`) — a visibly different,
 * tighter wave meaning vibrato rather than a trill. Reaching for `VibratoBracket` would have
 * inherited the wrong glyph along with four other defects (docs/trill-plan.md §4).
 */
export const TRILL_WIGGLE_GLYPH = ''

/**
 * ⭐⭐ **The parentheses around a CONTINUATION `tr`** — SMuFL `accidentalParensLeft` / `Right`.
 *
 * ⭐⭐ **HIS DECISION, 2026-08-13, and it is a decision — not an inherited convention:** *"I like to
 * use the `(tr)` convention of Sibelius, is good for the reader."* A reader must be able to tell a
 * trill that CARRIES OVER from one that starts here, and a bare repeated `tr` says the wrong thing.
 *
 * ⚠️ **Keep the DECISION and the ATTRIBUTION apart.** The plan's §1 rule 6 says "Sibelius prints a
 * parenthesised `(tr)`", which came from its first research pass and has never been checked at
 * source; research is in flight on it, along with what MuseScore's C++ emits and whether historical
 * engraved editions repeat the sign at all (they may well not — in which case `(tr)` is a modern
 * software convention, and our docs must say so rather than imply a lineage). ⭐ **None of that can
 * unmake the choice** — he chose it on readability, having seen it drawn. What the research can
 * change is what we CLAIM about it, and possibly the glyphs.
 *
 * ⏭️ **A future per-trill property switches it off** (his call, same message): the plain repeated
 * `tr` is the other convention, and a `Trill` may later carry an optional field — or an engraving
 * preset may set it score-wide. ⛔ Not built, and not a field until it is asked for; docs/trill-plan.md
 * §9 carries the row. Note this is the one thing here that would be a MODEL change rather than a
 * constant.
 *
 * ⚠️ **These are the ACCIDENTAL parentheses, used for something they were not specified for.** SMuFL
 * defines U+E26A/E26B as `accidentalParensLeft`/`Right`. They are the closest music-font brackets —
 * drawn to a glyph's height and weight, where a text paren would arrive from whatever fallback face
 * the stack resolved and match nothing around it — but choosing them here is a JUDGEMENT, not a
 * standard. ⏭️ Research is in flight on what MuseScore's C++ actually emits at a trill's
 * continuation segment; revisit both the convention and the glyphs when it lands.
 */
/** The serif stack the parens are set in — the one face in play with a true italic. */
export const TRILL_PAREN_FONT = DYNAMIC_TEXT_FONT

export const TRILL_PAREN_LEFT = '('
export const TRILL_PAREN_RIGHT = ')'

/**
 * The parentheses are drawn as ITALIC SERIF TEXT, smaller than the sign and raised to centre on it.
 *
 * ⭐ **Italic, because the `tr` itself is** — SMuFL's `ornamentTrill` is a stylised italic "tr", so
 * an upright bracket sits against it at a visibly wrong slant.
 *
 * ⚠️⚠️ **SETTING `font-style: italic` IS NOT ENOUGH — the FAMILY has to own an italic face.** The
 * first attempt set the style on VexFlow's own stack and the parens rendered bolt upright anyway
 * (his report: *"no italic"*), because the music font has no italic and the browser did not
 * synthesise one. `dynamicStyle.ts` already had the answer written down for the expression words:
 * *"Serif stack … has a true italic face (the music font doesn't), so expression text actually
 * slants."* So these take {@link DYNAMIC_TEXT_FONT}. ⚠️ A DOM assertion that `font-style` is italic
 * therefore proves nothing on its own — mine passed while the picture was upright.
 *
 * ⭐ **Not `accidentalParensLeft`/`Right`** (U+E26A/E26B), the attempt before that: they are
 * specified to bracket an ACCIDENTAL, which straddles the baseline where a `tr` sits almost entirely
 * above it, so they hung visibly low (*"not align vertically"*).
 */

/**
 * Paren size as a fraction of {@link TRILL_GLYPH_SIZE} — a fraction, not its own px value, so the two
 * cannot drift when the sign is retuned.
 *
 * ⚠️ **Pure taste, tuned against his eye and nothing else.** 0.85 was *"definitely too big"*, 0.62
 * *"still a tiny big"*, so 0.52. ⛔ There is no rule to derive this from: SMuFL has no parenthesised
 * trill, so nothing specifies how big a bracket around one should be.
 */
export const TRILL_PAREN_SCALE = 0.52

/**
 * How far the parens are RAISED off the sign's baseline, as a fraction of their own size.
 *
 * ⚠️ It cannot be zero. A text paren DESCENDS below its baseline and a `tr` does not, so sharing a
 * baseline hangs the brackets below the sign. This lifts them so their ink centres on the sign's.
 * ⚠️ Taste, and derived from assumed font metrics rather than measured ones — one number to tune.
 */
export const TRILL_PAREN_RAISE = 0.22

/** px, at full staff size. A shade under the dynamics' 30 — a `tr` is a smaller mark than an `f`. */
export const TRILL_GLYPH_SIZE = 26

/*
 * Tight vertical ink extent of the `tr`, from its own text baseline, in px.
 *
 * ⚠️ **First-cut proportions, not a measurement** — a glyph measures 0×0 in jsdom
 * (`reference_jsdom_cannot_measure_glyphs`), so a number computed at load would be a number agreeing
 * with itself. The honest measurement belongs to the browser suite; these are what the drawing
 * starts from and what his eye tunes. `ornamentTrill` sits almost entirely ABOVE its baseline (the
 * `t` ascends, and nothing descends), which is why `BELOW` is so much smaller than the dynamics'.
 */
export const TRILL_GLYPH_INK_ABOVE = TRILL_GLYPH_SIZE * 0.62 // baseline → glyph top
export const TRILL_GLYPH_INK_BELOW = TRILL_GLYPH_SIZE * 0.04 // baseline → glyph bottom

/**
 * How far the sign's ink reaches either side of its baseline, in STAFF SPACES.
 *
 * ⭐ In the staff's own spaces, which is why no staff size appears here or in the renderer: the sign
 * is drawn inside the staff's `scale(k)` group at a fixed px size, so a small staff's glyph is the
 * same number of ITS spaces as a full-size one's. The px→spaces conversion is therefore against the
 * constant, never against a scaled stave.
 */
export const TRILL_MARK_INK: MarkInk = {
  above: TRILL_GLYPH_INK_ABOVE / STAFF_SPACE_PX,
  below: TRILL_GLYPH_INK_BELOW / STAFF_SPACE_PX,
}

/**
 * ⭐ The trill family's two clearance numbers — LilyPond's `TrillSpanner` defaults, taken the same
 * way the dynamics line took `DynamicLineSpanner`'s 0.6/1.2 (docs/trill-plan.md §1 rule 8).
 *
 * ⭐⭐ **These sit NEARER the staff than the dynamics', and that is the ladder.** LilyPond states the
 * order as `outside-staff-priority`: `TrillSpanner` 50 against `DynamicLineSpanner` 250, i.e. the
 * trill is the innermost outside-staff family we have. For us that ordering IS these two numbers —
 * we need no priority table, because an innermost family never has to know what is above it
 * (docs/above-staff-ladder.md §2 and §4).
 *
 * ⚠️ **Unlike the dynamics' 2.1, the floor here is NOT derived from a cleared stem.** The dynamics
 * line needs its marks to agree with each other — it is read as a ROW — so its floor is chosen to be
 * exactly what ordinary music produces. A trill is read individually at its note and is NOT a
 * baseline family, so nothing here has to line up with anything: the floor is only a minimum, and
 * over stem-up music the ink is what decides. That is why 1.0 is a taste value where 2.1 was a
 * calculation, and why this one is genuinely waiting on his eye.
 */
export const TRILL_LINE: Clearance = {
  padding: 0.5,
  minFromStaff: 1.0,
}

/** Gap between the `tr` and the start of the wiggle, in staff spaces — so the line reads as leaving
 *  the sign rather than as touching it. LilyPond's `bound-padding` for the same join. */
export const TRILL_SIGN_GAP = 0.3

/**
 * ⭐ **AIR AT THE END — the wavy line stops short of whatever it runs up to.** His call, 2026-08-13:
 * the line was ending flush against the next notehead's left edge, which reads as the trill running
 * INTO the note rather than stopping before it.
 *
 * ⭐ The same arrangement as the hairpin's `HAIRPIN.END_INSET`, and for the reason he gave then
 * (2026-08-12, of the wedge): *"maybe instead of an IF statement it is better to hardcode the air…
 * since we will give the user the faculty of modifying, making logic will make things too
 * complicated."* So it is UNCONDITIONAL — not "inset only when a note actually starts there" —
 * which is also what LilyPond does with `bound-padding`.
 *
 * ⚠️ **Bigger than the hairpin's 0.25, deliberately.** That one is a hairline of air so two abutting
 * wedges do not touch; this one stands the line off a NOTEHEAD, which is the case Gould describes as
 * "about a space". Starting at half a space by eye — ⚠️ a taste value, and one of the three numbers
 * this feature is waiting on his eye for (docs/trill-plan.md P2).
 *
 * ⚠️ Applied to the trill's own END only — never to a SYSTEM BREAK, where a fragment runs to the
 * margin and there is nothing to stand off from. The renderer insets before cutting into pieces,
 * which is what makes that true without a condition.
 */
export const TRILL_END_INSET = 0.5
