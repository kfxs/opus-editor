/**
 * ⭐⭐ **WHAT A GROUP IS, IN OUR OWN VOCABULARY** — `docs/own-engraving-engine.md` P1c.
 *
 * ## Read out of the call sites, not designed
 *
 * `DrawContext.openGroup` used to hand back whatever the painter made, and 22 sites cast it to
 * `SVGGElement`. Reading all 22 showed they do exactly **four** things with it, and three of those
 * need no DOM at all:
 *
 * | what | who | answered by |
 * |---|---|---|
 * | set a `transform` | the staff scale (9 passes via `inStaffSpace`), the measure group, the gutter, the brace, two ghosts | {@link DrawGroup.setPlacement} — ⭐ **rule 8's affine, arriving where it was always going to be needed** |
 * | measure what was drawn, and drop it if nothing was | the 7 cursor ghosts | {@link DrawGroup.inkBox} + {@link DrawGroup.discard} |
 * | tag the primitive that just landed | the barline's two halves | {@link DrawGroup.tagLast} |
 * | hand the node to the EDITOR, to highlight later | hairpin, trill, ottava, pedal, slur, tie, fan member | ⛔ {@link DrawGroup.node} — the escape, and the next number to drive down |
 *
 * ## 🚨🚨 The third row is the SCENE's own argument, and it was already written down twice
 *
 * `BarlineRenderer` and `barlineGap` both carry the same comment — *"written by reading the group's
 * LAST CHILD back, because a context's drawing calls return the context and not the node"*. That is
 * a workaround for primitives being **invisible once drawn**, and in a scene it stops existing: a
 * primitive is a VALUE with fields. {@link DrawGroup.tagLast} is the smallest possible version of
 * that idea, and it is what a scene implementation makes trivial.
 *
 * ## ⛔ What this is NOT
 *
 * ⛔ Not an SVG node, and ⛔ not a DOM wrapper. Three of the four capabilities are answerable by a
 * recording implementation with no page at all — which is the whole point, because that
 * implementation is the SCENE (§7.2). The fourth is quarantined behind one method with a name you
 * can grep for.
 */
import type { Affine } from './Affine'

/** A box in the space the group was drawn in. ⚠️ ⛔ Not a DOM `DOMRect`. */
export interface DrawBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * ⭐ The raw thing a painter hands back from `openGroup` — an `SVGGElement` for the SVG painter, a
 * record for a recording one. ⛔ Nothing outside a painter may assume which.
 */
export type OpenedGroup = unknown

export interface DrawGroup {
  /**
   * ⭐⭐ **WHERE THIS GROUP SITS** — rule 8's placement, composed over everything drawn inside it.
   *
   * ⛔ Not "a scale" and ⛔ not "an x and a y", though every current caller passes one of those:
   * the type is the whole point, per §7.5.4. `IDENTITY` is what everything engraved normally
   * carries, and a painter is free to emit nothing for it.
   */
  setPlacement(placement: Affine): void

  /**
   * ⭐ **WHAT THIS GROUP ACTUALLY DREW**, in its own space — or **null** when it drew nothing
   * measurable.
   *
   * ⚠️ **null is the ordinary answer in jsdom**, where a glyph has no size
   * (`reference: jsdom cannot measure glyphs`), and the cursor ghosts are written for it: they treat
   * it as *"no ghost"*, ⛔ never as an error.
   *
   * 🚨 **It is the box BEFORE {@link DrawGroup.setPlacement}** — the group's own contents in the
   * group's own coordinates. That is what a ghost needs (it measures, then decides where to park),
   * and it is the trap recorded as *"a mark's getBBox PRECEDES its translate"*.
   */
  inkBox(): DrawBox | null

  /** Undo this group and everything drawn into it — the ghost that turned out to be unmeasurable. */
  discard(): void

  /**
   * Mark the GROUP itself — a fact about the whole thing drawn, for a later pass to read.
   *
   * One caller: a composite barline opts out of pixel-grid hinting (`data-no-hint`), because a sign
   * is aligned as a whole or not at all — nudging one stroke of a `:||:` and not the other changes
   * the white gap that IS the sign. ⚠️ Distinct from {@link DrawGroup.tagLast}, which marks the last
   * primitive INSIDE.
   */
  tag(name: string, value: string): void

  /**
   * ⭐ **TAG THE PRIMITIVE THAT LANDED LAST** in this group.
   *
   * The barline's two halves: each stroke of a `:||:` says which half it belongs to, so a press on
   * one lights that half. ⚠️ A no-op when nothing has been drawn yet — ⛔ never an error, because
   * the caller is in a loop over strokes some of which may be empty.
   */
  tagLast(name: string, value: string): void

  /**
   * ⛔⛔ **THE ESCAPE — the group as the painter's own object.**
   *
   * Two callers, both the same shape: the drawn node is handed to the EDITOR, which later recolours
   * it for a selection highlight (`hairpinGroupMap` and its five siblings, read back through
   * `ScoreRenderer.get*SVGGroup`), and the cursor ghosts, which recolour their own ink.
   *
   * ⚠️ **That is a real seam, not a leftover** — `ARCHITECTURE.md` says the renderer is the source
   * of truth for geometry, and highlighting is the editor reading drawn ink. ⛔ But it is out of
   * scope here, and it is the reason this method is one grep away rather than a cast at 22 sites:
   * `npm run lint:paint` counts it, and the count may only fall.
   */
  node(): OpenedGroup
}
