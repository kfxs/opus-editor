/**
 * Regenerates `src/engine/fonts/bravuraMetrics.ts` — the ~60 glyphs we draw, measured off the font.
 *
 *   node scripts/generate-font-metrics.mjs
 *
 * F1 of `docs/plans/font-metrics-plan.md`. The ink table stops being a set of numbers measured by hand in
 * Chrome and becomes a set of numbers read out of the font — ⭐ **the same font file the editor
 * engraves with and the PDF export outlines**, `public/fonts/Bravura.otf`, so what we measure and
 * what is drawn cannot be two different Bravuras (plan §1.1, §4.2).
 *
 * ## Three inputs, and each is here for a reason the others cannot cover
 *
 * | file | gives | why not one of the others |
 * |---|---|---|
 * | `public/fonts/Bravura.otf` | the BOXES and advances | the font we ship — the only copy whose numbers can be checked against the drawing |
 * | `public/smufl/glyphnames.json` | SMuFL name → codepoint | an OTF is keyed by codepoint; the spec's names are what a reader recognises |
 * | `scripts/vendor/Bravura.json` | `engravingDefaults`, anchors | ⚠️ a font file carries neither, and no amount of measuring recovers them |
 *
 * ⭐ It also **cross-checks** the OTF's boxes against Steinberg's published ones and reports any
 * disagreement — the cheap half of "are these three copies of Bravura the same Bravura" (plan §4.2).
 *
 * ## ⛔ A silent subset is the same defect as a silent cap
 *
 * We emit ~60 of 3,434 glyphs. So the run REPORTS what it dropped, names every requested glyph it
 * could not find, and **exits non-zero rather than emitting a partial module** — a metrics table
 * that quietly lacks a row is exactly the failure this whole plan exists to prevent.
 *
 * Bravura is SIL OFL 1.1 (`public/fonts/OFL.txt`, `scripts/vendor/PROVENANCE.md`).
 */
import opentype from 'opentype.js'
import { readFileSync, writeFileSync } from 'node:fs'

const OTF = 'public/fonts/Bravura.otf'
const GLYPHNAMES = 'public/smufl/glyphnames.json'
const METADATA = 'scripts/vendor/Bravura.json'
const OUT = 'src/engine/fonts/bravuraMetrics.ts'

/**
 * ⭐⭐ **THE GLYPH LIST — declared here, in one place, and nowhere else.**
 *
 * A group is a sentence about what the editor draws, so adding a glyph means saying which sentence
 * it belongs to. ⛔ Do not add a glyph "because it might be useful": every row here is 4 numbers and
 * an anchor set in the shipped bundle, and the report at the end of a run is only honest while this
 * list means "what we draw".
 */
