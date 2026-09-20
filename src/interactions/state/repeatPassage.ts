/**
 * ⭐⭐ **REPEAT — `R` duplicates the selected bar(s) into the bars that follow.** His ask,
 * 2026-08-29: *"if a measure is selected (or group of measures) and i press shortcut R (repeat) we
 * should reproduce the current measure or group of measures after the selection… by the way we
 * don't have to insert any measure, it should work like a copy and paste"*.
 *
 * Sibelius's own key for it, and its own semantics: the passage is COPIED FORWARD over what is
 * already there — ⛔ **nothing is inserted and nothing shifts right**. Two bars selected → the next
 * two bars are overwritten by them, and every bar after that stays where it was.
 *
 * ## ⭐ It is a COPY-PASTE, and it reuses that machinery verbatim
 *
 * The clip is built by {@link buildClipboardFromSelection} and handed to `MusicEngine.pasteEvents`
 * — the same two calls `ClipboardController` makes. So a repeat carries exactly what a Ctrl+C /
 * Ctrl+V of the same box carries (every voice and staff of the passage, its dynamics, slurs,
 * hairpins, trills, ottavas, pedals, tempos, rest shifts and hand nudges), and the destination is
 * overwritten by the same rule. ⛔ Nothing about *what travels* is restated here — this module
 * answers only WHICH passage and WHERE it lands.
 *
 * ⭐ **The system clipboard is NOT touched.** `R` is not a copy: whatever the user has held since
 * their last Ctrl+C is still there afterwards, so `R` then Ctrl+V pastes what they copied, not what
 * they repeated. That is why this builds its own clip rather than routing through
 * `ClipboardController`.
 *
 * ## ⚠️ At the END of the score, bars are APPENDED — which is not an insertion
 *
 * Repeating the last bar has nowhere to land, so the destination bar is minted (and `pasteEvents`
 * itself grows the region further when the clip outruns what is left). Appending past the final
 * barline moves no existing music, which is the thing his rule forbids; refusing instead would make
 * `R` silently dead exactly where a composer uses it most.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '../../engine/MusicEngine'
import type { SelectionController } from '../controllers/SelectionController'
import { selectedOf, type EditorState } from './EditorState'
import { passageOf, passageNoteIds, spansStaves, type MeasurePassage } from './measurePassage'
import { buildClipboardFromSelection } from '../clipboard/clipboard'
import { fracCreate } from '../../utils/fraction'

/** What the repeat needs of the selection — a Pick, so a spec can drive it without a controller. */
type RepeatSelection = Pick<SelectionController, 'selectMeasureContents'>

/**
 * Repeat the selected measure box forward. Returns false — a DECLINE, leaving the key free — when
 * no measure range is selected or the passage produced nothing to copy; true when the score changed
 * and the caller should render.
 */
export function repeatSelectedPassage(
  engine: MusicEngine,
  state: EditorState,
  selection: RepeatSelection,
): boolean {
  const box = selectedOf(state, 'measureRange')
  if (!box) {
    dbg('[Repeat] nothing to repeat — select a bar or a passage first')
    return false
  }
  const source = passageOf(box)
  const score = engine.getScore()
  const ids = passageNoteIds(score, source)
  // ⭐ The ids come from the PASSAGE, not from `selectedItems`: the system-wide `double` box carries
  // no note selection at all (`MouseController`'s Ctrl+Shift path clears it), and *the highlight
  // promises the copy* — one answer for what the box means, shared with Delete and Ctrl+C.
  if (!ids.length) {
    dbg(`[Repeat] measures ${source.fromMeasure}–${source.toMeasure} hold nothing to repeat`)
    return false
  }
  // ⚠️ No mark filter: absent = every mark the window ENCLOSES, which is what a box selection means
  // (`clipboard.MarkFilter`). A hand-built note selection is the case that needs one, and a measure
  // box is never that.
  const clip = buildClipboardFromSelection(score, ids)
  if (!clip) {
    dbg(`[Repeat] measures ${source.fromMeasure}–${source.toMeasure} produced no clip`)
    return false
  }

  const bars = source.toMeasure - source.fromMeasure + 1
  const at = source.toMeasure + 1
  // A single-voice clip lands in the voice it came FROM (⛔ not the palette's active voice: a repeat
  // reproduces what is there, and every lane of a multi-voice clip keeps its own voice anyway).
  const voice = clip.lanes[0]?.voice ?? 0

  const changed = engine.runBatch(
    bars === 1 ? `Repeat measure ${source.fromMeasure}` : `Repeat measures ${source.fromMeasure}–${source.toMeasure}`,
    () => {
      // The one bar the paste must be able to address; `pasteEvents` mints any further ones the
      // clip needs (`rebarOps` grows the region when the relay outruns it).
      if (!score.measures.some(m => m.number === at)) engine.addMeasure()
      engine.pasteEvents(clip, { measure: at, beat: fracCreate(0, 1), voice, staff: source.fromStaff })
    },
  )
  if (!changed) {
    dbg(`[Repeat] measures ${source.fromMeasure}–${source.toMeasure} → measure ${at}: nothing changed`)
    return false
  }

  // ⭐ The COPY becomes the selection, as it does after a paste — which is what makes `R R R` fill
  // forward, one passage at a time, the way Sibelius's key does.
  const copy: MeasurePassage = { ...source, fromMeasure: at, toMeasure: at + bars - 1 }
  selectPassage(engine, selection, state, copy, box.boxStyle)
  dbg(
    `[Repeat] measures ${source.fromMeasure}–${source.toMeasure} → ${copy.fromMeasure}–${copy.toMeasure} ` +
    `staves:${source.fromStaff}–${source.toStaff}${spansStaves(source) ? ' (multi-staff)' : ''}`,
  )
  return true
}

/** Put the box (and its contents) on `passage` — the selection half of a repeat, written once. */
function selectPassage(
  engine: MusicEngine,
  selection: RepeatSelection,
  state: EditorState,
  passage: MeasurePassage,
  boxStyle: 'single' | 'double',
): void {
  selection.selectMeasureContents(passageNoteIds(engine.getScore(), passage))
  // AFTER `selectMeasureContents`, which clears the element selection on its way through — the
  // order `MouseController` uses for the same pair, and for the same reason.
  state.selectedElement = {
    kind: 'measureRange',
    anchor: passage.fromMeasure,
    focus: passage.toMeasure,
    staff: passage.fromStaff,
    focusStaff: passage.toStaff,
    boxStyle,
  }
}
