/**
 * Dynamics rendering & layout — extracted from {@link VexFlowRenderer}. Operates on
 * the passed-in {@link RenderPass} + measure (no renderer-instance state), matching the
 * engine's free-function module idiom.
 *
 * Flow per measure (all called from `renderMeasure`):
 *   1. {@link attachDynamicsToSlots} — build each Annotation, attach to its anchor
 *      StaveNote, stash in `dynamicObjectMap`; returns co-located id-groups.
 *   2. {@link registerDynamics} — register each rendered mark's SVG bbox for hit-testing.
 *   3. {@link layoutCoLocatedDynamics} — reposition stacked marks onto one row.
 *
 * {@link buildDynamicAnnotation} is also used by the renderer's dynamic-ghost preview,
 * so it is exported.
 */
import { Annotation } from 'vexflow'
import type { StaveNote, Stave } from 'vexflow'
import type { ChordRest, Measure, Dynamic } from '@/types/music'
import { fracEq, fracGte, fracToNumber } from '@/utils/fraction'
import { splitDynamicRuns, dynamicLabel, composeDynamicGlyphs } from '@/utils/dynamics'
import { DYNAMIC_GLYPH_SIZE, DYNAMIC_TEXT_SIZE, DYNAMIC_TEXT_FONT, DYNAMIC_GLYPH_INK_ABOVE, DYNAMIC_GLYPH_INK_BELOW } from './dynamicStyle'
import { dynamicOffsetOverrideOf } from '../models/engravingOverrides'
import { staffSpacesToPixels } from './staffSpace'
import type { RenderPass } from './RenderPass'
import { voiceOf } from '@/utils/lanes'

/**
 * Attach each of the measure's dynamics to its anchor StaveNote as an Annotation
 * modifier, BEFORE formatting, so vertical placement stacks with articulations. The
 * anchor is the slot at the dynamic's (voice, beat); if there is no slot exactly there
 * it falls forward to the next slot in that voice, else the last slot of that voice,
 * else the last note — this keeps a dynamic visible even when it sits under an empty/rest beat.
 *
 * Each Annotation's DOM id is set to the Dynamic.id so its `<g class="vf-annotation">`
 * group is individually addressable (Phase 6 highlight); the object is stashed
 * in `dynamicObjectMap` for that lookup.
 *
 * Multiple dynamics may share one anchor note (the user can stack marks at a
 * beat, e.g. `p dolce`). VexFlow would stack them vertically; we lay them out
 * left-to-right in placement order afterwards — see {@link layoutCoLocatedDynamics}.
 *
 * IMPORTANT: each annotation's modifier width is ZEROED ({@link buildDynamicAnnotation}
 * calls setWidth(0)) so the formatter reserves no horizontal space for it — a long
 * text mark must never push the notes apart. The notes rule the layout; dynamics
 * are a secondary overlay (it overflows freely to the right of its note). The
 * annotation is still a real modifier, so VexFlow's vertical placement (below the
 * staff) and drawing happen normally. The registry bbox is taken from the rendered
 * SVG ({@link registerDynamics}) since the zeroed width would otherwise mis-size it.
 * @returns the dynamic-id groups (size ≥ 2) sharing a note, in placement order.
 */
export function attachDynamicsToSlots(pass: RenderPass, sortedSlots: ChordRest[], staveNotes: StaveNote[], measure: Measure): string[][] {
  const dynamics = measure.dynamics
  if (!dynamics?.length || staveNotes.length === 0) return []

  const byTarget = new Map<number, string[]>()
  for (const dyn of dynamics) {
    if (dyn.id === pass.suppressedDynamicId) continue // being edited in the text overlay
    const voice = voiceOf(dyn)

    let targetIdx = sortedSlots.findIndex(s => voiceOf(s) === voice && fracEq(s.beat, dyn.beat))
    if (targetIdx === -1) {
      targetIdx = sortedSlots.findIndex(s => voiceOf(s) === voice && fracGte(s.beat, dyn.beat))
    }
    if (targetIdx === -1) {
      for (let i = sortedSlots.length - 1; i >= 0; i--) {
        if (voiceOf(sortedSlots[i]) === voice) { targetIdx = i; break }
      }
    }
    if (targetIdx === -1) targetIdx = staveNotes.length - 1
    if (targetIdx < 0 || targetIdx >= staveNotes.length) continue

    const annotation = buildDynamicAnnotation(dyn)
    staveNotes[targetIdx].addModifier(annotation, 0)
    pass.dynamicObjectMap.set(dyn.id, annotation)
    const arr = byTarget.get(targetIdx) ?? []
    arr.push(dyn.id)
    byTarget.set(targetIdx, arr)
  }

  return [...byTarget.values()].filter(ids => ids.length >= 2)
}

