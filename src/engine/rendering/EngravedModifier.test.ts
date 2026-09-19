/**
 * The modifier contract (S12b): what VexFlow's note and our columns ask of a modifier, transcribed from
 * `Element` and `Modifier`. ⚠️ That the tremolo — its first member — draws and boxes exactly as before
 * was proved on the page: 50 random scores (897 tremolos), SVG and every registry box byte-identical
 * against the previous commit (`docs/vexflow-removal-map.md` S12b).
 */
import { describe, it, expect } from 'vitest'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { EngravedModifier, MODIFIER_POSITION, type ModifierMetrics } from './EngravedModifier'

class Probe extends EngravedModifier {
  static override get CATEGORY(): string {
    return 'Probe'
  }
  drawn = 0
  metrics: ModifierMetrics = { width: 0, ascent: 0, descent: 0 }
  draw(): void {
    this.drawn++
  }
  protected inkMetrics(): ModifierMetrics {
    return this.metrics
  }
  place(x: number, y: number): this {
    this.x = x
    this.y = y
    return this
  }
}

/** A surface that only records the calls `drawWithStyle` makes. */
const recording = () => {
  const calls: string[] = []
  const ctx = new Proxy({}, { get: (_t, name) => (...args: unknown[]) => { calls.push(`${String(name)}(${args.join(',')})`) } })
  return { ctx: ctx as DrawContext, calls }
}

describe('EngravedModifier', () => {
  it('files under its class CATEGORY, and draws ids from that category\'s own counter', () => {
    const a = new Probe()
    const b = new Probe()
    expect(a.getCategory()).toBe('Probe')
    expect(a.getAttribute('id')).toMatch(/^probe\d+$/)
    expect(Number(b.getAttribute('id')!.slice(5))).toBe(Number(a.getAttribute('id')!.slice(5)) + 1)
  })

  it('takes a position as a number or as VexFlow\'s strings; LEFT is the default', () => {
    const m = new Probe()
    expect(m.getPosition()).toBe(MODIFIER_POSITION.LEFT)
    expect(m.setPosition('above').getPosition()).toBe(MODIFIER_POSITION.ABOVE)
    expect(m.setPosition(MODIFIER_POSITION.RIGHT).getPosition()).toBe(MODIFIER_POSITION.RIGHT)
  })

  it('⚠️ negates the x shift of a LEFT modifier, as VexFlow does — and only of a LEFT one', () => {
    expect(new Probe().setXShift(4).getXShift()).toBe(-4)
    expect(new Probe().setPosition('right').setXShift(4).getXShift()).toBe(4)
  })

  it('refuses a draw with no note, no index or no context', () => {
    const m = new Probe()
    expect(() => m.checkAttachedNote()).toThrow()
    m.setIndex(0)
    expect(() => m.checkAttachedNote()).toThrow()
    expect(() => m.drawWithStyle()).toThrow()
  })

  it('⭐ draws with its style between a save and a restore', () => {
    const { ctx, calls } = recording()
    const m = new Probe().setStyle({ fillStyle: 'red', lineWidth: 2 })
    m.setContext(ctx).drawWithStyle()
    expect(calls).toEqual(['save()', 'setFillStyle(red)', 'setLineWidth(2)', 'restore()'])
    expect(m.drawn).toBe(1)
  })

  it('refuses a shadow style loudly — our surface has no shadow', () => {
    const { ctx } = recording()
    expect(() => new Probe().setStyle({ shadowColor: 'black' }).setContext(ctx).drawWithStyle()).toThrow(/shadow/)
  })

  it('⭐ boxes itself as `Element.getBoundingBox` did: x + xShift, y + yShift − ascent, advance × ink height', () => {
    const m = new Probe().setPosition('right').place(100, 50)
    m.metrics = { width: 12, ascent: 8, descent: 3 }
    m.setXShift(2).setYShift(1)
    const box = m.getBoundingBox()
    expect([box.getX(), box.getY(), box.getW(), box.getH()]).toEqual([102, 43, 12, 11])
    // …in the shape `BoundingBox.mergeWith` reads.
    expect([box.x, box.y, box.w, box.h]).toEqual([102, 43, 12, 11])
  })
})
