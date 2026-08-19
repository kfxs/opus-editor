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
import type { ChordRest, Measure, Dynamic, Fraction } from '@/types/music'
import { fracCompare, fracGte, fracToNumber } from '@/utils/fraction'
import { splitDynamicRuns, dynamicLabel, composeDynamicGlyphs } from '@/utils/dynamics'
import { DYNAMIC_GLYPH_SIZE, DYNAMIC_TEXT_SIZE, DYNAMIC_TEXT_FONT, DYNAMIC_GLYPH_INK_ABOVE, DYNAMIC_GLYPH_INK_BELOW } from './dynamicStyle'
import { dynamicOffsetOverrideOf } from '../models/engravingOverrides'
import { shiftDynamicMark } from './dynamicMarkTransform'
import { drawnTextOrigin, firstDrawnText } from './drawnText'
import { dynamicInkReachSpaces } from './dynamicMarkInk'
// ⚠️ The UNSCALED staff space, exactly as `DYNAMIC_GLYPH_INK_ABOVE` is an unscaled px constant: the
// boxes here are read from `getBBox`, i.e. in the mark's OWN user space, inside whatever `scale(k)`
// group its staff carries. Converting through `staffSpacesToPixels` would apply k twice.
import { STAFF_SPACE_PX } from '../models/staffSize'
import { staffSpacesToPixels } from './staffSpace'
import type { RenderPass } from './RenderPass'
import { voiceOf } from '@/utils/lanes'

/**
 * ⭐ **The slot a mark hangs off**, by the fall-forward rule: the first slot at-or-after its beat,
 * else the last one; −1 in an empty bar. An exact hit needs no case of its own — it is simply the
 * smallest beat ≥ the mark's.
 *
 * ⭐⭐ **The staff's slots, in EVERY voice, whatever the mark governs** (his call, 2026-08-19). Where
 * a mark is drawn is a question about COLUMNS, and a column belongs to the staff; what the mark
 * governs is a question about loudness. `view` is already one staff's lane, so being here is the
 * whole of the first half.
 *
 * ⚠️⚠️ **`sortedSlots` arrives VOICE-MAJOR**, not in beat order: `drawMeasureContent` builds it as
 * `groups.flatMap(g => g.slots)`, one group per voice. So "the first match" in it is the lowest
 * VOICE's, which is why this compares (beat, then voice) explicitly rather than scanning. With a
 * scoped mark that never mattered — one voice was in play. A mark governing the whole staff sees
 * every voice, and a plain scan would hang it on voice 1's next slot even when voice 2 has one
 * nearer its beat.
 *
 * ⭐ The voice is the tie-break, so two voices striking one beat resolve to the SAME slot every
 * render: an anchor that moved when a second voice was added would move the drawn mark with it.
 *
 * Exported for its own spec: the ordering trap above is the whole of it, and asserting it through
 * `attachDynamicsToSlots` would mean standing up VexFlow annotations to measure an ARRAY INDEX.
 */
export function anchorSlotIndex(slots: readonly ChordRest[], beat: Fraction): number {
  const earlier = (a: number, b: number) =>
    fracCompare(slots[a].beat, slots[b].beat) || voiceOf(slots[a]) - voiceOf(slots[b])
  let next = -1
  let last = -1
  for (let i = 0; i < slots.length; i++) {
    if (fracGte(slots[i].beat, beat) && (next === -1 || earlier(i, next) < 0)) next = i
    if (last === -1 || earlier(last, i) < 0) last = i
  }
  return next !== -1 ? next : last
}

