/**
 * The emitting Proxy behind `createObservableEditorState()` — the state's own change-notification
 * (docs/observable-editorstate-plan.md). This is now the ONLY reactivity the editor has, so these
 * are no longer a spike: they are the contract every subscriber depends on (the Keypad, the
 * Properties window, the dev toolbar, the score cursor, the gutter).
 *
 * Descended from `composables/observableEditorState.spike.test.ts`, whose job was to prove the Proxy
 * composed with Vue's `reactive()`. Vue is gone, so those composition tests went with it; everything
 * here is what was always true of the Proxy alone.
 */
import { describe, it, expect, vi } from 'vitest'
import { createObservableEditorState, type EditorState } from './EditorState'

describe('the emitting Proxy', () => {
  it('fires subscribers with the written key, and only on a real change', () => {
    const { state, subscribe } = createObservableEditorState()
    const keys: (keyof EditorState)[] = []
    subscribe((k) => keys.push(k))

    state.selectedNoteId = 'n1'
    state.selectedNoteId = 'n1' // no change → no emit
    state.selectedDuration = 'h'

    expect(keys).toEqual(['selectedNoteId', 'selectedDuration'])
  })

  it('unsubscribe stops delivery', () => {
    const { state, subscribe } = createObservableEditorState()
    const fn = vi.fn()
    const off = subscribe(fn)
    state.selectedNoteId = 'a'
    off()
    state.selectedNoteId = 'b'
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('a throwing subscriber does not starve the others, and the write still lands', () => {
    const { state, subscribe } = createObservableEditorState()
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    subscribe(() => {
      throw new Error('boom')
    })
    subscribe(good)

    state.selectedNoteId = 'x'

    expect(good).toHaveBeenCalledOnce()
    expect(state.selectedNoteId).toBe('x')
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('emits synchronously, inside the assignment', () => {
    const { state, subscribe } = createObservableEditorState()
    const order: string[] = []
    subscribe(() => order.push('emit'))

    state.selectedNoteId = 'n1'
    order.push('after-assignment')

    expect(order).toEqual(['emit', 'after-assignment'])
  })

  /**
   * `selectedMarkingTool` is the OBJECT-valued field — the armed-tool flags collapsed into one
   * union. The Proxy traps a SET on the field, so arming emits; a mutation INSIDE the value
   * (`tool.clef = 'bass'`) would be invisible and every subscriber would silently go stale. Every
   * write site reassigns the whole field, which is what this locks in.
   */
  it('arming a tool emits, because arming REASSIGNS the field', () => {
    const { state, subscribe } = createObservableEditorState()
    const emitted: (keyof EditorState)[] = []
    subscribe((k) => emitted.push(k))

    state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
    state.selectedMarkingTool = { kind: 'tie' } // arming another REPLACES it — no clearing needed
    state.selectedMarkingTool = null

    expect(emitted).toEqual(['selectedMarkingTool', 'selectedMarkingTool', 'selectedMarkingTool'])
  })

  it('does NOT emit for a mutation inside the armed value — the reassign rule, stated as a test', () => {
    const { state, subscribe } = createObservableEditorState()
    state.selectedMarkingTool = { kind: 'clef', clef: 'treble' }
    const fn = vi.fn()
    subscribe(fn)

    const tool = state.selectedMarkingTool
    if (tool?.kind === 'clef') tool.clef = 'bass' // mutate in place — the trap never sees it

    expect(fn).not.toHaveBeenCalled()
    // The value did change; nobody was told. That is exactly why write sites must reassign.
    expect(state.selectedMarkingTool).toEqual({ kind: 'clef', clef: 'bass' })
  })

  it('the armed payload keeps its shape and narrows through the proxy', () => {
    const { state } = createObservableEditorState()
    state.selectedMarkingTool = { kind: 'articulation', types: ['accent', 'staccato'] }
    const tool = state.selectedMarkingTool
    expect(tool?.kind).toBe('articulation')
    if (tool?.kind === 'articulation') expect(tool.types).toEqual(['accent', 'staccato'])
    else throw new Error('expected the articulation tool to narrow')
  })

  it('`in` falls through untrapped', () => {
    const { state } = createObservableEditorState()
    expect('selectedNoteId' in state).toBe(true)
    expect('nonexistent' in state).toBe(false)
  })

  /**
   * `selectedItems` is a Map, and a Map mutation is NOT a field write — the Proxy traps SET on the
   * state's own keys, so `selectedItems.set(...)` emits nothing. Under Vue this was papered over by
   * deep reactivity; nothing ever relied on it (no consumer re-read the map from a subscription),
   * and this test exists so that if one ever wants to, it finds the answer written down.
   */
  it('does NOT emit for a Map mutation — selection changes are pushed by their controller', () => {
    const { state, subscribe } = createObservableEditorState()
    const fn = vi.fn()
    subscribe(fn)

    state.selectedItems.set('k1', { kind: 'note', id: 'n1' } as never)

    expect(fn).not.toHaveBeenCalled()
    expect(state.selectedItems.size).toBe(1)
  })
})
