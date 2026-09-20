/**
 * ⭐⭐ **THE BARLINE PALETTE'S PRESS** — which LINE a sign lands on, and what pressing a button does.
 *
 * P4 of docs/plans/barline-types-plan.md, and the module CLAUDE.md's rule asks for: the score edit is in
 * the core (`engine/models/barlineOps`), the *gesture* is here, and `PaletteController` /
 * `MouseController` each keep one line.
 *
 * ## ⭐⭐ A BUTTON PLACES A SIGN ON A **LINE**
 *
 * 🚨 **HIS RULE, 2026-08-26, and it replaced the first one:** *"somehow the change should be in the
 * one most near to the pointer — this is important."* Reported twice from the running app, on two
 * different buttons: *"I'm clicking normal in the third barline but it's changing the fourth."*
 *
 * ⭐ **What was wrong was not the side rule but the QUESTION.** The first build asked *"which bar was
 * clicked?"* and put the sign on that bar's own side. But `pixelToMeasure` puts a press that lands ON
 * a boundary in the bar to its RIGHT — that is where the boundary's x belongs — so a user aiming at
 * a line was handed the bar past it. All four buttons had it; the eraser only made it unmissable,
 * because erasing is aimed at ink by definition.
 *
 * ⚠️ The header this replaces argued *"⛔ deliberately NOT the nearest boundary… a second rule to
 * learn"*. He has now asked for exactly that, twice and in his own words, so it stands as his call —
 * and it turns out to be **fewer** rules, not more: a barline sign is a statement about a LINE in
 * every one of the three gestures, so `side` survives only where a gesture genuinely names BARS.
 *
 * | what is selected | which line the sign lands on |
 * |---|---|
 * | nothing | the tool ARMS; the press goes to the line NEAREST THE POINTER |
 * | a barline (`ends measure N`) | that line |
 * | an open repeat (`opens measure M`) | that line — the one ending bar *M−1* |
 * | a measure range | ⭐ the only gesture that still reads `side`: it names BARS, so an end sign takes the passage's right-hand line and an open one its left |
 *
 * ⭐ Naming the line is what makes the eraser able to reach the `|:` opening bar 1: that sign stands
 * on the score's opening edge, a line no bar ends, and a boundary is allowed to be that.
 *
 * ## ⛔ A BUTTON ADDS ITS OWN SIGN — it does not replace what else is on the line
 *
 * 🚨 The second correction of the same afternoon: *"end repeat overwrote the open repeat for the
 * other measure… completely wrong."* Each row writes only the field it owns, so an end repeat and an
 * open repeat standing on one line compose into `:||:` — which is the point of them. See
 * {@link BarlineSignSpec.place}, and ⚠️ note that the Properties chooser is deliberately the other
 * sentence: it names the sign the line IS.
 *
 * ## ⛔ Nothing here reads the neighbour's PICTURE, and nothing here draws
 *
 * The *picture* at a boundary is `signAtBoundary`'s question, and the two bars that meet there are
 * its business. This module says what was ASKED FOR; `setBoundarySign` writes both owners of the one
 * line it was given (`barlineOps` says why that is not a breach of ONE OWNER PER LINE).
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { PlacedBarlineSign } from '../../engine/layout/barlineSign'
import type { EditorState } from '../state/EditorState'
import { selectedOf } from '../state/EditorState'
import { inStaffBand } from '../state/staffBand'

/**
 * The signs the palette can place, the eraser included — ⭐ **the ENGINE's type**, re-exported so the
 * editor's side of this feature has one import. Not a second list of the same strings: `repeatBoth`
 * is derived at a boundary and placed by no button (the Properties chooser says it, by naming a
 * line), and a rename over there must fail to compile here rather than leave the palette speaking a
 * dialect of the drawing's vocabulary.
 */
export type BarlineSign = PlacedBarlineSign

/**
 * ⭐⭐ **A LINE IN THE SCORE** — the bar it ENDS, or `null` for the score's opening edge, where no bar
 * ends and the only statement sayable is the `|:` opening bar 1.
 *
 * The one currency of this module, and the same shape `bus.barlineEdit` and `signAtBoundary` already
 * use: three gestures resolve to one of these, and one write consumes it.
 */
