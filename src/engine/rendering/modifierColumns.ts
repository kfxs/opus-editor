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
 * ⭐ **All five rules this editor needs are ours now** (S9c–g: `engrave/notes/voiceStack`,
 * `dotStack`, `accidentalStack`, `articulationStack`, `annotationStack` — each VexFlow's, transcribed
 * exactly). Ten of VexFlow's fifteen are skipped because this editor builds none of those modifiers —
 * each of their `format`s returns at once on an empty list, so skipping them is exact. A context that ever holds one REFUSES
 * loudly instead of drawing it wrong.
 */
import { Modifier, type ModifierContext } from 'vexflow'
import { addTicks } from '@/engine/layout/tickCount'
import { stackDots } from '@/engine/engrave/notes/dotStack'
import { stackAccidentals } from '@/engine/engrave/notes/accidentalStack'
import { type ArticulationSide, stackArticulations } from '@/engine/engrave/notes/articulationStack'
import { STAVE_LINE_DISTANCE_PX, UNISON_SHARES_HEAD } from '@/engine/engrave/inheritedDefaults'
import { stackAnnotations } from '@/engine/engrave/notes/annotationStack'
import { stackVoices } from '@/engine/engrave/notes/voiceStack'
import { EngravedAnnotation } from './EngravedAnnotation'
import { fontSizeToPx } from './drawnFontSize'
import { EngravedArticulation } from './EngravedArticulation'
import { staffLineY } from '@/engine/engrave/staff/staffFrame'
import { EngravedAccidental } from './EngravedAccidental'
import { EngravedDot } from './EngravedDot'
import { EngravedNote, columnVoiceNoteOf } from './EngravedNote'
import { noteFrame } from './staveFrame'
import { type BarTickable, type BarVoice, isEngravedNote, sharedResolution } from './barVoice'

/**
 * The modifier kinds VexFlow formats that this editor never builds (`modifiercontext.js:79–100`).
 * ⚠️ A member of any of them has no rule here — see {@link ColumnModifiers.preFormat}.
 */
const NO_RULE_KINDS = [
  'Parenthesis', 'FretHandFinger', 'Stroke', 'GraceNoteGroup', 'NoteSubGroup',
  'StringNumber', 'Ornament', 'ChordSymbol', 'Bend', 'Vibrato',
] as const

/** A column's running state — `ModifierContextState`: the room either side, the text lines each side. */
export interface ColumnModifierState {
  leftShift: number
  rightShift: number
  textLine: number
  topTextLine: number
}

/**
 * One column's modifier context — the notes that start together, and what they carry.
 *
 * ⭐ S12j-b: no longer VexFlow's `ModifierContext` — it keeps what anything asks of one: the members
 * filed by CATEGORY (`addMember`), the running `state`, the width, the metrics. ⚠️ A VexFlow NOTE still
 * files itself and its modifiers here (`Tickable.addToModifierContext` → `addMember`) and asks
 * `preFormat`, `getWidth`, `getState` and `getRightShift` — every one answered below.
 */
export class ColumnModifiers {
  readonly state: ColumnModifierState = { leftShift: 0, rightShift: 0, textLine: 0, topTextLine: 0 }
  readonly members: Record<string, unknown[]> = {}
  preFormatted = false
  postFormatted = false
  formatted = false
  width = 0
  spacing = 0

  /** `ModifierContext.addMember`: filed under its category, and told its column. */
  addMember(member: { getCategory(): string; setModifierContext(context: unknown): unknown }): this {
    const category = member.getCategory()
    if (!this.members[category]) this.members[category] = []
    this.members[category].push(member)
    member.setModifierContext(this)
    this.preFormatted = false
    return this
  }

  getMembers(category: string): unknown[] {
    return this.members[category] ?? []
  }

  getWidth(): number {
    return this.width
  }

  getLeftShift(): number {
    return this.state.leftShift
  }

  getRightShift(): number {
    return this.state.rightShift
  }

  getState(): ColumnModifierState {
    return this.state
  }

  /** `ModifierContext.getMetrics` — ⚠️ it throws until formatted, as VexFlow's did (nothing sets `formatted`). */
  getMetrics(): { width: number; spacing: number } {
    if (!this.formatted) throw new Error('ColumnModifiers: unformatted member has no metrics.')
    return { width: this.state.leftShift + this.state.rightShift + this.spacing, spacing: this.spacing }
  }

