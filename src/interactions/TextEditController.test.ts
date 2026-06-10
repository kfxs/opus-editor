import { describe, it, expect, beforeEach } from 'vitest'
import { TextEditController, type EditableTextSource, type TextEditDom, type TextEditMountOptions } from './TextEditController'
import { createEditorState, type EditorState } from './EditorState'

/** Fake DOM layer: records mount/unmount and lets tests drive commit/cancel + typing. */
class FakeDom implements TextEditDom {
  mounted = false
  text = ''
  opts: TextEditMountOptions | null = null
  mount(opts: TextEditMountOptions): void {
    this.mounted = true
    this.text = opts.text
    this.opts = opts
  }
  getText(): string { return this.text }
  unmount(): void { this.mounted = false }
  // test helpers
  type(t: string): void { this.text = t }
  fireCommit(): void { this.opts?.onCommit() }
  fireCancel(): void { this.opts?.onCancel() }
}

interface Calls { commit: string[]; cancel: number; hide: boolean[] }

function makeSource(overrides: Partial<EditableTextSource> = {}): EditableTextSource & { calls: Calls } {
  const calls: Calls = { commit: [], cancel: 0, hide: [] }
  const source: EditableTextSource & { calls: Calls } = {
    targetId: 'd1',
    kind: 'dynamic',
    isNew: false,
    getText: () => 'seed',
    getScreenRect: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    getFontCSS: () => ({ fontFamily: '', fontSize: '', fontStyle: '', color: '' }),
    commit: (t: string) => { calls.commit.push(t) },
    cancel: () => { calls.cancel++ },
    hideOriginal: (h: boolean) => { calls.hide.push(h) },
    calls,
    ...overrides,
  }
  return source
}

describe('TextEditController', () => {
  let state: EditorState
  let dom: FakeDom
  let ctrl: TextEditController

  beforeEach(() => {
    state = createEditorState()
    dom = new FakeDom()
    ctrl = new TextEditController(state, dom)
  })

  it('open seeds the overlay, hides the original, and sets editingText', () => {
    const source = makeSource({ targetId: 'abc', isNew: true })
    ctrl.open(source)

    expect(ctrl.isEditing()).toBe(true)
    expect(dom.mounted).toBe(true)
    expect(dom.text).toBe('seed')
    expect(source.calls.hide).toEqual([true])
    expect(state.editingText).toEqual({ targetId: 'abc', kind: 'dynamic', isNew: true })
  })

  it('commit writes the current text, restores the original, and clears state', () => {
    const source = makeSource()
    ctrl.open(source)
    dom.type('dolce')
    dom.fireCommit()

    expect(source.calls.commit).toEqual(['dolce'])
    expect(source.calls.hide).toEqual([true, false]) // hidden on open, restored on close
    expect(ctrl.isEditing()).toBe(false)
    expect(state.editingText).toBeNull()
    expect(dom.mounted).toBe(false)
  })

  it('cancel restores the original and clears state without committing', () => {
    const source = makeSource()
    ctrl.open(source)
    dom.type('changed but abandoned')
    dom.fireCancel()

    expect(source.calls.commit).toEqual([])
    expect(source.calls.cancel).toBe(1)
    expect(source.calls.hide).toEqual([true, false])
    expect(ctrl.isEditing()).toBe(false)
    expect(state.editingText).toBeNull()
  })

  it('commits an empty string through to the source (empty-text rule lives in the source)', () => {
    const source = makeSource({ isNew: true })
    ctrl.open(source)
    dom.type('')
    dom.fireCommit()
    expect(source.calls.commit).toEqual([''])
  })

  it('opening a second edit commits the first', () => {
    const first = makeSource({ targetId: 'first' })
    ctrl.open(first)
    dom.type('first text')

    const second = makeSource({ targetId: 'second' })
    ctrl.open(second)

    expect(first.calls.commit).toEqual(['first text'])
    expect(state.editingText).toEqual({ targetId: 'second', kind: 'dynamic', isNew: false })
    expect(ctrl.isEditing()).toBe(true)
  })

  it('commit / cancel are no-ops when not editing', () => {
    expect(() => ctrl.commit()).not.toThrow()
    expect(() => ctrl.cancel()).not.toThrow()
    expect(state.editingText).toBeNull()
  })
})
