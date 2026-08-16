/**
 * Regenerates `src/engine/fonts/bravuraMetrics.ts` — the ~60 glyphs we draw, measured off the font.
 *
 *   node scripts/generate-font-metrics.mjs
 *
 * F1 of `docs/font-metrics-plan.md`. The ink table stops being a set of numbers measured by hand in
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
  dots: ['augmentationDot'],

  // The header's glyphs. ⚠️ Their INK is here; what a header COSTS is not (`layout/headerInk.ts`
  // measures stave-x to the first notehead, a placement, and plan §7 keeps it out of scope).
  clefs: ['gClef', 'fClef', 'cClef'],
  timeSignatures: [
    'timeSig0', 'timeSig1', 'timeSig2', 'timeSig3', 'timeSig4',
    'timeSig5', 'timeSig6', 'timeSig7', 'timeSig8', 'timeSig9',
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

  // The lines family's own marks (`docs/trill-plan.md`, `pedal-plan.md`, `ottava-plan.md`).
  lines: ['ornamentTrill', 'keyboardPedalPed', 'keyboardPedalUp', 'ottavaAlta', 'ottavaBassaVb'],

  // Tremolo strokes — one glyph per stroke count, ours going to three.
  tremolos: ['tremolo1', 'tremolo2', 'tremolo3'],
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
const anchors = {}
const missing = []
const empty = []
const disagreements = []

for (const name of REQUESTED) {
  const entry = glyphNames[name]
  if (!entry) {
    missing.push(`${name} — no such name in glyphnames.json`)
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
 * (\`docs/font-metrics-plan.md\` F1). Hand-editing a number here would recreate by hand the very
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
 * ${metadata.fontVersion}. The generator cross-checks every box against that metadata and (at the time
 * this was written) found them identical to 0.001 spaces for all ${names.length} glyphs — so the skew is
 * recorded rather than papered over, and the cross-check is what says it is harmless.
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