/**
 * Attach each of the measure's dynamics to its anchor StaveNote as an Annotation
 * modifier, BEFORE formatting, so vertical placement stacks with articulations. The
 * anchor is the slot at the dynamic's beat, in any voice of this staff ({@link anchorSlotIndex});
 * if there is no slot exactly there it falls forward to the next one, else the last one, else the
 * last note — this keeps a dynamic visible even when it sits under an empty/rest beat.
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

    let targetIdx = anchorSlotIndex(sortedSlots, dyn.beat)
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
 * (so the newest mark sits on the right), centered on their anchor. VexFlow stacks
 * multiple annotations vertically and its modifier offsets are awkward to control,
 * so we reposition the rendered SVG groups directly (a translate), then update each
 * one's registry bbox so hit-testing follows. Must run AFTER {@link registerDynamics}.
 * Pure no-op in non-DOM tests (getBBox unavailable → entries skipped).
 *
 * ⭐ **HORIZONTAL ONLY, since P1 of docs/dynamics-line-and-hairpins-plan.md.** It used to align the
 * row on the first mark's vertical CENTRE, which put a 14 px italic word against a 30 px glyph's box
 * instead of on its baseline — `p dolce` sat visibly stepped, and only in the co-located case (a mark
 * on its own has always been drawn at the text size and grown upward from one baseline, which is what
 * {@link buildDynamicAnnotation}'s comment protects). ⛔ The vertical belongs to the LINE now
 * (`dynamicsLinePass`), which gives both marks the same baseline for free — so putting a `dy` back
 * here would be two answers to one question.
 *
 * @param groups dynamic-id groups (placement order) from {@link attachDynamicsToSlots}.
 */
