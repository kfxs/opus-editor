/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** `node scripts/generate-font-metrics.mjs`
 *
 * Leipzig's table for the 73 glyphs the editor draws — the SAME shape as
 * `bravuraMetrics.ts`, total over the same `GlyphName` union, read by `fontMetrics` when the face is
 * the active one (`fonts/musicFont`, `docs/plans/music-font-switch-plan.md` Phase B).
 *
 * ⭐ **Boxes measured from `public/fonts/Leipzig.otf`**; anchors and engraving defaults from the face's own
 * metadata (`scripts/vendor/Leipzig.json`), which is the only place they exist.
 *
 * 🚨 **7 glyph(s) this face does not draw are BRAVURA'S, whole** — box and anchors
 * together, because the drawing is Bravura's too (the font stack falls through to it):
 * `reversedBracketTop`, `reversedBracketBottom`, `braceSmall`, `braceLarge`, `braceLarger`, `braceFlat`, `bracket`.
 * ⛔ A glyph the face DOES draw never borrows a Bravura anchor: it has what its own metadata states.
 *
 * ⚠️ Engraving defaults the face does not state, taken from Bravura: `thinThickBarlineSeparation`.
 *
 * ⭐ Every measured box that the face's metadata also publishes agrees with it to 0.01 spaces.
 *
 * Leipzig — OTF 5.2, metadata 5.2.86. SIL OFL 1.1.
 * Sources: `public/fonts/Leipzig-OFL.txt`, `scripts/vendor/PROVENANCE.md`.
 */

import type { GlyphBox } from './fontMetrics'
import type { GlyphName } from './bravuraMetrics'

export const LEIPZIG = {
  name: 'Leipzig',
  otfRevision: 5.2,
  metadataVersion: "5.2.86",
} as const

/** The glyphs below that are Bravura's, not this face's — drawn, measured and anchored in Bravura. */
export const FALLBACK_GLYPHS: readonly GlyphName[] = ['reversedBracketTop', 'reversedBracketBottom', 'braceSmall', 'braceLarge', 'braceLarger', 'braceFlat', 'bracket']

/** The engraving defaults below that this face's metadata does not state — Bravura's values. */
export const FALLBACK_DEFAULTS: readonly string[] = ['thinThickBarlineSeparation']

