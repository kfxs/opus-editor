/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** `node scripts/generate-font-metrics.mjs`
 *
 * Sebastian's table for the 107 glyphs the editor draws — the SAME shape as
 * `bravuraMetrics.ts`, total over the same `GlyphName` union, read by `fontMetrics` when the face is
 * the active one (`fonts/musicFont`, `docs/plans/music-font-switch-plan.md` Phase B).
 *
 * ⭐ **Boxes measured from `public/fonts/Sebastian.otf`**; anchors and engraving defaults from the face's own
 * metadata (`scripts/vendor/Sebastian.json`), which is the only place they exist.
 *
 * 🚨 **5 glyph(s) this face does not draw are BRAVURA'S, whole** — box and anchors
 * together, because the drawing is Bravura's too (the font stack falls through to it):
 * `bracket`, `metNote64thUp`, `metNote128thUp`, `metNote256thUp`, `metNote512thUp`.
 * ⛔ A glyph the face DOES draw never borrows a Bravura anchor: it has what its own metadata states.
 *
 * ⚠️ Engraving defaults the face does not state, taken from Bravura: `thinThickBarlineSeparation`.
 *
 * 🚨 3 measured box(es) DISAGREE with the face's published metadata (the numbers below are the OTF's — the file we draw with):
 *   · dynamicPiano — off by 0.104 spaces
 *   · dynamicForte — off by 0.020 spaces
 *   · dynamicRinforzando — off by 0.052 spaces
 *
 * Sebastian — OTF 1.35, metadata 1.35. SIL OFL 1.1.
 * Sources: `public/fonts/Sebastian-OFL.txt`, `scripts/vendor/PROVENANCE.md`.
 */

import type { GlyphBox } from './fontMetrics'
import type { GlyphName } from './bravuraMetrics'

export const SEBASTIAN = {
  name: 'Sebastian',
  otfRevision: 1.35,
  metadataVersion: 1.35,
} as const

/** The glyphs below that are Bravura's, not this face's — drawn, measured and anchored in Bravura. */
export const FALLBACK_GLYPHS: readonly GlyphName[] = ['bracket', 'metNote64thUp', 'metNote128thUp', 'metNote256thUp', 'metNote512thUp']

/** The engraving defaults below that this face's metadata does not state — Bravura's values. */
export const FALLBACK_DEFAULTS: readonly string[] = ['thinThickBarlineSeparation']

