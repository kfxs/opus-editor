/**
 * The single source of truth for dynamics.
 *
 * A dynamic IS its `text` (docs/dynamics-text-as-truth-plan.md): a string that mixes SMuFL
 * dynamics glyphs (the `f`/`p`/… drawn in the music font — the *actual* dynamic, the level) with
 * plain expression words (`dolce`, `con brio`). The distinction is the FONT, not the spelling: a
 * `p` stored as the SMuFL glyph is piano; a `p` typed as plain text is just a letter and stays
 * silent. This module owns both the glyph⇄letter mapping and the meaning axis (glyph run → level →
 * loudness). The scope axis lives on `Dynamic.voice`.
 *
 * No consumer should hardcode the set of dynamics — derive it from DYNAMIC_VELOCITY (and the
 * DynamicLevel union) so adding a level is one row.
 */
import { TextDynamics } from 'vexflow'
import type { Dynamic, DynamicLevel, Score } from '@/types/music'
import { fracCompare, fracLte, fracGt } from './fraction'

/**
 * Interpreted level → Tone.js normalized velocity (0..1), used as the 4th arg of
 * `triggerAttackRelease(name, dur, time, velocity)`. NOT decibels.
 *
 * Add a row here when extending the DynamicLevel union; playback and any
 * level-aware UI read from this table rather than a private list.
 */
export const DYNAMIC_VELOCITY: Record<DynamicLevel, number> = {
  p: 0.25,
  mp: 0.45,
  mf: 0.7,
  f: 1.0,
}

/** The level assumed before any interpreted dynamic appears. */
export const DEFAULT_DYNAMIC: DynamicLevel = 'mf'

/** Placeholder text a freshly-placed EXPRESSION (the `text` palette tool) carries until the
 *  user types over it. Only exists so the mark renders a real box to edit against. */
export const DEFAULT_DYNAMIC_TEXT = 'Text'

// ---------------------------------------------------------------------------
// Glyph ⇄ letter (the "is this the dynamic font?" boundary)
// ---------------------------------------------------------------------------

/**
 * Per-letter SMuFL codepoints for dynamics (`p`/`m`/`f`/`s`/`z`/`r`), from VexFlow's TextDynamics.
 * These are the characters that ARE the dynamic font — a level is spelled with them, never with the
 * plain ASCII letters. A multi-letter level like `mp` is stored as the two letters' glyphs
 * concatenated; {@link composeDynamicGlyphs} swaps that for a single precomposed glyph at DRAW time.
 */
const LETTER_TO_GLYPH = TextDynamics.GLYPHS as Record<string, string | undefined>

/** SMuFL glyph char → its ASCII letter (the inverse of {@link LETTER_TO_GLYPH}). */
const GLYPH_TO_LETTER: Record<string, string> = Object.fromEntries(
  Object.entries(LETTER_TO_GLYPH)
    .filter(([, glyph]) => typeof glyph === 'string')
    .map(([letter, glyph]) => [glyph as string, letter]),
)

/** Map a run of ASCII dynamic letters (e.g. 'mf') to its SMuFL glyph string. Used to MINT a glyph
 *  (placing a level from the palette, or seeding the editor); per-character, so idempotent on chars
 *  that are already glyphs. */
export function levelToGlyphString(run: string): string {
  return [...run].map(ch => LETTER_TO_GLYPH[ch] ?? ch).join('')
}

/** Turn SMuFL dynamic glyph chars back into their ASCII letters, leaving everything else untouched
 *  — used to READ a glyph run's level, never to change what's stored. */
export function glyphsToLetters(text: string): string {
  return [...text].map(ch => GLYPH_TO_LETTER[ch] ?? ch).join('')
}

/** True when a character IS a SMuFL dynamics glyph (the dynamic font) — the sole test for whether
 *  a character is part of a level. A plain ASCII 'p' is NOT one, so typed text is never a level. */
function isDynamicGlyphChar(ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(GLYPH_TO_LETTER, ch)
}

/** The `text` a palette tool places: the SMuFL glyph for a level tool (so it's a real dynamic, in
 *  the dynamic font), or the placeholder for the free-text `text` tool. */
export function dynamicTextFromTool(tool: DynamicLevel | 'text'): string {
  return tool === 'text' ? DEFAULT_DYNAMIC_TEXT : levelToGlyphString(tool)
}

// ---------------------------------------------------------------------------
// Precomposed glyphs (a ligature — DRAW-time only, never stored)
// ---------------------------------------------------------------------------