const GLYPHS = {
  // The note itself — P3's subject, and the head whose width every column gap is measured from.
  noteheads: ['noteheadDoubleWhole', 'noteheadWhole', 'noteheadHalf', 'noteheadBlack'],

  // ⚠️ Six, matching `NoteDuration` exactly. A rest we cannot write is a rest we must not measure.
  rests: ['restWhole', 'restHalf', 'restQuarter', 'rest8th', 'rest16th', 'rest32nd'],

  // The five signs `ACCIDENTAL_WIDTH` and `accidentalHeight` are keyed by.
  accidentals: [
    'accidentalSharp',
    'accidentalFlat',
    'accidentalNatural',
    'accidentalDoubleSharp',
    'accidentalDoubleFlat',
  ],

  // ⭐ Up and down are DIFFERENT GLYPHS with different widths (1.056 against 1.224), which is why a
  //   down-flag adds nothing to a column and an up-flag adds a whole space.
  flags: ['flag8thUp', 'flag8thDown', 'flag16thUp', 'flag16thDown', 'flag32ndUp', 'flag32ndDown'],

  // The augmentation dot — `INK.dotWidth` and `INK_HEIGHT.dot`, both already exact (plan §2).
  // ⭐ And the REPEAT dot, which is a different glyph that happens to be the same size: both engines
  //   that draw one draw THIS code point (MuseScore `SymId::repeatDot`, Verovio `SMUFL_E044`), and
  //   both size the sign from its measured width rather than from a constant. See `BarlineRenderer`.
  dots: ['augmentationDot', 'repeatDot'],

  // ⭐ The REPEAT BARLINE'S WINGS — the flared tips a "winged" repeat carries at the top and bottom
  //   of its thick line (his ask, 2026-08-26). ⛔ SMuFL has no wing glyph: every engine that draws
  //   them re-uses the STAFF BRACKET's own tips, which is what these are (MuseScore's `drawTips`
  //   stamps exactly this pair and its mirror). The mirrored two attach at their RIGHT edge, which
  //   is why their measured width is needed and not just their height.
  barlineWings: ['bracketTop', 'bracketBottom', 'reversedBracketTop', 'reversedBracketBottom'],

  // The header's glyphs. ⚠️ Their INK is here; what a header COSTS is not (`layout/headerInk.ts`
  // measures stave-x to the first notehead, a placement, and plan §7 keeps it out of scope).
  clefs: ['gClef', 'fClef', 'cClef'],
  timeSignatures: [
    'timeSig0', 'timeSig1', 'timeSig2', 'timeSig3', 'timeSig4',
    'timeSig5', 'timeSig6', 'timeSig7', 'timeSig8', 'timeSig9',
    // ⭐ The two meters that are a SYMBOL rather than numerals — `C` and `C|` (S4b0 of
    //   docs/history/vexflow-removal-map.md: the meter's glyph is chosen by us, not by VexFlow's table).
    'timeSigCommon', 'timeSigCutCommon',
  ],

  // The letters a dynamic mark is composed of (`dynamics.ts` builds the words from these).
  dynamics: [
    'dynamicPiano',
    'dynamicMezzo',
    'dynamicForte',
    'dynamicRinforzando',
    'dynamicSforzando',
    'dynamicZ',
    'dynamicNiente',
  ],

  // Above and below are separate glyphs, and not mirror images: a marcato points at the staff.
  articulations: [
    'articAccentAbove', 'articAccentBelow',
    'articStaccatoAbove', 'articStaccatoBelow',
    'articTenutoAbove', 'articTenutoBelow',
    'articMarcatoAbove', 'articMarcatoBelow',
    'articStaccatissimoAbove', 'articStaccatissimoBelow',
  ],

  // The lines family's own marks (`docs/plans/trill-plan.md`, `pedal-plan.md`, `ottava-plan.md`).
  lines: ['ornamentTrill', 'keyboardPedalPed', 'keyboardPedalUp', 'ottavaAlta', 'ottavaBassaVb'],

  // Tremolo strokes — one glyph per stroke count, ours going to three.
  tremolos: ['tremolo1', 'tremolo2', 'tremolo3'],

  // ⭐⭐ THE LEFT-EDGE SIGNS (`docs/plans/braces-brackets-plan.md` P4a). The piano BRACE, plus the four
  //   alternates — ⭐ all five are exactly 4 staff spaces tall and differ ONLY in width, so the
  //   choice between them is *"which drawing holds its weight when stretched this far"*, not
  //   *"how wide should it be"* (the depth is CONSTANT — Gould p. 331, measured).
  //   ⚠️ `brace` is the glyph the version skew shows on: 0.320 spaces in the OTF we ship against
  //   0.277 in the metadata we vendor, ~13% apart, and the cross-check below is what says so out
  //   loud. ⛔ The four alternates live in SMuFL's `optionalGlyphs`, not in `glyphnames.json`, and
  //   the metadata publishes no box for them — so they are measured off the font alone.
  //   The BRACKET's own terminals are already above under `barlineWings`; its rod is a rectangle.
  //   ⭐ `bracket` (U+E002) is the PRECOMPOSED bracket — rod and both serifs in one glyph. ⛔ We do
  //   NOT engrave it (the drawn sign is a rod plus the two tips, so it can span any staff height);
  //   it is the GHOST's, where a fixed box is correct by construction. Its BOX is needed so the
  //   ghost can be scaled to the brace's height rather than towering over it.
  groupings: ['brace', 'braceSmall', 'braceLarge', 'braceLarger', 'braceFlat', 'bracket'],
}