export interface BarlineBoundary {
  endsMeasure: number | null
}

/** What this module needs of the `ElementRegistry` — declared structurally, like every stamp here,
 *  so a test can hand it three boxes instead of a rendered score. */
export interface BarlineHitRegistry {
  getByType(type: 'barline' | 'repeatStart'): ReadonlyArray<{
    measure?: number
    staff?: number
    bbox: { x: number; y: number; width: number; height: number }
  }>
  isPainted(measure: number, staff: number): boolean
}

interface BarlineSignSpec {
  /**
   * ⭐ **WHICH SIDE of a PASSAGE this sign stands on** — read by exactly one gesture, the measure
   * range, because it is the only one that names BARS rather than a line. `right` is the line that
   * ends the passage, `left` the line that opens it, which is his own rule: *"an endbar is always on
   * the right, an open is on the left side of the measure."*
   *
   * ⭐ The eraser (`plain`) is `right` by convention rather than by argument: a passage has two lines
   * and "make this normal" names neither, so it takes the same end as the two signs it most often
   * undoes. ⚠️ Erasing a whole passage's barlines is a range-shaped operation nobody has asked for;
   * this is one line, said out loud rather than papered over.
   */
  side: 'left' | 'right'
  /** What the log calls it. */
  label: string
  /**
   * ⭐⭐ **WRITE THIS SIGN ONTO THAT LINE — its OWN field, and nothing else's.**
   *
   * 🚨 **HIS REPORT, 2026-08-26:** with a `|:` standing on the line ending bar 2, pressing END REPEAT
   * *"overwrote the open repeat… completely wrong."* Dead right — that pair IS the back-to-back sign,
   * the commonest thing in repeated music. ⚠️ And its twin, an hour later: *"I click a final here and
   * it just made disappear the end repeat, but I don't see it writing the final"* — the other
   * direction, where NOT overriding was the bug.
   *
   * ⭐⭐ **HIS RULE, and it is one sentence:** *"if the barline is the repeat, it should just check if
   * what is clicking on it is a repeat and contrary to its sign — in that case they make the double
   * repetition; if not, just override."* So **a line carries ONE sign, except that the two repeats
   * combine.** Two rows implement each half:
   *
   *  - the two **styles** call `setBoundarySign`, which clears whatever was on the line;
   *  - the two **repeats** call `addRepeatAtBoundary`, which leaves the OPPOSITE repeat alone (that
   *    pair is `:||:`) and overrides everything else.
   *
   * ⛔ The ERASER clears the line outright — that is what it is for.
   *
   * ⚠️ **The Properties chooser is a different sentence**, which is why it exists alongside: it offers
   * a `:||:` row, so picking from it says *"this line is now exactly that"* and can BUILD the
   * back-to-back sign in one go. A palette button can only ever add its own half of it.
   */
  place(engine: MusicEngine, boundary: BarlineBoundary): boolean
}

/**
 * What each sign is, as a table the compiler keeps TOTAL (`npm run lint:tables`) — the
 * `SPAN_MARK_TOOLS` / `ELEMENT_SPECS` idiom. A fifth sign (the thin double `||`, the family's next
 * member) is a ROW here and a case nowhere.
 *
 * ⚠️ `final` and `invisible` are barline STYLES and the two repeats are not (plan §3.2, corroborated
 * by MNX + SMuFL + three engines) — which is why `place` is per-row rather than one
 * `setBoundarySign(sign)`. That one collapse was tried and his report took it back; see
 * {@link BarlineSignSpec.place}.
 */
