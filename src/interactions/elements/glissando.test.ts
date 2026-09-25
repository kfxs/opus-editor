import { describe, it, expect, vi } from 'vitest'
import { GLISSANDO_ELEMENT } from './glissando'
import type { ElementChainDeps, MouseDownCtx } from './chain'
import type { ElementInfo } from '@/engine/ElementRegistry'

/**
 * Subject: `./glissando` — a press ON the drawn stroke selects the glissando (P4); a press in the air beside
 * a steep line, inside its box, does not.
 */
describe('GLISSANDO_ELEMENT.hit', () => {
  // A steep stroke from (100, 100) to (120, 20): its box is 20 × 80, mostly air.
  const stroke = {
    type: 'glissando', id: 'g1', bbox: { x: 100, y: 20, width: 20, height: 80 },
    points: [{ x: 100, y: 100 }, { x: 120, y: 20 }],
  } as unknown as ElementInfo
  const press = (x: number, y: number) => {
    const pick = vi.fn(() => true)
    const ctx = { registry: { getByType: (t: string) => (t === 'glissando' ? [stroke] : []) }, x, y } as unknown as MouseDownCtx
    const hit = GLISSANDO_ELEMENT.hit!(ctx, { pick } as unknown as ElementChainDeps)
    return { hit, pick }
  }

  it('a press on the stroke picks it', () => {
    const { hit, pick } = press(110, 60)
    expect(hit).toBe(true)
    expect(pick).toHaveBeenCalledWith({ kind: 'glissandoLine', id: 'g1' })
  })

  it('⛔ a press inside its box but off the ink does not', () => {
    const { hit, pick } = press(118, 95)
    expect(hit).toBe(false)
    expect(pick).not.toHaveBeenCalled()
  })

  it('⭐ forgiving along the line (7 px off still picks it) — but narrow near its ends, where a head stands', () => {
    // Mid-line (110, 60), 7 px to the side perpendicular-ish.
    expect(press(117, 62).hit).toBe(true)
    // Beside the lower end (100, 100): 6 px away is too far there.
    expect(press(94, 100).hit).toBe(false)
  })
})
