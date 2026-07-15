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
 * Hence each page of {@link KEYPAD_PAGES} is 17 cells long and strictly in reading order — a merged
 * key is written ONCE, where it starts. {@link KeypadWidget} places them from that order alone, so
 * the panel cannot drift out of shape.
 *
 * The Keypad is MULTI-PAGE (Sibelius has several numpad layouts): the `+` key turns the page, and
 * every page shares the same geometry and the same two controls in fixed spots — the select arrow
 * (top-left) and the page-turn `+`. Only the other keys change from page to page.
 *
 * Glyphs are SMuFL codepoints in Bravura — the same font the score is engraved in, so a quarter
 * note on this panel is the quarter note that lands on the staff. The few marks SMuFL has no glyph
 * for (the tie, the drag hints) are hand-drawn SVG.
 */
import type { NoteDuration } from '../../types/music'

/** One music-font glyph, its `size` and `dy` both quoted against a 26px reference (see {@link g}). */
export type GlyphSpec = { glyph: string; size?: number; dy?: number }

/**
 * A cell's picture: a single glyph, a ROW of glyphs each sized on its own, or a hand-drawn icon.
 * Nothing else — a Keypad cell is never text. The row exists because two marks on one key (the
 * quarter + eighth rest) are drawn at DIFFERENT ems in the font, so they need independent sizes to
 * look balanced; one string in one span cannot.
 */
export type Icon = GlyphSpec | { glyphs: GlyphSpec[] } | { svg: string; dy?: number }

/**
 * How a key LIGHTS — which is to say, what kind of statement it makes. Three kinds, and the panel
 * reads them off the data alone:
 *
 * - `duration` — one of a set, and always one of them: a note has SOME length, so the lit key can
 *   only move, never go out. Clicking the lit one again does nothing.
 * - `accidental` — one of a set, or none: ♯ then ♭ moves the light; ♯ then ♯ puts it out.
 * - `toggle` — its own light, independent of every other key. Staccato and tenuto light together,
 *   because a note really can be both.
 * - `momentary` — no light at all. A blank, unassigned slot that just logs; it is not a state.
 * - `mode` — the odd one out: its light is not the panel's own, it is the EDITOR's tool mode. The
 *   arrow lights exactly when the score is in selection mode, and clicking it puts the score there.
 *   The panel reads that from the {@link toolMode} store, never from its own `lit` set.
 * - `page` — the `+` key: turns to the next Keypad page (Sibelius's second numpad layout). No light,
 *   like `momentary`, but it re-lays the grid rather than acting on a note. On every page, so you
 *   can always turn back.
 */
export type Select = 'duration' | 'accidental' | 'toggle' | 'momentary' | 'mode' | 'page'

export interface KeypadCell {
  /** The numpad key this cell mirrors. It is the cell's identity, and its tooltip. */
  key: string
  /** Logged on click. A name, not a function — see the header. */
  action: string
  icon: Icon
  select: Select
  /** For a `duration` cell, the model duration it arms — the cell carries its own value, so the
   *  widget maps NOTHING (a duration key sets {@link durationSelection}; the store lights it back). */
  duration?: NoteDuration
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
const REST_EIGHTH = '\uE4E6'
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
  /** Select mode — the selection arrow, drawn as the plain mouse pointer. Top-left, like Sibelius. */
  select: draw(
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
const g = (glyph: string, size?: number, dy?: number): GlyphSpec => ({ glyph, size, dy })

/** How far a stemmed note drops, so its NOTEHEAD sits centred rather than its bounding box. */
const STEM_DROP = 6

/** The articulations (accent, staccato, tenuto) are tiny marks in SMuFL — nudge them up a touch so
 *  they read on the key at the size the note glyphs do. */
const ARTIC_SIZE = 34

/** The accidentals (natural, sharp, flat) — already tall, so a gentler bump than the articulations. */
const ACC_SIZE = 32

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

/** One cell, before it grows a `key`: action, picture, lighting rule, and — for a duration — the
 *  model value it arms (the 4th slot, present ONLY on the six duration keys). */
type CellSpec = [string, Icon, Select, NoteDuration?]

/** The two controls every page carries, in their fixed spots — the select arrow (top-left) and the
 *  page-turn `+`. Written once and spread into each page so a page cannot forget how to turn back. */
const SELECT_CELL: CellSpec = ['select', ICON.select, 'mode']
const PAGE_CELL: CellSpec = ['nextPage', ICON.nextPage, 'page']

/** Page 1 — note entry: durations, accidentals, articulations, rest, dot, tie. The duration keys
 *  carry their model value (`'q'`, `'8'`, …); the rest of the panel is not wired to the score yet. */
const page1: CellSpec[] = [
  SELECT_CELL, ['accent', g(ARTIC.accent, ARTIC_SIZE), 'toggle'], ['staccato', g(ARTIC.staccato, ARTIC_SIZE), 'toggle'], ['tenuto', g(ARTIC.tenuto, ARTIC_SIZE), 'toggle'],
  ['natural', g(ACC.natural, ACC_SIZE), 'accidental'], ['sharp', g(ACC.sharp, ACC_SIZE), 'accidental'], ['flat', g(ACC.flat, ACC_SIZE, 3), 'accidental'], PAGE_CELL,
  ['quarter', g(NOTE.quarter, undefined, STEM_DROP), 'duration', 'q'], ['half', g(NOTE.half, undefined, STEM_DROP), 'duration', 'h'], ['whole', g(NOTE.whole, undefined, STEM_DROP), 'duration', 'w'],
  ['thirtySecond', g(NOTE.thirtySecond, undefined, STEM_DROP), 'duration', '32'], ['sixteenth', g(NOTE.sixteenth, undefined, STEM_DROP), 'duration', '16'], ['eighth', g(NOTE.eighth, undefined, STEM_DROP), 'duration', '8'], ['tie', ICON.tie, 'toggle'],
  ['rest', { glyphs: [g(REST_QUARTER), g(REST_EIGHTH, 34)] }, 'toggle'], ['dot', g(NOTE.dot, 34), 'toggle'],
]

/** An empty, unassigned slot — no glyph, no light. It just logs on click (see {@link KeypadWidget}). */
const BLANK: CellSpec = ['unassigned', { glyph: '' }, 'momentary']

/**
 * Page 2 — infrastructure only, for now. Every key but the two shared controls is a {@link BLANK}
 * slot: it shows nothing and only logs its key on click. Glyphs and actions come later; the point
 * today is that the page EXISTS and the `+` turns to it.
 */
const page2: CellSpec[] = [
  SELECT_CELL, BLANK, BLANK, BLANK,
  BLANK, BLANK, BLANK, PAGE_CELL,
  BLANK, BLANK, BLANK,
  BLANK, BLANK, BLANK, BLANK,
  BLANK, BLANK,
]

const toCells = (page: CellSpec[]): KeypadCell[] =>
  page.map(([action, icon, select, duration], i) => ({ key: KEYS[i], action, icon, select, duration }))

/** Every page of the Keypad, in order. The `+` key steps through them; index 0 is the opening page. */
export const KEYPAD_PAGES: KeypadCell[][] = [page1, page2].map(toCells)