/**
 * Lay co-located dynamics out on one row, left-to-right in PLACEMENT ORDER
 * (so the newest mark sits on the right), centered on their anchor and aligned
 * on a common vertical center. VexFlow stacks multiple annotations vertically
 * and its modifier offsets are awkward to control, so we reposition the rendered
 * SVG groups directly (a translate), then update each one's registry bbox so
 * hit-testing follows. Must run AFTER {@link registerDynamics}. Pure no-op in
 * non-DOM tests (getBBox unavailable → entries skipped).
 *
 * @param groups dynamic-id groups (placement order) from {@link attachDynamicsToSlots}.
 */
export function layoutCoLocatedDynamics(pass: RenderPass, groups: string[][]): void {
  const GAP = 6
  for (const ids of groups) {
    const items: Array<{ id: string; el: SVGGraphicsElement; box: { x: number; y: number; width: number; height: number } }> = []
    for (const id of ids) {
      const el = pass.dynamicObjectMap.get(id)?.getSVGElement?.() as SVGGraphicsElement | undefined
      if (!el?.getBBox) continue
      try {
        const box = el.getBBox()
        items.push({ id, el, box: { x: box.x, y: box.y, width: box.width, height: box.height } })
      } catch { /* getBBox can throw before layout in some envs */ }
    }
    if (items.length < 2) continue

    // Center the row where the group currently sits; align on the first mark's
    // vertical center (placement-order first = leftmost).
    const centerX = items[0].box.x + items[0].box.width / 2
    const centerY = items[0].box.y + items[0].box.height / 2
    const total = items.reduce((s, it) => s + it.box.width, 0) + GAP * (items.length - 1)

    let cursor = 0
    for (const it of items) {
      const targetX = centerX - total / 2 + cursor
      const dx = targetX - it.box.x
      const dy = centerY - (it.box.y + it.box.height / 2)
      it.el.setAttribute('transform', `translate(${dx}, ${dy})`)
      cursor += it.box.width + GAP

      // Shift the TIGHT bbox registerDynamics already stored (rebuilt from the <text> baseline for
      // level glyphs) by this translate — do NOT write back `it.box`, which is the raw getBBox group
      // box that re-unions VexFlow's inflated pointer-rect (the very thing registerDynamics stripped).
      // Writing it.box back re-inflated co-located level marks, throwing off hit-testing and the
      // attachment line's dynamic-side endpoint. Mirrors applyDynamicOffsets' shift-in-place.
      const entry = pass.elementRegistry.getById(it.id)
      if (entry) entry.bbox = { x: entry.bbox.x + dx, y: entry.bbox.y + dy, width: entry.bbox.width, height: entry.bbox.height }
    }
  }
}

/**
 * Build the VexFlow Annotation for one dynamic. The mark's text is glyph-substituted (each glyph
 * run → its SMuFL glyph, words left as typed) and drawn as ONE annotation in an italic-serif-first
 * stack whose LAST font is the music font — so glyph runs fall back to the music glyph while words
 * stay serif italic. All default to below-staff placement.
 *
 * IMPORTANT: EVERY mark — including a bare level — is set at the small TEXT size here, NOT the big
 * glyph size. VexFlow places a "below" annotation's baseline at `lowestNoteY + gap + textHeight`,
 * where textHeight is font-size-dependent; setting a bigger size for levels pushed their baseline
 * LOWER than a text mark's, so a dynamic and an expression sat at different heights. Placing them
 * all at the text size gives them ONE baseline; the glyph runs are then enlarged around that fixed
 * baseline by {@link applyMixedDynamicRuns} (a bigger `<tspan>` grows the glyph but not its baseline).
 */
export function buildDynamicAnnotation(dyn: Dynamic): Annotation {
  // The text IS the display string — glyph runs already hold their SMuFL glyph characters.
  const annotation = new Annotation(dynamicLabel(dyn))
  annotation.setAttribute('id', dyn.id)
  annotation.setVerticalJustification(dyn.placement === 'above' ? 'above' : 'below')
  // Left-justify so the FIRST character anchors on the note (the tick), not the
  // text centre. Dynamics/expression text reads left-to-right from the note.
  annotation.setJustification(Annotation.HorizontalJustify.LEFT)

  // Italic serif for words, music font appended as the per-character fallback so glyph runs still
  // draw as the SMuFL glyph. Text size for ALL marks so they share one baseline (see above).
  annotation.setFont({ family: `${DYNAMIC_TEXT_FONT}, Bravura`, size: DYNAMIC_TEXT_SIZE, style: 'italic' })

  // Zero the modifier width (AFTER setFont, which re-measures) so the formatter
  // reserves no horizontal space — the mark never pushes the notes apart. The
  // text still renders in full (renderText draws the string); only the reported
  // width is 0. Vertical placement and drawing are unaffected. See attachDynamicsToSlots.
  annotation.setWidth(0)
  return annotation
}

