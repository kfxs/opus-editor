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
 *
 * Some pictures are MORE than one glyph — a tremolo is a note wearing its strokes; a two-note tremolo
 * is two notes with beams between. SMuFL has no single glyph for these, so page 2 HAND-DRAWS them as a
 * STACK of glyphs, each slid into place by `dx`/`dy` (against 26). Every such drawing is NAMED (page 1's
 * {@link ICON} map is the model — see the `TREMOLO` map) and referenced from the layout by name, so a
 * page-2 line reads as clean as page 1's `['tie', ICON.tie, 'tie']`. The named recipe is BAKED to one
 * svg at draw time ({@link tremolo} → an `Icon.bake` → `KeypadWidget.bakeGlyphStack`) — this is the
 * SHIPPING path; a VexFlow re-engraving was tried and rejected (it changed the look and fought the font
 * metrics). To REWORK a drawing, swap its `tremolo(` for {@link rework}, which renders the SAME stack
 * LIVE as spans so `dx`/`dy` can be tuned by eye, then swap back to re-bake.
 */
import type { Accidental, ArticulationType, NoteDuration } from '../../types/music'

/** One music-font glyph, its `size`, `dx` and `dy` all quoted against a 26px reference (see {@link g}). */
export type GlyphSpec = { glyph: string; size?: number; dx?: number; dy?: number }

/**
 * A cell's picture: a single glyph, a ROW of glyphs each sized on its own, a `bake` (a STACK of glyphs
 * — a note wearing its tremolo strokes, each slid into place by `dx`/`dy` — rendered to ONE svg at draw
 * time, see {@link tremolo}), the same stack as LIVE `layers` (the raw hand-drawing, the rework path —
 * see {@link rework}), or a hand-drawn icon. Nothing else — a Keypad cell is never text.
 */
export type Icon =
  | GlyphSpec
  | { glyphs: GlyphSpec[] }
  | { bake: GlyphSpec[] }
  | { layers: GlyphSpec[] }
  | { svg: string; dy?: number }

/**
 * How a key LIGHTS — which is to say, what kind of statement it makes. Three kinds, and the panel
 * reads them off the data alone:
 *
 * - `duration` — one of a set, and always one of them: a note has SOME length, so the lit key can
 *   only move, never go out. Clicking the lit one again does nothing.
 * - `accidental` — one of a set, or none: ♯ then ♭ moves the light; ♯ then ♯ puts it out.
 * - `articulation` — its own light, independent of every other articulation: accent, staccato and
 *   tenuto light together, because a note really can wear all three. Backed by the editor's
 *   {@link articulationSelection} store (a SET), so the panel reflects the note under the cursor.
 * - `dot` — on or off, a nullable single value like `accidental`: the `.` lights when the note is
 *   dotted and re-pressing it clears the dot. Backed by the {@link dotSelection} store.
 * - `tie` — on or off too, the same nullable-single shape as `dot`, but its state is read from the
 *   engine (a note's `tiedTo`), not a reactive field. Backed by {@link tieSelection}.
 * - `rest` — REPORTS, it does not act: it lights when the selected slot is a rest, and pressing it
 *   does nothing (yet). The only read-only key on the panel — every other light is something you can
 *   also press ON. It exists because the duration keys tell only half the story: a selected quarter
 *   rest lights the quarter key exactly as a quarter NOTE does, and this is what tells them apart.
 *   Backed by {@link restSelection}, engine-read (`isRest`) like the tie.
 * - `momentary` — no light at all. A blank, unassigned slot that just logs; it is not a state.
 * - `mode` — the odd one out: its light is not the panel's own, it is the EDITOR's tool mode. The
 *   arrow lights exactly when the score is in selection mode, and clicking it puts the score there.
 *   Backed by {@link modeSelection}, the same two-channel seam as `duration`/`accidental` — the
 *   highlight follows the editor (pushed by keypadSync), the press enters selection mode.
 * - `page` — the `+` key: turns to the next Keypad page (Sibelius's second numpad layout). No light,
 *   like `momentary`, but it re-lays the grid rather than acting on a note. On every page, so you
 *   can always turn back.
 */
export type Select = 'duration' | 'accidental' | 'articulation' | 'dot' | 'tie' | 'rest' | 'momentary' | 'mode' | 'page'

