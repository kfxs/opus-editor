/**
 * THE FOURTEEN SELECTABLE ELEMENTS, filed by KIND — two tables and the shared tail.
 *
 * `SelectedElement` made an element's **type** one thing (2026-07-27 Phase 1: 23 scalar fields → one
 * discriminated union). Its **behaviour** stayed spread over four files: `handle*MouseDown` ×12 in
 * `MouseController`, `apply*Highlight` ×13 reached from `RenderController`'s switch, the Delete
 * switch in `shortcutWiring`, the report switch in `selectionSnapshot`. The code was filed by
 * MECHANISM — all mousedowns together, all highlights together — and it CHANGES by kind, so every
 * kind was a thin slice across five files (docs/modularity-plan-2026-07-28.md §4, Phase 1).
 *
 * Now each kind is one module in this directory, holding what a press does with it and what it
 * looks like selected. Adding a fifteenth is one new file plus one row here.
 *
 * ⚠️ **It is TWO structures, because the two axes genuinely have two shapes.** The chain is
 * *ordered and partial*; the paint is *unordered and total*:
 *
 *  - {@link ELEMENT_HIT_ORDER} — 13 entries. ORDER IS THE CONTENT: an array position is the answer
 *    to "who gets a press two glyphs both cover?", and the comments in it are the most valuable
 *    thing that used to be in `handleMouseDown`. `tuplet` and `measureRange` are NOT here: they are
 *    set by the pre-steps that run before the selection is cleared (a tuplet bracket press, a
 *    Ctrl+Shift box), which are gestures rather than kinds. `slur` appears here once, as an arc
 *    press; its endpoint HANDLES are a pre-step drag, also outside.
 *  - {@link ELEMENT_SPECS} — 15 entries, total over the union, so a sixteenth kind fails to BUILD
 *    until it says how it paints. That is the guarantee `assertNeverElement` gives, from a table.
 *
 * ⚠️ Delete (`shortcutWiring`) and the Properties report (`selectionSnapshot`) deliberately stay as
 * their own exhaustive switches. The plan sketched a `delete?` row here, but read against the code
 * those bodies are not slices: each is 5–20 lines of real per-kind reasoning that needs the engine,
 * the state, the selection AND the multi-select set (Delete on a measure box runs a batch over the
 * dynamics and slurs the box pulled in). They answer different questions from different data, and
 * each is already exhaustive at one site — moving them would buy nothing and risk a lot.
 *
 * ⚠️ SCREAMING_SNAKE on both tables, deliberately: `scripts/check-singletons.mjs` reads a
 * module-level `export const <camelCase> = {` as new mutable state and would fail `build:check`.
 * These are frozen lookup tables — data, not state — and the name is how the check can tell
 * (docs/DESIGN-PRINCIPLES.md §1). If a spec ever wants to REMEMBER something between clicks, that
 * is instance state and it belongs on the controller.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import type { SelectedElement } from '../EditorState'
import type { HighlightController } from '../HighlightController'

import { CLEF_ELEMENT } from './clef'
import { TIME_SIGNATURE_ELEMENT } from './timeSignature'
import { TEMPO_ELEMENT } from './tempo'
import { DYNAMIC_ELEMENT } from './dynamic'
import { TIE_ELEMENT } from './tie'
import { SLUR_ELEMENT } from './slur'
import { HAIRPIN_ELEMENT } from './hairpin'
import { ACCIDENTAL_ELEMENT } from './accidental'
import { ARTICULATION_ELEMENT } from './articulation'
import { DOT_ELEMENT } from './dot'
import { TREMOLO_ELEMENT } from './tremolo'
import { STEM_ELEMENT } from './stem'
import { BARLINE_ELEMENT } from './barline'
import { TUPLET_ELEMENT } from './tuplet'
import { MEASURE_RANGE_ELEMENT } from './measureRange'

/**
 * Resolved targets for one selection-tool mousedown, computed once and shared by the hit-tests and
 * by the pre-step gestures, so they don't each re-hit-test.
 */
export interface MouseDownCtx {
  event: MouseEvent
  engine: MusicEngine
  registry: ElementRegistry
  x: number
  y: number
  closestElement: ElementInfo | null
  tupletAtClick: ElementInfo | null
}

/**
 * What a hit-test may do BESIDES answering "mine" — all of it owned by `MouseController`, which is
 * where the gesture state and the controllers live. Handed down rather than reached for, so a kind
 * module imports no controller and can be read on its own.
 */
export interface ElementChainDeps {
  /**
   * ⭐ **THE SHARED TAIL, written once.** Eleven of the twelve handlers ended in the same three
   * statements — clear the whole NOTE selection (the multi-select Map, not just the anchor, since it
   * is what drives the note highlight), make this the ONE selected element, repaint. Always returns
   * true, so a hit-test reads `return deps.pick(…)`.
   *
   * `arm` runs BETWEEN the assignment and the repaint, which is where the two handlers that also
   * start a drag (clef, barline) did their arming. Order preserved deliberately: the assignment
   * fires `EditorState`'s Proxy, so its subscribers run at that point — and the clef arming freezes
   * the layout, which a subscriber's own repaint would otherwise see the wrong side of.
   */
  pick(element: SelectedElement, arm?: () => void): true
  /**
   * The articulation's own tail — the twelfth handler, and the one exception. It selects the whole
   * GROUP on the note (Sibelius-style) instead of clearing the note selection, so it cannot ride
   * `pick`. Always returns true, for the same reason.
   */
  pickArticulationGroup(noteId: string): true
  /** Arm the horizontal drag that slides a movable clef along its bar. The event travels because
   *  arming must also `preventDefault` — and only when it really arms. */
  armClefDrag(clef: ElementInfo, event: MouseEvent): void
  /** Arm the drag that stretches the bar to the LEFT of the grabbed barline. */
  armBarWidthDrag(measure: number, x: number): void
  /**
   * Record this press and answer whether it was the SECOND on the same mark inside the double-click
   * window — consuming it when it was, so a third click is not another double.
   *
   * ⚠️ Manual, not the native `dblclick`: selecting re-renders on every mousedown, which swaps the
   * SVG nodes, so the two clicks land on different element instances and the browser never fires it.
   */
  isDoubleClick(mark: 'tempo' | 'dynamic', id: string): boolean
  /** Open the in-canvas text overlay over an existing tempo mark / dynamic. */
  openEditor(mark: 'tempo' | 'dynamic', id: string): void
}