  /**
   * VexFlow's `ModifierContext.preFormat`, in its order: the voices (S9g), then the dots,
   * the accidentals, the articulations, the annotations. Each rule reads and writes the SAME
   * `state` (`leftShift`, `rightShift`, `textLine`, `topTextLine`), so the order is part of it.
   */
  preFormat(): void {
    if (this.preFormatted) return
    const { state, members } = this
    for (const kind of NO_RULE_KINDS) {
      if (members[kind]?.length) {
        throw new Error(`ColumnModifiers: no rule for a ${kind} — this editor never built one before`)
      }
    }
    this.formatVoices()
    this.formatDots()
    this.formatAccidentals()
    this.formatArticulations()
    this.formatAnnotations()
    this.width = state.leftShift + state.rightShift
    this.preFormatted = true
  }

  /**
   * ⭐ S9g — the column's voices making room for each other, by `engrave/notes/voiceStack`
   * (`StaveNote.format`, transcribed). The steps land through the notes' own setters, in the rule's
   * order, BEFORE the dots, accidentals, articulations and annotations are stacked — they read what
   * this moved. ⚠️ Most of it is undone again by the renderer's multi-voice re-assert (see
   * `voiceStack`'s header for what survives).
   */
  private formatVoices(): void {
    const members = this.members.StaveNote ?? []
    // One note has nothing to make room for — VexFlow's rule returns at once, before reading it.
    if (members.length < 2) return
    const notes = members.map(note => {
      if (!(note instanceof EngravedNote)) throw new Error('ColumnModifiers: a note that is not an EngravedNote')
      return note
    })
    const { steps, rightShift } = stackVoices(notes.map(columnVoiceNoteOf), UNISON_SHARES_HEAD)
    for (const step of steps) {
      const note = notes[step.note]
      switch (step.kind) {
        case 'hide': note.renderOptions.draw = false; break
        case 'moveRest': note.setKeyLine(0, note.getKeyLine(0) + step.lines); break
        case 'xShift': note.setXShift(step.px); break
        case 'stem': note.setStemDirection(step.direction); break
      }
    }
    this.state.rightShift += rightShift
  }

  /**
   * ⭐ S9f — the column's text annotations (the dynamics), by `engrave/notes/annotationStack`
   * (`Annotation.format`, transcribed). ⚠️ Every text here is an {@link EngravedAnnotation} on an
   * `EngravedNote`.
   */
  private formatAnnotations(): void {
    // Ours since S12g — filed here by the category string, so narrowed back from VexFlow's member type.
    const texts = (this.members.Annotation ?? []) as unknown[]
    if (texts.length === 0) return
    const ours = texts.map(text => {
      if (!(text instanceof EngravedAnnotation)) throw new Error('ColumnModifiers: an annotation that is not an EngravedAnnotation')
      return text
    })
    const { textLines, state } = stackAnnotations(ours.map(text => {
      const note = text.checkAttachedNote()
      if (!(note instanceof EngravedNote)) throw new Error('ColumnModifiers: an annotation on a note that is not an EngravedNote')
      const stem = note.getStem()
      return {
        align: text.getAlign(),
        side: text.getSide(),
        fontPx: fontSizeToPx(text.fontInfo.size),
        width: text.getWidth(),
        noteGlyphWidth: note.getGlyphWidth(),
        stemDirection: note.hasStem() ? note.getStemDirection() : 1,
        stemSpaces: stem && note.getNoteType() === 'n' ? Math.abs(stem.getHeight()) / STAVE_LINE_DISTANCE_PX : 0,
        staffLines: noteFrame(note)?.lineCount ?? 5,
        topLine: note.getLineNumber(true),
        bottomLine: note.getLineNumber(),
      }
    }), this.state)
    ours.forEach((text, i) => text.setTextLine(textLines[i]))
    Object.assign(this.state, state)
  }

  /**
   * ⭐ S9e — the column's articulations, by `engrave/notes/articulationStack` (`Articulation.format`,
   * transcribed). ⚠️ Every mark here is an {@link EngravedArticulation} on an `EngravedNote`; each
   * mark's origin is still set by VexFlow's `setOrigin`, as the rule did, because it rewrites the
   * mark's shifts from its own box.
   */
  private formatArticulations(): void {
    // Ours since S12f — filed here by the category string, so narrowed back from VexFlow's member type.
    const marks = (this.members.Articulation ?? []) as unknown[]
    if (marks.length === 0) return
    const ours = marks.map(mark => {
      if (!(mark instanceof EngravedArticulation)) throw new Error('ColumnModifiers: an articulation that is not an EngravedArticulation')
      return mark
    })
    const { placed, state } = stackArticulations(ours.map(mark => {
      const note = mark.checkAttachedNote()
      if (!(note instanceof EngravedNote)) throw new Error('ColumnModifiers: an articulation on a note that is not an EngravedNote')
      const stem = note.getStem()
      const position = mark.getPosition()
      const side: ArticulationSide = position === Modifier.Position.ABOVE ? 'above'
        : position === Modifier.Position.BELOW ? 'below' : 'other'
      return {
        side,
        height: mark.height,
        width: mark.getWidth(),
        betweenLines: mark.canSitBetweenLines(),
        noteGlyphWidth: note.getGlyphWidth(),
        stemDirection: note.hasStem() ? note.getStemDirection() : 1,
        stemSpaces: stem ? Math.abs(stem.getHeight()) / STAVE_LINE_DISTANCE_PX : 0,
        staffLines: noteFrame(note)?.lineCount ?? 5,
        topLine: note.getLineNumber(true),
        bottomLine: note.getLineNumber(),
      }
    }), this.state)
    ours.forEach((mark, i) => {
      const { textLine, origin } = placed[i]
      if (textLine === null || origin === null) return
      mark.setTextLine(textLine)
      mark.setOrigin(origin[0], origin[1])
    })
    Object.assign(this.state, state)
  }