/**
 * Bravura draws each dynamics letter at the advance that suits it STANDING ALONE, and provides
 * separate precomposed glyphs for the combinations. For `p` the two agree (~347 combined vs 365
 * solo — 18 units apart, invisible), but for `f` they do not: precomposed adds ~240 per extra `f`
 * where concatenation adds 364, so a hand-assembled `fff` is 1092 units against the real glyph's
 * 831 — a ~5px gap after every `f` at engraving size. Hence this table.
 *
 * This is exactly an `fi` ligature, and the font would normally apply it for us — but the Bravura
 * VexFlow bundles has NO GSUB table at all (Bravura *Text* is the one with the ligature features),
 * so we substitute by hand.
 *
 * Codepoints are written out rather than read from VexFlow's `Glyphs` map ON PURPOSE. `Glyphs` is
 * exported by VexFlow's CJS build but NOT its ESM one (`src/index.js` never re-exports
 * `glyphs.js`), and the package's exports map sends bundlers to ESM — so a `Glyphs` lookup is
 * populated under Node/Vitest and EMPTY in the browser. That divergence is invisible to a unit
 * test: it passes while the app silently falls back to loose concatenation. Codepoints are
 * SMuFL-standard and stable, so owning them here removes the split entirely.
 *
 * Verified present in the Bravura that VexFlow bundles by reading the font's cmap directly.
 */
const PRECOMPOSED_MAP: Record<string, string> = {
  pp:     '\uE52B', // dynamicPP
  ppp:    '\uE52A', // dynamicPPP
  pppp:   '\uE529', // dynamicPPPP
  ppppp:  '\uE528', // dynamicPPPPP
  pppppp: '\uE527', // dynamicPPPPPP
  ff:     '\uE52F', // dynamicFF
  fff:    '\uE530', // dynamicFFF
  ffff:   '\uE531', // dynamicFFFF
  fffff:  '\uE532', // dynamicFFFFF
  ffffff: '\uE533', // dynamicFFFFFF
  mp:     '\uE52C', // dynamicMP
  mf:     '\uE52D', // dynamicMF
  pf:     '\uE52E', // dynamicPF
  fp:     '\uE534', // dynamicFortePiano
  fz:     '\uE535', // dynamicForzando
  sf:     '\uE536', // dynamicSforzando1
  sfp:    '\uE537', // dynamicSforzandoPiano
  sfpp:   '\uE538', // dynamicSforzandoPianissimo
  sfz:    '\uE539', // dynamicSforzato
  sfzp:   '\uE53A', // dynamicSforzatoPiano
  sffz:   '\uE53B', // dynamicSforzatoFF
  rf:     '\uE53C', // dynamicRinforzando1
  rfz:    '\uE53D', // dynamicRinforzando2
}

/** The table, longest key first so a greedy scan prefers `sfz` over `sf` + `z`. */
export const PRECOMPOSED: ReadonlyArray<[letters: string, glyph: string]> =
  Object.entries(PRECOMPOSED_MAP).sort((a, b) => b[0].length - a[0].length)

/**
 * Swap a run of dynamics glyphs for Bravura's precomposed equivalents — `𝆑𝆑𝆑` (three chars) becomes
 * the single `dynamicFFF`. Greedy longest-match, so `sfz` draws as one `dynamicSforzato` rather
 * than `sf` + `z`; anything with no precomposed glyph falls through as its own letter glyph, which
 * is exactly today's behaviour.
 *
 * PURELY PRESENTATIONAL — call it when writing glyphs into the DOM, never before storing. The model
 * keeps one char per letter so {@link parseDynamicText} can still read a level off the run and the
 * text editor can still add and backspace one letter at a time.
 */
