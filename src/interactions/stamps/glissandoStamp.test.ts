import { describe, it, expect, vi } from 'vitest'
import { createEditorState } from '../state/EditorState'
import { stampGlissandoAtClick } from './glissandoStamp'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { ElementRegistry } from '@/engine/ElementRegistry'

/**
 * Subject: `./glissandoStamp` — with the stamp armed, a click on a head puts a glissando on it (additive only);
 * a click on a rest or on paper is consumed and changes nothing; not armed, the click is not its business.
 */
describe('stampGlissandoAtClick', () => {
  const setup = (target: { id: string; isRest?: boolean; has?: boolean } | null) => {
    const state = createEditorState()
    state.selectedMarkingTool = { kind: 'glissandoLine' }
    const add = vi.fn(() => 1)
    const engine = {
      getNote: () => (target ? { isRest: target.isRest ?? false } : undefined),
      glissando: { on: () => (target?.has ? { id: 'G' } : undefined), add },
    } as unknown as MusicEngine
    const registry = {
      findClosestNoteOrRest: () => (target ? { id: target.id } : null),
      hitsNoteOrRestBody: () => !!target,
    } as unknown as ElementRegistry
    return { state, engine, registry, add }
  }

  it('a head: one glissando, repainted', () => {
    const { state, engine, registry, add } = setup({ id: 'N1' })
    const render = vi.fn()
    expect(stampGlissandoAtClick(state, engine, registry, 0, 0, render)).toBe(true)
    expect(add).toHaveBeenCalledWith(['N1'])
    expect(render).toHaveBeenCalled()
  })

  it('⛔ additive only: a head that has one is left alone (consumed)', () => {
    const { state, engine, registry, add } = setup({ id: 'N1', has: true })
    expect(stampGlissandoAtClick(state, engine, registry, 0, 0, () => {})).toBe(true)
    expect(add).not.toHaveBeenCalled()
  })

  it('a rest or paper: consumed, no change; not armed: not its click', () => {
    const rest = setup({ id: 'R', isRest: true })
    expect(stampGlissandoAtClick(rest.state, rest.engine, rest.registry, 0, 0, () => {})).toBe(true)
    expect(rest.add).not.toHaveBeenCalled()
    const off = setup({ id: 'N1' })
    off.state.selectedMarkingTool = null
    expect(stampGlissandoAtClick(off.state, off.engine, off.registry, 0, 0, () => {})).toBe(false)
  })
})
