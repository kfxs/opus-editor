/**
 * ⭐ **THE TEMPO MARK'S PROPORTIONS AND ITS RUNG** — the two numbers that place it outside everything
 * else, and how much room its own ink takes.
 *
 * P0b of docs/plans/ottava-plan.md. Sits beside `./trillStyle` and `./dynamicStyle`, which hold the same
 * pair for their own families, and it exists for the reason those do: a family's ink extents are a
 * FONT measurement (jsdom returns zeros, so they cannot be computed in the layout module that uses
 * them), and its clearance pair is taste that must be findable in one place.
 *
 * ⭐⭐ **Tempo is the OUTERMOST family we have** — LilyPond states the order as
 * `outside-staff-priority` and puts `MetronomeMark` at **1300**, against `DynamicLineSpanner` 250 and
 * `TrillSpanner` 50 (docs/how-it-works/above-staff-ladder.md §1). For us that order is not a number: the trill and
 * the dynamics line file their claims in `engine/layout/outsideStaffBand.ts` as they are placed, and
 * the tempo mark — placed last — clears whatever it finds there. {@link TEMPO_LINE} only has to be a
 * FLOOR for the case where it finds nothing.
 */
import type { Clearance, MarkInk } from '@/engine/layout/inkBand'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { drawnFontPx } from '../../painter/drawnFontSize'
import { musicOnlyStack } from '@/engine/fonts/musicFont'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { TEXT_ROLES, textRoleFamily, textRoleSizePt, textRoleSlant, textRoleWeight } from '@/engine/engrave/textRoles'
import type { TextRunFont } from '../../painter/glyphPainter'

/**
 * The size of the metronome's note glyph (`♩`), overriding VexFlow's default.
 *
 * VexFlow engraves it at 25 against a 14 word — nearly 1.8× — so the notehead dwarfs the text it
 * sits in. Printed metronome marks size the note to roughly the word's own height, so this tracks
 * {@link TEMPO_TEXT_FONT_SIZE} at about 1.12×, putting the note just above the caps — which is what
 * `Allegro (♩ = 144)` is supposed to look like. (16 against a 14 word before the words grew.)
 *
 * ⚠️⚠️ **Its EM BOX is enormous and is not what you see**: measured at **86 px — 8.6 staff spaces —**
 * for the 16 pt version, because a music font's em spans the whole staff and then some. That is why
 * `TempoLayout` may never register `getBBox()` as the mark's hit-box, and why {@link TEMPO_INK_ABOVE}
 * is a FRACTION of this rather than the box itself.
 *
 * ⚠️ It lives HERE rather than beside the `MetricsDefaults` write that applies it (`./TempoLayout`)
 * because the ink extents below are stated against it, and `TempoLayout` needs those extents in turn
 * for the mark's hit-box — putting the constant there makes the two modules import each other.
 */
// ⭐ The NUMBER is a row of `engrave/textRoles` (`tempoSymbol`, 20 pt) since 2026-09-21 — asked per use.
export function tempoGlyphSizePt(): number {
  return textRoleSizePt('tempoSymbol')
}

/**
 * ⭐ The size of the mark's WORDS, in POINTS — ours now, applied over VexFlow's `StaveTempo.fontSize`
 * metric by `./TempoLayout` (which used to just accept its default of 14).
 *
 * ⭐⭐ **Derived, not guessed — it is LilyPond's, scaled to our staff.** Every reference program
 * states text size in points against a REFERENCE STAFF HEIGHT and lets it scale from there:
 * LilyPond and Dorico use a 20 pt staff, Sibelius and MuseScore 7.0 mm (≈19.8 pt), Finale 24 pt.
 * LilyPond then computes its default text size as `staff-height / 20 * 11` — i.e. **11 pt at a 20 pt
 * staff, or 2.2 STAFF SPACES**, which is the portable form.
 *
 * ⚠️ Our staff space is `STAFF_SPACE_PX` = 10 px = 7.5 pt, so our staff is **30 pt** tall — half
 * again LilyPond's reference. 11 × 30/20 = 16.5. MuseScore's own `tempoFontSize` (source: `styledef.cpp`) is 12 pt against a
 * `spatium` of 1.75 mm = **2.42 spaces** = 18.1 pt for us, and that is the TOP of the verified band.
 * **18** sits on it. Measured before the change, the words were 14 pt = 1.87 staff spaces — under
 * every reference — which is what his eye reported, 2026-08-13 ("the tempo font and glyph look too
 * small", then "too small" again once the band was researched).
 *
 * ⭐ It is deliberately LARGER than the dynamics/expression text (`dynamicStyle`'s
 * `DYNAMIC_TEXT_SIZE` = 16), and that gap is the engraving convention rather than an accident: a
 * tempo mark outranks an expression word on the page — MuseScore states the same gap, 12 pt against
 * 10 pt. ⚠️ Taste from here on — one constant.
 */
// ⭐ The NUMBER is a row of `engrave/textRoles` (`tempoWords`, 18 pt) since 2026-09-21 — asked per use.
export function tempoTextSizePt(): number {
  return textRoleSizePt('tempoWords')
}

/**
 * ⭐ The face of a tempo mark's WORDS — bold, at {@link TEMPO_TEXT_FONT_SIZE}: what VexFlow's
 * `StaveTempo.name` category resolved (`fontWeight: 'bold'`, `metrics.js:158`), as a row of ours.
 *
 * ⚠️ The family is the music stack with its music fonts moved to the BACK. VexFlow's stack LEADS
 * with the music font (`'Bravura,Academico'`): the letters fall through to the text face and look
 * right, but the SPACES do not — Bravura has a space glyph, and a music font's space is next to
 * nothing wide, which is why the mark once engraved as `Allegro(♩=144)` however many spaces were in
 * the string. The glyph runs keep the music font first ({@link TEMPO_GLYPH_FONT_SIZE}).
 */
