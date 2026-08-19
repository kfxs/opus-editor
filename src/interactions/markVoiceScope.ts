/**
 * ⭐⭐ **WHAT A VOICE PRESS DOES TO A SELECTED MARK** — `Alt+1…5` and the Keypad's voice row, for the
 * dynamics family. P4 of docs/dynamic-voice-scope-plan.md.
 *
 * ## The rule is ONE sentence, and it is his
 *
 * > *"alt 1234 works regarding the context: if a note is selected it move the note to the voice, if
 * > a dynamic is selected it move the dynamic to the voice (we add in case of dynamic alt5 for all);
 * > if note + dynamic is selected we move everything to the voice (in this case if alt 5 we just
 * > move dynamic or hairpin cause for note this voice ALL is not valid)"*
 *
 * ⇒ **`Alt+1–4` applies to everything in the selection that can take a voice; `Alt+5` applies to
 * everything that can take ALL — which is marks only.** ⛔ Not "a mark OR a note, whichever is
 * selected": a mixed selection does both halves, and the two halves never contend, because a note
 * has no "all" and a mark has no other meaning for one.
 *
 * ## Why this is its own module
 *
 * A voice press already meant two things on `PaletteController.setActiveVoice` — arm the entry
 * voice, or move the selected notes. This is a THIRD, and it is about a different kind of object
 * entirely, so it is a module with a row of its own rather than a branch in that method (the ⭐ rule
 * in CLAUDE.md). The palette keeps the note half and gains one delegation.
 *
 * ⚠️ **The two dynamics-family kinds only.** An 8va and a pedal govern a STAFF and have no voice to
 * set; a trill takes its anchor note's and is moved by moving the note. So the set here is exactly
 * the set that carries a scope — {@link SCOPED_KINDS} — and a kind joining it is one row.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { EditorState } from './EditorState'
import { selectedIdsOf } from './EditorState'
import type { VoiceScope } from '../utils/dynamicScope'
import type { SelectionItem } from './selection'

/** What the press needs off the engine — a Pick, so a spec needs no renderer. */
export type ScopeEngine = Pick<MusicEngine, 'setMarkVoiceScope' | 'runBatch'>

/**
 * ⭐ The selection kinds that CARRY a scope. Both members of the dynamics family, and nothing else:
 * a row here is the whole of adding a third (docs/dynamic-voice-scope-plan.md).
 */
export const SCOPED_KINDS: ReadonlyArray<SelectionItem['kind']> = ['dynamic', 'hairpin']

/**
 * ⭐⭐ **Apply `scope` to every scoped mark in the selection.** The MARK half of a voice press; the
 * caller owns the note half and the entry-voice half.
 *
 * ⭐ **ONE undo entry for the whole press**, via `runBatch` — a box holding six dynamics is one
 * gesture, and six `Ctrl+Z`s to undo one `Alt+5` is the kind of thing that makes undo untrustworthy.
 *
 * ⚠️ Returns **false when nothing was written** — no scoped mark selected, or every one of them
 * already had that scope. That false is load-bearing twice over: `Alt+5` must DECLINE when there is
 * no mark (so the key stays free for whatever else may want it), and a caller must not re-render on
 * it, or every press of the already-lit button repaints the score.
 */
export function applyMarkVoiceScope(engine: ScopeEngine, state: EditorState, scope: VoiceScope): boolean {
  const ids = SCOPED_KINDS.flatMap(kind => [...selectedIdsOf(state, kind)])
  if (ids.length === 0) return false

  let wrote = false
  // ⚠️ The batch runs whether or not anything changes; `wrote` is what the caller acts on. An empty
  // batch saves no undo entry (`runBatch`'s own rule), so a no-op press leaves the history alone.
  engine.runBatch(scope === 'all' ? 'Marks govern all voices' : `Marks govern voice ${scope + 1}`, () => {
    for (const id of ids) if (engine.setMarkVoiceScope(id, scope)) wrote = true
  })
  return wrote
}

/** True when the selection holds something a voice press can scope — what `Alt+5` asks before it
 *  decides whether to act or decline the key. */
export function selectionHasScopedMark(state: EditorState): boolean {
  return SCOPED_KINDS.some(kind => selectedIdsOf(state, kind).size > 0)
}

/**
 * ⭐ **The scope the Keypad should LIGHT**, or null when the selection says nothing about one.
 *
 * Null for a selection with no scoped mark (the voice row then falls back to the entry voice), and
 * null when the selected marks DISAGREE — a box holding a staff-wide `p` and a voice-2 `f` has no
 * single answer, and lighting either one would be a claim about the other. The duration key's rule
 * for a multi-note selection, verbatim.
 */
export function selectedMarkScope(
  engine: Pick<MusicEngine, 'getDynamicById' | 'getHairpinById'>,
  state: EditorState,
): VoiceScope | null {
  const marks = [
    ...[...selectedIdsOf(state, 'dynamic')].map(id => engine.getDynamicById(id)),
    ...[...selectedIdsOf(state, 'hairpin')].map(id => engine.getHairpinById(id)),
  ].filter(m => m !== null)
  if (marks.length === 0) return null

  // ⚠️ Read the FIELD, not `voiceScopeOf`'s answer for a missing mark: a deleted id must not vote.
  const scopes = new Set<VoiceScope>(marks.map(m => m.voice ?? 'all'))
  return scopes.size === 1 ? [...scopes][0] : null
}