const REQUESTED = Object.values(GLYPHS).flat()

/**
 * `engravingDefaults` is taken whole rather than picked over — ⭐ all of it, because the set is tiny
 * and because *choosing* which weights to adopt is F3's decision to take in the open (plan §F3)
 * rather than one this script makes by omission.
 *
 * ⚠️ **Except that one of the 30 is not a measurement**: `textFontFamily` is a font STACK
 * (`["Academico", "Century Schoolbook", …]`). It is dropped and reported, so that
 * `engravingDefault()` can promise a number in staff spaces to every caller.
 */
const isWeight = value => typeof value === 'number'

// ─────────────────────────────────────────────────────────────────────────────

/** Staff spaces, to the precision the font can actually express. */
const round = value => Number(value.toFixed(3))

function read(path, what) {
  try {
    return readFileSync(path)
  } catch {
    console.error(`\n⛔ Cannot read ${path} — ${what}.`)
    if (path === METADATA) {
      console.error('   It is vendored, not fetched. See scripts/vendor/PROVENANCE.md; to restore:')
      console.error(`   curl -sSL -o ${METADATA} \\`)
      console.error('     https://raw.githubusercontent.com/steinbergmedia/bravura/master/redist/Bravura.json')
    }
    process.exit(1)
  }
}

const font = opentype.parse(read(OTF, 'the font we engrave with').buffer)
const glyphNames = JSON.parse(read(GLYPHNAMES, "SMuFL's own name → codepoint map"))
const metadata = JSON.parse(read(METADATA, "Steinberg's metadata, for the anchors and the weights"))

/**
 * ⚠️ A staff space is a QUARTER of the em, not a constant — read it off the font rather than
 * hardcoding 250, so a font whose em is not 1000 cannot be measured wrongly and silently.
 */
const SPACE = font.unitsPerEm / 4

const boxes = {}
/** ⭐ The codepoint each measured glyph is at — SMuFL's own answer, so a CHARACTER can be resolved
 *  back to a measured box (P6: a scene holds the character a primitive drew, not its name). */
const codepoints = {}
const anchors = {}
const missing = []
const empty = []
const disagreements = []

/**
 * ⭐ Name → codepoint, and it takes TWO maps. `glyphnames.json` is SMuFL's recommended set;
 * **stylistic alternates are not in it** — they live in the font metadata's `optionalGlyphs`
 * (the brace variants at U+F400–F403). ⛔ Reaching them by hardcoding a codepoint here would put
 * the one number this script exists to *read* back into the script.
 */
const codepointOf = name => glyphNames[name]?.codepoint ?? metadata.optionalGlyphs?.[name]?.codepoint

