/**
 * ⭐⭐ **WHAT A VOICE PRESS DOES TO A SELECTED MARK** — `Alt+1…5` and the Keypad's voice row.
 * Subject: {@link markVoiceScope}, sitting beside this file.
 *
 * ⚠️ No engine and no DOM: the rule is about the SELECTION, so the engine is a spy. What the write
 * itself does to the model is `dynamicOps` / `hairpinOps`' own chapter.
 */
import { describe, it, expect, vi } from 'vitest'
import { applyMarkVoiceScope, selectedMarkScope, selectionHasScopedMark } from './markVoiceScope'
import { createEditorState, type EditorState } from './EditorState'
import type { SelectionItem } from './selection'
import { itemKey } from './selection'
import type { VoiceScope } from '../utils/dynamicScope'

/** An engine that records every scope write and reports each as a real change. */
function spyEngine(changed = true) {
  const writes: Array<[string, VoiceScope]> = []
  const engine = {
    setMarkVoiceScope: vi.fn((id: string, scope: VoiceScope) => { writes.push([id, scope]); return changed }),
    runBatch: vi.fn((_d: string, fn: () => void) => { fn(); return true }),
  }
  return { engine, writes }
}

/** A state holding `items` in the box selection, plus an optional single-click element. */
function stateWith(items: SelectionItem[], element: EditorState['selectedElement'] = null): EditorState {
  const state = createEditorState()
  const map = new Map<string, SelectionItem>()
  for (const item of items) map.set(itemKey(item), item)
  state.selectedItems = map
  state.selectedElement = element
  return state
}

describe('applyMarkVoiceScope — which marks a voice press reaches', () => {
  it('writes the scope to every scoped mark in the box selection', () => {
    const { engine, writes } = spyEngine()
    const state = stateWith([
      { kind: 'dynamic', id: 'D1' },
      { kind: 'hairpin', id: 'H1' },
      { kind: 'note', id: 'N1' }, // ⛔ a note takes no scope
    ])
    expect(applyMarkVoiceScope(engine, state, 1)).toBe(true)
    expect(writes).toEqual([['D1', 1], ['H1', 1]])
  })

  // ⚠️ The selection is TWO things, and asking only one is the bug that hides until a box is dragged.
  it('reaches the single-click element AND the box, without duplicating one in both', () => {
    const { engine, writes } = spyEngine()
    const state = stateWith([{ kind: 'dynamic', id: 'D1' }], { kind: 'dynamic', id: 'D1' })
    applyMarkVoiceScope(engine, state, 'all')
    expect(writes).toEqual([['D1', 'all']])
  })

  it('⛔ leaves the OTHER line families alone — they have no voice to set', () => {
    const { engine, writes } = spyEngine()
    const state = stateWith([
      { kind: 'ottava', id: 'O1' },
      { kind: 'pedal', id: 'P1' },
      { kind: 'trill', id: 'T1' },
    ])
    expect(applyMarkVoiceScope(engine, state, 2)).toBe(false)
    expect(writes).toEqual([])
  })

  it('⚠️ answers FALSE when nothing changed, so Alt+5 can decline and the caller need not repaint', () => {
    const { engine } = spyEngine(false) // the model says "already that scope"
    const state = stateWith([{ kind: 'dynamic', id: 'D1' }])
    expect(applyMarkVoiceScope(engine, state, 'all')).toBe(false)
  })

  it('…and false with no scoped mark at all, without opening a batch', () => {
    const { engine } = spyEngine()
    expect(applyMarkVoiceScope(engine, stateWith([{ kind: 'note', id: 'N1' }]), 3)).toBe(false)
    expect(engine.runBatch).not.toHaveBeenCalled()
  })

  it('⭐ ONE undo entry for the whole press — six marks are one gesture', () => {
    const { engine } = spyEngine()
    const state = stateWith([
      { kind: 'dynamic', id: 'D1' }, { kind: 'dynamic', id: 'D2' }, { kind: 'hairpin', id: 'H1' },
    ])
    applyMarkVoiceScope(engine, state, 0)
    expect(engine.runBatch).toHaveBeenCalledTimes(1)
    expect(engine.setMarkVoiceScope).toHaveBeenCalledTimes(3)
  })
})

describe('selectionHasScopedMark', () => {
  it('is true for a dynamic or a hairpin, false for notes and the other lines', () => {
    expect(selectionHasScopedMark(stateWith([{ kind: 'hairpin', id: 'H1' }]))).toBe(true)
    expect(selectionHasScopedMark(stateWith([{ kind: 'note', id: 'N1' }, { kind: 'pedal', id: 'P1' }]))).toBe(false)
  })
})

describe('selectedMarkScope — what the Keypad lights', () => {
  const engine = {
    getDynamicById: (id: string) => (id === 'D-all' ? { id, voice: undefined } : { id, voice: 2 }),
    getHairpinById: (id: string) => (id === 'H-all' ? { id } : { id, voice: 2 }),
  } as unknown as Parameters<typeof selectedMarkScope>[0]

  it('answers the scope of a single selected mark — absent reads as ALL', () => {
    expect(selectedMarkScope(engine, stateWith([{ kind: 'dynamic', id: 'D-all' }]))).toBe('all')
    expect(selectedMarkScope(engine, stateWith([{ kind: 'dynamic', id: 'D1' }]))).toBe(2)
    expect(selectedMarkScope(engine, stateWith([{ kind: 'hairpin', id: 'H-all' }]))).toBe('all')
  })

  it('answers null with no scoped mark — the row then falls back to the entry voice', () => {
    expect(selectedMarkScope(engine, stateWith([{ kind: 'note', id: 'N1' }]))).toBeNull()
  })

  // ⚠️ Lighting either one would be a claim about the other — the multi-note duration rule.
  it('answers null when the selected marks DISAGREE', () => {
    const mixed = stateWith([{ kind: 'dynamic', id: 'D-all' }, { kind: 'dynamic', id: 'D1' }])
    expect(selectedMarkScope(engine, mixed)).toBeNull()
  })

  it('…but not when they agree', () => {
    const agree = stateWith([{ kind: 'dynamic', id: 'D1' }, { kind: 'hairpin', id: 'H1' }])
    expect(selectedMarkScope(engine, agree)).toBe(2)
  })

  it('⚠️ a deleted id does not vote — it is dropped, not read as ALL', () => {
    const gone = { getDynamicById: () => null, getHairpinById: () => ({ id: 'H1', voice: 1 }) }
    const state = stateWith([{ kind: 'dynamic', id: 'D9' }, { kind: 'hairpin', id: 'H1' }])
    expect(selectedMarkScope(gone as unknown as Parameters<typeof selectedMarkScope>[0], state)).toBe(1)
  })
})
