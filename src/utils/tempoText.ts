/**
 * The tempo mark's TEXT — the thing that is printed, and the thing you edit.
 *
 * A tempo mark is a piece of text ('Moderato ♩ = 112 sempre'), and the program READS the speed out
 * of what you typed. That is the Sibelius model, and it is the only one that can't lie: the
 * number you can see is the number that plays, the brackets you deleted stay deleted, and words
 * after the metronome stay after it — because the string is stored as you typed it and nothing
 * ever rebuilds it from pieces.
 *
 * So this module is small on purpose. Two directions:
 * - {@link parseTempoText} — the typed string → the SPEED it states ({unit, dots, bpm}), plus the
 *   string normalized (a typed 'q' becomes a real ♩). The string itself is the mark's text.
 * - {@link composeTempoText} — the palette's arming state → the string it should place.
 *
 * ## What counts as a metronome
 *
 * `<unit><dots> = <number>`, anywhere in the string, brackets or no brackets:
 *
 *     Allegro (♩ = 144)   Moderato ♩ = 112 sempre   ♩. = 60   q = 120   Allegro
 *
 * The unit may be the printed glyph (♩) or a typed shorthand ('q', '8'), because you cannot type
 * ♩ on a keyboard — Sibelius makes you insert it from a palette; we take either and print the
 * glyph. A string with no metronome in it is simply a word or a phrase.
 */
import type { NoteDuration, TempoMark } from '@/types/music'
import { MIN_BPM, MAX_BPM } from './tempoMap'

/**
 * How each unit is PRINTED. The renderer engraves these as real music glyphs (TempoLayout).
 *
 * ⭐ The Unicode note character where Unicode has one (𝅜 … 𝅘𝅥𝅲, down to the 128th). The 256th and 512th
 * have none, so they print as SMuFL's own metronome glyph, which the renderer then maps to itself.
 * ⚠️ The LONGA is `null`: neither Unicode nor SMuFL cuts a longa for running text — a tempo mark cannot
 * say one (docs/plans/other-durations-plan.md P1). Read it through {@link unitGlyph}.
 */
export const UNIT_GLYPH: Record<NoteDuration, string | null> = {
  longa: null,
  breve: '\u{1D15C}', // MUSICAL SYMBOL BREVE
  w: '𝅝', h: '𝅗𝅥', q: '♩', '8': '♪', '16': '𝅘𝅥𝅯', '32': '𝅘𝅥𝅰',
  '64': '\u{1D163}',  // MUSICAL SYMBOL SIXTY-FOURTH NOTE
  '128': '\u{1D164}', // MUSICAL SYMBOL ONE HUNDRED TWENTY-EIGHTH NOTE
  '256': '\uECB1',    // metNote256thUp — no Unicode character
  '512': '\uECB3',    // metNote512thUp — no Unicode character
}

/**
 * The printed unit of a metronome mark — ⚠️ throws for a unit no tempo text can spell (today the longa),
 * rather than printing `null` into a score. Nothing the editor arms or parses yields one.
 */
export function unitGlyph(unit: NoteDuration): string {
  const glyph = UNIT_GLYPH[unit]
  if (glyph === null) throw new Error(`[tempoText] no printed metronome unit for "${unit}"`)
  return glyph
}

/**
 * The same note values as SMuFL's **metronome-mark** glyphs — the ones cut to sit INLINE with text.
 *
 * Not the same thing as the noteheads the staff is engraved from (`noteQuarterUp`, U+E1D5): those are
 * drawn against a staff and are sized for one, so dropped into a line of text they tower over it. The
 * `metNote…` family (U+ECA0–ECB7) is the text-sized cut, and it is what every mark that says a note
 * value in RUNNING TEXT uses — a metronome mark, and a tuplet's "ratio + note".
 *
 * ⚠️ The LONGA is `null` — SMuFL has no `metNote` longa (the family runs from the double whole to the
 * 1024th). ⭐ The breve is the ROUND cut, `metNoteDoubleWhole`; the square one is a style row for later.
 * Codepoints written out: these are SMuFL standard and do not move.
 */
export const MET_NOTE_GLYPH: Record<NoteDuration, string | null> = {
  longa: null,
  breve: '\uECA0', // metNoteDoubleWhole
  w: '\uECA2',   // metNoteWhole
  h: '\uECA3',   // metNoteHalfUp
  q: '\uECA5',   // metNoteQuarterUp
  '8': '\uECA7',  // metNote8thUp
  '16': '\uECA9', // metNote16thUp
  '32': '\uECAB', // metNote32ndUp
  '64': '\uECAD',  // metNote64thUp
  '128': '\uECAF', // metNote128thUp
  '256': '\uECB1', // metNote256thUp
  '512': '\uECB3', // metNote512thUp
}

/** The dot that goes with them — metAugmentationDot, not an ASCII full stop. */
export const MET_AUGMENTATION_DOT = '\uECB7'

/**
 * Everything accepted AS a unit — printed glyph or typed shorthand. Longest-first matters for the
 * alternation: '16' must be tried before '1', '128' before its '8', and the multi-code-unit glyphs (𝅗𝅥 is
 * a surrogate pair) before the single ones.
 *
 * ⭐ The PRINTED half is {@link UNIT_GLYPH} itself, longest first — every unit a mark can print, it can read
 * back (docs/plans/other-durations-plan.md P5: the breve and the 64th … 512th joined). ⛔ Never the longa,
 * which nothing prints. The TYPED shorthands are this list's own.
 */