/**
 * Enlarge each glyph run of a dynamic to the big music-glyph size by re-laying the mark's `<text>`
 * as per-run `<tspan>`s — glyph runs at the glyph size, words at the text size. Applies to ANY mark
 * with a glyph run: a bare level (`mp`), a mixed mark (`mp dolce`), or a level-bearing expression.
 *
 * {@link buildDynamicAnnotation} draws every mark at the SMALL text size, which is what fixes the
 * baseline: VexFlow places the "below" baseline using the font size, so all marks share one baseline;
 * this pass then grows only the glyph runs, and a bigger `<tspan>` font-size grows the glyph UPWARD
 * from that fixed baseline — so a dynamic and an expression sit at the same height. Runs AFTER draw
 * and BEFORE {@link registerDynamics} (so the bbox reflects the bigger glyph). Pure-text marks have
 * no glyph run and are skipped. No-op in non-DOM tests (no `<text>` / no `getComputedStyle`).
 */
export function applyMixedDynamicRuns(pass: RenderPass, measure: Measure): void {
  if (!measure.dynamics?.length || typeof document === 'undefined' || typeof getComputedStyle !== 'function') return
  for (const dyn of measure.dynamics) {
    if (dyn.id === pass.suppressedDynamicId) continue
    const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGElement | undefined
    const text = el?.querySelector?.('text') as SVGTextElement | null
    if (text) enlargeDynamicGlyphRuns(text, dyn)
  }
}

/**
 * Re-lay one dynamic `<text>` as per-run `<tspan>`s so its glyph runs draw at the big glyph size
 * while words stay at the text size — the mark keeps its `<text>` x / baseline y, so the glyph
 * grows UPWARD from the shared baseline. Shared by the score pass ({@link applyMixedDynamicRuns})
 * and the placement ghost, so the two never drift. No-op when the mark has no glyph run.
 */
export function enlargeDynamicGlyphRuns(text: SVGTextElement, dyn: Dynamic): void {
  if (typeof getComputedStyle !== 'function') return
  const runs = splitDynamicRuns(dynamicLabel(dyn))
  if (!runs.some(r => r.glyph && r.text.trim() !== '')) return // no glyph run → leave as-is

  // The mark was drawn at the text size; scale glyph runs up by the glyph/text ratio so they match
  // a standalone level glyph, whatever unit VexFlow rendered the base size in.
  const basePx = parseFloat(getComputedStyle(text).fontSize) || DYNAMIC_TEXT_SIZE
  const glyphPx = basePx * (DYNAMIC_GLYPH_SIZE / DYNAMIC_TEXT_SIZE)
  const NS = 'http://www.w3.org/2000/svg'

  while (text.firstChild) text.removeChild(text.firstChild) // keep the <text>'s x / baseline y
  for (const run of runs) {
    const tspan = document.createElementNS(NS, 'tspan')
    if (run.glyph) {
      tspan.setAttribute('font-family', 'Bravura')
      tspan.setAttribute('font-size', `${glyphPx}px`)
      tspan.setAttribute('font-style', 'normal')
      // Ligature step: the model stores one char per letter, but Bravura's per-letter advances only
      // suit a letter standing alone (a hand-built `fff` is ~24% too wide). Swap in the precomposed
      // glyph for DRAWING only — this runs before registerDynamics, so the hit-box follows the
      // tighter shape for free. See composeDynamicGlyphs.
      tspan.textContent = composeDynamicGlyphs(run.text)
    } else {
      tspan.setAttribute('font-family', DYNAMIC_TEXT_FONT)
      tspan.setAttribute('font-style', 'italic')
      // SVG collapses whitespace at a run's edges; a non-breaking space survives (see TempoLayout).
      tspan.textContent = run.text.replace(/ /g, ' ')
    }
    text.appendChild(tspan)
  }
}

/**
 * Apply each dynamic's hand-nudged position offset (client #8 — see docs/dynamic-offset-plan.md).
 * The stored `{x,y}` is in staff-spaces, anchor-relative; convert to pixels against the measure's
 * stave and translate the rendered SVG group, then shift its registry bbox so hit-testing follows.
 *
 * Uses the same SVG-transform technique as {@link layoutCoLocatedDynamics} (VexFlow's modifier
 * shifts are awkward to control for annotations), and COMPOSES with it: a co-located mark already
 * carries a `translate(...)`, so the offset is PREPENDED — both are pure translations, so they add
 * commutatively and the co-location layout is preserved. Must run AFTER `registerDynamics` (needs
 * the bbox) and `layoutCoLocatedDynamics` (to compose on top of its transform). Pure no-op in
 * non-DOM tests (no SVG element) and when no offset is stored.
 */
