/**
 * ⭐ **The DOT keys — `.`, `..`, `...` — as ONE press with a COUNT** (docs/plans/multiple-dots-plan.md P2).
 *
 * The Keypad dot key's branches, moved out of `PaletteController.toggleDot` (which is now the n = 1 call)
 * so the dev shell's `..` and `...` are the same key with another number (D5, his rule: *"it should behave
 * like the keypad dot button, but for double and for triple"*). ⭐ The counts are a RADIO (D6, his words:
 * *"it is impossible to have 3 and 2 or 1 and 2 at the same time so the dots switch if any"*): a press
 * SWITCHES to its count, and only a press of the count already held turns the dots off.
 *
 * One press, routed by context — the same split as the other stamps:
 *  0a. A tool that USES the armed length (the rest stamp) → ITS dots become n (or 0); it stays armed.
 *  0.  The dot STAMP is armed with n → disarm it; armed with another count → re-arm with n.
 *      Another marking tool armed → arm the dot stamp with n.
 *  1.  A slot's DOTS are selected in the score → they already number n ⇒ REMOVE them (the selection
 *      clears, as the accidental's does); else ⇒ SET n. Ahead of (3): clicking a dot clears the note
 *      selection, so (3) would otherwise read "nothing selected" and arm the stamp.
 *  3.  Selection mode with NOTHING note-like selected → arm the dot STAMP with n.
 *  2.  Selection mode with a note selected → n, or 0 if it already has n.
 *  4.  Entry mode → n armed for the NEXT note, or 0 if already n.
 *
 * ⭐ An ARMED count the armed value cannot take (`maxDots`, D1 — `...` on an armed 16th) is refused; a
 * WRITTEN one is refused by the model (D4), and the armed count re-reads what was actually written.
 */
import { dbg } from '@/utils/debug'
import { maxDots } from '@/utils/durations'
import { formatPitch } from '@/utils/pitchSpelling'
import type { MusicEngine } from '@/engine/MusicEngine'
import { armedTool, armedToolUsesLength, selectedOf, type EditorState } from '../state/EditorState'
import { selectedNoteIds } from '../state/selection'
import { writeSelectionValue } from '../controllers/selectionWrittenValue'
import type { SpanToolHost } from './spanToolPress'

/** What a dot press needs of the palette beyond a span tool's host. */
export interface DotKeyHost extends SpanToolHost {
  /** Repaint the armed ghost at the pointer's last position — the entry ghost shows the armed dots. */
  repaintGhost(): void
  selectNote(id: string | null): void
}

const dotsOf = (n: number) => '.'.repeat(n)

/** The count a press of `n` leaves armed, or null when the armed length cannot take it. */
function armedCountAfter(state: EditorState, n: number): number | null {
  const next = state.selectedDots === n ? 0 : n
  if (next > maxDots(state.selectedDuration)) {
    dbg(`[Dot] ${dotsOf(n)} refused — a ${state.selectedDuration} takes at most ${maxDots(state.selectedDuration)} dot(s)`)
    return null
  }
  return next
}

/** One press of the dot key with `n` dots — see the header. */
export function pressDots(host: DotKeyHost, n: number): void {
  const { state } = host
  const engine = host.getEngine()
  const armed = state.selectedMarkingTool

  // (0a) the armed length's tool keeps the press: its rest becomes dotted (or stops being)
  if (armedToolUsesLength(state)) {
    const next = armedCountAfter(state, n)
    if (next === null) return
    state.selectedDots = next
    host.repaintGhost()
    return
  }

  // (0) the dot stamp is live → its own count disarms it, another count re-arms it
  if (armed?.kind === 'dot') {
    if (armed.count === n) host.disarm()
    else host.arm({ kind: 'dot', count: n })
    return
  }
  // a DIFFERENT marking tool is armed → switch to this one (see setAccidental)
  if (armed) {
    host.arm({ kind: 'dot', count: n })
    return
  }

  // (1) the dots are selected in the score → the press removes them, or switches their count
  const selectedDot = selectedOf(state, 'dot')
  if (selectedDot && engine) {
    const noteId = selectedDot.noteId
    if ((engine.getNote(noteId)?.dots ?? 0) === n) {
      dbg(`[Dot] removing selected dot(s) | noteId:${noteId}`)
      engine.runBatch('Remove dot', () => engine.updateNote(noteId, { dots: 0 }))
      state.selectedElement = null
      state.selectedDots = 0
      host.selectNote(null)
    } else {
      dbg(`[Dot] selected dots → ${n} | noteId:${noteId}`)
      engine.runBatch(`Set ${n} dot(s)`, () => engine.updateNote(noteId, { dots: n }))
    }
    host.render()
    return
  }

  // (3) selection mode with nothing note-like selected → arm the stamp
  if (state.selectedTool === 'selection' && selectedNoteIds(state.selectedItems.values()).length === 0) {
    host.arm({ kind: 'dot', count: n })
    return
  }

  if (state.selectedNoteId && engine && state.selectedTool === 'selection') {
    // (2) a note selected → switch it to n, or undot it
    const anchor = state.selectedNoteId
    const before = engine.getNote(anchor)
    const next = (before?.dots ?? 0) === n ? 0 : n
    writeSelectionValue(engine, state, { dots: next })
    // What was WRITTEN — the model may refuse (D4) — is what the keys light.
    state.selectedDots = engine.getNote(anchor)?.dots ?? 0
    if (before && !before.isRest) {
      dbg(`[Duration] ${formatPitch(before)} | ${before.duration}${dotsOf(before.dots ?? 0)} → ${before.duration}${dotsOf(state.selectedDots)}`)
    }
    host.render()
  } else if (state.selectedTool === 'entry') {
    // (4) entry mode: the count is armed for the next note; the ghost shows it
    const next = armedCountAfter(state, n)
    if (next === null) return
    state.selectedDots = next
    host.repaintGhost()
  }
}

/**
 * Is the `n`-dot key LIT? The armed stamp's count; in selection, the selected slot's count (what
 * `SelectionController` copies into `selectedDots`) — or the selected dots' own; in entry, the armed count.
 */
export function dotsLit(state: EditorState, engine: MusicEngine | null, n: number): boolean {
  const stamp = armedTool(state, 'dot')
  if (stamp) return stamp.count === n
  const selectedDot = selectedOf(state, 'dot')
  if (selectedDot && engine) return (engine.getNote(selectedDot.noteId)?.dots ?? 0) === n
  return state.selectedDots === n
}