export interface KeypadCell {
  /** The numpad key this cell mirrors. It is the cell's identity, and its tooltip. */
  key: string
  /** Logged on click. A name, not a function — see the header. */
  action: string
  icon: Icon
  select: Select
  /** The model value a wired key carries, so the widget maps NOTHING — a duration/accidental/
   *  articulation key presses its own value into the matching store, and the store lights it back.
   *  Exactly one is set, by `select` (a `duration` cell has {@link duration}, an `accidental` cell
   *  has {@link accidental}, an `articulation` cell has {@link articulation}). */
  duration?: NoteDuration
  accidental?: Accidental
  articulation?: ArticulationType
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
const g = (glyph: string, size?: number, dy?: number, dx?: number): GlyphSpec => ({ glyph, size, dy, dx })

/** How far a stemmed note drops, so its NOTEHEAD sits centred rather than its bounding box. */
const STEM_DROP = 6

/** The articulations (accent, staccato, tenuto) are tiny marks in SMuFL — nudge them up a touch so
 *  they read on the key at the size the note glyphs do. */
const ARTIC_SIZE = 34

/** The accidentals (natural, sharp, flat) — already tall, so a gentler bump than the articulations. */
const ACC_SIZE = 32

/** Stem-DOWN note glyphs — page 1's own notes are stem-up; page 2 starts from the down-stem note. */
const NOTE_DOWN = { half: '\uE1D4', quarter: '\uE1D6', sixteenth: '\uE1DA' }
/** Tremolo strokes — combining marks that ride a note's stem. */
const TREM = { one: '\uE220', two: '\uE221', three: '\uE222', four: '\uE223', five: '\uE224', penderecki: '\uE22B' }
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

/** One cell, before it grows a `key`: action, picture, lighting rule, and — for a wired key — the
 *  model value it carries (the 4th slot: a NoteDuration on a duration key, an Accidental on an
 *  accidental key, an ArticulationType on an articulation key; absent otherwise). `toCells` files it
 *  under the field `select` calls for. */
type CellSpec = [string, Icon, Select, (NoteDuration | Accidental | ArticulationType)?]

/** The two controls every page carries, in their fixed spots — the select arrow (top-left) and the
 *  page-turn `+`. A page never lists these itself; {@link withControls} injects them, so a new page
 *  defines only its OWN keys and can neither forget the arrow nor misplace the `+`. */
const SELECT_CELL: CellSpec = ['select', ICON.select, 'mode']
const PAGE_CELL: CellSpec = ['nextPage', ICON.nextPage, 'page']

/** Where the two shared controls sit on EVERY page — read off {@link KEYS} (the arrow on the top-left
 *  key, the page-turn on `+`) rather than hard-coded, so they stay right if the numpad is re-described. */
const SELECT_SLOT = KEYS.indexOf('NumLock')
const PAGE_SLOT = KEYS.indexOf('+')

/** How many keys a page defines on its own — every slot but the two the controls occupy. */
const PAGE_OWN_KEYS = KEYS.length - 2

/**
 * Drop the two shared controls back into a page's own keys, at their fixed slots. A page lists only
 * its {@link PAGE_OWN_KEYS} keys in reading order AROUND those slots; this reinserts the arrow and the
 * `+`. Throws if the page is the wrong length, so a miscounted page fails LOUD at load instead of
 * silently sliding every key one seat over. (Slots are inserted low-to-high so each lands at its final
 * index — `SELECT_SLOT` before `PAGE_SLOT`.)
 */
const withControls = (own: CellSpec[]): CellSpec[] => {
  if (own.length !== PAGE_OWN_KEYS) {
    throw new Error(`Keypad page needs ${PAGE_OWN_KEYS} keys, got ${own.length}`)
  }
  const cells = [...own]
  cells.splice(SELECT_SLOT, 0, SELECT_CELL)
  cells.splice(PAGE_SLOT, 0, PAGE_CELL)
  return cells
}

/** Page 1 — note entry: articulations, accidentals, durations, tie, rest, dot. The duration,
 *  accidental and articulation keys carry their model value (`'q'`, `'#'`, `'accent'`, …); the tie,
 *  rest and dot keys are their own value, so they carry none. Its OWN keys only — the arrow and `+`
 *  come from {@link withControls}. */
const page1: CellSpec[] = [
  ['accent', g(ARTIC.accent, ARTIC_SIZE), 'articulation', 'accent'], ['staccato', g(ARTIC.staccato, ARTIC_SIZE), 'articulation', 'staccato'], ['tenuto', g(ARTIC.tenuto, ARTIC_SIZE), 'articulation', 'tenuto'],
  ['natural', g(ACC.natural, ACC_SIZE), 'accidental', 'n'], ['sharp', g(ACC.sharp, ACC_SIZE), 'accidental', '#'], ['flat', g(ACC.flat, ACC_SIZE, 3), 'accidental', 'b'],
  ['quarter', g(NOTE.quarter, undefined, STEM_DROP), 'duration', 'q'], ['half', g(NOTE.half, undefined, STEM_DROP), 'duration', 'h'], ['whole', g(NOTE.whole, undefined, STEM_DROP), 'duration', 'w'],
  ['thirtySecond', g(NOTE.thirtySecond, undefined, STEM_DROP), 'duration', '32'], ['sixteenth', g(NOTE.sixteenth, undefined, STEM_DROP), 'duration', '16'], ['eighth', g(NOTE.eighth, undefined, STEM_DROP), 'duration', '8'], ['tie', ICON.tie, 'tie'],
  ['rest', { glyphs: [g(REST_QUARTER), g(REST_EIGHTH, 34)] }, 'rest'], ['dot', g(NOTE.dot, 34), 'dot'],
]

/**
 * Bake a hand-drawing into ONE svg icon. The argument is the SAME `layers` recipe — a stack of
 * music-font glyphs, each offset by `dx`/`dy` against 26 — that page 2 has always used; `tremolo()`
 * marks it for the widget to render to one svg at draw time (renderIcon bakes it — it needs the DOM).
 * The page-1 shape: an icon via a helper, exactly like `ICON.tie = draw('<path .../>')`. The
 * hand-drawing is KEPT as the argument — the source, reproducible.
 */
const tremolo = (layers: GlyphSpec[]): Icon => ({ bake: layers })

/**
 * REWORK a drawing live. Takes the SAME recipe as {@link tremolo}, but renders it as the raw stacked
 * glyphs (HTML spans, in {@link KeypadWidget}) instead of baking it to svg — so tuning a `dx`/`dy` and
 * reloading shows the change at once, in the plain hand-drawing form. To rework a cell, swap its
 * `tremolo(` to `rework(`, adjust the offsets, then swap it back to re-bake. This is the ONLY reason
 * the span renderer in the widget still exists — it is the rework path, not dead code, so keep it.
 */
const rework = (layers: GlyphSpec[]): Icon => ({ layers })

/** A single-note tremolo: a down-stem quarter wearing N stem strokes. Sibelius: "1 tremolo" … "5
 *  tremolos" (keys 1–5); the buzz roll (key 6) is drawn here with the Penderecki mark. */
const struck = (stroke: string, sy = 4, size?: number, sx = -2): Icon =>
  tremolo([g(NOTE_DOWN.quarter, undefined, -10), g(stroke, size, sy, sx)])

/** A single note wearing a detached beam-bar below the stem (a beam glyph, not stem strokes). */
const barred = (dx = 0, ndx = 0): Icon =>
  tremolo([g(NOTE_DOWN.quarter, undefined, -10, dx + ndx), g('\uE1FA', 30, 31, 1 + dx)])

/**
 * Page 2 — Sibelius 6's Beams/Tremolos keypad, as a picture. Every drawing is NAMED here (page 1's
 * {@link ICON} map, for tremolos) and baked to one svg; the layout table references the name, so a
 * page-2 line reads as clean as page 1's `['tie', ICON.tie, 'tie']`. The recipe (the hand-drawing) is
 * kept as each entry's argument — the source, reproducible. Names are Sibelius 6's own, by numpad
 * position; the `⚠️` ones are best guesses from the drawing (confirm against Sibelius and rename).
 * OWN keys only — the arrow and `+` come from {@link withControls}.
 */
const TREMOLO = {
  // Single-note tremolos — Sibelius "1 tremolo" … "5 tremolos" (keys 1–5) + buzz roll (key 6).
  oneTremolo: struck(TREM.one),
  twoTremolos: struck(TREM.two, 3),
  threeTremolos: struck(TREM.three, 3),
  fourTremolos: struck(TREM.four, 4, 22),
  fiveTremolos: struck(TREM.five, 4.5, 21),
  buzzRoll: struck(TREM.penderecki, 4.5, 30, -1),

  // Tremolo with next note — Sibelius Enter (drawn with two half notes).
  tremoloWithNext: tremolo([g(NOTE_DOWN.half, undefined, -7, -8), g(NOTE_DOWN.half, undefined, -13, 12), g('\uE007', 12, 15, -2)]),

  // Feathered beams — Sibelius keys 0 (accelerando) and . (rallentando).
  featheredAccel: tremolo([g(NOTE.quarter, 22, 9, -8), g(NOTE.quarter, 22, 9, 3), g(NOTE.quarter, 22, 9, 16), g('\uE1F8', 30, 13, 0), g('\uE1F8', 30, 13, 8), g('\uE1F8', 30, 13, 15), g('\uE988', 14, -6, 1)]),
  featheredRit: tremolo([g(NOTE.quarter, 22, 9, -13), g(NOTE.quarter, 22, 9, -1), g(NOTE.quarter, 22, 9, 10), g('\uE1F8', 30, 13, -5), g('\uE1F8', 30, 13, 3), g('\uE1F8', 30, 13, 8), g('\uE978', 14, -3, -3)]),

  // ⚠️ Beam buttons (numpad / - 7 8 9) — named by the drawing; confirm Sibelius 6's own names.
  stemBeams: tremolo([g(NOTE_DOWN.quarter, undefined, -10, 6), g('\uE1FA', 30, 31, 7), g('\uE1F8', 30, 37, -2)]),
  twoNoteQuarters: tremolo([g(NOTE.quarter, 22, 12, -12), g(NOTE.quarter, 22, 12, 10), g('\uE4E7', 22, 6, 1), g('\uE1FA', 30, 13, -4), g('\uE1FA', 30, 13, 2), g('\uE1FA', 30, 13, 8), g('\uE204', 22, 5, -1), g('\uE204', 22, 5, 10), g('\uE204', 22, 5, -12)]),
  oneBeam: barred(-2),
  threeBeams: tremolo([g(NOTE_DOWN.quarter, undefined, -10, 5), g('\uE1FA', 30, 31, -5), g('\uE1FA', 30, 31, 4), g('\uE1FA', 30, 31, 7)]),
  oneBeamOffset: barred(-2, 10),
}

const page2: CellSpec[] = [
  ['tremolo', TREMOLO.stemBeams, 'momentary'], ['tremolo', g(NOTE_DOWN.sixteenth, undefined, -10), 'momentary'],
  ['tremolo', TREMOLO.twoNoteQuarters, 'momentary'],
  ['tremolo', TREMOLO.oneBeam, 'momentary'],
  ['tremolo', TREMOLO.threeBeams, 'momentary'],
  ['tremolo', TREMOLO.oneBeamOffset, 'momentary'],
  ['tremolo', TREMOLO.fourTremolos, 'momentary'], ['tremolo', TREMOLO.fiveTremolos, 'momentary'], ['tremolo', TREMOLO.buzzRoll, 'momentary'],
  ['tremolo', TREMOLO.oneTremolo, 'momentary'], ['tremolo', TREMOLO.twoTremolos, 'momentary'], ['tremolo', TREMOLO.threeTremolos, 'momentary'],
  ['tremolo', TREMOLO.tremoloWithNext, 'momentary'],
  ['tremolo', TREMOLO.featheredAccel, 'momentary'],
  ['tremolo', TREMOLO.featheredRit, 'momentary'],
]

const toCells = (page: CellSpec[]): KeypadCell[] =>
  page.map(([action, icon, select, value], i) => ({
    key: KEYS[i],
    action,
    icon,
    select,
    // The 4th slot is typed by `select`; file it under the field the widget reads for that kind.
    duration: select === 'duration' ? (value as NoteDuration) : undefined,
    accidental: select === 'accidental' ? (value as Accidental) : undefined,
    articulation: select === 'articulation' ? (value as ArticulationType) : undefined,
  }))

/** Every page of the Keypad, in order — each page's own keys with the two shared controls injected.
 *  The `+` key steps through them; index 0 is the opening page. */
export const KEYPAD_PAGES: KeypadCell[][] = [page1, page2].map(page => toCells(withControls(page)))
