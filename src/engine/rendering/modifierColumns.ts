/**
 * ⭐⭐ **THE MODIFIER CONTEXTS ARE OURS — S9b** (`docs/vexflow-removal-map.md` §5.1 #1 and #3).
 *
 * VexFlow's formatter keeps one `ModifierContext` per (stave, tick): the notes that start together
 * and every modifier they carry. Its `preFormat` is where the modifier RULES run — which way a
 * colliding voice steps aside, how far a dot or an accidental stands off, how articulations and
 * annotations stack — and it runs as a side effect of `Formatter.format`.
 *
 * This file is the SEAM those rules come home through, one at a time (S9c–g):
 *
 * - {@link attachModifierColumns} builds the contexts — `Formatter.createModifierContexts`, which
 *   `joinVoices` used to run, transcribed — so the contexts are OUR class;
 * - {@link ColumnModifiers.preFormat} is VexFlow's dispatch list, kept in its order.
 *
 * ⛔ **No rule changed in this step.** The rules it calls are still VexFlow's, and ten of VexFlow's
 * fifteen are skipped because this editor builds none of those modifiers — each of their `format`s
 * returns at once on an empty list, so skipping them is exact. A context that ever holds one REFUSES
 * loudly instead of drawing it wrong.
 */
import { Accidental, Annotation, Articulation, Formatter, Fraction, ModifierContext, StaveNote } from 'vexflow'
import type { Voice } from 'vexflow'
import { stackDots } from '@/engine/engrave/notes/dotStack'
import { EngravedDot } from './EngravedDot'
import { EngravedNote } from './EngravedNote'

/**
 * The modifier kinds VexFlow formats that this editor never builds (`modifiercontext.js:79–100`).
 * ⚠️ A member of any of them has no rule here — see {@link ColumnModifiers.preFormat}.
 */
const NO_RULE_KINDS = [
  'Parenthesis', 'FretHandFinger', 'Stroke', 'GraceNoteGroup', 'NoteSubGroup',
  'StringNumber', 'Ornament', 'ChordSymbol', 'Bend', 'Vibrato',
] as const

/** One column's modifier context — the notes that start together, and what they carry. */
export class ColumnModifiers extends ModifierContext {
  /**
   * VexFlow's `ModifierContext.preFormat`, in its order: the notes (multi-voice), then the dots,
   * the accidentals, the articulations, the annotations. Each rule reads and writes the SAME
   * `state` (`leftShift`, `rightShift`, `textLine`, `topTextLine`), so the order is part of it.
   */
  override preFormat(): void {
    if (this.preFormatted) return
    const { state, members } = this
    for (const kind of NO_RULE_KINDS) {
      if (members[kind]?.length) {
        throw new Error(`ColumnModifiers: no rule for a ${kind} — this editor never built one before`)
      }
    }
    StaveNote.format(members.StaveNote as StaveNote[], state)
    this.formatDots()
    Accidental.format(members.Accidental as Accidental[], state)
    Articulation.format(members.Articulation as Articulation[], state)
    Annotation.format(members.Annotation as Annotation[], state)
    this.width = state.leftShift + state.rightShift
    this.preFormatted = true
  }

  /**
   * ⭐ S9c — the column's augmentation dots, by `engrave/notes/dotStack` (`Dot.format`, transcribed).
   * ⚠️ Every dot here is an {@link EngravedDot} (`attachEngravedDots`), on an `EngravedNote`:
   * anything else is refused rather than placed by a rule that was not written for it.
   */
  private formatDots(): void {
    const dots = this.members.Dot ?? []
    if (dots.length === 0) return
    const ours = dots.map(dot => {
      if (!(dot instanceof EngravedDot)) throw new Error('ColumnModifiers: a dot that is not an EngravedDot')
      return dot
    })
    const { placed, width } = stackDots(ours.map(dot => {
      const note = dot.getNote()
      if (!(note instanceof EngravedNote)) throw new Error('ColumnModifiers: a dot on a note that is not an EngravedNote')
      return {
        line: note.getKeyProps()[dot.checkIndex()].line,
        noteKey: note.getAttribute('id'),
        isRest: note.isRest(),
        // `getFirstDotPx`, less its parenthesis term: this context refuses parentheses (above).
        firstDotPx: note.getRightDisplacedHeadPx(),
        width: dot.getWidth(),
        shiftY: dot.getShiftY(),
      }
    }))
    ours.forEach((dot, i) => {
      dot.setShiftY(placed[i].shiftY)
      dot.setXShift(placed[i].xShift)
    })
    this.state.rightShift += width
  }
}

/**
 * ⭐ Give every tickable of these voices its column's context — `Formatter.createModifierContexts`,
 * transcribed. Call it where `joinVoices` was called, BEFORE `format()`.
 *
 * ⚠️ Kept as VexFlow walked it: a column is keyed by the tickable's STAVE and by the running tick
 * count's NUMERATOR, in VexFlow's own `Fraction` (whose `add` does not reduce), at the voices' shared
 * resolution — so notes of different voices that start together share one context.
 */
export function attachModifierColumns(voices: readonly Voice[]): void {
  if (voices.length === 0) return
  const resolutionMultiplier = Formatter.getResolutionMultiplier([...voices])
  const byStave = new Map<unknown, Record<number, ColumnModifiers>>()
  for (const voice of voices) {
    const ticksUsed = new Fraction(0, resolutionMultiplier)
    for (const tickable of voice.getTickables()) {
      const tick = ticksUsed.numerator
      const stave = tickable.getStave()
      let columns = byStave.get(stave)
      if (!columns) {
        columns = {}
        byStave.set(stave, columns)
      }
      if (!columns[tick]) columns[tick] = new ColumnModifiers()
      tickable.addToModifierContext(columns[tick])
      ticksUsed.add(tickable.getTicks())
    }
  }
}