export const GLYPH_BOXES: Record<GlyphName, GlyphBox> = {
  // noteheads
  noteheadDoubleWhole: { left: 0, right: 2.18, up: 0.68, down: 0.68, advance: 2.18 },
  noteheadWhole: { left: 0, right: 1.62, up: 0.532, down: 0.532, advance: 1.62 },
  noteheadHalf: { left: 0, right: 1.256, up: 0.552, down: 0.528, advance: 1.256 },
  noteheadBlack: { left: 0, right: 1.256, up: 0.532, down: 0.532, advance: 1.256 },
  // rests
  restWhole: { left: 0, right: 1.2, up: 0, down: 0.5, advance: 1.2 },
  restHalf: { left: 0, right: 1.2, up: 0.5, down: 0, advance: 1.2 },
  restQuarter: { left: 0, right: 1.22, up: 1.488, down: 1.552, advance: 1.216 },
  rest8th: { left: 0, right: 1.104, up: 0.732, down: 1, advance: 1.108 },
  rest16th: { left: -0.004, right: 1.3, up: 0.696, down: 1.968, advance: 1.296 },
  rest32nd: { left: -0.004, right: 1.596, up: 1.652, down: 1.94, advance: 1.616 },
  // accidentals
  accidentalSharp: { left: 0, right: 0.788, up: 1.42, down: 1.356, advance: 0.788 },
  accidentalFlat: { left: 0, right: 0.792, up: 1.876, down: 0.7, advance: 0.8 },
  accidentalNatural: { left: 0, right: 0.628, up: 1.404, down: 1.404, advance: 0.628 },
  accidentalDoubleSharp: { left: 0, right: 1.028, up: 0.48, down: 0.48, advance: 1.032 },
  accidentalDoubleFlat: { left: 0, right: 1.552, up: 1.876, down: 0.7, advance: 1.552 },
  // flags
  flag8thUp: { left: 0, right: 1.104, up: 0, down: 2.776, advance: 1.108 },
  flag8thDown: { left: 0, right: 1.104, up: 2.776, down: 0, advance: 1.108 },
  flag16thUp: { left: 0, right: 1.104, up: 0, down: 3.116, advance: 1.096 },
  flag16thDown: { left: 0, right: 1.104, up: 3.044, down: 0, advance: 1.096 },
  flag32ndUp: { left: 0, right: 1.104, up: 0.76, down: 3.116, advance: 1.096 },
  flag32ndDown: { left: 0, right: 1.104, up: 3.04, down: 0.76, advance: 1.096 },
  // dots
  augmentationDot: { left: 0, right: 0.516, up: 0.264, down: 0.26, advance: 0.74 },
  repeatDot: { left: 0, right: 0.4, up: 0.2, down: 0.2, advance: 0.4 },
  // barlineWings
  bracketTop: { left: 0, right: 1.596, up: 1.128, down: 0, advance: 1.596 },
  bracketBottom: { left: 0, right: 1.596, up: 0, down: 1.128, advance: 1.596 },
  reversedBracketTop: { left: 0, right: 1.876, up: 1.18, down: 0, advance: 1.876 }, // ← Bravura
  reversedBracketBottom: { left: 0, right: 1.876, up: 0, down: 1.18, advance: 1.876 }, // ← Bravura
  // clefs
  gClef: { left: 0.004, right: 2.584, up: 4.332, down: 2.62, advance: 2.584 },
  fClef: { left: -0.016, right: 2.792, up: 1.004, down: 2.324, advance: 2.792 },
  cClef: { left: 0, right: 2.424, up: 2.008, down: 2.008, advance: 2.424 },
  // timeSignatures
  timeSig0: { left: -0.08, right: 1.736, up: 1.004, down: 1, advance: 1.816 },
  timeSig1: { left: -0.08, right: 1.264, up: 1, down: 1, advance: 1.344 },
  timeSig2: { left: -0.08, right: 1.688, up: 1.004, down: 1.004, advance: 1.768 },
  timeSig3: { left: -0.08, right: 1.568, up: 1, down: 1.008, advance: 1.648 },
  timeSig4: { left: -0.08, right: 1.628, up: 1.004, down: 1, advance: 1.708 },
  timeSig5: { left: -0.08, right: 1.508, up: 1, down: 1, advance: 1.588 },
  timeSig6: { left: -0.08, right: 1.608, up: 1, down: 1, advance: 1.688 },
  timeSig7: { left: -0.08, right: 1.696, up: 1.004, down: 1, advance: 1.776 },
  timeSig8: { left: -0.04, right: 1.536, up: 0.997, down: 1, advance: 1.616 },
  timeSig9: { left: -0.08, right: 1.62, up: 1, down: 1, advance: 1.7 },
  timeSigCommon: { left: 0, right: 1.656, up: 1.004, down: 0.996, advance: 1.688 },
  timeSigCutCommon: { left: 0, right: 1.668, up: 1.272, down: 1.276, advance: 1.668 },
  // dynamics
  dynamicPiano: { left: 0.196, right: 1.332, up: 1.052, down: 0.668, advance: 1.224 },
  dynamicMezzo: { left: 0.176, right: 1.712, up: 1.048, down: 0.072, advance: 1.62 },
  dynamicForte: { left: 0.572, right: 1.22, up: 1.768, down: 0.892, advance: 0.928 },
  dynamicRinforzando: { left: 0.08, right: 0.9, up: 1.036, down: 0, advance: 0.9 },
  dynamicSforzando: { left: 0, right: 0.776, up: 1.08, down: 0, advance: 0.776 },
  dynamicZ: { left: 0.144, right: 1.04, up: 0.996, down: 0.064, advance: 1.04 },
  dynamicNiente: { left: 0.156, right: 1.252, up: 1.048, down: 0.072, advance: 1.16 },
  // articulations
  articAccentAbove: { left: 0, right: 1.388, up: 0.944, down: 0, advance: 1.388 },
  articAccentBelow: { left: 0, right: 1.388, up: 0, down: 0.944, advance: 1.388 },
  articStaccatoAbove: { left: 0, right: 0.384, up: 0.384, down: 0, advance: 0.384 },
  articStaccatoBelow: { left: 0, right: 0.384, up: 0, down: 0.384, advance: 0.384 },
  articTenutoAbove: { left: 0, right: 1.384, up: 0.144, down: 0, advance: 1.384 },
  articTenutoBelow: { left: 0, right: 1.384, up: 0, down: 0.144, advance: 1.384 },
  articMarcatoAbove: { left: 0, right: 1.092, up: 1.06, down: 0, advance: 1.096 },
  articMarcatoBelow: { left: -0.004, right: 1.096, up: 0, down: 1.06, advance: 1.096 },
  articStaccatissimoAbove: { left: 0, right: 0.442, up: 0.976, down: 0, advance: 0.44 },
  articStaccatissimoBelow: { left: 0, right: 0.442, up: 0, down: 0.976, advance: 0.44 },
  // lines
  ornamentTrill: { left: 0, right: 1.728, up: 1.456, down: 0, advance: 1.728 },
  keyboardPedalPed: { left: 0, right: 2.78, up: 2.056, down: 0, advance: 2.78 },
  keyboardPedalUp: { left: 0, right: 1.724, up: 1.668, down: 0.004, advance: 1.724 },
  ottavaAlta: { left: 0, right: 2.628, up: 1.4, down: -0.004, advance: 2.628 },
  ottavaBassaVb: { left: 0, right: 2.48, up: 1.328, down: 0, advance: 2.48 },
  // tremolos
  tremolo1: { left: 0.652, right: 0.652, up: 0.5, down: 0.5, advance: 0.652 },
  tremolo2: { left: 0.652, right: 0.652, up: 0.852, down: 0.848, advance: 0.652 },
  tremolo3: { left: 0.652, right: 0.652, up: 1.2, down: 1.2, advance: 0.652 },
  // groupings
  brace: { left: 0, right: 0.371, up: 3.995, down: -0.005, advance: 4 },
  braceSmall: { left: 0, right: 0.412, up: 3.988, down: 0, advance: 0.412 }, // ← Bravura
  braceLarge: { left: 0, right: 0.268, up: 3.992, down: -0.004, advance: 0.268 }, // ← Bravura
  braceLarger: { left: 0, right: 0.24, up: 3.988, down: 0, advance: 0.244 }, // ← Bravura
  braceFlat: { left: 0, right: 0.224, up: 4, down: -0.004, advance: 0.228 }, // ← Bravura
  bracket: { left: 0, right: 1.876, up: 5.284, down: 1.272, advance: 2.232 }, // ← Bravura
}

