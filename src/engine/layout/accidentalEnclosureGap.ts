/**
 * ⭐ **THE WHITE INSIDE A BRACKETED ACCIDENTAL** — between `(` and the sign, and the sign and `)`
 * (docs/plans/alteration-signs-plan.md K3). A table of rules, each sourced; which row is armed is HIS.
 *
 * ⭐ ONE number feeds the ROOM (`./spacingPadding.accidentalExtent`) and the INK
 * (`rendering/engraved/EngravedAccidental`), so the two cannot drift — `./accidentalGap`'s promise.
 *
 * ⭐ All three engines draw the brackets at the SIGN's size, the font's own `accidentalParensLeft/Right`
 * (E26A/E26B); only VexFlow shrinks the whole run, to 20 pt of 30 (`Accidental.cautionary.fontSize`) —
 * ⏳ a SIZE row is a follow-up, not built.
 *
 * ⚠️ No live switch yet: a console arm would have to join the layout key and the width-cache
 * fingerprint, as `accidentalGapGeneration` does. Changing the armed row is an edit here.
 */
import { glyphBox, type GlyphName } from '@/engine/fonts/fontMetrics'

/** One rule: the white between a bracket's ink box and the sign's, each side, in staff spaces. */
export interface AccidentalEnclosureGapRule {
  gap: number
  source: string
}

export const ACCIDENTAL_ENCLOSURE_GAP_RULES = {
  /** ✅ ARMED — his call, 2026-10-10: *"lilypond should be default"*. The brackets glued on with no
   *  padding (`lily/accidental.cc` `parenthesize`: `add_at_edge (X_AXIS, LEFT, open, 0)`). */
  lilypond: { gap: 0, source: 'LilyPond lily/accidental.cc parenthesize — add_at_edge, padding 0' },
  /** Gould pp. 139 / 378, measured on the bracketed graces: `(` → the accidental inside, 0.15–0.26 sp
   *  (the bracketed grace's own `parenToAccidental`, `./bracketedRoom`). */
  gould: { gap: 0.2, source: 'Gould pp. 139 / 378: “(” to the accidental 0.15–0.26 sp' },
  /** MuseScore's style `bracketedAccidentalPadding` (`engraving/style/styledef.cpp:285`). ⚠️ For the five
   *  common signs MuseScore draws SMuFL's precomposed `accidental…Parens` glyphs instead. */
  musescore: { gap: 0.175, source: 'MuseScore bracketedAccidentalPadding 0.175 sp' },
} as const satisfies Record<string, AccidentalEnclosureGapRule>

export type AccidentalEnclosureGapRuleName = keyof typeof ACCIDENTAL_ENCLOSURE_GAP_RULES

/** ✅ What is armed. */
export const ACTIVE_ACCIDENTAL_ENCLOSURE_GAP_RULE: AccidentalEnclosureGapRuleName = 'lilypond'

/** The white each side of the sign, in staff spaces — the armed row's. */
export function accidentalEnclosureGap(): number {
  return ACCIDENTAL_ENCLOSURE_GAP_RULES[ACTIVE_ACCIDENTAL_ENCLOSURE_GAP_RULE].gap
}

/** The two bracket glyphs, by SMuFL name — one pair today (`AccidentalEnclosure` is `'round'`). */
export const ACCIDENTAL_ENCLOSURE_GLYPHS = { left: 'accidentalParensLeft', right: 'accidentalParensRight' } as const

/**
 * ⭐ Where a BRACKETED sign's three glyphs stand, in staff spaces from the run's LEFT edge (K3b) — `(` at 0, the
 * sign at {@link signAt}, `)` at {@link rightAt} — from the font table's advances and the armed white: the SAME
 * numbers `spacingPadding.accidentalEnclosureWidth` prices the room with. Read by the passes that stamp a sign by
 * hand (a grace's, a fan member's), which have no `EngravedAccidental` to ask.
 */
export function accidentalRunOffsets(signGlyph: GlyphName): { signAt: number; rightAt: number } {
  const signAt = glyphBox(ACCIDENTAL_ENCLOSURE_GLYPHS.left).advance + accidentalEnclosureGap()
  return { signAt, rightAt: signAt + glyphBox(signGlyph).advance + accidentalEnclosureGap() }
}