export const GLYPH_BOXES: Record<GlyphName, GlyphBox> = {
  // noteheads
  noteheadDoubleWhole: { left: 0, right: 2.336, up: 0.576, down: 0.584, advance: 2.132 },
  noteheadDoubleWholeSquare: { left: 0, right: 1.8, up: 0.724, down: 0.724, advance: 1.808 },
  noteheadWhole: { left: 0, right: 1.78, up: 0.552, down: 0.552, advance: 1.78 },
  noteheadHalf: { left: 0, right: 1.316, up: 0.548, down: 0.552, advance: 1.316 },
  noteheadBlack: { left: 0, right: 1.28, up: 0.552, down: 0.552, advance: 1.28 },
  // rests
  restLonga: { left: 0, right: 0.5, up: 1, down: 0.996, advance: 0.5 },
  restDoubleWhole: { left: 0.06, right: 0.7, up: 1.004, down: 0, advance: 0.64 },
  restWhole: { left: 0.06, right: 1.46, up: 0.004, down: 0.584, advance: 1.4 },
  restHalf: { left: 0.06, right: 1.356, up: 0.588, down: 0, advance: 1.296 },
  restQuarter: { left: 0.008, right: 1.028, up: 1.496, down: 1.424, advance: 1.028 },
  rest8th: { left: 0, right: 1.124, up: 0.828, down: 1.016, advance: 1.124 },
  rest16th: { left: 0, right: 1.388, up: 0.812, down: 2.024, advance: 1.388 },
  rest32nd: { left: 0, right: 1.52, up: 1.808, down: 2.028, advance: 1.524 },
  rest64th: { left: -0.004, right: 1.728, up: 1.8, down: 3.024, advance: 1.736 },
  rest128th: { left: 0, right: 1.924, up: 2.796, down: 3.016, advance: 1.936 },
  rest256th: { left: 0, right: 2.124, up: 2.764, down: 4.032, advance: 2.128 },
  rest512th: { left: 0, right: 2.324, up: 3.748, down: 4.032, advance: 2.324 },
  // accidentals
  accidentalSharp: { left: -0.004, right: 0.972, up: 1.36, down: 1.36, advance: 0.968 },
  accidentalFlat: { left: 0, right: 0.868, up: 1.82, down: 0.652, advance: 0.868 },
  accidentalNatural: { left: 0, right: 0.724, up: 1.36, down: 1.36, advance: 0.724 },
  accidentalDoubleSharp: { left: 0, right: 1.144, up: 0.572, down: 0.572, advance: 1.144 },
  accidentalDoubleFlat: { left: 0, right: 1.6, up: 1.82, down: 0.652, advance: 1.6 },
  // flags
  flag8thUp: { left: 0, right: 1.168, up: 0, down: 3.272, advance: 1.168 },
  flag8thDown: { left: 0, right: 1.168, up: 2.952, down: 0, advance: 1.168 },
  flag16thUp: { left: 0, right: 1.152, up: -0.008, down: 3.376, advance: 1.156 },
  flag16thDown: { left: 0, right: 1.168, up: 3.192, down: 0, advance: 1.168 },
  flag32ndUp: { left: 0, right: 1.168, up: 0.596, down: 3.372, advance: 0.816 },
  flag32ndDown: { left: 0, right: 1.168, up: 3.168, down: 0.8, advance: 1.168 },
  flag64thUp: { left: 0, right: 1.168, up: 1.372, down: 3.388, advance: 1.188 },
  flag64thDown: { left: 0, right: 1.168, up: 3.2, down: 1.56, advance: 1.172 },
  flag128thUp: { left: 0, right: 1.168, up: 2.212, down: 3.328, advance: 1.176 },
  flag128thDown: { left: 0, right: 1.168, up: 3.196, down: 2.344, advance: 1.168 },
  flag256thUp: { left: 0, right: 1.168, up: 2.956, down: 3.36, advance: 1.168 },
  flag256thDown: { left: 0, right: 1.168, up: 3.196, down: 3.12, advance: 1.172 },
  flag512thUp: { left: 0, right: 1.168, up: 3.732, down: 3.384, advance: 1.188 },
  flag512thDown: { left: 0, right: 1.168, up: 3.196, down: 3.92, advance: 1.172 },
  // dots
  augmentationDot: { left: 0, right: 0.496, up: 0.244, down: 0.244, advance: 0.496 },
  repeatDot: { left: 0, right: 0.4, up: 0.2, down: 0.2, advance: 0.4 },
  // graces
  graceNoteSlashStemUp: { left: 0, right: 2.02, up: 1.604, down: 0, advance: 2.02 },
  graceNoteSlashStemDown: { left: 0, right: 2.02, up: 0, down: 1.604, advance: 2.02 },
  // bracketedGrace
  noteheadParenthesisLeft: { left: 0, right: 0.436, up: 0.724, down: 0.724, advance: 0.292 },
  noteheadParenthesisRight: { left: 0.144, right: 0.292, up: 0.724, down: 0.724, advance: 0.292 },
  accidentalParensLeft: { left: 0, right: 0.388, up: 0.856, down: 0.856, advance: 0.42 },
  accidentalParensRight: { left: -0.036, right: 0.424, up: 0.856, down: 0.856, advance: 0.424 },
  // barlineWings
  bracketTop: { left: 0.004, right: 1.576, up: 1.1, down: 0, advance: 1.576 },
  bracketBottom: { left: 0.004, right: 1.576, up: 0, down: 1.1, advance: 0.496 },
  reversedBracketTop: { left: 0, right: 1.58, up: 1.1, down: 0, advance: 1.576 },
  reversedBracketBottom: { left: 1.08, right: 0.5, up: 0, down: 1.1, advance: 0.496 },
  // clefs
  gClef: { left: 0, right: 2.612, up: 4.636, down: 2.676, advance: 2.616 },
  fClef: { left: 0, right: 2.724, up: 1.012, down: 2.456, advance: 2.744 },
  cClef: { left: 0, right: 2.668, up: 2.028, down: 2.028, advance: 2.668 },
  // timeSignatures
  timeSig0: { left: -0.104, right: 1.6, up: 1, down: 1, advance: 1.704 },
  timeSig1: { left: -0.216, right: 1.268, up: 1, down: 1, advance: 1.368 },
  timeSig2: { left: -0.1, right: 1.564, up: 1, down: 1, advance: 1.668 },
  timeSig3: { left: -0.104, right: 1.588, up: 1, down: 1, advance: 1.692 },
  timeSig4: { left: -0.104, right: 1.66, up: 1, down: 1, advance: 1.764 },
  timeSig5: { left: -0.104, right: 1.532, up: 1, down: 1, advance: 1.632 },
  timeSig6: { left: -0.104, right: 1.568, up: 1, down: 1, advance: 1.672 },
  timeSig7: { left: -0.124, right: 1.512, up: 1, down: 1, advance: 1.532 },
  timeSig8: { left: -0.104, right: 1.592, up: 1, down: 1, advance: 1.696 },
  timeSig9: { left: -0.084, right: 1.548, up: 1, down: 1, advance: 1.632 },
  timeSigCommon: { left: 0.004, right: 1.664, up: 1, down: 1.004, advance: 1.668 },
  timeSigCutCommon: { left: 0, right: 1.664, up: 1.54, down: 1.536, advance: 1.664 },
  // dynamics
  dynamicPiano: { left: 0.44, right: 1.404, up: 1.016, down: 0.652, advance: 1.404 },
  dynamicMezzo: { left: -0.036, right: 1.776, up: 0.984, down: 0.04, advance: 1.712 },
  dynamicForte: { left: 0.432, right: 1.496, up: 1.6, down: 0.688, advance: 1.616 },
  dynamicRinforzando: { left: 0, right: 1.088, up: 0.916, down: 0, advance: 1.088 },
  dynamicSforzando: { left: 0, right: 0.884, up: 1.016, down: 0.032, advance: 0.884 },
  dynamicZ: { left: 0, right: 1.092, up: 0.988, down: 0.048, advance: 1.092 },
  dynamicNiente: { left: 0, right: 1.144, up: 0.916, down: 0.024, advance: 1.144 },
  // articulations
  articAccentAbove: { left: -0.001, right: 1.604, up: 0.879, down: 0, advance: 1.604 },
  articAccentBelow: { left: -0.001, right: 1.604, up: 0, down: 0.879, advance: 1.604 },
  articStaccatoAbove: { left: 0, right: 0.496, up: 0.496, down: 0, advance: 0.496 },
  articStaccatoBelow: { left: 0, right: 0.496, up: 0, down: 0.496, advance: 0.496 },
  articTenutoAbove: { left: 0, right: 1.2, up: 0.224, down: 0, advance: 1.2 },
  articTenutoBelow: { left: 0, right: 1.2, up: 0, down: 0.224, advance: 1.2 },
  articMarcatoAbove: { left: -0.004, right: 1.172, up: 1.2, down: 0.056, advance: 1.172 },
  articMarcatoBelow: { left: 0, right: 1.168, up: 0.04, down: 1.216, advance: 1.168 },
  articStaccatissimoAbove: { left: 0, right: 0.256, up: 0.916, down: 0.084, advance: 0.256 },
  articStaccatissimoBelow: { left: 0, right: 0.256, up: 0.084, down: 0.916, advance: 0.256 },
  // lines
  ornamentTrill: { left: 0, right: 2.004, up: 1.572, down: 0.024, advance: 2.368 },
  keyboardPedalPed: { left: 0, right: 3.8, up: 2.088, down: 0.032, advance: 3.832 },
  keyboardPedalUp: { left: -0.004, right: 1.8, up: 1.604, down: 0.012, advance: 1.8 },
  ottavaAlta: { left: 0.04, right: 3.236, up: 1.948, down: 0.04, advance: 3.24 },
  ottavaBassaVb: { left: 0.04, right: 2.948, up: 1.948, down: 0.04, advance: 2.952 },
  // tremolos
  tremolo1: { left: 0.68, right: 0.68, up: 0.428, down: 0.428, advance: 0 },
  tremolo2: { left: 0.68, right: 0.68, up: 0.82, down: 0.82, advance: 0 },
  tremolo3: { left: 0.68, right: 0.68, up: 1.212, down: 1.212, advance: 0 },
  // groupings
  brace: { left: 0.002, right: 0.268, up: 3.98, down: -0.018, advance: 0.252 },
  braceSmall: { left: 0, right: 0.44, up: 3.979, down: -0.021, advance: 0.44 },
  braceLarge: { left: -0.002, right: 0.2, up: 3.979, down: -0.018, advance: 0.2 },
  braceLarger: { left: 0, right: 0.159, up: 3.979, down: -0.018, advance: 0.176 },
  braceFlat: { left: 0, right: 0.184, up: 4, down: -0.004, advance: 0.184 },
  bracket: { left: 0, right: 1.876, up: 5.284, down: 1.272, advance: 2.232 }, // ← Bravura
  // metronome
  metNoteDoubleWhole: { left: 0, right: 1.872, up: 0.932, down: 0, advance: 1.872 },
  metNoteDoubleWholeSquare: { left: -0.02, right: 1.444, up: 1.012, down: 0.08, advance: 1.444 },
  metNoteWhole: { left: 0, right: 1.456, up: 0.932, down: -0.028, advance: 1.456 },
  metNoteHalfUp: { left: 0, right: 1.12, up: 2.76, down: -0.028, advance: 1.12 },
  metNoteQuarterUp: { left: 0, right: 1.044, up: 2.76, down: -0.028, advance: 1.044 },
  metNote8thUp: { left: 0, right: 1.784, up: 2.8, down: -0.028, advance: 1.784 },
  metNote16thUp: { left: 0, right: 1.804, up: 2.88, down: -0.028, advance: 1.804 },
  metNote32ndUp: { left: -0.004, right: 1.72, up: 2.88, down: -0.028, advance: 1.72 },
  metNote64thUp: { left: 0, right: 2.148, up: 4.392, down: 0.564, advance: 2.148 }, // ← Bravura
  metNote128thUp: { left: 0, right: 2.148, up: 5.072, down: 0.564, advance: 2.148 }, // ← Bravura
  metNote256thUp: { left: 0, right: 2.16, up: 5.696, down: 0.564, advance: 2.164 }, // ← Bravura
  metNote512thUp: { left: 0, right: 2.168, up: 6.356, down: 0.564, advance: 2.168 }, // ← Bravura
  metAugmentationDot: { left: 0, right: 0.344, up: 0.664, down: -0.32, advance: 0.344 },
}

