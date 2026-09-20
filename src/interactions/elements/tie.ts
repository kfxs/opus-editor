/**
 * A TIE — the arc joining two soundings of the same pitch. Identified by the note it comes FROM,
 * because that is where the model keeps it (`tiedTo` on the pitch).
 *
 * ⭐ **Hit-tested against the sampled CURVE, like the slur** (docs/plans/slur-plan.md §12 Phase 3b). It
 * used to be a padded RECTANGLE around the arc's bbox — so a press anywhere in the empty air under
 * a tie selected it, and the tie was the last span element that behaved that way. The points arrive
 * for free now that every tie draws through `drawCurveArc`, which is why this landed with the
 * migration rather than as its own errand.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import { distToSegment } from './slur'

export const TIE_ELEMENT: ClickableElementSpec = {
  kind: 'tie',
  /** Select a tie arc for removal. */
  hit({ registry, x, y }, deps) {
    // Distance to the line SEGMENTS between consecutive samples, not to the samples themselves: a
    // cross-system half spans a whole system, so its ~17 points sit far apart (the slur's note).
    const tiePad = 6
    const tieAt = registry.getByType('tie').find(el => {
      const pts = el.points
      if (!pts?.length) {
        // No sampled arc (a tie drawn before the migration, or one whose draw failed) — fall back
        // to the padded bbox so a tie is never unselectable.
        const b = el.bbox
        return x >= b.x - tiePad && x <= b.x + b.width + tiePad
          && y >= b.y - tiePad && y <= b.y + b.height + tiePad
      }
      if (pts.length === 1) return (x - pts[0].x) ** 2 + (y - pts[0].y) ** 2 <= tiePad * tiePad
      for (let i = 1; i < pts.length; i++) {
        if (distToSegment(x, y, pts[i - 1], pts[i]) <= tiePad) return true
      }
      return false
    }) ?? null
    if (!tieAt?.fromNoteId) return false

    dbg(`✓ Tie selected | fromNoteId:${tieAt.fromNoteId} toNoteId:${tieAt.toNoteId} fromMeasure:${tieAt.fromMeasure} toMeasure:${tieAt.toMeasure}`)
    // The shared tail clears the whole note selection (the multi-select Map, not just the anchor)
    // and any previous element, so only the tie ends up selected.
    return deps.pick({ kind: 'tie', fromNoteId: tieAt.fromNoteId })
  },

  highlight: paintSelectedTie,
}

export function paintSelectedTie(ctx: HighlightContext): void {
  const engine = ctx.engine
  const fromNoteId = selectedOf(ctx.state, 'tie')?.fromNoteId
  if (!fromNoteId) return

  // Paint the tie in ITS voice's colour (V1 blue, V2 green — Sibelius-style;
  // matches the notehead highlight) rather than a uniform orange.
  const voice = engine.getNote(fromNoteId)?.voice ?? 0
  paintNoteTie(ctx, fromNoteId, voiceFillColor(voice))
}

/**
 * Colour the tie `noteId` OWNS — its forward (`tiedTo`) arc. Shared by the selected-NOTE highlight
 * ({@link paintNote}, so a tied note reads as fully selected) and the selected-TIE highlight
 * ({@link paintSelectedTie}), exactly as {@link paintNoteArticulations} is shared.
 *
 * The FORWARD tie only, which is precisely what the Keypad's Enter key lights and removes
 * (`PaletteController.noteHasTie` reads `tiedTo`) — so score and Keypad always agree. Select the
 * far end of a tie and neither lights: that note owns no tie, it is only tied INTO.
 *
 * No lookup of `tiedTo` is needed: `tieGroupMap` is keyed by the FROM note, so a note that ties to
 * nothing simply has no group and this is a no-op.
 */
export function paintNoteTie(ctx: HighlightContext, noteId: string, color: string): void {
  const group = ctx.engine.getTieSVGGroup(noteId)
  if (!group) return
  paintTieGroup(ctx, group, color)
}

/** Colour the tie inside its OWN `<g class="tie">` group — never a document-wide
 *  bbox path-scan, which bled onto staff lines whose bbox fell inside the tie's
 *  rectangle (mirrors the slur fix). An arc emits TWO paths — a stroke-only outline
 *  and a fill-only body (`engrave/curves/curveInk`) — so set fill AND stroke on each,
 *  or a selected tie shows a coloured body with a black outline (see curveArc.ts). */
export function paintTieGroup(ctx: HighlightContext, group: SVGGElement, tieColor: string): void {
  group.querySelectorAll('path').forEach(el => {
    ctx.setAttr(el, 'fill', tieColor)
    ctx.setAttr(el, 'stroke', tieColor)
    ctx.setStyleProp(el, 'fill', tieColor)
    ctx.setStyleProp(el, 'stroke', tieColor)
    ctx.addClass(el, 'selected-tie')
  })
}