/** One entry in the priority chain: consumed the press, or declined it and left the state alone. */
export type ElementHit = (ctx: MouseDownCtx, deps: ElementChainDeps) => boolean

/** Everything one selectable kind knows about itself. */
export interface ElementKindSpec {
  /** Which kind this is. Duplicated with its key in {@link ELEMENT_SPECS} deliberately: it is what
   *  makes {@link ELEMENT_HIT_ORDER} — an ARRAY, where the order is the content — readable and
   *  testable as an order of KINDS rather than of anonymous functions. `chain.test.ts` pins the two
   *  against each other, so the copy cannot drift. */
  kind: SelectedElement['kind']
  /**
   * Where a press resolves to this kind. ABSENT means a pre-step resolves it instead — which is why
   * this is optional rather than a required field with two entries that have nothing to put in it.
   */
  hit?: ElementHit
  /** What extra painting this kind gets when it is the ONE selected element. */
  highlight: (h: HighlightController) => void
}

/** A kind a PRESS can resolve to — i.e. one with an entry in {@link ELEMENT_HIT_ORDER}. */
export interface ClickableElementSpec extends ElementKindSpec {
  hit: ElementHit
}

/**
 * ⭐ **THE PRIORITY CHAIN — the array position IS the answer.** Read top to bottom: the first entry
 * that consumes the press wins, and the note itself is the fall-through after all of them. This used
 * to be twelve `if (…) return`s in `handleMouseDown` followed, hundreds of lines later, by their
 * twelve bodies; the ordering comments were the most load-bearing thing in that method, so they
 * travel here verbatim.
 */
export const ELEMENT_HIT_ORDER: ReadonlyArray<ClickableElementSpec> = [
  CLEF_ELEMENT,
  TIME_SIGNATURE_ELEMENT,
  TEMPO_ELEMENT,
  DYNAMIC_ELEMENT,
  TIE_ELEMENT,
  SLUR_ELEMENT,
  // The hairpin immediately after the slur: both are spanners hit-tested by proximity to their own
  // ink, and where they overlap (a slur below the staff over a wedge) the ARC wins — it is the
  // thinner target and the one drawn closer to the notes, so a press that could be either was
  // almost certainly aimed at it.
  HAIRPIN_ELEMENT,
  ACCIDENTAL_ELEMENT,
  ARTICULATION_ELEMENT,
  // Dots last of the sub-elements: they sit right beside the notehead, so a dot must never win a
  // press that a neighbouring glyph could claim. It still precedes the note itself — a dot's box
  // is outside the head, so it can only take clicks that would otherwise select the note.
  DOT_ELEMENT,
  // The stem after every glyph that can sit ON it (articulations and dots at the tip, an arc
  // crossing it) and before the barline, whose pad reaches into the bar's last column. Its own
  // handler stands down for a press the notehead owns.
  //
  // The tremolo goes immediately before it: the mark is drawn on the stem, so it wins inside its
  // own ink and the stem keeps the rest of its length.
  TREMOLO_ELEMENT,
  STEM_ELEMENT,
  // The barline last of all: its box has to be padded to be clickable at 4px, and that pad
  // reaches into the last column of the bar — so every glyph that could own the click gets
  // asked first, and the note itself is guarded for inside the handler.
  BARLINE_ELEMENT,
]

/**
 * TOTAL over `SelectedElement['kind']` — the exhaustiveness site for painting. A sixteenth kind is a
 * compile error here until someone decides how it shows.
 *
 * ⚠️ The `apply*Highlight` BODIES stay in {@link HighlightController}: they lean on ~10 of that
 * class's privates (`highlightGlyphsInBBox`, `colorNoteArticulations`, `colorNoteDots`, `setAttr`,
 * `raiseToFront`, the undo log …), and publishing that painting toolkit as an API would be a larger
 * and worse change than the one this table is for. What moves here is the DISPATCH.
 */
export const ELEMENT_SPECS: Record<SelectedElement['kind'], ElementKindSpec> = {
  clef: CLEF_ELEMENT,
  timeSignature: TIME_SIGNATURE_ELEMENT,
  tempo: TEMPO_ELEMENT,
  dynamic: DYNAMIC_ELEMENT,
  tie: TIE_ELEMENT,
  slur: SLUR_ELEMENT,
  hairpin: HAIRPIN_ELEMENT,
  accidental: ACCIDENTAL_ELEMENT,
  articulation: ARTICULATION_ELEMENT,
  dot: DOT_ELEMENT,
  tremolo: TREMOLO_ELEMENT,
  stem: STEM_ELEMENT,
  barline: BARLINE_ELEMENT,
  tuplet: TUPLET_ELEMENT,
  measureRange: MEASURE_RANGE_ELEMENT,
}
