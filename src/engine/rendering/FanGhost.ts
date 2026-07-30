/**
 * THE FEATHER STAMP'S GHOST — a bare NOTEHEAD following the cursor, dot and all.
 *
 * Its own module rather than a twelfth function in {@link GhostRenderer}, per CLAUDE.md's rule: the
 * table there gains a ROW ({@link GHOST_DRAWERS}) and the drawing lives here. What it draws is one
 * head and nothing else — see {@link ToolGhost}'s `fan` member for why the stem is not the stamp's
 * to promise.
 *
 * ⭐ **HOW A HEAD IS DRAWN ALONE.** VexFlow has no "notehead only" note: a `StaveNote` of a half or
 * an eighth builds a stem, and `shouldDrawFlag()` asks only whether a stem OBJECT exists — hiding
 * the stem (`Stem.setVisibility(false)`) still leaves an eighth's flag hanging in mid-air. So the
 * note is drawn WHOLE and then PRUNED IN PLACE: VexFlow puts each head in its own `vf-notehead`
 * group (`NoteHead.draw` opens it), and — the reason this works — it draws that head's MODIFIERS
 * inside that same group (`parent.drawModifiers(this)`, the fact
 * `reference_vexflow_articulation_notehead_group` records). Deleting every OTHER child of the note's
 * group therefore keeps the augmentation dot, at the offset VexFlow computed for this duration, and
 * drops the stem, the flag and the pointer rect in one move.
 *
 * ⚠️ IN PLACE is not a detail — see the pruning below for what lifting the heads out costs.
 *
 * ⚠️ The alternative — calling `note.drawNoteHeads()` and never `draw()` — is one line shorter and
 * WRONG: `draw()` is what sets each head's x (`setX(getNoteHeadBeginX())`) before drawing, so the
 * heads land at one x and their dots at another.
 */
import { Stave, StaveNote, Voice, Formatter, Dot, Barline, type SVGContext } from 'vexflow'
import type { NoteDuration } from '@/types/music'
import { convertDuration } from './NoteBuilder'

/** The class `VexFlowRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  {@link GHOST_GROUP_SELECTOR}, or the ghost smears one copy per mouse position. */
export const FAN_GHOST_GROUP_CLASS = 'ghost-fan-group'

/** Px the head is parked LEFT of the pointer. The arrow's body extends down-RIGHT from its tip, so
 *  a head centred on the cursor is a head under the cursor — the same reason the accidental ghost
 *  parks left. The VERTICAL is exact, deliberately: the click's y is the pitch, so the head has to
 *  sit at the height it will be placed at. */
const GAP_X = 5

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Draw the ghost head at the cursor. Returns false if nothing was drawn (a duration VexFlow refuses,
 * a head that came out empty) — the caller treats that as "no ghost", never as an error.
 */
export function drawFanGhost(
  ctx: SVGContext, svg: SVGElement, cursorX: number, cursorY: number, duration: NoteDuration, dots: number,
): boolean {
  try {
    const childrenBefore = svg.children.length

    // A 0-line stave draws nothing itself, and gives the note something to be positioned against —
    // the trick every cursor ghost uses. 'b/4' is the middle line under the default clef, so the
    // head is the one NoteBuilder would have drawn; WHICH pitch the click takes is the click's
    // business, and the ghost's y says it (see GAP_X).
    const tempStave = new Stave(0, cursorY, 120, { numLines: 0 })
    tempStave.setBegBarType(Barline.type.NONE)
    tempStave.setEndBarType(Barline.type.NONE)
    tempStave.setContext(ctx)

    const note = new StaveNote({ keys: ['b/4'], duration: convertDuration(duration, dots) })
    for (let d = 0; d < dots; d++) Dot.buildAndAttach([note], { all: true })
    note.setStave(tempStave)
    note.setContext(ctx)

    // A voice + formatter gives the note a tick context (it will not draw without one).
    const voice = new Voice({ numBeats: 4, beatValue: 4 }).setMode(Voice.Mode.SOFT).addTickable(note)
    new Formatter().joinVoices([voice]).format([voice], 100)
    note.draw()

    const drawn: Element[] = []
    for (let i = childrenBefore; i < svg.children.length; i++) drawn.push(svg.children[i])
    if (drawn.length === 0) return false

    // DROP EVERYTHING THAT IS NOT A HEAD — but PRUNE IN PLACE, never lift the heads out.
    //
    // ⭐⭐ **The group VexFlow drew into carries the glyphs' FONT.** `SVGContext.openGroup` stamps the
    // context's current attributes onto the `<g>`, and `fillText` then OMITS from the `<text>` every
    // attribute the enclosing group already states. So whether the head's own node carries
    // `font-size` depends on what the context's font happened to be when the group opened — and
    // after a score render has left it at glyph size, the head carries NOTHING and inherits from
    // `vf-stavenote`. Lifting the head out of that group therefore dropped it to the SVG root's 10pt:
    // his report — *"the note was so tiny that it seems a dot"* — and it appeared only AFTER a stamp,
    // because that is what left the context at 30pt for the next ghost. Keeping the container is the
    // fix; it is also why the whole family draws through `openGroup` in the first place.
    //
    // `vf-`, because `openGroup` prefixes every class it is given (`reference_vexflow_opengroup_prefix`).
    let heads = 0
    for (const el of drawn) {
      for (const child of Array.from(el.children)) {
        if (child.classList?.contains('vf-notehead')) heads++
        else child.remove()
      }
    }
    if (heads === 0) {
      for (const el of drawn) svg.removeChild(el)
      return false
    }

    // The wrapper moves the CONTAINERS, not their children, so every attribute they carry travels
    // with them — the class is only there for the sweep and the tint.
    const group = document.createElementNS(SVG_NS, 'g')
    group.setAttribute('class', FAN_GHOST_GROUP_CLASS)
    for (const el of drawn) svg.removeChild(el)
    for (const el of drawn) group.appendChild(el)
    svg.appendChild(group)

    const gbox = (group as unknown as SVGGraphicsElement).getBBox?.()
    if (gbox && gbox.width > 0) {
      const dx = cursorX - GAP_X - (gbox.x + gbox.width)
      const dy = cursorY - (gbox.y + gbox.height / 2)
      group.setAttribute('transform', `translate(${dx}, ${dy})`)
    }

    return true
  } catch (_e) {
    return false
  }
}