for (const name of REQUESTED) {
  const entry = codepointOf(name) ? { codepoint: codepointOf(name) } : undefined
  if (!entry) {
    missing.push(`${name} — no such name in glyphnames.json, nor in the metadata's optionalGlyphs`)
    continue
  }
  const codepoint = parseInt(entry.codepoint.replace('U+', ''), 16)
  const glyph = font.charToGlyph(String.fromCodePoint(codepoint))
  // ⚠️ `charToGlyph` NEVER fails: an unmapped codepoint comes back as glyph 0, `.notdef`, which has
  //   a box like any other glyph. Believing it would put a made-up rectangle in the table under a
  //   real name — so the index is checked, not the result.
  if (!glyph || glyph.index === 0) {
    missing.push(`${name} (${entry.codepoint}) — not in ${OTF}`)
    continue
  }
  const box = glyph.getBoundingBox()
  if (box.x1 === 0 && box.x2 === 0 && box.y1 === 0 && box.y2 === 0) {
    empty.push(`${name} (${entry.codepoint}) — the glyph exists but draws no ink`)
    continue
  }

  codepoints[name] = codepoint
  boxes[name] = {
    left: round(-box.x1 / SPACE),
    right: round(box.x2 / SPACE),
    up: round(box.y2 / SPACE),
    down: round(-box.y1 / SPACE),
    advance: round(glyph.advanceWidth / SPACE),
  }

  // ⭐ The cross-check (plan §4.2): does the font we ship agree with the metadata we vendored?
  const published = metadata.glyphBBoxes[name]
  if (published) {
    const [right, up] = published.bBoxNE
    const [left, down] = published.bBoxSW
    const drift = Math.max(
      Math.abs(right - boxes[name].right),
      Math.abs(up - boxes[name].up),
      Math.abs(-left - boxes[name].left),
      Math.abs(-down - boxes[name].down),
    )
    if (drift > 0.001) disagreements.push(`${name} — off by ${drift.toFixed(3)} spaces`)
  } else {
    disagreements.push(`${name} — the metadata has no box for it at all`)
  }

  const anchorSet = metadata.glyphsWithAnchors[name]
  if (anchorSet) {
    anchors[name] = Object.fromEntries(
      Object.entries(anchorSet).map(([which, [x, y]]) => [which, [round(x), round(y)]]),
    )
  }
}

if (missing.length) {
  console.error(`\n⛔ ${missing.length} requested glyph(s) could not be measured — nothing written:`)
  for (const line of missing) console.error(`   · ${line}`)
  console.error('\n   Fix the list in this script, or the input files. A partial table is worse than none.')
  process.exit(1)
}

const defaults = Object.fromEntries(
  Object.entries(metadata.engravingDefaults).filter(([, value]) => isWeight(value)),
)
const notWeights = Object.entries(metadata.engravingDefaults)
  .filter(([, value]) => !isWeight(value))
  .map(([name, value]) => `${name} = ${JSON.stringify(value)}`)
const names = Object.keys(boxes)

/**
 * ⭐⭐ **WHAT THE CROSS-CHECK FOUND, WRITTEN INTO THE FILE IT CHECKED.**
 *
 * ⛔ Not a fixed sentence. This header used to say *"found them identical to 0.001 spaces for all N
 * glyphs"* whatever the run actually reported — so the first glyph that disagreed (`brace`, when the
 * left-edge signs were added) left the file **asserting the opposite of its own run**. A comment that
 * a reader can catch lying is worse than no comment: it teaches them to skip the next one
 * (`docs/plans/font-metrics-plan.md`, and the same lesson as `satisfies Record<keyof T, true>`).
 */
const crossCheckReport = disagreements.length === 0
  ? ` * ⭐ All ${names.length} boxes agree to within 0.001 spaces, so the version skew is recorded\n` +
    ` * rather than papered over — and the cross-check is what says it is harmless.`
  : ` * 🚨 **${disagreements.length} of ${names.length} DISAGREE** — the rest are identical to within 0.001 spaces:\n` +
    disagreements.map(d => ` *   · ${d}`).join('\n') + '\n' +
    ` *\n * ⚠️ The numbers below are the **OTF's**, because that is the file we draw with. Where a glyph\n` +
    ` * is listed above, ⛔ do not reach for the metadata's figure to "correct" it — it would describe\n` +
    ` * a Bravura this editor does not ship.`


// ─────────────────────────────────────────────────────────────────────────────

/** House style: single quotes, and an identifier-safe key is left bare. */
const str = value => `'${String(value).replace(/'/g, "\\'")}'`
const quote = name => (/^[A-Za-z_$][\w$]*$/.test(name) ? name : str(name))
const asBox = box => `{ left: ${box.left}, right: ${box.right}, up: ${box.up}, down: ${box.down}, advance: ${box.advance} }`

const boxLines = Object.entries(GLYPHS)
  .map(([group, list]) => {
    const rows = list
      .filter(name => boxes[name])
      .map(name => `  ${quote(name)}: ${asBox(boxes[name])},`)
      .join('\n')
    return `  // ${group}\n${rows}`
  })
  .join('\n')