  /**
   * ⭐ S9d — the column's accidentals, by `engrave/notes/accidentalStack` (`Accidental.format`,
   * transcribed). ⚠️ Every sign here is an {@link EngravedAccidental} on an `EngravedNote`.
   *
   * ⚠️ The LINE the rule sorts by is VexFlow's two-way choice, kept: the key line when the note has
   * no stave yet, and `round(y / space × 2) / 2` of that key line's y when it has one.
   */
  private formatAccidentals(): void {
    // Ours since S12e — filed here by the category string, so narrowed back from VexFlow's member type.
    const signs = (this.members.Accidental ?? []) as unknown[]
    if (signs.length === 0) return
    const ours = signs.map(sign => {
      if (!(sign instanceof EngravedAccidental)) throw new Error('ColumnModifiers: an accidental that is not an EngravedAccidental')
      return sign
    })
    const { xShifts, leftShift } = stackAccidentals(ours.map(sign => {
      const note = sign.getNote()
      if (!(note instanceof EngravedNote)) throw new Error('ColumnModifiers: an accidental on a note that is not an EngravedNote')
      const keyLine = note.getKeyProps()[sign.checkIndex()].line
      const frame = noteFrame(note)
      return {
        line: frame ? Math.round((staffLineY(frame, keyLine) / frame.spacePx) * 2) / 2 : keyLine,
        type: sign.type,
        width: sign.getWidth(),
        displacedRoom: note.getLeftDisplacedHeadPx() - note.getXShift(),
      }
    }), this.state.leftShift)
    ours.forEach((sign, i) => sign.setXShift(xShifts[i]))
    this.state.leftShift = leftShift
  }

  /**
   * ⭐ S9c — the column's augmentation dots, by `engrave/notes/dotStack` (`Dot.format`, transcribed).
   * ⚠️ Every dot here is an {@link EngravedDot} (`attachEngravedDots`), on an `EngravedNote`:
   * anything else is refused rather than placed by a rule that was not written for it.
   */
  private formatDots(): void {
    // Ours since S12c — filed here by the category string, so narrowed back from VexFlow's member type.
    const dots = (this.members.Dot ?? []) as unknown[]
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
        noteKey: note.getAttribute('id') ?? '',
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
 * count's NUMERATOR, in a sum that does not reduce (`layout/tickCount`, VexFlow's `Fraction.add`), at the voices' shared
 * resolution — so notes of different voices that start together share one context.
 */
export function attachModifierColumns(voices: readonly BarVoice[]): void {
  if (voices.length === 0) return
  const resolutionMultiplier = sharedResolution(voices)
  const byStave = new Map<unknown, Record<number, ColumnModifiers>>()
  for (const voice of voices) {
    const ticksUsed = { numerator: 0, denominator: resolutionMultiplier }
    for (const tickable of voice.tickables) {
      const tick = ticksUsed.numerator
      const stave = tickable.getStave()
      let columns = byStave.get(stave)
      if (!columns) {
        columns = {}
        byStave.set(stave, columns)
      }
      if (!columns[tick]) columns[tick] = new ColumnModifiers()
      fileInColumn(tickable, columns[tick])
      addTicks(ticksUsed, tickable.getTicks())
    }
  }
}

/**
 * File a tickable — and every modifier it carries — in a column: `Tickable.addToModifierContext`.
 * ⭐ The ONE cast: the tickable is typed for VexFlow's `ModifierContext`, and a column of ours answers
 * every call its code makes of one (`addMember`, `preFormat`, `getWidth`, `getState`, `getRightShift`).
 */
export function fileInColumn(tickable: BarTickable, column: ColumnModifiers): void {
  if (isEngravedNote(tickable)) tickable.addToModifierContext(column)
  else tickable.addToModifierContext(column as unknown as ModifierContext)
}
