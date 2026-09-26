/**
 * ⭐ **WHAT THE EDITOR'S VOICE MODEL SAYS A NOTE IS — kept across the voice rule, and put back after it.**
 *
 * The column's voice rule (`engrave/notes/voiceStack`, VexFlow's `StaveNote.format` transcribed, run by
 * `format/modifierColumns` inside `formatColumns`) rewrites same-tick notes of different voices: it hides
 * one of two same-duration rests, steps a rest aside, turns a stem over, and shifts a head sideways. This
 * editor stacks its voices itself (`layout/restVoicePlacement`, the voice's forced stem side), so all four
 * are undone — but only AFTER the rule has run, because the dots, accidentals, articulations and
 * annotations it stacked read what it did, and the column keeps the room it bought (`voiceStack`'s header).
 *
 * Asked by the page (`ScoreRenderer.drawMeasureContent`) and the bent staff (`eye/spineScore`), so the
 * two keep ONE answer to "what survives the voice rule".
 */
import type { EngravedNote } from '../engraved/EngravedNote'

/** Each note's rest line / stem direction / horizontal shift, as the voice model built it. */
export interface VoiceIntent {
  restLine: Map<EngravedNote, number>
  stemDir: Map<EngravedNote, number>
  xShift: Map<EngravedNote, number>
}

/**
 * Capture `notes`' intent BEFORE formatting. A whole-bar (centred) rest's line is not captured — it is
 * centred separately, and a re-assert would disturb that. With one voice only the rest lines are kept:
 * nothing else of a single voice is rewritten.
 */
export function captureVoiceIntent(notes: readonly EngravedNote[], multiVoice: boolean): VoiceIntent {
  const intent: VoiceIntent = { restLine: new Map(), stemDir: new Map(), xShift: new Map() }
  for (const note of notes) {
    if (note.isRest()) {
      if (!note.isCenterAligned()) intent.restLine.set(note, note.getKeyLine(0))
    } else if (multiVoice) {
      // The stem set from voice parity or the `x` override — the rule must not flip it.
      intent.stemDir.set(note, note.getStemDirection())
    }
    // Keep every voice at the shared X (no auto sideways offset). A whole-bar rest carries its centring
    // in a separate `centerXShift`, so restoring its xShift is harmless.
    if (multiVoice) intent.xShift.set(note, note.getXShift())
  }
  return intent
}

/**
 * Undo the voice rule on `notes`, AFTER formatting: every rest drawn again, back on its captured line;
 * every note's captured stem; every captured x-shift. `setKeyLine` / `setStemDirection` refresh the note.
 */
export function reassertVoiceIntent(notes: readonly EngravedNote[], intent: VoiceIntent): void {
  for (const note of notes) {
    if (note.isRest()) {
      note.renderOptions.draw = true
      const line = intent.restLine.get(note)
      if (line !== undefined && note.getKeyLine(0) !== line) note.setKeyLine(0, line)
    } else {
      const dir = intent.stemDir.get(note)
      if (dir !== undefined && note.getStemDirection() !== dir) note.setStemDirection(dir)
    }
    const xShift = intent.xShift.get(note)
    if (xShift !== undefined && note.getXShift() !== xShift) note.setXShift(xShift)
  }
}