const UNIT_ALIASES: ReadonlyArray<readonly [string, NoteDuration]> = [
  ...(Object.keys(UNIT_GLYPH) as NoteDuration[])
    .flatMap(d => { const g = UNIT_GLYPH[d]; return g === null ? [] : [[g, d] as const] })
    .sort(([a], [b]) => b.length - a.length),
  ['breve', 'breve'], ['whole', 'w'], ['half', 'h'], ['quarter', 'q'], ['eighth', '8'],
  ['512', '512'], ['256', '256'], ['128', '128'], ['64', '64'],
  ['16', '16'], ['32', '32'], ['8', '8'], ['w', 'w'], ['h', 'h'], ['q', 'q'], ['e', '8'],
]

/**
 * `♩. = 144` / `q=144` / `𝅗𝅥 . = 60` — the unit, its dots, and the number.
 *
 * The unit must not be glued to a letter (`(?<!\p{L})`), or the shorthands eat the ends of words:
 * without it, 'Andante = 120' matches its trailing 'e' as the eighth-note shorthand and leaves the
 * word 'Andant'.
 */
const METRONOME = new RegExp(
  `(?<!\\p{L})(${UNIT_ALIASES.map(([alias]) => escapeRegExp(alias)).join('|')})` + // unit
  `\\s*(\\.*)` +                                                                   // dots
  `\\s*=\\s*` +
  `(\\d+(?:\\.\\d+)?)`,                                                            // bpm
  'iu',
)

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** What a parse produced: the mark's text + the speed it states, or WHY it can't become a mark. */
type ParsedTempo =
  | {
      ok: true
      /** The string to STORE and print — as typed, with any shorthand unit turned into its glyph. */
      text: string
      /** The speed it states. All absent when the string is just a word or a phrase. */
      unit?: NoteDuration
      dots?: number
      bpm?: number
    }
  /** The string says nothing at all. The mark should go. */
  | { ok: false; reason: 'empty' }
  /** A metronome IS there but its number is nonsense (0, 5000) — reject, don't guess. */
  | { ok: false; reason: 'bpm-out-of-range'; bpm: number }

/**
 * Read a typed string into a mark: keep the string, extract the speed.
 *
 * `prev` is consulted for exactly one thing — **an edit can only delete what it could SEE.** A
 * word that sounds without printing its number ('Allegro', quietly 144) shows the user no
 * metronome, so retyping that word must not wipe the bpm that was never on screen. But a
 * metronome that WAS printed and is now gone from the string was really deleted, and the mark
 * stops stating a speed.
 */
export function parseTempoText(input: string, prev?: TempoMark): ParsedTempo {
  const text = input.trim().replace(/\s+/g, ' ')
  if (!text) return { ok: false, reason: 'empty' }

  const match = METRONOME.exec(text)

  if (!match) {
    // No metronome in the string. Did the previous one have a VISIBLE metronome to delete?
    const wasPrinted = prev?.text !== undefined && METRONOME.test(prev.text)
    return wasPrinted || prev?.bpm === undefined
      ? { ok: true, text } // deleted (or never had one): no speed statement
      : { ok: true, text, unit: prev.unit, dots: prev.dots, bpm: prev.bpm } // never on screen: keep it sounding
  }

  const [whole, alias, dots, digits] = match
  const bpm = Number(digits)
  if (!Number.isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
    return { ok: false, reason: 'bpm-out-of-range', bpm }
  }

  const unit = UNIT_ALIASES.find(([a]) => a.toLowerCase() === alias.toLowerCase())?.[1] ?? 'q'

  // Print what was typed — but with the unit as a real glyph, so 'q = 120' engraves as '♩ = 120'.
  const printed = `${unitGlyph(unit)}${'.'.repeat(dots.length)} = ${bpm}`
  return {
    ok: true,
    text: text.slice(0, match.index) + printed + text.slice(match.index + whole.length),
    unit,
    dots: dots.length || undefined,
    bpm,
  }
}

/** The palette's arming state: a form (word? metronome? printed?), not yet a mark. */
interface TempoToolFields {
  text?: string
  unit?: NoteDuration
  dots?: number
  bpm?: number
  showMetronome?: boolean
}

/**
 * The string the PALETTE should place: a word, a metronome, or both — `Allegro (♩ = 144)`.
 *
 * Brackets when there is a word beside the metronome (the commoner engraving, and what every
 * preset produces). They are only a default: they live in the text from here on, so deleting them
 * in the editor deletes them for good.
 */
export function composeTempoText(tool: TempoToolFields): string {
  const showsMetronome = tool.showMetronome === true && tool.bpm !== undefined
  if (!showsMetronome) return tool.text ?? ''

  const met = `${unitGlyph(tool.unit ?? 'q')}${'.'.repeat(tool.dots ?? 0)} = ${tool.bpm}`
  return tool.text ? `${tool.text} (${met})` : met
}

/**
 * The armed tool as a MARK's fields — the one place the palette's form becomes text.
 *
 * Used by BOTH the placement and the ghost preview, because they must agree: a bare metronome tool
 * carries no `text` at all, so a ghost built by spreading the tool had nothing to draw and simply
 * did not appear. `showMetronome` is a property of the FORM, not of the mark — it decides whether
 * the number makes it into the string, and then it is gone.
 */
export function tempoFieldsFromTool(tool: TempoToolFields): {
  text: string
  unit?: NoteDuration
  dots?: number
  bpm?: number
} {
  return { text: composeTempoText(tool), unit: tool.unit, dots: tool.dots, bpm: tool.bpm }
}
