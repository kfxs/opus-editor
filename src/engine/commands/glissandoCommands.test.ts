/**
 * {@link glissandoCommands} — the button's one undo entry, and none for a refusal.
 */
import { describe, it, expect } from 'vitest'
import { fakeCommandContext } from './fakeCommandContext'
import { glissandoCommands } from './glissandoCommands'
import { fracCreate as frac } from '@/utils/fraction'

function setup() {
  const ctx = fakeCommandContext()
  const c = ctx.score.addNote({ step: 'C', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  const e = ctx.score.addNote({ step: 'E', alter: 0, octave: 4, duration: 'q', measure: 1, beat: frac(0, 1) })
  return { ctx, gliss: glissandoCommands(ctx), c, e }
}

describe('glissandoCommands', () => {
  it('add: one per head, ONE undo entry for the lot', () => {
    const { ctx, gliss, c, e } = setup()
    expect(gliss.add([c.id, e.id])).toBe(2)
    expect(ctx.log).toEqual(['mutate:Glissandi'])
    expect(gliss.on(c.id)).toBeDefined()
  })

  it('add again changes nothing and records nothing', () => {
    const { ctx, gliss, c } = setup()
    gliss.add([c.id])
    ctx.log.length = 0
    expect(gliss.add([c.id, 'ghost'])).toBe(0)
    expect(ctx.log).toEqual([])
  })

  it('remove: one entry; an unknown id none', () => {
    const { ctx, gliss, c } = setup()
    gliss.add([c.id])
    ctx.log.length = 0
    expect(gliss.remove(gliss.on(c.id)!.id)).toBe(true)
    expect(gliss.remove('ghost')).toBe(false)
    expect(ctx.log).toEqual(['mutate:Remove glissando'])
  })
})