export function applyDynamicOffsets(pass: RenderPass, measure: Measure, stave: Stave): void {
  if (!measure.dynamics?.length) return
  for (const dyn of measure.dynamics) {
    const off = dynamicOffsetOverrideOf(pass.score, dyn.id)
    if (!off || (off.x === 0 && off.y === 0)) continue
    const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGraphicsElement | undefined
    if (!el) continue

    const dx = staffSpacesToPixels(off.x, stave)
    const dy = staffSpacesToPixels(off.y, stave)
    const existing = el.getAttribute('transform')
    el.setAttribute('transform', existing ? `translate(${dx}, ${dy}) ${existing}` : `translate(${dx}, ${dy})`)

    const entry = pass.elementRegistry.getById(dyn.id)
    if (entry) entry.bbox = { x: entry.bbox.x + dx, y: entry.bbox.y + dy, width: entry.bbox.width, height: entry.bbox.height }
  }
}

/**
 * Register each rendered dynamic into the ElementRegistry (for hit-testing /
 * selection) using its Annotation's bounding box. Runs as a post-pass over the
 * measure's dynamics rather than inside the slot loop, so it covers dynamics
 * anchored to BOTH chords and rests uniformly. The registry entry carries only
 * id + bbox; kind/level/text are looked up from the model when needed.
 */
export function registerDynamics(pass: RenderPass, measure: Measure): void {
  if (!measure.dynamics?.length) return
  for (const dyn of measure.dynamics) {
    const annotation = pass.dynamicObjectMap.get(dyn.id)
    if (!annotation) continue
    try {
      // Use the rendered SVG bounds, not Annotation.getBoundingBox(): the modifier
      // width is zeroed (see buildDynamicAnnotation) so getBoundingBox would report
      // a 0-width box, breaking hit-testing. getBBox gives the true painted extent.
      // (Matches what layoutCoLocatedDynamics already uses.)
      const el = annotation.getSVGElement?.() as SVGGraphicsElement | undefined
      const box = el?.getBBox ? el.getBBox() : null
      if (box) {
        // The anchor: the note this mark is attached to — its X and its LOWEST notehead Y (the
        // one nearest a below-staff dynamic). Anchoring to the note itself (not a fixed staff
        // line) makes the attachment line TRACK the note when its pitch moves — the bar redraws
        // on a pitch change, so this recaptures at the new position. Drives the dashed
        // attachment-line visualization when the dynamic is selected
        // (HighlightController.applyDynamicAnchorLine) — never hit-testing. The annotation carries
        // its anchor note (VexFlow Modifier.getNote); positions are final here (post-draw).
        const note = annotation.getNote() as StaveNote | undefined
        const ys = note?.getYs?.()
        const anchorY = ys?.length ? Math.max(...ys) : note?.getStave?.()?.getYForLine(4)
        const anchor = note && anchorY !== undefined ? { x: note.getAbsoluteX(), y: anchorY } : undefined

        // Default: the group box (correct for pure-TEXT marks — their pointer-rect is small). For any
        // mark containing a GLYPH run — a bare level OR a mixed `mp dolce` — the group box unions
        // VexFlow's tall transparent pointer-rect AND the glyph's full font ascent, ballooning it
        // above the mark; rebuild it from the <text> — horizontal from its own extent, vertical from
        // the baseline + tight offsets (see dynamicStyle). This keeps the mark's TOP consistent
        // whether it's a bare glyph or mixed, so the text-edit overlay lands at the same height for
        // both (a mixed mark used to sit too high). Ignores the group height.
        const hasGlyphRun = splitDynamicRuns(dynamicLabel(dyn)).some(r => r.glyph && r.text.trim() !== '')
        let bx = box.x, by = box.y, bw = box.width, bh = box.height
        if (hasGlyphRun) {
          const textEl = el?.querySelector('text') as SVGGraphicsElement | null
          const textBox = textEl?.getBBox ? textEl.getBBox() : null
          if (textBox) { bx = textBox.x; bw = textBox.width }
          const baseline = parseFloat(textEl?.getAttribute('y') ?? '')
          if (Number.isFinite(baseline)) {
            by = baseline - DYNAMIC_GLYPH_INK_ABOVE
            bh = DYNAMIC_GLYPH_INK_ABOVE + DYNAMIC_GLYPH_INK_BELOW
          }
        }
        pass.elementRegistry.add({
          type: 'dynamic',
          id: dyn.id,
          measure: measure.number,
          beat: fracToNumber(dyn.beat),
          bbox: { x: bx, y: by, width: bw, height: bh },
          ...(anchor ? { anchor } : {}),
        })
      }
    } catch (_e) { /* getBBox may fail before layout in some envs */ }
  }
}