const codepointLines = Object.entries(GLYPHS)
  .map(([group, list]) => {
    const rows = list
      .filter(name => codepoints[name] !== undefined)
      .map(name => `  ${quote(name)}: ${codepoints[name]},`)
      .join('\n')
    return `  // ${group}\n${rows}`
  })
  .join('\n')

const anchorLines = Object.entries(anchors)
  .map(([name, set]) => {
    const rows = Object.entries(set)
      .map(([which, [x, y]]) => `${quote(which)}: [${x}, ${y}]`)
      .join(', ')
    return `  ${quote(name)}: { ${rows} },`
  })
  .join('\n')

const defaultLines = Object.entries(defaults)
  .map(([name, value]) => `  ${quote(name)}: ${value},`)
  .join('\n')

const revision = font.tables.head?.fontRevision

const source = `/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** \`node scripts/generate-font-metrics.mjs\`
 *
 * ${names.length} of Bravura's ${Object.keys(metadata.glyphBBoxes).length} glyphs: the ones the editor draws
 * (\`docs/plans/font-metrics-plan.md\` F1). Hand-editing a number here would recreate by hand the very
 * drift the file exists to end — change the glyph list in the script and re-run.
 *
 * ⭐ **Boxes measured from \`public/fonts/Bravura.otf\`** — the font we engrave with and outline for
 * the PDF — and cross-checked against Steinberg's published metadata. Anchors and engraving
 * defaults come from that metadata, which is the only place they exist.
 *
 * Bravura — OTF ${revision}, metadata ${metadata.fontVersion}. SIL OFL 1.1.
 * Sources: \`public/fonts/OFL.txt\`, \`scripts/vendor/PROVENANCE.md\`.
 */

import type { GlyphBox } from './fontMetrics'

/**
 * Bravura, as we have it — stamped so a regeneration that moves numbers is visible in a diff.
 *
 * ⚠️ **TWO versions, and they are not the same number.** The font file we ship and measure is
 * ${revision}; Steinberg's metadata, which supplies the anchors and the weights below, is
 * ${metadata.fontVersion}. The generator cross-checks every box against that metadata, and this is what
 * that check found on the run that wrote this file:
 *
${crossCheckReport}
 */
export const BRAVURA = {
  name: ${str(metadata.fontName)},
  /** \`head.fontRevision\` of \`public/fonts/Bravura.otf\` — the boxes are measured from this. */
  otfRevision: ${revision},
  /** \`fontVersion\` of \`scripts/vendor/Bravura.json\` — the anchors and defaults come from this. */
  metadataVersion: ${JSON.stringify(metadata.fontVersion)},
} as const

/**
 * ⭐ **Every glyph we have a box for**, as a closed union — so a typo is a compile error and
 * {@link glyphBox} never has to answer for a name that does not exist.
 */
export type GlyphName =
${names.map(name => `  | ${str(name)}`).join('\n')}

/** The ink each glyph draws, in staff spaces from its own origin. See {@link GlyphBox}. */
export const GLYPH_BOXES: Record<GlyphName, GlyphBox> = {
${boxLines}
}

/**
 * ⭐⭐ **WHICH CODEPOINT EACH MEASURED GLYPH IS** — SMuFL's own \`glyphnames.json\`, read rather than
 * transcribed, and emitted so the map can be inverted.
 *
 * ⚠️ **P6 is why this exists.** A SCENE records the CHARACTER a text primitive drew, ⛔ not the name
 * it was looked up by — so computing that primitive's ink box needs the way back. \`glyphNameOf()\`
 * in \`./fontMetrics\` is that inversion, and it answers **null** for a codepoint we have not
 * measured, ⛔ never a plausible box.
 */
export const GLYPH_CODEPOINTS: Record<GlyphName, number> = {
${codepointLines}
}

/**
 * ⭐ **P3's prerequisite**: where a stem meets a head, where a flag hangs, where a dot tucks in —
 * \`[x, y]\` in staff spaces from the glyph's origin, y UP.
 *
 * ⚠️ Partial on purpose: most glyphs have no anchors, and {@link anchor} returns null for them
 * rather than a plausible \`[0, 0]\`.
 */
export const GLYPH_ANCHORS: Partial<Record<GlyphName, Record<string, readonly [number, number]>>> = {
${anchorLines}
}

/**
 * SMuFL's \`engravingDefaults\` — the font's own statement of how thick every structural line is.
 * ${Object.keys(defaults).length} of them, in staff spaces.
 *
 * ⚠️ ${notWeights.length} of the font's ${Object.keys(metadata.engravingDefaults).length} is not a measurement and is not here: \`${notWeights.join('`, `')}\`.
 */
export const ENGRAVING_DEFAULTS = {
${defaultLines}
} as const
`

