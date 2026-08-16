/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** `node scripts/generate-font-metrics.mjs`
 *
 * 60 of Bravura's 3434 glyphs: the ones the editor draws
 * (`docs/font-metrics-plan.md` F1). Hand-editing a number here would recreate by hand the very
 * drift the file exists to end — change the glyph list in the script and re-run.
 *
 * ⭐ **Boxes measured from `public/fonts/Bravura.otf`** — the font we engrave with and outline for
 * the PDF — and cross-checked against Steinberg's published metadata. Anchors and engraving
 * defaults come from that metadata, which is the only place they exist.
 *
 * Bravura — OTF 1.392, metadata 1.481. SIL OFL 1.1.
 * Sources: `public/fonts/OFL.txt`, `scripts/vendor/PROVENANCE.md`.
 */

import type { GlyphBox } from './fontMetrics'

/**
 * Bravura, as we have it — stamped so a regeneration that moves numbers is visible in a diff.
 *
 * ⚠️ **TWO versions, and they are not the same number.** The font file we ship and measure is
 * 1.392; Steinberg's metadata, which supplies the anchors and the weights below, is
 * 1.481. The generator cross-checks every box against that metadata and (at the time
 * this was written) found them identical to 0.001 spaces for all 60 glyphs — so the skew is
 * recorded rather than papered over, and the cross-check is what says it is harmless.
 */
export const BRAVURA = {
  name: 'Bravura',
  /** `head.fontRevision` of `public/fonts/Bravura.otf` — the boxes are measured from this. */
  otfRevision: 1.392,
  /** `fontVersion` of `scripts/vendor/Bravura.json` — the anchors and defaults come from this. */
  metadataVersion: 1.481,
} as const

/**
 * ⭐ **Every glyph we have a box for**, as a closed union — so a typo is a compile error and
 * {@link glyphBox} never has to answer for a name that does not exist.
 */
export type GlyphName =
  | 'noteheadDoubleWhole'
  | 'noteheadWhole'
  | 'noteheadHalf'
  | 'noteheadBlack'
  | 'restWhole'
  | 'restHalf'
  | 'restQuarter'
  | 'rest8th'
  | 'rest16th'
  | 'rest32nd'
  | 'accidentalSharp'
  | 'accidentalFlat'
  | 'accidentalNatural'
  | 'accidentalDoubleSharp'
  | 'accidentalDoubleFlat'
  | 'flag8thUp'
  | 'flag8thDown'
  | 'flag16thUp'
  | 'flag16thDown'
  | 'flag32ndUp'
  | 'flag32ndDown'
  | 'augmentationDot'
  | 'gClef'
  | 'fClef'
  | 'cClef'
  | 'timeSig0'
  | 'timeSig1'
  | 'timeSig2'
  | 'timeSig3'
  | 'timeSig4'
  | 'timeSig5'
  | 'timeSig6'
  | 'timeSig7'
  | 'timeSig8'
  | 'timeSig9'
  | 'dynamicPiano'
  | 'dynamicMezzo'
  | 'dynamicForte'
  | 'dynamicRinforzando'
  | 'dynamicSforzando'
  | 'dynamicZ'
  | 'dynamicNiente'
  | 'articAccentAbove'
  | 'articAccentBelow'
  | 'articStaccatoAbove'
  | 'articStaccatoBelow'
  | 'articTenutoAbove'
  | 'articTenutoBelow'
  | 'articMarcatoAbove'
  | 'articMarcatoBelow'
  | 'articStaccatissimoAbove'
  | 'articStaccatissimoBelow'
  | 'ornamentTrill'
  | 'keyboardPedalPed'
  | 'keyboardPedalUp'
  | 'ottavaAlta'
  | 'ottavaBassaVb'
  | 'tremolo1'
  | 'tremolo2'
  | 'tremolo3'

