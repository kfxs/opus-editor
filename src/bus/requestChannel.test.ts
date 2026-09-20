import { describe, it, expect, vi } from 'vitest'
import { RequestChannel, PressChannel } from './requestChannel'

describe('RequestChannel', () => {
  it('hands the request to every handler', () => {
    const channel = new RequestChannel<{ id: string; x: number }>()
    const a = vi.fn()
    const b = vi.fn()
    channel.onSet(a)
    channel.onSet(b)
    channel.set({ id: 'n1', x: 2 })
    expect(a).toHaveBeenCalledWith({ id: 'n1', x: 2 })
    expect(b).toHaveBeenCalledWith({ id: 'n1', x: 2 })
  })

  it('ALWAYS fires — the same request twice is two events', () => {
    const channel = new RequestChannel<number>()
    const handler = vi.fn()
    channel.onSet(handler)
    channel.set(1)
    channel.set(1)
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('onSet answers its own unsubscribe, and only its own', () => {
    const channel = new RequestChannel<number>()
    const gone = vi.fn()
    const kept = vi.fn()
    const off = channel.onSet(gone)
    channel.onSet(kept)
    off()
    channel.set(1)
    expect(gone).not.toHaveBeenCalled()
    expect(kept).toHaveBeenCalledWith(1)
  })
})

describe('PressChannel', () => {
  it('fires every press, a repeat included, until unsubscribed', () => {
    const channel = new PressChannel<string>()
    const handler = vi.fn()
    const off = channel.onPress(handler)
    channel.press('3:2')
    channel.press('3:2')
    off()
    channel.press('3:2')
    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenCalledWith('3:2')
  })
})