export function layoutCoLocatedDynamics(pass: RenderPass, groups: string[][]): void {
  // 0.6 staff-spaces of INK, in the bar's own space — the mark is drawn inside the staff's scale
  // group, so a small staff's row closes up with it (docs/staff-size-plan.md §1).
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

    // Center the row where the group currently sits (placement-order first = leftmost).
    const centerX = items[0].box.x + items[0].box.width / 2
    const total = items.reduce((s, it) => s + it.box.width, 0) + GAP * (items.length - 1)

    let cursor = 0
    for (const it of items) {
      const targetX = centerX - total / 2 + cursor
      cursor += it.box.width + GAP

      // The TIGHT bbox registerDynamics already stored (rebuilt from the <text> baseline for level
      // glyphs) is shifted by this translate — do NOT write back `it.box`, which is the raw getBBox
      // group box that re-unions VexFlow's inflated pointer-rect (the very thing registerDynamics
      // stripped). Writing it.box back re-inflated co-located level marks, throwing off hit-testing
      // and the attachment line's dynamic-side endpoint. `shiftDynamicMark` does both, and owns the
      // element's transform so this and the line pass cannot overwrite each other.
      shiftDynamicMark(pass, it.id, it.el, targetX - it.box.x, 0)
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
 * shifts are awkward to control for annotations), and COMPOSES with it: both are pure translations,
 * so a co-located AND nudged mark keeps its place in the row. ⭐ The composition is
 * `dynamicMarkTransform`'s now rather than a PREPEND onto whatever attribute it found — see that
 * module for why the arrival of the line pass made prepending unsafe. Must run AFTER
 * `registerDynamics` (needs the bbox). Pure no-op in non-DOM tests (no SVG element) and when no
 * offset is stored.
 *
 * ⭐ **The offset is measured from the LINE now**, not from wherever VexFlow dropped the annotation —
 * the stored delta is unchanged and anchor-relative as it always was, but its origin is finally a
 * rule instead of a side effect (plan §4).
 */
export function applyDynamicOffsets(pass: RenderPass, measure: Measure, stave: Stave): void {
  if (!measure.dynamics?.length) return
  for (const dyn of measure.dynamics) {
    const off = dynamicOffsetOverrideOf(pass.score, dyn.id)
    if (!off || (off.x === 0 && off.y === 0)) continue
    const el = pass.dynamicObjectMap.get(dyn.id)?.getSVGElement?.() as SVGGraphicsElement | undefined
    if (!el) continue

    shiftDynamicMark(pass, dyn.id, el, staffSpacesToPixels(off.x, stave), staffSpacesToPixels(off.y, stave))
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
        // (HighlightController.applyAnchorGuideLine) — never hit-testing. The annotation carries
        // its anchor note (VexFlow Modifier.getNote); positions are final here (post-draw).
        const note = annotation.getNote() as StaveNote | undefined
        const ys = note?.getYs?.()
        const anchorY = ys?.length ? Math.max(...ys) : note?.getStave?.()?.getYForLine(4)
        const anchor = note && anchorY !== undefined ? { x: note.getAbsoluteX(), y: anchorY } : undefined
        const spacing = note?.getStave?.()?.getSpacingBetweenLines?.()

        // Default: the group box (correct for pure-TEXT marks — their pointer-rect is small). For any
        // mark containing a GLYPH run — a bare level OR a mixed `mp dolce` — the group box unions
        // VexFlow's tall transparent pointer-rect AND the glyph's full font ascent, ballooning it
        // above the mark; rebuild it from the <text> — horizontal from its own extent, vertical from
        // the baseline + tight offsets (see dynamicStyle). This keeps the mark's TOP consistent
        // whether it's a bare glyph or mixed, so the text-edit overlay lands at the same height for
        // both (a mixed mark used to sit too high). Ignores the group height.
        const hasGlyphRun = splitDynamicRuns(dynamicLabel(dyn)).some(r => r.glyph && r.text.trim() !== '')
        let bx = box.x, by = box.y, bw = box.width, bh = box.height
        // ⚠️ Through `./drawnText`: a missing `y` means ZERO, not "not drawn". Read off the
        //    attribute this silently fell back to the BALLOONED group box — the very box the
        //    rebuild exists to replace — for any mark VexFlow happened to place at y=0.
        // ⭐ Hoisted out of the glyph branch below because the guide point reads it too: the mark's
        //    BASELINE is what both the rebuilt box and the ink top are measured from.
        const origin = hasGlyphRun ? drawnTextOrigin(firstDrawnText(el)) : null
        if (hasGlyphRun) {
          const textEl = firstDrawnText(el) as SVGGraphicsElement | null
          const textBox = textEl?.getBBox ? textEl.getBBox() : null
          if (textBox) { bx = textBox.x; bw = textBox.width }
          if (origin) {
            by = origin.y - DYNAMIC_GLYPH_INK_ABOVE
            bh = DYNAMIC_GLYPH_INK_ABOVE + DYNAMIC_GLYPH_INK_BELOW
          }
        }
        // ⭐⭐ WHERE A GUIDE MAY TOUCH THIS MARK — a point ON THE INK, which the box is not.
        //
        // The box's top is `baseline − DYNAMIC_GLYPH_INK_ABOVE`, one fraction for every letter, and
        // over a `p` that is nine pixels above anything drawn: *"for dynamic letters there is too
        // much air, so it is an empty space"* (his report of the attachment line, 2026-08-17). The
        // font knows better per letter, so ask it — `./dynamicMarkInk`, whose header carries both
        // the numbers and why the BOX itself deliberately keeps the constant.
        //
        // ⭐ THE CORNER NEAREST THE STAFF, so the guide never crosses the letter it points at: the
        // ink's TOP for a mark below the staff (the line rises to the note), its BOTTOM for one
        // above. MuseScore's is the same idea from the other end — its anchor line runs to the
        // staff's near line, and leaves the element's own origin, which their layout has already put
        // on the ink (`textlayout.cpp:221`; see `./dynamicMarkInk`).
        //
        // ⚠️ `null` for prose (`dolce`): the table is Bravura's and a serif word is not in it. The
        // box is then used as before — right for prose anyway, since a text box's top IS roughly its
        // cap height, which is the case he said *"does not look bad"*.
        const ink = dynamicInkReachSpaces(dynamicLabel(dyn))
        const above = dyn.placement === 'above'
        const guideY = ink && origin
          ? origin.y + (above ? ink.below : -ink.above) * STAFF_SPACE_PX
          : (above ? by + bh : by)
        pass.elementRegistry.add({
          type: 'dynamic',
          id: dyn.id,
          measure: measure.number,
          beat: fracToNumber(dyn.beat),
          bbox: { x: bx, y: by, width: bw, height: bh },
          // ⚠️ x is the BOX's left, and that is not a shortcut: horizontally the box already IS ink
          // (the `<text>`'s own `getBBox`, which a browser measures from the glyph outlines — the
          // vertical is the layout box, which is why only the vertical had to be asked of the font).
          // ⚠️ One guide, and only when the anchor note was found: ⛔ a guide is never a guess.
          ...(anchor ? { guides: [{ from: { x: bx, y: guideY }, to: anchor }] } : {}),
          // ⭐ The stave's line spacing where this mark was DRAWN — what the interpolating walk
          // (`interactions/dynamicWalk`) converts a measured pixel gap into staff-spaces with. ⛔ It
          // refuses to guess one, so this is the only route: a small staff beside a normal one is a
          // ratio, and a guessed scale would re-base the offset by the wrong distance.
          ...(spacing === undefined ? {} : { staffSpacePx: spacing }),
        })
      }
    } catch (_e) { /* getBBox may fail before layout in some envs */ }
  }
}