/** The ink each glyph draws, in staff spaces from its own origin. See {@link GlyphBox}. */
export const GLYPH_BOXES: Record<GlyphName, GlyphBox> = {
  // noteheads
  noteheadDoubleWhole: { left: 0, right: 2.396, up: 0.62, down: 0.62, advance: 2.396 },
  noteheadWhole: { left: 0, right: 1.688, up: 0.5, down: 0.5, advance: 1.688 },
  noteheadHalf: { left: 0, right: 1.18, up: 0.5, down: 0.5, advance: 1.18 },
  noteheadBlack: { left: 0, right: 1.18, up: 0.5, down: 0.5, advance: 1.18 },
  // rests
  restWhole: { left: 0, right: 1.128, up: 0.036, down: 0.54, advance: 1.132 },
  restHalf: { left: 0, right: 1.128, up: 0.568, down: 0.008, advance: 1.132 },
  restQuarter: { left: -0.004, right: 1.08, up: 1.492, down: 1.5, advance: 1.08 },
  rest8th: { left: 0, right: 0.988, up: 0.696, down: 1.004, advance: 1 },
  rest16th: { left: 0, right: 1.28, up: 0.716, down: 2, advance: 1.28 },
  rest32nd: { left: 0, right: 1.452, up: 1.704, down: 2, advance: 1.452 },
  // accidentals
  accidentalSharp: { left: 0, right: 0.996, up: 1.4, down: 1.392, advance: 0.996 },
  accidentalFlat: { left: 0, right: 0.904, up: 1.756, down: 0.7, advance: 0.904 },
  accidentalNatural: { left: 0, right: 0.672, up: 1.364, down: 1.34, advance: 0.672 },
  accidentalDoubleSharp: { left: 0, right: 0.988, up: 0.508, down: 0.5, advance: 1 },
  accidentalDoubleFlat: { left: 0, right: 1.644, up: 1.748, down: 0.7, advance: 1.652 },
  // flags
  flag8thUp: { left: 0, right: 1.056, up: 0.036, down: 3.241, advance: 1.056 },
  flag8thDown: { left: 0, right: 1.224, up: 3.232, down: 0.056, advance: 1.224 },
  flag16thUp: { left: 0, right: 1.116, up: 0.008, down: 3.252, advance: 1.116 },
  flag16thDown: { left: 0, right: 1.164, up: 3.248, down: 0.036, advance: 1.168 },
  flag32ndUp: { left: 0, right: 1.044, up: 0.596, down: 3.248, advance: 1.048 },
  flag32ndDown: { left: 0, right: 1.092, up: 3.248, down: 0.688, advance: 1.096 },
  // dots
  augmentationDot: { left: 0, right: 0.4, up: 0.2, down: 0.2, advance: 0.4 },
  // clefs
  gClef: { left: 0, right: 2.684, up: 4.392, down: 2.632, advance: 2.684 },
  fClef: { left: 0.02, right: 2.736, up: 1.048, down: 2.54, advance: 2.736 },
  cClef: { left: 0, right: 2.796, up: 2.024, down: 2.024, advance: 2.796 },
  // timeSignatures
  timeSig0: { left: -0.08, right: 1.8, up: 1.004, down: 1, advance: 1.88 },
  timeSig1: { left: -0.08, right: 1.256, up: 1.004, down: 1, advance: 1.336 },
  timeSig2: { left: -0.08, right: 1.704, up: 1.016, down: 1.028, advance: 1.784 },
  timeSig3: { left: -0.08, right: 1.604, up: 0.996, down: 1.004, advance: 1.684 },
  timeSig4: { left: -0.08, right: 1.8, up: 1.004, down: 1, advance: 1.88 },
  timeSig5: { left: -0.08, right: 1.532, up: 0.984, down: 1.004, advance: 1.612 },
  timeSig6: { left: -0.08, right: 1.656, up: 1.004, down: 0.996, advance: 1.736 },
  timeSig7: { left: -0.08, right: 1.684, up: 0.996, down: 1, advance: 1.764 },
  timeSig8: { left: -0.08, right: 1.664, up: 1.036, down: 1.036, advance: 1.744 },
  timeSig9: { left: -0.08, right: 1.656, up: 1.004, down: 0.996, advance: 1.736 },
  // dynamics
  dynamicPiano: { left: 0.356, right: 1.464, up: 1.096, down: 0.568, advance: 1.46 },
  dynamicMezzo: { left: 0.08, right: 1.784, up: 1.096, down: 0.04, advance: 1.748 },
  dynamicForte: { left: 0.564, right: 1.456, up: 1.776, down: 0.608, advance: 1.456 },
  dynamicRinforzando: { left: 0.08, right: 1.108, up: 1.096, down: 0, advance: 1.108 },
  dynamicSforzando: { left: 0, right: 0.916, up: 1.092, down: 0.04, advance: 0.916 },
  dynamicZ: { left: 0.12, right: 0.976, up: 1.072, down: 0.04, advance: 0.976 },
  dynamicNiente: { left: 0.092, right: 1.232, up: 1.096, down: 0.04, advance: 1.232 },
  // articulations
  articAccentAbove: { left: 0, right: 1.356, up: 0.98, down: -0.004, advance: 1.356 },
  articAccentBelow: { left: 0, right: 1.356, up: 0, down: 0.976, advance: 1.356 },
  articStaccatoAbove: { left: 0, right: 0.336, up: 0.336, down: 0, advance: 0.336 },
  articStaccatoBelow: { left: 0, right: 0.336, up: 0, down: 0.336, advance: 0.336 },
  articTenutoAbove: { left: 0.004, right: 1.352, up: 0.192, down: 0, advance: 1.352 },
  articTenutoBelow: { left: 0.004, right: 1.352, up: 0, down: 0.192, advance: 1.352 },
  articMarcatoAbove: { left: 0.004, right: 0.94, up: 1.012, down: 0.004, advance: 0.944 },
  articMarcatoBelow: { left: 0.004, right: 0.94, up: 0, down: 1.016, advance: 0.944 },
  articStaccatissimoAbove: { left: -0.004, right: 0.4, up: 1.172, down: 0.008, advance: 0.408 },
  articStaccatissimoBelow: { left: -0.004, right: 0.4, up: 0, down: 1.18, advance: 0.408 },
  // lines
  ornamentTrill: { left: 0, right: 2.084, up: 1.56, down: 0.04, advance: 2.084 },
  keyboardPedalPed: { left: 0, right: 4.076, up: 2.22, down: 0.032, advance: 4.076 },
  keyboardPedalUp: { left: 0, right: 1.8, up: 1.8, down: 0, advance: 1.8 },
  ottavaAlta: { left: 0, right: 3.54, up: 1.852, down: 0.04, advance: 3.54 },
  ottavaBassaVb: { left: 0, right: 3.184, up: 1.852, down: 0.04, advance: 3.184 },
  // tremolos
  tremolo1: { left: 0.6, right: 0.6, up: 0.376, down: 0.372, advance: 0.6 },
  tremolo2: { left: 0.604, right: 0.596, up: 0.748, down: 0.748, advance: 0.596 },
  tremolo3: { left: 0.6, right: 0.6, up: 1.112, down: 1.12, advance: 0.6 },
}