export const GLYPH_ANCHORS: Partial<Record<GlyphName, Record<string, readonly [number, number]>>> = {
  noteheadWhole: { cutOutNW: [0.06, 0.244], cutOutSE: [1.568, -0.232] },
  noteheadHalf: { cutOutNW: [0.14, 0.24], cutOutSE: [1.076, -0.24], stemDownNW: [0, -0.144], stemUpSE: [1.256, 0.164] },
  noteheadBlack: { cutOutNW: [0.144, 0.24], cutOutSE: [1.088, -0.244], stemDownNW: [0, -0.156], stemUpSE: [1.256, 0.156] },
  accidentalSharp: { cutOutNE: [0.624, 0.844], cutOutNW: [0.16, 0.644], cutOutSE: [0.624, -0.64], cutOutSW: [0.16, -0.82] },
  accidentalFlat: { cutOutNE: [0.096, 0.564], cutOutSE: [0.432, -0.344] },
  accidentalNatural: { cutOutNE: [0.08, 0.736], cutOutSW: [0.548, -0.76] },
  accidentalDoubleFlat: { cutOutNE: [0.856, 0.56], cutOutSE: [1.232, -0.3] },
}

export const ENGRAVING_DEFAULTS = {
  arrowShaftThickness: 0.16,
  barlineSeparation: 0.4,
  beamSpacing: 0.25,
  beamThickness: 0.5,
  bracketThickness: 0.5,
  dashedBarlineDashLength: 0.5,
  dashedBarlineGapLength: 0.25,
  dashedBarlineThickness: 0.16,
  hBarThickness: 1,
  hairpinThickness: 0.16,
  legerLineExtension: 0.27,
  legerLineThickness: 0.16,
  lyricLineThickness: 0.16,
  octaveLineThickness: 0.16,
  pedalLineThickness: 0.16,
  repeatBarlineDotSeparation: 0.18,
  repeatEndingLineThickness: 0.16,
  slurEndpointThickness: 0.1,
  slurMidpointThickness: 0.22,
  staffLineThickness: 0.08,
  stemThickness: 0.076,
  subBracketThickness: 0.16,
  textEnclosureThickness: 0.16,
  thickBarlineThickness: 0.5,
  thinBarlineThickness: 0.15,
  thinThickBarlineSeparation: 0.4, // ← Bravura
  tieEndpointThickness: 0.1,
  tieMidpointThickness: 0.22,
  tupletBracketThickness: 0.16,
} as const
