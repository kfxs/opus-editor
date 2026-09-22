/**
 * ⭐ **The GRACE stamp's click** (`docs/plans/grace-notes-plan.md` §3 rule 1, D6 — decided 2026-09-22):
 * a click hangs a grace on the NOTE (or REST — D7 reversed) it lands nearest, at the click's PITCH,
 * drawn as the armed value.
 *
 * ⭐ **It behaves like NOTE ENTRY** (P2a, his rule): x is a COLUMN, y a PITCH — `./graceTarget` says
 * where. In a grace's column the pitch joins that grace (a grace CHORD; the same pitch is refused); in a
 * gap a new grace stands THERE — first, between two, or last. The pitch is the click's y through
 * `pixelToPosition`, the note-entry rule.
 *
 * The tool stays armed (a stamp is used in runs) and every click is ours while it is — a miss is a
 * no-op, never a note entered by accident.
 */
import { dbg } from '@/utils/debug'
import { entryAlteration } from '../../engine/models/entryAlteration'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { ElementRegistry } from '../../engine/ElementRegistry'
import { armedTool, pendingArticulations, type EditorState } from '../state/EditorState'
import { graceClickAt } from './graceTarget'

export function stampGraceAtClick(
  state: EditorState, engine: MusicEngine, registry: ElementRegistry, x: number, y: number, render: () => void,
  /** Put the keyboard caret on what the click made — `SelectionController.moveCaretTo`, the note click's. */
  caretTo: (noteId: string) => void = () => {},
): boolean {
  const tool = armedTool(state, 'grace')
  if (!tool) return false

  const { position, target } = graceClickAt(engine, registry, x, y, state.selectedDuration)
  const host = target?.host
  if (!target || !host?.id) {
    dbg('· Grace stamp: no note near the click — no change')
    return true
  }
  // ⭐ A REST is a host too (D7 reversed, his call 2026-09-22): the grace is entered first, the note
  //    after it takes it over. On a whole-bar rest the click's BEAT names where it belongs.
  // ⭐ Spelled EXACTLY as note entry spells a click (his words: *"the grace should behaive like normal
  //    note entry"*): the ARMED accidental wins; none armed = what is in force where the grace sounds —
  //    the bar's running accidental, else the key (`entryAlteration`); an armed ♮ is FORCED, or a
  //    natural that cancels nothing would never show (`NoteEntryCoordinator`'s rule). It stays armed:
  //    a stamp is used in runs.
  const { step, octave } = position.spelling
  const hostBeat = host.type === 'rest' ? position.beat : engine.getNote(host.id)?.beat ?? position.beat
  const alter = entryAlteration(
    engine.getScore(), { measure: position.measure, beat: hostBeat, staff: position.staff }, step, octave, state.selectedAccidental,
  )
  const spelling = { step, octave, alter, ...(state.selectedAccidental === 'n' && { forceAccidental: true }) }
  const written = { duration: state.selectedDuration, ...(state.selectedDots && { dots: state.selectedDots }) }
  // ⭐ In a grace's COLUMN: a grace CHORD — note entry's chord rule, the same pitch refused.
  if (target.chordWith) {
    const pitch = engine.grace.addGracePitch(target.chordWith, spelling, written, pendingArticulations(state))
    dbg(pitch
      ? `✓ Grace chord | +${spelling.step}${state.selectedAccidental ?? ''}${spelling.octave} on grace ${target.chordWith}`
      : `· Grace chord: the grace already has ${spelling.step}${spelling.octave} — no change`)
    if (pitch) {
      caretTo(pitch.id)
      render()
    }
    return true
  }
  const grace = engine.grace.addGrace(
    host.id, tool.side, spelling, tool.form, written,
    host.type === 'rest' ? position.beat : undefined,
    pendingArticulations(state),
    target.index,
  )
  if (!grace) {
    dbg(`· Grace stamp: note ${host.id} refused it (see graceOps.addGrace) — no change`)
    return true
  }
  dbg(`✓ Grace stamped | ${tool.form} ${spelling.step}${state.selectedAccidental ?? ''}${spelling.octave} ${state.selectedDuration} before ${host.type} ${host.id} at ${target.index}`)
  // ⭐ The grace is the CARET, as an entered note is (his rule, 2026-09-22: *"the grace stamp should
  //    behave similar to note stamp"*): selected, the blue line after it, and a typed letter is its main
  //    note (`controllers/keyboardCaret`). The tool stays armed.
  caretTo(grace.pitches[0].id)
  render()
  return true
}
