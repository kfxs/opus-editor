import { describe, it, expect } from 'vitest'
import { tupletCommands } from './tupletCommands'
import { fakeCommandContext } from './fakeCommandContext'
import { fracCreate as frac } from '@/utils/fraction'
import type { ElementInfo } from '../ElementRegistry'

/**
 * Subject: `./tupletCommands` — what the commands add over `models/tupletOps`: ONE undo entry per edit,
 * labelled for what changed, ⛔ none when nothing did; and the `x` flip, moved here from the facade.
 */
describe('tupletCommands', () => {
  const setup = () => {
    const ctx = fakeCommandContext()
    const tuplet = ctx.score.createTuplet(1, frac(0, 1), '8', 3, 2)!
    const find = () => ctx.score.getScore().measures[0].tuplets!.find(t => t.id === tuplet.id)!
    return { ctx, cmds: tupletCommands(ctx), id: tuplet.id, find }
  }

  it('⭐ setFormat: ONE entry naming what changed; auto stored ABSENT', () => {
    const { ctx, cmds, id, find } = setup()
    expect(cmds.setFormat(id, { bracket: 'never', numberStyle: 'ratio' })).toBe(true)
    expect(find()).toMatchObject({ bracket: 'never', numberStyle: 'ratio' })
    expect(ctx.log).toEqual(['mutate:Tuplet number ratio, bracket never'])
    expect(cmds.setFormat(id, { bracket: 'auto' })).toBe(true)
    expect('bracket' in find()).toBe(false)
    expect(ctx.undoEntries()).toBe(2)
  })

  it('⛔ an edit that changes nothing records nothing; an unknown id is false', () => {
    const { ctx, cmds, id } = setup()
    expect(cmds.setFormat(id, { bracket: 'auto', numberStyle: 'auto' })).toBe(false)
    expect(cmds.setFormat('nope', { bracket: 'always' })).toBe(false)
    expect(ctx.log).toEqual([])
  })

  it('flip: auto → the side OPPOSITE the one drawn; again → auto; one entry each; nothing drawn ⇒ "above" is assumed', () => {
    const { ctx, cmds, id, find } = setup()
    // ⚠️ Filed under `tupletId`, as the registry files it — an element keyed by `id` is what the bug matched nothing against.
    ctx.drawn = [{ type: 'tuplet', tupletId: id, tupletGeometry: { location: -1 } } as unknown as ElementInfo]
    expect(cmds.flip(id)).toBe(true)
    expect(find().placement, 'drawn below ⇒ pinned above').toBe('above')
    expect(cmds.flip(id)).toBe(true)
    expect(find().placement).toBeUndefined()
    ctx.drawn = []
    cmds.flip(id)
    expect(find().placement, 'headless: taken as above ⇒ flipped below').toBe('below')
    expect(ctx.log).toEqual(['mutate:Flip tuplet', 'mutate:Reset tuplet to auto', 'mutate:Flip tuplet'])
    expect(cmds.flip('nope')).toBe(false)
  })
})