export const BARLINE_SIGNS: Record<BarlineSign, BarlineSignSpec> = {
  /** ⭐ The ERASER — his ask: *"another way to rewrite the open, final and end repeat."* The ONE row
   *  that clears, and the only one that touches both owners of the line. */
  plain: {
    side: 'right',
    label: 'normal barline',
    place: (engine, boundary) => engine.setBoundarySign(boundary.endsMeasure, 'plain'),
  },
  /** ⭐ The line is there and divides the bars; it is simply not engraved — tinted for the editor,
   *  omitted in print. ⛔ Not "no barline": see `BarlineStyle`. */
  /** ⭐ A STYLE, so it OVERRIDES: `setBoundarySign` clears the repeats standing on this line. */
  invisible: {
    side: 'right',
    label: 'invisible barline',
    place: (engine, boundary) => engine.setBoundarySign(boundary.endsMeasure, 'invisible'),
  },
  final: {
    side: 'right',
    label: 'final barline',
    place: (engine, boundary) => engine.setBoundarySign(boundary.endsMeasure, 'final'),
  },
  /** ⭐ A REPEAT, so it COMPOSES with the opposite one and overrides everything else. */
  repeatEnd: {
    side: 'right',
    label: 'end repeat',
    place: (engine, boundary) => engine.addRepeatAtBoundary(boundary.endsMeasure, 'end'),
  },
  repeatStart: {
    side: 'left',
    label: 'open repeat',
    place: (engine, boundary) => engine.addRepeatAtBoundary(boundary.endsMeasure, 'start'),
  },
}

/**
 * The line `sign` should land on given what is selected, or **null when nothing names one** — which
 * is the palette's signal to ARM instead (the "if nothing selected, stamp" half of the rule).
 *
 * Selection mode only, like every other apply-to-the-selection path: in entry mode a selected note is
 * the keyboard CARET, not a selection, and a press there means "arm the stamp".
 *
 * ⚠️ A NOTE selection deliberately does NOT name a line. It would be easy to read the note's measure
 * and act on it, but that is a rule nobody stated: his three cases are a barline, a measure, or
 * nothing. A press with notes selected therefore arms — the ordinary stamp bargain, which drops the
 * selection and previews what the next click makes.
 */
export function barlineTargetFromSelection(state: EditorState, sign: BarlineSign): BarlineBoundary | null {
  if (state.selectedTool !== 'selection') return null

  // ⭐ Both barline selections ARE a line, so neither reads `side`: whichever sign you press, it lands
  // on the line you have picked. A `|:` opening bar M stands on the line ending bar M−1 — and on the
  // score's opening edge when M is 1, which is a boundary too.
  const line = selectedOf(state, 'barline')
  if (line) return { endsMeasure: line.measure }

  const openRepeat = selectedOf(state, 'repeatStart')
  if (openRepeat) return { endsMeasure: openRepeat.measure > 1 ? openRepeat.measure - 1 : null }

  // EITHER box counts (the double Ctrl+Shift+click one and the single plain-click one) — both name
  // bars out loud, and a barline does not care what was selected INSIDE them. ⭐ The one gesture that
  // reads `side`, because it is the one that names bars and not a line.
  const range = selectedOf(state, 'measureRange')
  if (range) {
    const first = Math.min(range.anchor, range.focus)
    const last = Math.max(range.anchor, range.focus)
    return BARLINE_SIGNS[sign].side === 'left'
      ? { endsMeasure: first > 1 ? first - 1 : null }
      : { endsMeasure: last }
  }
  return null
}

/**
 * Place `sign` on `boundary` and say so. The ONE write, shared by all three gestures, so a click and
 * a press on a selection cannot drift apart.
 *
 * @returns whether the score changed — false for a line that cannot carry this sign (an open repeat
 *          asked for after the last bar, or anything but `|:` at the score's opening edge) and for a
 *          sign that is already standing there.
 */
export function applyBarlineSign(engine: MusicEngine, sign: BarlineSign, boundary: BarlineBoundary): boolean {
  const { label } = BARLINE_SIGNS[sign]
  const where = boundary.endsMeasure === null
    ? 'the opening edge of the score'
    : `the line ending measure ${boundary.endsMeasure}`
  const changed = BARLINE_SIGNS[sign].place(engine, boundary)
  dbg(changed
    ? `✓ Barline placed | ${label} on ${where}`
    : `· Barline unchanged | ${label} on ${where} — already there, or no line that can carry it`)
  return changed
}