export function composeDynamicGlyphs(glyphRun: string): string {
  const letters = glyphsToLetters(glyphRun)
  let out = ''
  let i = 0
  while (i < letters.length) {
    const hit = PRECOMPOSED.find(([combo]) => letters.startsWith(combo, i))
    if (hit) {
      out += hit[1]
      i += hit[0].length
    } else {
      // Not part of any combination (a lone letter, or a char that was never a glyph) — as-is.
      out += levelToGlyphString(letters[i])
      i++
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Runs + interpretation
// ---------------------------------------------------------------------------

/** One fragment of a dynamic string. A `glyph` run is a maximal span of SMuFL dynamics-glyph
 *  characters (drawn big in the music font); every other run — words, spaces, ASCII — is text
 *  (drawn as italic expression text). Concatenating the runs' `text` reproduces the input. */
export interface DynamicRun {
  glyph: boolean
  text: string
}

/**
 * Split a dynamic's text into glyph/text runs by whether each character IS a dynamics glyph
 * (the dynamic font), NOT by spelling. This is the crux of the model: `più 𝆑` splits into the word
 * `più ` and the glyph `𝆑`, while a plain-text `p` is a text run — so typing `p` never becomes
 * piano. Drives BOTH rendering (font per run) and interpretation ({@link parseDynamicText}).
 */
export function splitDynamicRuns(text: string): DynamicRun[] {
  const runs: DynamicRun[] = []
  for (const ch of [...text]) {
    const glyph = isDynamicGlyphChar(ch)
    const last = runs[runs.length - 1]
    if (last && last.glyph === glyph) last.text += ch
    else runs.push({ glyph, text: ch })
  }
  return runs
}

/**
 * Read a dynamic's text back into { the text, the level it plays }. The level is the FIRST glyph
 * run whose letters name a recognized level (a key of {@link DYNAMIC_VELOCITY}) — so it may be a
 * prefix (`più f`), a suffix (`f con brio`) or the whole mark (`mp`). Absent if no glyph run names
 * one (a pure expression, or an unmapped glyph like `sfz`). The level is always DERIVED, never stored.
 */
export function parseDynamicText(text: string): { text: string; level?: DynamicLevel } {
  for (const run of splitDynamicRuns(text)) {
    if (!run.glyph) continue
    const letters = glyphsToLetters(run.text)
    if (Object.prototype.hasOwnProperty.call(DYNAMIC_VELOCITY, letters)) {
      return { text, level: letters as DynamicLevel }
    }
  }
  return { text }
}

/** The level a dynamic PLAYS, derived from its text (text-as-truth). */
export function dynamicLevelOf(d: Dynamic): DynamicLevel | undefined {
  return parseDynamicText(d.text).level
}

/**
 * Whether a dynamic affects playback: its text contains a glyph run naming a recognized level.
 * A pure expression (`dolce`) or an unmapped glyph (`sfz`) is silent — it carries the previous level.
 */
export function isInterpreted(d: Dynamic): boolean {
  return dynamicLevelOf(d) !== undefined
}

/** The string a dynamic displays — its text (the truth), glyphs and words verbatim. */
export function dynamicLabel(d: Dynamic): string {
  return d.text
}

/** The voice a dynamic governs (default 0). */
export function dynamicVoice(d: Dynamic): number {
  return d.voice ?? 0
}

/** Dynamics of a measure, sorted ascending by beat (empty if none). */
export function measureDynamics(score: Score, measureNumber: number): Dynamic[] {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure?.dynamics?.length) return []
  return [...measure.dynamics].sort((a, b) => fracCompare(a.beat, b.beat))
}

/**
 * The interpreted dynamic level in effect at (measureNumber, beat) for `voice`:
 * the last interpreted dynamic at-or-before that position in the same voice,
 * walking back across earlier measures (mirrors clefUtils.inheritedClef), else
 * DEFAULT_DYNAMIC. Text dynamics are skipped — they carry the previous level.
 *
 * This is the *correctness* reference. Sequential playback uses an incremental
 * single-pass scan (Phase 3) instead of walking back per chord.
 */
export function resolveActiveLevel(
  score: Score,
  measureNumber: number,
  beat: Dynamic['beat'],
  voice: number = 0,
): DynamicLevel {
  // This measure: latest interpreted dynamic in this voice with beat <= target.
  const here = measureDynamics(score, measureNumber)
  for (let i = here.length - 1; i >= 0; i--) {
    const d = here[i]
    if (dynamicVoice(d) === voice && isInterpreted(d) && fracLte(d.beat, beat)) {
      return dynamicLevelOf(d)!
    }
  }
  // Earlier measures: latest interpreted dynamic in this voice (any beat).
  for (let n = measureNumber - 1; n >= 1; n--) {
    const earlier = measureDynamics(score, n)
    for (let i = earlier.length - 1; i >= 0; i--) {
      const d = earlier[i]
      if (dynamicVoice(d) === voice && isInterpreted(d)) {
        return dynamicLevelOf(d)!
      }
    }
  }
  return DEFAULT_DYNAMIC
}

/**
 * Resolve the interpreted level governing **every chord** in the score, in a
 * single in-order pass (the playback step-function). Returns `chord.id → level`.
 *
 * This is the O(n) sequential equivalent of calling {@link resolveActiveLevel}
 * per chord: a running per-voice level is carried forward across measures rather
 * than walked back each time. Rests carry no sound and are skipped. The result
 * matches `resolveActiveLevel` for every chord (asserted in tests).
 */
export function resolveChordLevels(score: Score): Map<string, DynamicLevel> {
  const out = new Map<string, DynamicLevel>()
  const activeLevels = new Map<number, DynamicLevel>()

  for (const measure of score.measures) {
    const measureDyns = (measure.dynamics ?? [])
      .filter(isInterpreted)
      .sort((a, b) => fracCompare(a.beat, b.beat))

    for (const slot of measure.slots) {
      if (slot.type !== 'chord') continue
      const voice = slot.voice ?? 0
      let level: DynamicLevel = activeLevels.get(voice) ?? DEFAULT_DYNAMIC
      for (const d of measureDyns) {
        if (fracGt(d.beat, slot.beat)) break // sorted: nothing later qualifies
        if ((d.voice ?? 0) === voice) level = dynamicLevelOf(d)!
      }
      out.set(slot.id, level)
    }

    // Carry each voice's last (highest-beat) dynamic forward to later measures.
    for (const d of measureDyns) {
      activeLevels.set(d.voice ?? 0, dynamicLevelOf(d)!)
    }
  }

  return out
}
