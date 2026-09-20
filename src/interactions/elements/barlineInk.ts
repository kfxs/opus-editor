/**
 * ⭐ **A SELECTED BOUNDARY SIGN'S INK** — what the barline's and the open repeat's `highlight` rows
 * share: which `<g>` holds the sign drawn at a boundary (the ids are `BarlineRenderer`'s), and the
 * painter that lights ONE HALF of it plus the divider the two halves share.
 */
import type { SignHalf } from '@/engine/layout/barlineSign'
import { ELEMENT_SELECTION_FILL } from '@/utils/selectionColors'
import type { HighlightContext } from './highlightContext'

/**
 * ⭐ **The weight a selected line is drawn at, in px** — the width the barline highlight has had
 * since it shipped (`docs/how-it-works/barline-selection.md`), kept when it became a recolour. Thin ink reads
 * paler than a filled glyph at the same hue, and 2 px is what made a selected barline read as
 * selected. See {@link thickenToHighlightWeight}.
 */
const HIGHLIGHT_WEIGHT_PX = 2

/**
 * ⭐⭐ **PAINT ONE HALF OF A SIGN** — the shared body of the two highlights above, and the answer
 * to *"when we have open+end and I choose it, it highlights everything but it should highlight just
 * the part that was clicked"* (his report, 2026-08-26).
 *
 * ⭐ **The rule is `SignHalf`'s, read off the ink and not re-derived here:** every rect and glyph the
 * pass drew carries a `data-half` saying whose statement it is — `end` left of the divider, `start`
 * right of it, `shared` for the divider itself. This lights `half` **plus `shared`**, so each
 * selection at a `:||:` gets a COMPLETE repeat sign: its dots, its thin stroke, and the thick line
 * the two designs share (Gould p. 234's design (A) is one shared divider, not two whole signs).
 *
 * ⭐⭐ **AND NEVER A FRAGMENT OF ONE — his correction, 2026-08-26:** *"I can highlight on an open or
 * on a close just the thick part or the thick with the points… this is incorrect, we should always
 * highlight the music semantic and no part of it."* The first draft of this could show a bare thick
 * line, in the one case where a bar OWNS NO INK at the boundary it ends: bar *N+1*'s `|:` replaces
 * bar *N*'s plain line entirely (`signAtBoundary`), so all that was left to light was the divider.
 *
 * ⭐ So: **a selection with no ink of its own here lights the WHOLE sign standing on its line.** Bar
 * *N* said nothing, and the honest answer to "what is drawn at the line you picked?" is the whole
 * `|:` — not the 0.5 spaces of it that happen to sit on the boundary. ⚠️ It changes nothing in the
 * other three cases: a plain line and a bar's own `:|`/final already light in full, because a sign
 * nobody shares is entirely its owner's.
 *
 * ⚠️ Untagged ink lights with either half, deliberately: a fallback that shows too much is a
 * selection you can see, where one that shows too little is the bug being fixed.
 *
 * Drawn on EVERY staff of that measure, like the time signature's highlight and for the same
 * reason: one barline, stated once for the system, drawn once per staff.
 */
export function paintBarlineHalf(
  ctx: HighlightContext,
  half: SignHalf,
  groupFor: (svg: Element, staff: number) => (SVGGElement | null)[],
): void {
  const engine = ctx.engine
  const svg = ctx.svg

  const staffCount = engine.getScore().staves?.length ?? 1
  for (let staff = 0; staff < staffCount; staff++) {
    // The group's existence IS the "is this bar on screen" test — the pass draws one only for a
    // boundary it actually painted, which is what `registry.isPainted` used to be asked here.
    //
    // ⭐⭐ **SEVERAL GROUPS, because one line is now drawn in several pieces.** A joined barline is
    // this staff's own sign PLUS the segment crossing the gap below it, which cannot be drawn in
    // the staff's scale group and so is a group of its own (`engine/rendering/barlineGap`). They
    // are one line to the eye and must be one line to the selection: lighting only the sign leaves
    // black ink between the staves, which is his *"are we overlapping the blue to another black
    // barline?"* report arriving in a new place.
    const groups = groupFor(svg, staff).filter((g): g is SVGGElement => g !== null)
    if (groups.length === 0) continue
    const ink = groups.flatMap(g => [...g.querySelectorAll('rect, text')]) as SVGElement[]
    const halfOf = (el: SVGElement) => el.closest('[data-half]')?.getAttribute('data-half')
    // ⭐ Whether this selection owns any of the sign at all — see the header. When it does not, the
    // whole sign is what stands on its line, and lighting the divider alone would be the fragment.
    const ownsInk = ink.some(el => halfOf(el) === half)
    for (const el of ink) {
      const own = halfOf(el)
      if (ownsInk && own !== null && own !== undefined && own !== half && own !== 'shared') continue
      // Both ways, like every other recolour here: the attribute is what VexFlow's own context
      // wrote, and the style property is what wins if a rule ever sets one.
      ctx.setAttr(el, 'fill', ELEMENT_SELECTION_FILL)
      ctx.setStyleProp(el, 'fill', ELEMENT_SELECTION_FILL)
      ctx.addClass(el, 'selected-barline')
      if (el.tagName === 'rect') thickenToHighlightWeight(ctx, el)
    }
  }
}

