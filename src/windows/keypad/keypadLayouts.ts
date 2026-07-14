/**
 * The Keypad's buttons — DATA ONLY, no DOM.
 *
 * This is a picture of Sibelius's Keypad, not a set of commands: every cell says what it LOOKS like
 * and which numeric-keypad key it sits on, and nothing about what it would do. Wiring comes later,
 * one cell at a time; until then a click just logs its `action`.
 *
 * The geometry IS the numeric keypad, and that is the whole point of the panel — the mouse and the
 * numpad are the same instrument, so a hand that learns one has learned the other:
 *
 *     ┌────────┬────────┬────────┬────────┐
 *     │NumLock │   /    │   *    │   -    │
 *     ├────────┼────────┼────────┤────────┤
 *     │   7    │   8    │   9    │        │
 *     ├────────┼────────┼────────┤   +    │   ← + is TALL (rows 2–3) — the next page
 *     │   4    │   5    │   6    │        │
 *     ├────────┼────────┼────────┼────────┤
 *     │   1    │   2    │   3    │        │
 *     ├────────┴────────┼────────┤ Enter  │   ← Enter is TALL (rows 4–5)
 *     │        0        │   .    │        │   ← 0 is WIDE (columns 1–2)
 *     └─────────────────┴────────┴────────┘
 *
 * Hence {@link KEYPAD_CELLS} is 17 long and strictly in reading order — a merged key is written
 * ONCE, where it starts. {@link KeypadWidget} places them from that order alone, so the panel
 * cannot drift out of shape.
 *
 * Glyphs are SMuFL codepoints in Bravura — the same font the score is engraved in, so a quarter
 * note on this panel is the quarter note that lands on the staff. The few marks SMuFL has no glyph
 * for (the tie, the drag hints) are hand-drawn SVG.
 */

/** A glyph from the music font, or a hand-drawn icon. Nothing else — a Keypad cell is never text. */
export type Icon = { glyph: string; size?: number; dy?: number } | { svg: string; dy?: number }

/**
 * How a key LIGHTS — which is to say, what kind of statement it makes. Three kinds, and the panel
 * reads them off the data alone:
 *
 * - `duration` — one of a set, and always one of them: a note has SOME length, so the lit key can
 *   only move, never go out. Clicking the lit one again does nothing.
 * - `accidental` — one of a set, or none: ♯ then ♭ moves the light; ♯ then ♯ puts it out.
 * - `toggle` — its own light, independent of every other key. Staccato and tenuto light together,
 *   because a note really can be both.
 * - `momentary` — no light at all. `+` goes somewhere; it is not a state you are in.
 */
export type Select = 'duration' | 'accidental' | 'toggle' | 'momentary'

export interface KeypadCell {
  /** The numpad key this cell mirrors. It is the cell's identity, and its tooltip. */
  key: string
  /** Logged on click. A name, not a function — see the header. */
  action: string
  icon: Icon
  select: Select
}

/**
 * SMuFL codepoints, written as ESCAPES and never as the characters themselves — they live in the
 * Private Use Area, so pasted literally they are invisible in the editor and survive nothing that
 * touches the file. `` is a quarter note, and stays one.
 *
 * The font is Bravura, which VexFlow registers in `document.fonts` (it ships it as a woff2 data
 * URL and calls FontFace.load on import) — so the panel gets the score's own engraving for free.
 */
const NOTE = {
  whole: '\uE1D2',
  half: '\uE1D3',
  quarter: '\uE1D5',
  eighth: '\uE1D7',
  sixteenth: '\uE1D9',
  thirtySecond: '\uE1DB',
  dot: '\uE1E7',
}
const REST_QUARTER = '\uE4E5'
const ACC = { flat: '\uE260', natural: '\uE261', sharp: '\uE262' }
const ARTIC = { accent: '\uE4A0', staccato: '\uE4A2', tenuto: '\uE4A4' }

// ─── Hand-drawn icons (no SMuFL glyph exists for these) ────────────────────────────────────────
const draw = (body: string, dy?: number): Icon => ({
  svg: `<svg viewBox="0 0 40 26" width="40" height="26" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round">${body}</svg>`,
  dy,
})

const ICON = {
  /** Enter. The big curve — the one cell everybody recognises the panel by. */
  tie: draw('<path d="M5 8 Q20 22 35 8" stroke-width="2.4"/>', 5),
  /** NumLock: note input on/off — drawn as the plain mouse pointer. */
  noteInput: draw(
    '<path d="M16 3 L16 21 L20.5 16.8 L23.5 23 L26.5 21.6 L23.5 15.6 L29 15.2 Z"' +
      ' fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>',
  ),
  /** `+`: the next page of the Keypad. Tall, because on the keyboard `+` is a tall key. */
  nextPage: draw('<path d="M14 4 l9 9 -9 9" stroke-width="2.4"/><path d="M25 4 v18" stroke-width="2"/>'),
} as const

/**
 * A music glyph. `dy` nudges it DOWN inside its key — the note glyphs hang from the top of their
 * stems, so centring their box leaves the notehead riding high; a couple of pixels puts the head
 * where the eye expects it. Both `size` and `dy` are quoted against a 26px glyph and scale with
 * the key.
 */
const g = (glyph: string, size?: number, dy?: number): Icon => ({ glyph, size, dy })

/** How far a stemmed note drops, so its NOTEHEAD sits centred rather than its bounding box. */
const STEM_DROP = 6

/** The numpad keys, in the reading order the cells must follow. Three of them are merged keys. */
export const KEYS = [
  'NumLock', '/', '*', '-',
  '7', '8', '9', '+',
  '4', '5', '6',
  '1', '2', '3', 'Enter',
  '0', '.',
]

/** The row along the bottom. In Sibelius these pick the voice you are writing into. */
export const VOICES = ['1', '2', '3', '4', 'All']

const cells: [string, Icon, Select][] = [
  ['noteInput', ICON.noteInput, 'toggle'], ['accent', g(ARTIC.accent), 'toggle'], ['staccato', g(ARTIC.staccato), 'toggle'], ['tenuto', g(ARTIC.tenuto), 'toggle'],
  ['natural', g(ACC.natural), 'accidental'], ['sharp', g(ACC.sharp), 'accidental'], ['flat', g(ACC.flat), 'accidental'], ['nextPage', ICON.nextPage, 'momentary'],
  ['quarter', g(NOTE.quarter, undefined, STEM_DROP), 'duration'], ['half', g(NOTE.half, undefined, STEM_DROP), 'duration'], ['whole', g(NOTE.whole, undefined, STEM_DROP), 'duration'],
  ['thirtySecond', g(NOTE.thirtySecond, undefined, STEM_DROP), 'duration'], ['sixteenth', g(NOTE.sixteenth, undefined, STEM_DROP), 'duration'], ['eighth', g(NOTE.eighth, undefined, STEM_DROP), 'duration'], ['tie', ICON.tie, 'toggle'],
  ['rest', g(REST_QUARTER), 'toggle'], ['dot', g(NOTE.dot, 34), 'toggle'],
]

export const KEYPAD_CELLS: KeypadCell[] = cells.map(([action, icon, select], i) => ({
  key: KEYS[i],
  action,
  icon,
  select,
}))

/** The duration the panel opens on — a note always has a length, so one duration key is always lit. */
export const DEFAULT_DURATION = 'quarter'