writeFileSync(OUT, source)

// ─────────────────────────────────────────────────────────────────────────────
// ⭐ The report. What we took, and — the part that matters — what we did not.

const total = Object.keys(metadata.glyphBBoxes).length
console.log(`\n${OUT}`)
console.log(`  em ${font.unitsPerEm}, staff space ${SPACE} units`)
if (String(revision) !== String(metadata.fontVersion)) {
  console.log(`  ⚠️ VERSION SKEW: the OTF we measure is ${revision}, the metadata is ${metadata.fontVersion}.`)
  console.log('     Not an error — the cross-check below is what decides whether it matters.')
} else {
  console.log(`  Bravura ${revision}, font and metadata agreed on the version`)
}
console.log(`  ⭐ ${names.length} glyphs emitted, ${total - names.length} of ${total} DROPPED — by group:`)
for (const [group, list] of Object.entries(GLYPHS)) {
  console.log(`     ${group.padEnd(16)} ${list.filter(name => boxes[name]).length}`)
}
console.log(`  ${Object.keys(anchors).length} of them carry anchors · ${Object.keys(defaults).length} engraving defaults`)
if (notWeights.length) {
  console.log(`  ⚠️ ${notWeights.length} engraving default(s) dropped for not being a measurement:`)
  for (const line of notWeights) console.log(`     · ${line}`)
}

if (empty.length) {
  console.log(`  ⚠️ ${empty.length} requested glyph(s) draw no ink and were skipped:`)
  for (const line of empty) console.log(`     · ${line}`)
}

if (disagreements.length) {
  console.log(`  🚨 ${disagreements.length} glyph(s) where OUR font and the published metadata DISAGREE:`)
  for (const line of disagreements) console.log(`     · ${line}`)
  console.log('     Three copies of Bravura are in play (plan §4.2) — this says two of them differ.')
} else {
  console.log('  ✅ every box agrees with Steinberg\'s published metadata to 0.001 spaces')
}
console.log()

// ─────────────────────────────────────────────────────────────────────────────
// ⭐⭐ THE OTHER FACES — Phase B1 of `docs/plans/music-font-switch-plan.md`.
//
// Everything above is Bravura, untouched: it is the DEFAULT, the table every spec is pinned to, and
// — here — every other face's FALLBACK. Each face below is measured the same way (boxes from the
// OTF we ship, anchors and weights from its own vendored metadata) into a table of the SAME shape,
// total over the same `GlyphName` union.
//
// ⭐ **A glyph the face lacks is not a refusal here: it is taken WHOLE from Bravura** — its box AND
// its anchors, because the DRAWING of that glyph is Bravura's too (`fonts/musicFont`'s stack puts
// Bravura behind the face). ⛔ Never a Bravura anchor on another face's outline, and never the
// reverse: a glyph the face DOES draw gets only the anchors its own metadata states.
// Every such row is DECLARED, in `FALLBACK_GLYPHS` and in the generated header. An engraving
// default the face does not state falls back the same way, into `FALLBACK_DEFAULTS`.
//
// ⚠️ An OPTIONAL glyph (Bravura's brace alternates, U+F400–F403) is looked up at BRAVURA'S
// codepoint: the drawing asks for that codepoint whatever the face, so the honest question is
// "what does this face draw THERE". Sebastian draws braces there (measured 2026-09-21: 4 sp tall,
// the same small→flat order) though its metadata does not name them; Leipzig draws nothing.

