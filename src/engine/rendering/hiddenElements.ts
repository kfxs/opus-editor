/**
 * **What a HIDDEN element does, and who is looking.**
 *
 * The editor lets you hide things that are still real content — today the hidden rest (engraving
 * client #6, Sibelius' Ctrl+Shift+H, docs/rest-hide-plan.md), tomorrow whatever joins it. "Hidden"
 * has never meant *gone*: the rest still fills its beat, still holds its column, is still
 * selectable, and can still be unhidden. What it means is **do not engrave this**.
 *
 * But an editor that literally stopped drawing a hidden element would make it unfindable — you
 * could not click what leaves no ink. So the editor draws it GRAY: visible enough to select and
 * unhide, obviously not part of the music. That gray is an **editing affordance, not engraving**,
 * and it must not survive onto paper. It did: the PDF re-renders the score through the same
 * renderer, so every hidden rest was printing as a gray rest.
 *
 * Hence the render **audience**. One render, two readers:
 *
 *   - `'editor'` — a hidden element is TINTED. You can see it, select it, unhide it.
 *   - `'print'`  — a hidden element is OMITTED. Nothing of it reaches the page.
 *
 * ⚠️ **Omitted, not un-formatted.** The treatment is applied *after* the draw, so the element has
 * already taken part in formatting and kept its column. That is the correct reading of "hidden":
 * a hidden half rest still holds half a bar of space, exactly as it does on screen, so hiding a
 * rest never re-spaces the music around it. Suppressing it earlier — skipping the voice, or
 * `renderOptions.draw = false` before `format()` — would close the gap and move real notes.
 *
 * ## Adding the next hideable element
 *
 * The audience is the whole mechanism, so a new hideable element does NOT add a branch here. It
 * finds the SVG group its ink lives in and hands it to {@link applyHiddenTreatment} — one call,
 * both audiences answered. Only ink drawn OUTSIDE a group of its own needs to consult
 * {@link hiddenTreatment} directly and skip its own draw (the rest's supporting ledger line is
 * the one such case: a bare stroke on the shared context, with no group to remove).
 */

/**
 * Who the render is for. `'editor'` is the default everywhere; only an export asks for `'print'`,
 * and it does so on its OWN renderer (`engine/export/scoreSvg.ts`), never on the editor's.
 */
export type RenderAudience = 'editor' | 'print'

/** Gray a hidden element renders in for the editor (Tailwind gray-400 family). */
export const HIDDEN_ELEMENT_COLOR = '#9CA3AF'

/**
 * The table. Two audiences, two treatments — the single place the question is answered, so a new
 * hideable element inherits the print behaviour instead of re-deciding it (and forgetting to).
 */
export function hiddenTreatment(audience: RenderAudience): 'tint' | 'omit' {
  return audience === 'print' ? 'omit' : 'tint'
}

/**
 * Apply the audience's treatment to one hidden element's rendered SVG group.
 *
 * Tinting colours every `text`/`path` in the group rather than setting `fill` on the group itself,
 * because VexFlow writes `fill` onto the leaves and a parent's fill loses to a child's. It is a
 * post-draw DOM edit for the same reason the ghost note and the selection highlight are: VexFlow's
 * `setStyle` mutates the shared drawing context and leaks the colour onto everything drawn after
 * (see reference: setStyle context leak).
 *
 * Omitting removes the group outright. Safe only because the draw is over — see the ⚠️ above.
 */
export function applyHiddenTreatment(group: SVGGElement, audience: RenderAudience): void {
  if (hiddenTreatment(audience) === 'omit') {
    group.remove()
    return
  }
  group.querySelectorAll('text, path').forEach((el) => {
    const svgEl = el as SVGElement
    svgEl.setAttribute('fill', HIDDEN_ELEMENT_COLOR)
    svgEl.style.fill = HIDDEN_ELEMENT_COLOR
  })
}