/**
 * ⭐⭐ **THE LINE NEAREST THE POINTER** — his rule, and the whole of the armed click.
 *
 * ⚠️ Both families of box are candidates, and that is what makes the eraser able to reach the `|:`
 * opening bar 1: a `repeatStart` box names a line no bar ends
 * (`BarlineRenderer.registerRepeatStart`), so it answers with `endsMeasure: null`. Without it the
 * initial repeat would be un-erasable by the palette, exactly as it was un-selectable before P5b.
 *
 * ⚠️ Only PAINTED barlines answer — `interactions/elements/barline`'s rule and for its reason: tier 1
 * registers a box for every bar in the SCORE, drawn or not, so an off-screen bar's box would
 * otherwise win a press that a visible line is under. ⛔ The `repeatStart` boxes need no such filter:
 * the drawing pass registers them, so their existence IS proof they were painted.
 *
 * The y picks the STAFF BAND and nothing else — a barline is system-wide (plan §2). ⭐ The band is
 * PADDED (`./staffBand`), so a press just under the bottom line still lands: his report of six
 * straight declines a few pixels below the staff.
 */
export function nearestBoundary(registry: BarlineHitRegistry, x: number, y: number): BarlineBoundary | null {
  // ⚠️ The PADDED band (`./staffBand`), ⛔ not the registered box's own height — his report: six
  // presses in a row declined at y 391 while y 386 placed a sign, because a barline's box is exactly
  // the five staff lines. A stamp is not disambiguating between two staves' lines; it only needs to
  // know the press was near the music, and the tolerance it uses must be the one the measure click
  // already uses or the two gestures teach different lessons.
  const inBand = (b: { y: number; height: number }) => inStaffBand(b, y)
  const centre = (b: { x: number; width: number }) => b.x + b.width / 2

  const candidates: Array<{ endsMeasure: number | null; at: number }> = []
  for (const el of registry.getByType('barline')) {
    if (el.measure === undefined || !inBand(el.bbox)) continue
    if (!registry.isPainted(el.measure, el.staff ?? 0)) continue
    candidates.push({ endsMeasure: el.measure, at: centre(el.bbox) })
  }
  for (const el of registry.getByType('repeatStart')) {
    if (el.measure === undefined || !inBand(el.bbox)) continue
    candidates.push({ endsMeasure: el.measure > 1 ? el.measure - 1 : null, at: centre(el.bbox) })
  }

  const nearest = candidates.reduce<typeof candidates[number] | null>(
    (best, c) => (best === null || Math.abs(c.at - x) < Math.abs(best.at - x) ? c : best),
    null,
  )
  return nearest === null ? null : { endsMeasure: nearest.endsMeasure }
}

/**
 * ⭐⭐ **THE ARMED TOOL'S CLICK — the NEAREST LINE gets the sign.**
 *
 * `MouseController` keeps one row in its dispatch chain, like every stamp beside it.
 *
 * 🚨 His rule, reported twice from the running app and quoted in the header. ⛔ The bar the press fell
 * in is no longer read at all: a barline sign is a statement about a line, and the bar was an
 * indirection that got the answer wrong for any press near a boundary — which is exactly where a user
 * aiming at a barline puts the pointer.
 *
 * ⚠️ Declines when the press is on no staff band (between two staves, or off the music): there is no
 * line there, and stamping the nearest one in the score would be a guess. The tool stays armed either
 * way — you place these in runs (a final at the end of each section).
 */
export function stampBarlineAtClick(
  state: EditorState,
  engine: MusicEngine,
  registry: BarlineHitRegistry,
  x: number,
  y: number,
  render: () => void,
): boolean {
  const tool = state.selectedMarkingTool
  if (tool?.kind !== 'barline') return false

  const boundary = nearestBoundary(registry, x, y)
  if (boundary === null) {
    dbg(`· Barline declined | press @${x.toFixed(1)},${y.toFixed(1)} is on no staff — no line to place on`)
    return true
  }

  applyBarlineSign(engine, tool.sign, boundary)
  // Repaint even when nothing changed: the click consumed a placement, and the ghostless tool has
  // nothing else to show for it.
  render()
  return true
}
