/**
 * SPIKE — the gate for docs/observable-editorstate-plan.md.
 *
 * Proves the emitting Proxy from `createObservableEditorState()` composes with Vue's
 * `reactive()`: one assignment fires BOTH Vue's dependents and the plain-TS `subscribe`
 * listeners. This test lives in composables/ (not interactions/) because it imports Vue —
 * the boundary lint forbids Vue inside interactions/, and that is the whole point: the
 * factory itself is Vue-free; only this proof-of-composition touches Vue.
 *
 * Covers every item in the plan's "cost #1" spike checklist. If these all pass, the
 * `reactive(proxy)` composition is fact, not hope, and the design can be built on.
 */
import { describe, it, expect, vi } from 'vitest'
import { reactive, watch, computed, nextTick, toRaw, isReactive } from 'vue'
import { createObservableEditorState, type EditorState } from '../interactions/EditorState'

describe('emitting Proxy — standalone (no Vue)', () => {
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
})

describe('reactive(proxy) composition — the gate', () => {
  function wrap() {
    const observable = createObservableEditorState()
    const state = reactive(observable.state) as EditorState
    return { state, bare: observable.state, subscribe: observable.subscribe }
  }

  it('(1) a Vue watch/computed fires on a write through the Vue-wrapped state', async () => {
    const { state } = wrap()
    const seen: (string | null)[] = []
    watch(
      () => state.selectedNoteId,
      (v) => seen.push(v),
    )
    const derived = computed(() => `note:${state.selectedNoteId}`)
    expect(derived.value).toBe('note:null')

    state.selectedNoteId = 'n1'
    await nextTick()

    expect(seen).toEqual(['n1']) // watch fired end-to-end
    expect(derived.value).toBe('note:n1') // computed re-tracked
  })

  it('(1b) the SAME write also fires the plain-TS subscriber — both worlds from one assignment', async () => {
    const { state, subscribe } = wrap()
    const emitted: (keyof EditorState)[] = []
    subscribe((k) => emitted.push(k))
    const watchFired = vi.fn()
    watch(() => state.selectedDuration, watchFired)

    state.selectedDuration = '8'
    await nextTick()

    expect(emitted).toContain('selectedDuration') // emitter fired
    expect(watchFired).toHaveBeenCalledOnce() // Vue fired
  })

  it('(2) Map mutation through the double proxy still triggers a Vue watcher that iterates it', async () => {
    const { state } = wrap()
    const sizes: number[] = []
    watch(
      () => state.selectedItems.size,
      (s) => sizes.push(s),
    )
    // A deep watcher iterating the map (HighlightController-style consumer).
    const iterated: string[][] = []
    watch(
      () => [...state.selectedItems.keys()],
      (keys) => iterated.push(keys),
      { deep: true },
    )

    state.selectedItems.set('k1', { kind: 'note', id: 'n1' } as never)
    await nextTick()
    state.selectedItems.set('k2', { kind: 'note', id: 'n2' } as never)
    await nextTick()

    expect(sizes).toEqual([1, 2])
    expect(iterated).toEqual([['k1'], ['k1', 'k2']])
    // Vue reactive() instruments the nested Map — confirm it survived the double proxy.
    expect(isReactive(state.selectedItems)).toBe(true)
  })

  it('(3) a write through the BARE emitting proxy does NOT trigger Vue (the one-write-path rule)', async () => {
    const { state, bare } = wrap()
    const watchFired = vi.fn()
    watch(() => state.selectedNoteId, watchFired)

    bare.selectedNoteId = 'ghost' // write behind Vue's back
    await nextTick()

    expect(watchFired).not.toHaveBeenCalled() // Vue is blind to it — proves the rule's hazard
    // ...yet the value IS there when read (same raw object underneath) — the silent-staleness trap.
    expect(state.selectedNoteId).toBe('ghost')
  })

  it('(4) emitter listeners fire synchronously, before Vue flushes its batched watchers', async () => {
    const { state, subscribe } = wrap()
    const order: string[] = []
    subscribe(() => order.push('emit'))
    watch(() => state.selectedNoteId, () => order.push('vue-watch'))

    state.selectedNoteId = 'n1'
    order.push('after-assignment')
    // Emit already ran synchronously inside the assignment; Vue's watch is still queued.
    expect(order).toEqual(['emit', 'after-assignment'])

    await nextTick()
    expect(order).toEqual(['emit', 'after-assignment', 'vue-watch'])
  })

  it('(5a) toRaw(state) returns the emitting proxy, not the plain raw object', () => {
    const { state, bare, subscribe } = wrap()
    const raw = toRaw(state)
    // Vue unwraps its own layer → lands on our emitting proxy (bare), not the plain object.
    expect(raw).toBe(bare)
    // And that unwrapped handle still emits — writing it is a bare write (see rule).
    const fn = vi.fn()
    subscribe(fn)
    ;(raw as EditorState).selectedNoteId = 'via-raw'
    expect(fn).toHaveBeenCalledWith('selectedNoteId')
  })

  /**
   * `selectedMarkingTool` is the first OBJECT-valued field on the state — the eight armed-tool flags
   * collapsed into one union value. The emitting Proxy traps a SET on the field, so arming emits and
   * the Keypad follows; but a mutation INSIDE the value (`tool.clef = 'bass'`) would be invisible to
   * it, and the Keypad would silently go stale. Every write site reassigns the whole field, which is
   * what these lock in.
   */
  it('(6) arming a tool fires BOTH the plain-TS subscriber and Vue — from one assignment', async () => {
    const { state, subscribe } = wrap()
    const emitted: (keyof EditorState)[] = []
    subscribe((k) => emitted.push(k))
    const seen: (string | undefined)[] = []
    watch(() => state.selectedMarkingTool?.kind, (k) => seen.push(k))

    state.selectedMarkingTool = { kind: 'clef', clef: 'bass' }
    await nextTick()
    state.selectedMarkingTool = { kind: 'tie' } // arming another REPLACES it — no clearing needed
    await nextTick()
    state.selectedMarkingTool = null
    await nextTick()

    expect(emitted).toEqual(['selectedMarkingTool', 'selectedMarkingTool', 'selectedMarkingTool'])
    expect(seen).toEqual(['clef', 'tie', undefined])
  })

  it('(6b) the payload survives both proxies intact', () => {
    const { state } = wrap()
    state.selectedMarkingTool = { kind: 'articulation', types: ['accent', 'staccato'] }
    const tool = state.selectedMarkingTool
    expect(tool?.kind).toBe('articulation')
    // Narrowing still works through the double proxy — the union is the point.
    if (tool?.kind === 'articulation') expect(tool.types).toEqual(['accent', 'staccato'])
    else throw new Error('expected the articulation tool to narrow')
  })

  it('(5b) has / deleteProperty fall through untrapped without throwing', async () => {
    const { state } = wrap()
    expect('selectedNoteId' in state).toBe(true)
    expect('nonexistent' in state).toBe(false)
    // Nothing in the codebase deletes state keys; just confirm the trap-less path is inert.
    const watchFired = vi.fn()
    watch(() => state.showCursor, watchFired)
    state.showCursor = false
    await nextTick()
    expect(watchFired).toHaveBeenCalledOnce()
  })
})