/**
 * ⭐⭐ **NO PART OF A SELECTED SIGN IS THINNER THAN {@link HIGHLIGHT_WEIGHT_PX} of blue** — grown
 * symmetrically, so the stroke stays where it is drawn.
 *
 * ⭐ **HIS CALL, and it is the right reading of the old rule:** *"why not make the highlight 2px
 * again? what was wrong was the black, correct?"* Yes. The 2 px was never the problem — the old
 * mark was a SEPARATE rect that missed the sign and left black beside it, and the note that said a
 * selected barline must not look heavier was answering *"should we paint a fatter line ON TOP of
 * the engraved one?"*. This is a different question: the drawn stroke itself is the blue, and 1.6
 * px of blue on white paper simply reads paler than the meter's big filled glyph beside it — his
 * report, twice.
 *
 * ⛔ Only ever GROWS, and only what is thinner: a final bar's 0.5-space thick line is already
 * heavier than this and must not be touched, or the sign's own proportions change under selection.
 * ⚠️ The width goes back on `clearHighlights` like every other attribute here ({@link setAttr}),
 * and the next render redraws the sign from the pass anyway.
 */
function thickenToHighlightWeight(ctx: HighlightContext, rect: SVGElement): void {
  const width = Number(rect.getAttribute('width'))
  if (!Number.isFinite(width) || width >= HIGHLIGHT_WEIGHT_PX) return
  const grow = HIGHLIGHT_WEIGHT_PX - width
  ctx.setAttr(rect, 'x', String(Number(rect.getAttribute('x')) - grow / 2))
  ctx.setAttr(rect, 'width', String(HIGHLIGHT_WEIGHT_PX))
}

/** The `<g>` holding the sign drawn at the boundary that ends `measure` on `staff` — bar N's own
 *  end sign, or the start repeat its neighbour drew there instead. Null when nothing was drawn
 *  (the bar is culled, or off the last system). The ids are `BarlineRenderer`'s. */
export function barlineSignGroup(svg: Element, measure: number, staff: number): SVGGElement | null {
  return signGroupById(svg, `${measure}-${staff}-end`)
    ?? signGroupById(svg, `${measure + 1}-${staff}-start`)
}

/**
 * {@link barlineSignGroup}'s twin for the ink BELOW that staff — the piece of the same line
 * crossing into the gap, when the two staves are joined (docs/plans/barline-join-plan.md).
 *
 * ⭐ Deliberately the same two-lookup rule and the same order, because it is the same question:
 * a boundary carries one sign, drawn either by the bar that ends there or by the bar that opens a
 * repeat there, and the gap segment is filed under whichever of the two put the pen down. Null
 * whenever the gap is not joined, the staves are not drawn, or this is the bottom staff — the
 * group's existence is the whole test, exactly as above.
 */
export function barlineGapGroup(svg: Element, measure: number, staff: number): SVGGElement | null {
  return signGroupById(svg, `gap-${measure}-${staff}-end`)
    ?? signGroupById(svg, `gap-${measure + 1}-${staff}-start`)
}

/** One drawn sign's `<g>` by the tail of its id. The ids are `BarlineRenderer`'s.
 *
 *  ⚠️ `[id="…"]`, not `#…`: an id SELECTOR takes a `getElementById` fast path that answers for the
 *  FIRST match in the DOCUMENT and then checks containment — so with two scores mounted (or two
 *  test fixtures left in the body) it returns null for a group that is right here. */
export function signGroupById(svg: Element, id: string): SVGGElement | null {
  return svg.querySelector<SVGGElement>(`[id="barline-${id}"]`)
}