/**
 * ⭐ **P3's prerequisite**: where a stem meets a head, where a flag hangs, where a dot tucks in —
 * `[x, y]` in staff spaces from the glyph's origin, y UP.
 *
 * ⚠️ Partial on purpose: most glyphs have no anchors, and {@link anchor} returns null for them
 * rather than a plausible `[0, 0]`.
 */
export const GLYPH_ANCHORS: Partial<Record<GlyphName, Record<string, readonly [number, number]>>> = {
  noteheadDoubleWhole: { noteheadOrigin: [0.36, 0], stemDownNW: [0.36, 0.004], stemUpSE: [2.036, 0.004] },
  noteheadWhole: { cutOutNW: [0.172, 0.332], cutOutSE: [1.532, -0.364] },
  noteheadHalf: { cutOutNW: [0.204, 0.296], cutOutSE: [0.98, -0.3], splitStemDownNE: [0.956, -0.3], splitStemDownNW: [0.128, -0.428], splitStemUpSE: [1.108, 0.372], splitStemUpSW: [0.328, 0.38], stemDownNW: [0, -0.168], stemUpSE: [1.18, 0.168] },
  noteheadBlack: { cutOutNW: [0.208, 0.3], cutOutSE: [0.94, -0.296], splitStemDownNE: [0.968, -0.248], splitStemDownNW: [0.12, -0.416], splitStemUpSE: [1.092, 0.392], splitStemUpSW: [0.312, 0.356], stemDownNW: [0, -0.168], stemUpSE: [1.18, 0.168] },
  accidentalSharp: { cutOutNE: [0.84, 0.896], cutOutNW: [0.144, 0.568], cutOutSE: [0.84, -0.596], cutOutSW: [0.144, -0.896] },
  accidentalFlat: { cutOutNE: [0.252, 0.656], cutOutSE: [0.504, -0.476] },
  accidentalNatural: { cutOutNE: [0.192, 0.776], cutOutSW: [0.476, -0.828] },
  accidentalDoubleFlat: { cutOutNE: [0.988, 0.644], cutOutSE: [1.336, -0.396] },
  flag8thUp: { graceNoteSlashNE: [1.284, -0.796], graceNoteSlashSW: [-0.644, -2.456], stemUpNW: [0, -0.04] },
  flag8thDown: { graceNoteSlashNW: [-0.596, 2.168], graceNoteSlashSE: [1.328, 0.628], stemDownSW: [0, 0.132] },
  flag16thUp: { stemUpNW: [0, -0.088] },
  flag16thDown: { stemDownSW: [0, 0.128] },
  flag32ndUp: { stemUpNW: [0, 0.376] },
  flag32ndDown: { stemDownSW: [0, -0.448] },
  dynamicPiano: { opticalCenter: [1.22, 0] },
  dynamicMezzo: { opticalCenter: [0.872, 0] },
  dynamicForte: { opticalCenter: [1.256, 0] },
  dynamicRinforzando: { opticalCenter: [0.612, 0] },
  dynamicSforzando: { opticalCenter: [0.444, 0] },
  dynamicZ: { opticalCenter: [0.5, 0] },
  dynamicNiente: { opticalCenter: [0.616, 0] },
}

/**
 * SMuFL's `engravingDefaults` — the font's own statement of how thick every structural line is.
 * 29 of them, in staff spaces.
 *
 * ⚠️ 1 of the font's 30 is not a measurement and is not here: `textFontFamily = ["Academico","Century Schoolbook","Edwin","serif"]`.
 */
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
  legerLineExtension: 0.4,
  legerLineThickness: 0.16,
  lyricLineThickness: 0.16,
  octaveLineThickness: 0.16,
  pedalLineThickness: 0.16,
  repeatBarlineDotSeparation: 0.16,
  repeatEndingLineThickness: 0.16,
  slurEndpointThickness: 0.1,
  slurMidpointThickness: 0.22,
  staffLineThickness: 0.13,
  stemThickness: 0.12,
  subBracketThickness: 0.16,
  textEnclosureThickness: 0.16,
  thickBarlineThickness: 0.5,
  thinBarlineThickness: 0.16,
  thinThickBarlineSeparation: 0.4,
  tieEndpointThickness: 0.1,
  tieMidpointThickness: 0.22,
  tupletBracketThickness: 0.16,
} as const