export const GLYPH_ANCHORS: Partial<Record<GlyphName, Record<string, readonly [number, number]>>> = {
  noteheadDoubleWhole: { noteheadOrigin: [0.328, 0] },
  noteheadWhole: { cutOutNW: [0.172, 0.332], cutOutSE: [1.532, -0.364] },
  noteheadHalf: { stemDownNW: [0.004, -0.176], stemUpSE: [1.316, 0.176], cutOutNW: [0.204, 0.296], cutOutSE: [0.98, -0.3], splitStemDownNE: [0.956, -0.3], splitStemDownNW: [0.128, -0.428], splitStemUpSE: [1.108, 0.372], splitStemUpSW: [0.328, 0.38] },
  noteheadBlack: { stemDownNW: [0, -0.176], stemUpSE: [1.28, 0.172], cutOutNW: [0.208, 0.3], cutOutSE: [0.94, -0.296], splitStemDownNE: [0.968, -0.248], splitStemDownNW: [0.12, -0.416], splitStemUpSE: [1.092, 0.392], splitStemUpSW: [0.312, 0.356] },
  accidentalSharp: { cutOutNE: [0.84, 0.896], cutOutNW: [0.112, 0.768], cutOutSE: [0.84, -0.68], cutOutSW: [0.112, -0.944] },
  accidentalFlat: { cutOutNE: [0.252, 0.656], cutOutSE: [0.516, -0.436] },
  accidentalNatural: { cutOutNE: [0.192, 0.776], cutOutSW: [0.476, -0.828] },
  flag8thUp: { stemUpNW: [0, -0.04] },
  flag8thDown: { stemDownSW: [0, 0.132] },
  flag16thUp: { stemUpNW: [0, -0.088] },
  flag16thDown: { stemDownSW: [0, 0.128] },
  flag32ndUp: { stemUpNW: [0, 0.376] },
  flag32ndDown: { stemDownSW: [0, -0.448] },
  flag64thUp: { stemUpNW: [0, 1.172] },
  flag64thDown: { stemDownSW: [0, -1.244] },
  flag128thUp: { stemUpNW: [0, 1.9] },
  flag128thDown: { stemDownSW: [0, -2.076] },
  flag256thUp: { stemUpNW: [0, 2.592] },
  flag256thDown: { stemDownSW: [0, -2.812] },
  flag512thUp: { stemUpNW: [0, 3.324] },
  flag512thDown: { stemDownSW: [0, -3.608] },
  dynamicPiano: { opticalCenter: [0.756, 0] },
  dynamicMezzo: { opticalCenter: [0.856, 0] },
  dynamicForte: { opticalCenter: [0.764, 0] },
  ornamentTrill: { opticalCenter: [1.004, 0.536] },
}

export const ENGRAVING_DEFAULTS = {
  arrowShaftThickness: 0.16,
  barlineSeparation: 0.5,
  beamSpacing: 0.25,
  beamThickness: 0.5,
  bracketThickness: 0.5,
  dashedBarlineDashLength: 0.5,
  dashedBarlineGapLength: 0.33,
  dashedBarlineThickness: 0.16,
  hBarThickness: 1,
  hairpinThickness: 0.16,
  legerLineExtension: 0.4,
  legerLineThickness: 0.16,
  lyricLineThickness: 0.13,
  octaveLineThickness: 0.16,
  pedalLineThickness: 0.16,
  repeatBarlineDotSeparation: 0.16,
  repeatEndingLineThickness: 0.16,
  slurEndpointThickness: 0.08,
  slurMidpointThickness: 0.25,
  staffLineThickness: 0.13,
  stemThickness: 0.125,
  subBracketThickness: 0.16,
  textEnclosureThickness: 0.16,
  thickBarlineThickness: 0.5,
  thinBarlineThickness: 0.16,
  thinThickBarlineSeparation: 0.4, // ← Bravura
  tieEndpointThickness: 0.08,
  tieMidpointThickness: 0.25,
  tupletBracketThickness: 0.125,
} as const