const OTHER_FACES = [
  {
    constant: 'LEIPZIG',
    otf: 'public/fonts/Leipzig.otf',
    metadata: 'scripts/vendor/Leipzig.json',
    out: 'src/engine/fonts/leipzigMetrics.ts',
    licence: 'public/fonts/Leipzig-OFL.txt',
  },
  {
    constant: 'SEBASTIAN',
    otf: 'public/fonts/Sebastian.otf',
    metadata: 'scripts/vendor/Sebastian.json',
    out: 'src/engine/fonts/sebastianMetrics.ts',
    licence: 'public/fonts/Sebastian-OFL.txt',
  },
]

for (const face of OTHER_FACES) {
  const faceFont = opentype.parse(read(face.otf, 'a music face the dev shell offers').buffer)
  const faceMetadata = JSON.parse(read(face.metadata, "the face's own SMuFL metadata"))
  const faceSpace = faceFont.unitsPerEm / 4

  const faceBoxes = {}
  const faceAnchors = {}
  const fallbackGlyphs = []
  const faceDisagreements = []

  for (const name of names) {
    const glyph = faceFont.charToGlyph(String.fromCodePoint(codepoints[name]))
    const box = glyph && glyph.index !== 0 ? glyph.getBoundingBox() : null
    const inkless = box && box.x1 === 0 && box.x2 === 0 && box.y1 === 0 && box.y2 === 0
    if (!box || inkless) {
      fallbackGlyphs.push(name)
      faceBoxes[name] = boxes[name]
      if (anchors[name]) faceAnchors[name] = anchors[name]
      continue
    }
    faceBoxes[name] = {
      left: round(-box.x1 / faceSpace),
      right: round(box.x2 / faceSpace),
      up: round(box.y2 / faceSpace),
      down: round(-box.y1 / faceSpace),
      advance: round(glyph.advanceWidth / faceSpace),
    }
    const published = faceMetadata.glyphBBoxes?.[name]
    if (published) {
      const [right, up] = published.bBoxNE
      const [left, down] = published.bBoxSW
      const drift = Math.max(
        Math.abs(right - faceBoxes[name].right),
        Math.abs(up - faceBoxes[name].up),
        Math.abs(-left - faceBoxes[name].left),
        Math.abs(-down - faceBoxes[name].down),
      )
      // ⚠️ 0.01, not Bravura's 0.001: these metadata files publish boxes to 2–3 places.
      if (drift > 0.01) faceDisagreements.push(`${name} — off by ${drift.toFixed(3)} spaces`)
    }
    const anchorSet = faceMetadata.glyphsWithAnchors?.[name]
    if (anchorSet) {
      faceAnchors[name] = Object.fromEntries(
        Object.entries(anchorSet).map(([which, [x, y]]) => [which, [round(x), round(y)]]),
      )
    }
  }

  const fallbackDefaults = []
  const faceDefaults = Object.fromEntries(Object.keys(defaults).map(name => {
    const stated = faceMetadata.engravingDefaults?.[name]
    if (isWeight(stated)) return [name, stated]
    fallbackDefaults.push(name)
    return [name, defaults[name]]
  }))

  const faceRevision = faceFont.tables.head?.fontRevision
  const group = lines => Object.entries(GLYPHS)
    .map(([title, list]) => `  // ${title}\n${list.filter(name => faceBoxes[name]).map(lines).join('\n')}`)
    .join('\n')
  const mark = name => (fallbackGlyphs.includes(name) ? ' // ← Bravura' : '')
  const list = items => (items.length ? items.map(item => `\`${item}\``).join(', ') : 'none')

  const faceSource = `/**
 * ⛔⛔ **GENERATED — DO NOT EDIT.** \`node scripts/generate-font-metrics.mjs\`
 *
 * ${faceMetadata.fontName}'s table for the ${names.length} glyphs the editor draws — the SAME shape as
 * \`bravuraMetrics.ts\`, total over the same \`GlyphName\` union, read by \`fontMetrics\` when the face is
 * the active one (\`fonts/musicFont\`, \`docs/plans/music-font-switch-plan.md\` Phase B).
 *
 * ⭐ **Boxes measured from \`${face.otf}\`**; anchors and engraving defaults from the face's own
 * metadata (\`${face.metadata}\`), which is the only place they exist.
 *
 * 🚨 **${fallbackGlyphs.length} glyph(s) this face does not draw are BRAVURA'S, whole** — box and anchors
 * together, because the drawing is Bravura's too (the font stack falls through to it):
 * ${list(fallbackGlyphs)}.
 * ⛔ A glyph the face DOES draw never borrows a Bravura anchor: it has what its own metadata states.
 *
 * ⚠️ Engraving defaults the face does not state, taken from Bravura: ${list(fallbackDefaults)}.
 *
 * ${faceDisagreements.length === 0
    ? `⭐ Every measured box that the face's metadata also publishes agrees with it to 0.01 spaces.`
    : `🚨 ${faceDisagreements.length} measured box(es) DISAGREE with the face's published metadata (the numbers below are the OTF's — the file we draw with):\n${faceDisagreements.map(d => ` *   · ${d}`).join('\n')}`}
 *
 * ${faceMetadata.fontName} — OTF ${faceRevision}, metadata ${faceMetadata.fontVersion}. SIL OFL 1.1.
 * Sources: \`${face.licence}\`, \`scripts/vendor/PROVENANCE.md\`.
 */

import type { GlyphBox } from './fontMetrics'
import type { GlyphName } from './bravuraMetrics'

export const ${face.constant} = {
  name: ${str(faceMetadata.fontName)},
  otfRevision: ${faceRevision},
  metadataVersion: ${JSON.stringify(faceMetadata.fontVersion)},
} as const

/** The glyphs below that are Bravura's, not this face's — drawn, measured and anchored in Bravura. */
export const FALLBACK_GLYPHS: readonly GlyphName[] = [${fallbackGlyphs.map(str).join(', ')}]

/** The engraving defaults below that this face's metadata does not state — Bravura's values. */
export const FALLBACK_DEFAULTS: readonly string[] = [${fallbackDefaults.map(str).join(', ')}]

export const GLYPH_BOXES: Record<GlyphName, GlyphBox> = {
${group(name => `  ${quote(name)}: ${asBox(faceBoxes[name])},${mark(name)}`)}
}

export const GLYPH_ANCHORS: Partial<Record<GlyphName, Record<string, readonly [number, number]>>> = {
${Object.entries(faceAnchors).map(([name, set]) =>
    `  ${quote(name)}: { ${Object.entries(set).map(([which, [x, y]]) => `${quote(which)}: [${x}, ${y}]`).join(', ')} },${mark(name)}`).join('\n')}
}

export const ENGRAVING_DEFAULTS = {
${Object.entries(faceDefaults).map(([name, value]) =>
    `  ${quote(name)}: ${value},${fallbackDefaults.includes(name) ? ' // ← Bravura' : ''}`).join('\n')}
} as const
`
  writeFileSync(face.out, faceSource)

  console.log(face.out)
  console.log(`  ${faceMetadata.fontName} OTF ${faceRevision}, metadata ${faceMetadata.fontVersion} · em ${faceFont.unitsPerEm}`)
  console.log(`  ⭐ ${names.length - fallbackGlyphs.length} glyphs measured · ${fallbackGlyphs.length} from Bravura: ${fallbackGlyphs.join(', ') || '—'}`)
  console.log(`  ${Object.keys(faceAnchors).length} carry anchors · defaults from Bravura: ${fallbackDefaults.join(', ') || '—'}`)
  if (faceDisagreements.length) {
    console.log(`  🚨 ${faceDisagreements.length} box(es) disagree with the face's own metadata:`)
    for (const line of faceDisagreements) console.log(`     · ${line}`)
  }
  console.log()
}
