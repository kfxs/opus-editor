import { afterEach, describe, it, expect, vi } from 'vitest'
import { durationsConsole } from './durationsConsole'

describe('__durations — the long values\' rows, from the console', () => {
  const render = vi.fn()
  const console_ = durationsConsole(render)
  afterEach(() => { console_.reset(); render.mockClear() })

  it('each setter arms its row and re-renders; reset restores his defaults', () => {
    expect(console_.breveHead('square').breveHead).toBe('square')
    expect(console_.longaStem('normal').longaStem).toBe('normal')
    expect(console_.barRest('lilypond').barRest).toBe('lilypond')
    expect(render).toHaveBeenCalledTimes(3)
    expect(console_.reset()).toEqual({ breveHead: 'round', longaHead: 'square', longaStem: 'right', barRest: 'convention' })
  })

  it('⛔ a typo is refused and does not re-render', () => {
    render.mockClear()
    expect(console_.barRest('everything' as never).barRest).toBe('convention')
    expect(render).not.toHaveBeenCalled()
  })
})