export function tempoTextFont(): TextRunFont {
  return {
    // ⭐ The WORDS' face, in the bold the books ask of a tempo (Gould p. 182) — `fonts/textFont` —
    //    with the music faces behind it for the glyphs. For the defaults this is `'Academico, Bravura'`,
    //    the string `textFirstFamily(musicFontStack())` always gave.
    family: `${textRoleFamily('tempoWords')}, ${musicOnlyStack()}`,
    sizePt: tempoTextSizePt(),
    weight: textRoleWeight('tempoWords'),
    style: textRoleSlant('tempoWords'),
  }
}

/**
 * ⚠️ **First cut BY EYE, exactly as `dynamicStyle`'s 0.68/0.18 and `trillStyle`'s 0.62/0.04 were** —
 * a glyph measures 0×0 in jsdom, so an honest measurement can only come from the browser suite.
 *
 * The two are driven by different runs, which is why they are not one fraction of one size:
 *
 * - **above** is the METRONOME GLYPH's, not the text's. `Allegro (♩ = 120)` is mostly text,
 *   but the ♩ is drawn from the music font at {@link TEMPO_GLYPH_FONT_SIZE} and reaches higher than
 *   any capital. Taking the text's ascender here would let a metronome mark's stem poke through
 *   whatever is above it.
 * - **below** is the TEXT's descender. `Allegro` has a `g`, and a mark that cleared only its
 *   baseline would sit a descender deep into the family below it.
 */
/**
 * ⭐⭐ **THE TEMPO'S NOTE STANDS ON ITS WORDS' BASELINE** — his rule, 2026-09-21: *"for the moment we
 * are using this only in tempo and it should be aligned with the text."*
 *
 * A MUSIC face cuts its `metNote…` glyphs with the notehead CENTRED on the baseline (they are made to
 * sit on a staff line), so beside words half the head hangs below the line the letters stand on —
 * Bravura by 0.564 sp of its em (141/1000), Leipzig by 0.504. A face's TEXT cut stands the head ON the
 * baseline instead; Sebastian's `metNote…` range already is that cut (its head sits 0.028 sp ABOVE),
 * which is why only Sebastian looked right (`docs/research/music-text-fonts-research.md` §2).
 *
 * ⇒ Every glyph run of the mark — the note AND its augmentation dot, which must stay beside the head —
 * is raised by how far the active face's quarter note hangs below its baseline, read from the face's
 * own table (`fonts/fontMetrics`). ⛔ Never negative: a face that already stands the note on the line
 * (or a hair above, as Sebastian does) is left as its designer cut it.
 *
 * ⚠️ `glyphBox` is in staff spaces of the glyph's own em (em = 4 sp), so the px is that fraction of
 * the size the symbol is DRAWN at — the `tempoSymbol` row, not the staff's space.
 */
export function tempoSymbolRaisePx(): number {
  // ⭐ WHICH rule, and the free offset on top of it, are the `tempoSymbol` row's (`engrave/textRoles`
  //    — a house-style preset one day); HOW FAR the rule lifts is the active face's own box.
  const baseline = TEXT_ROLES.tempoSymbol.baseline
  const hangs = baseline?.rule === 'onWordsBaseline' ? Math.max(0, glyphBox('metNoteQuarterUp').down) : 0
  return (hangs / 4) * drawnFontPx(tempoGlyphSizePt()) + (baseline?.offsetSpaces ?? 0) * STAFF_SPACE_PX
}

export function tempoInkAbove(): number {
  // The ♩'s top — and the note now stands ON the baseline, so its top is higher by what it was raised.
  return drawnFontPx(tempoGlyphSizePt()) * 0.75 + tempoSymbolRaisePx()
}
export function tempoInkBelow(): number {
  return drawnFontPx(tempoTextSizePt()) * 0.22 // baseline → the `g`'s tail
}

/** How far the mark's ink reaches either side of its own text baseline, in staff spaces. */
export function tempoMarkInk(): MarkInk {
  return { above: tempoInkAbove() / STAFF_SPACE_PX, below: tempoInkBelow() / STAFF_SPACE_PX }
}

/**
 * ⭐ The tempo family's two clearance numbers — the fourth row of the same table, and the one with
 * the largest floor.
 *
 * ⚠️⚠️ **Both are TASTE, and they are the pair owed to his eye** (docs/plans/ottava-plan.md P0b). Every
 * score with a tempo mark repositions when these land, because what they replace is not another
 * pair of numbers but a CONSTANT: `TempoLayout` drew every mark at `stave.getYForTopText(1)`, which
 * resolves to a baseline exactly 2 staff spaces above the top line — blind to ledger lines, to a
 * dynamic above the staff, to a trill, and (the case that made this due) to an 8va bracket.
 *
 * ⭐ **Why the floor is bigger than the dynamics' 2.1 rather than derived from it.** The ladder is
 * not made of these numbers — the accumulator does the ordering, and a tempo mark over a dynamic
 * clears the dynamic wherever it actually landed. The floor answers a different question: where a
 * tempo mark sits when there is nothing above the staff at all. It wants to be far enough out that
 * a mark over bare music and a mark over a dynamic read as the same family, and near enough that
 * `Allegro` does not float off the top of an empty opening bar. 3.0 is that guess.
 */
export const TEMPO_LINE: Clearance = {
  /** Between the nearest ink (music, or a family already placed) and the mark's own. A shade more
   *  than the dynamics' 0.6: the outermost family is the one with room to spare. */
  padding: 0.8,
  /** The least distance from the top stave line to the mark's ink — the largest of the four. */
  minFromStaff: 3.0,
}
