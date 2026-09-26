/**
 * ⭐ **The FULL-BAR REST button's PRESS and its LIGHT** (docs/plans/voice-measure-rest-plan.md P2) — what
 * the dev toolbar's button does, in its own module (`CLAUDE.md`: a new feature adds a MODULE).
 *
 * His brief, 2026-09-26: *"if the user select a voice different than 1 and press this button then we arm
 * the full bar rest for this voice… also for voice 1 we can arm the full bar rest with the same
 * approach"*. The context decides, as every button of the strip does:
 *
 * - BARS selected (a `measureRange`, in selection mode) → each bar × staff of it gets a full-bar rest in
 *   the ACTIVE voice at once — ONE undo entry, nothing armed (his ask, 2026-09-26: *"select and hit full
 *   bar"*).
 * - ⭐ what is selected ALREADY is one (the button lit — {@link barRestLit}) → the press turns it OFF: the
 *   stamped rests are deleted, through Delete's own path (`engine.deleteNotes`), so a voice 2–4 leaves
 *   the bar and voice 1 gets its automatic rest back (his ask, 2026-09-26).
 * - NOTES or RESTS selected → each one's BAR gets a full-bar rest in THAT note's own voice and staff — ONE
 *   undo entry — and the new rests become the selection (so the button lights, and a second press turns
 *   them off). His report, 2026-09-26: a voice-2 note selected, the press armed the stamp instead.
 * - otherwise → ARM the stamp (`./barRestStamp`); a re-press disarms it. The VOICE is not armed with it —
 *   the click reads the active voice, so the Keypad's voice row goes on choosing it while it is live.
 */
import { dbg } from '@/utils/debug'
import { activeVoiceToModel, armedTool, selectedOf, type EditorState } from '../state/EditorState'
import { passageNoteIds, passageOf, type MeasurePassage } from '../state/measurePassage'
import { itemKey, selectedNoteIds, type SelectionItem } from '../state/selection'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { Score } from '@/types/music'
import type { SpanToolHost } from './spanToolPress'

/** One press of the full-bar rest button. */
export function pressBarRest(host: SpanToolHost): void {
  const state = host.state
  if (armedTool(state, 'barRest')) {
    host.disarm()
    dbg('[barRest] stamp disarmed')
    return
  }
  const range = state.selectedTool === 'selection' && !state.selectedMarkingTool
    ? selectedOf(state, 'measureRange') : null
  const engine = host.getEngine()
  const lit = engine ? litStampedRests(state, engine) : null
  if (lit && engine) {
    const cleared = engine.deleteNotes(lit)
    dbg(`[barRest] toggled OFF: ${cleared} stamped full-bar rest(s) deleted`)
    if (range?.boxStyle === 'single') refreshPassageNotes(state, engine.getScore(), passageOf(range))
    else if (!range) clearNoteSelection(state)
    host.render()
    return
  }
  if (range && engine) {
    const passage = passageOf(range)
    const changed = engine.silentBar.stampPassage(passage, activeVoiceToModel(state.activeVoice))
    dbg(`[barRest] m${passage.fromMeasure}–${passage.toMeasure} staves ${passage.fromStaff}–${passage.toStaff} v${state.activeVoice}: ${changed} lane(s) stamped`)
    if (changed) {
      if (range.boxStyle === 'single') refreshPassageNotes(state, engine.getScore(), passage)
      host.render()
    }
    return
  }
  const noteIds = engine && state.selectedTool === 'selection' && !state.selectedMarkingTool
    ? selectedNoteIds(state.selectedItems.values()) : []
  if (engine && noteIds.length) {
    const lanes = noteIds.flatMap(id => {
      const n = engine.getNote(id)
      return n ? [{ measure: n.measure, staff: n.staff ?? 0, voice: n.voice ?? 0 }] : []
    })
    const { ids, changed } = engine.silentBar.stampLanes(lanes)
    dbg(`[barRest] ${noteIds.length} selected note(s) → ${changed} lane(s) stamped`)
    selectNotesOnly(state, ids)
    host.render()
    return
  }
  host.arm({ kind: 'barRest' })
  dbg(`[barRest] stamp armed (voice ${state.activeVoice})`)
}

/**
 * ⭐ A SINGLE box selects the bar's notes too (the highlight promises the copy), and the stamp has just
 * replaced some of them — so the note half of the selection is gathered again from the same passage,
 * or Delete / Copy would act on ids that are gone. The marks in it stay as they were.
 */
function refreshPassageNotes(state: EditorState, score: Score, passage: MeasurePassage): void {
  const ids = passageNoteIds(score, passage)
  const items = new Map<string, SelectionItem>()
  for (const [key, item] of state.selectedItems) if (item.kind !== 'note') items.set(key, item)
  for (const id of ids) items.set(itemKey({ kind: 'note', id }), { kind: 'note', id })
  state.selectedItems = items
  const anchor = ids.length ? ids[ids.length - 1] : null
  state.selectedNoteId = anchor
  state.selectionPivotId = anchor
  state.selectionBase = Array.from(items.values())
}

/**
 * Lit: the stamp armed — or what is SELECTED already is a stamped full-bar rest (his report, 2026-09-26:
 * *"when i select a full bar rest i dont see that the button highlight"*): every selected note is one,
 * or every bar × staff of the selected bars holds one in the active voice.
 */
export function barRestLit(state: EditorState, engine: MusicEngine | null): boolean {
  if (armedTool(state, 'barRest')) return true
  return !!engine && litStampedRests(state, engine) !== null
}

/**
 * The stamped full-bar rests that light the button through the SELECTION, or null when it does not:
 * every bar × staff of the selected bars holds one in the active voice, or every selected note is one.
 */
function litStampedRests(state: EditorState, engine: MusicEngine): string[] | null {
  if (state.selectedMarkingTool || state.selectedTool !== 'selection') return null
  const range = selectedOf(state, 'measureRange')
  if (range) {
    const p = passageOf(range)
    const voice = activeVoiceToModel(state.activeVoice)
    const ids: string[] = []
    for (let m = p.fromMeasure; m <= p.toMeasure; m++) {
      for (let staff = p.fromStaff; staff <= p.toStaff; staff++) {
        const id = engine.silentBar.at(m, staff, voice)
        if (!id) return null
        ids.push(id)
      }
    }
    return ids
  }
  const ids = selectedNoteIds(state.selectedItems.values())
  return ids.length > 0 && ids.every(id => engine.getNote(id)?.stamped === true) ? ids : null
}

/** The deleted rests were the whole selection: nothing is selected now. */
function clearNoteSelection(state: EditorState): void {
  selectNotesOnly(state, [])
}

/** Exactly these notes selected — the anchor the last. */
function selectNotesOnly(state: EditorState, ids: readonly string[]): void {
  const items = new Map<string, SelectionItem>()
  for (const id of ids) items.set(itemKey({ kind: 'note', id }), { kind: 'note', id })
  state.selectedItems = items
  const anchor = ids.length ? ids[ids.length - 1] : null
  state.selectedNoteId = anchor
  state.selectionPivotId = anchor
  state.selectionBase = Array.from(items.values())
}
