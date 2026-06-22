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
import { Annotation, TextDynamics } from 'vexflow'
import type { StaveNote } from 'vexflow'
import type { ChordRest, Measure, Dynamic, DynamicLevel } from '@/types/music'
import { fracEq, fracGte, fracToNumber } from '@/utils/fraction'
import { DYNAMIC_GLYPH_SIZE, DYNAMIC_TEXT_SIZE, DYNAMIC_TEXT_FONT } from './dynamicStyle'
import type { RenderPass } from './RenderPass'

/**
 * Per-letter SMuFL codepoints for dynamics (`p`/`m`/`f`/`s`/`z`/`r`), reused from
 * VexFlow's TextDynamics. `Glyphs.*` (with precomposed `dynamicMP`/`dynamicMF`)
 * isn't exported by the package, so a level like `mp` is rendered by concatenating
 * its letters' glyphs. This generalizes for free to future ppp…fff / sf / sfz.
 */
const DYNAMIC_LETTER_GLYPHS = TextDynamics.GLYPHS as Record<string, string | undefined>

/** Map a dynamic level (e.g. 'mf') to its SMuFL glyph string. */
function levelToGlyphString(level: DynamicLevel): string {
  return [...level].map(ch => DYNAMIC_LETTER_GLYPHS[ch] ?? ch).join('')
}

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
    const voice = dyn.voice ?? 0

    let targetIdx = sortedSlots.findIndex(s => (s.voice ?? 0) === voice && fracEq(s.beat, dyn.beat))
    if (targetIdx === -1) {
      targetIdx = sortedSlots.findIndex(s => (s.voice ?? 0) === voice && fracGte(s.beat, dyn.beat))
    }
    if (targetIdx === -1) {
      for (let i = sortedSlots.length - 1; i >= 0; i--) {
        if ((sortedSlots[i].voice ?? 0) === voice) { targetIdx = i; break }
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

      const entry = pass.elementRegistry.getById(it.id)
      if (entry) entry.bbox = { x: it.box.x + dx, y: it.box.y + dy, width: it.box.width, height: it.box.height }
    }
  }
}

/**
 * Build the VexFlow Annotation for one dynamic. Level marks render the SMuFL
 * dynamics glyph in the music font (global stack); custom-text marks render the
 * user's text in an italic text font. Both default to below-staff placement.
 */
export function buildDynamicAnnotation(dyn: Dynamic): Annotation {
  const isLevel = dyn.kind === 'level' && dyn.level !== undefined
  const label = isLevel ? levelToGlyphString(dyn.level!) : (dyn.text ?? '')

  const annotation = new Annotation(label)
  annotation.setAttribute('id', dyn.id)
  annotation.setVerticalJustification(dyn.placement === 'above' ? 'above' : 'below')
  // Left-justify so the FIRST character anchors on the note (the tick), not the
  // text centre. Dynamics/expression text reads left-to-right from the note.
  annotation.setJustification(Annotation.HorizontalJustify.LEFT)

  if (isLevel) {
    // Level glyph: keep the default family (VexFlow's global Bravura+text stack)
    // so the SMuFL dynamics glyph follows the score's engraving font.
    annotation.setFont({ size: DYNAMIC_GLYPH_SIZE })
  } else {
    // Custom text: an italic serif — the notation convention for expression
    // text (dolce, espr.). A real serif face guarantees a true italic slant
    // (the music font has no italic). User-selectable styling is future work.
    annotation.setFont({ family: DYNAMIC_TEXT_FONT, size: DYNAMIC_TEXT_SIZE, style: 'italic' })
  }

  // Zero the modifier width (AFTER setFont, which re-measures) so the formatter
  // reserves no horizontal space — the mark never pushes the notes apart. The
  // text still renders in full (renderText draws the string); only the reported
  // width is 0. Vertical placement and drawing are unaffected. See attachDynamicsToSlots.
  annotation.setWidth(0)
  return annotation
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
        pass.elementRegistry.add({
          type: 'dynamic',
          id: dyn.id,
          measure: measure.number,
          beat: fracToNumber(dyn.beat),
          bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
        })
      }
    } catch (e) { /* getBBox may fail before layout in some envs */ }
  }
}
