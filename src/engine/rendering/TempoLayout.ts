/**
 * Tempo-mark rendering & layout — the render side of {@link TempoMark}
 * (docs/tempo-marks-plan.md §6). Free functions over the passed-in {@link RenderPass} +
 * measure, matching the {@link DynamicsLayout} idiom.
 *
 * Called once per measure from `renderMeasure`, AFTER the voices are formatted and drawn
 * (an anchor note's absolute X does not exist before that).
 *
 * ## Why this does not use `Stave.setTempo()` / the stave-modifier path
 *
 * VexFlow's `StaveTempo` is the right primitive — it engraves `Allegro (♩ = 120)` with the
 * SMuFL `metNote*` glyphs and auto-parenthesizes the metronome when a word is present. But
 * three things make the built-in path unusable here, and all three are handled below:
 *
 * 1. `Stave.setTempo()` hardcodes `x = stave.x`, so it can only mark the START of a bar.
 *    We construct `StaveTempo` ourselves with an x taken from the anchor note.
 * 2. `StaveTempo.draw()` never calls `ctx.openGroup()` — it emits bare `<text>` nodes into
 *    whatever group is open (inside the stave's, via `Stave.draw()`). There would be NO
 *    element carrying the mark's id, so hit-testing, selection-highlight and text-edit
 *    suppression would all have nothing to hold. We open the group ourselves.
 * 3. `draw()` adds `stave.getModifierXShift(this.getPosition())` to x — which, in VexFlow,
 *    indexes `stave.modifiers` BY THE POSITION ENUM (3 = ABOVE). For a stave that isn't
 *    carrying ≥4 modifiers that is `undefined.getPosition()` — a crash. We neutralize it
 *    (see `staveWithoutModifierShift`) and position the mark ourselves.
 */
import { StaveTempo } from 'vexflow'
import type { Stave, StaveNote } from 'vexflow'
import type { ChordRest, Measure, TempoMark } from '@/types/music'
import { fracCompare, fracToNumber } from '@/utils/fraction'
import type { RenderPass } from './RenderPass'

/**
 * The ctor's own `setXShift(10)`, which `draw()` adds to every glyph it paints. Subtracted
 * from the anchor so the mark actually lands where we asked for it.
 */
const STAVE_TEMPO_X_SHIFT = 10

/**
 * A stave façade whose `getModifierXShift()` is 0 (see the header, point 3). Prototype
 * delegation, so every other field/method — `checkContext()`, `getYForTopText()` — is the
 * REAL stave's. Cheaper and far less fragile than re-implementing `StaveTempo.draw()`.
 */
function staveWithoutModifierShift(stave: Stave): Stave {
  const proxy = Object.create(stave) as Stave & { getModifierXShift: () => number }
  proxy.getModifierXShift = () => 0
  return proxy
}

/**
 * The x a mark anchors to: the absolute X of the first note/rest at-or-after its beat
 * (the gesture `DynamicsLayout` uses), else the bar's note-start X — so a mark on an
 * empty beat, or on a bar whose notes were all deleted, still renders.
 */
function anchorX(mark: TempoMark, slots: ChordRest[], staveNotes: StaveNote[], stave: Stave): number {
  for (let i = 0; i < slots.length; i++) {
    if (fracCompare(slots[i].beat, mark.beat) >= 0) {
      try {
        return staveNotes[i].getAbsoluteX()
      } catch {
        break // not formatted (shouldn't happen post-draw) — fall through to the bar start
      }
    }
  }
  return stave.getNoteStartX()
}

/**
 * The options handed to `StaveTempo`, honouring the ONE rule its `draw()` gets wrong.
 *
 * `draw()` gates the whole metronome on `duration`, printing `bpm` in an `else if` INSIDE
 * that block. So passing a unit while withholding the number (the naive reading of
 * `showMetronome: false`) engraves a broken **`Allegro (♩ = )`** — open paren, notehead,
 * equals, nothing, close paren. And passing a `bpm` with no `duration` engraves NOTHING.
 *
 * Hence: the unit and the number travel together or not at all. A mark still SOUNDS when
 * its metronome is hidden — `showMetronome` is display, never meaning (decision D1).
 */
export function tempoOptions(mark: TempoMark): { name?: string; duration?: string; dots?: number; bpm?: number } {
  const showsMetronome = mark.showMetronome === true && mark.bpm !== undefined
  if (!showsMetronome) return { name: mark.text }
  return { name: mark.text, duration: mark.unit ?? 'q', dots: mark.dots, bpm: mark.bpm }
}

/**
 * Draw the measure's tempo marks above the staff and register each one's rendered bbox
 * for hit-testing.
 *
 * SCOPE: a mark is drawn above its scope's TOP staff — it governs the clock, not a staff,
 * so it is engraved once per system, not once per staff. v1 has exactly one scope (the
 * whole system), which resolves to staff 0; the guard is written in terms of the scope so
 * polytempo only has to change the resolver, not this call. Without it, a grand staff
 * would print `Allegro` above every staff and register duplicate ids.
 */
export function drawTempoMarks(
  pass: RenderPass,
  measure: Measure,
  stave: Stave,
  staffIndex: number,
  slots: ChordRest[],
  staveNotes: StaveNote[],
): void {
  if (!measure.tempos?.length) return
  if (staffIndex !== topStaffIndexForScope(undefined)) return

  const ctx = pass.context
  const proxyStave = staveWithoutModifierShift(stave)

  for (const mark of measure.tempos) {
    if (mark.id === pass.suppressedTempoId) continue // being edited in the text overlay

    const x = anchorX(mark, slots, staveNotes, stave) - STAVE_TEMPO_X_SHIFT

    // OUR group, carrying the mark's id → '#vf-<id>', which is what the registry bbox,
    // the selection highlight and the text-edit overlay all address it by. VexFlow's
    // StaveTempo opens none of its own.
    const group = ctx.openGroup('tempo', mark.id) as SVGGElement
    try {
      new StaveTempo(tempoOptions(mark), x, 0).setStave(proxyStave).setContext(ctx).draw()
    } finally {
      ctx.closeGroup() // never leave the group open — everything after would nest inside it
    }

    try {
      const box = group.getBBox()
      if (box.width > 0 || box.height > 0) {
        pass.elementRegistry.add({
          type: 'tempo',
          id: mark.id,
          measure: measure.number,
          beat: fracToNumber(mark.beat),
          bbox: { x: box.x, y: box.y, width: box.width, height: box.height },
        })
      }
    } catch {
      /* getBBox throws in jsdom / before layout — the mark still drew */
    }
  }
}

/**
 * The index of the staff a scope's marks are engraved above. v1: one scope = the whole
 * system = the top staff. Polytempo would map a StaffGroup id → its topmost staff.
 */
function topStaffIndexForScope(_scopeId: string | undefined): number {
  return 0
}
