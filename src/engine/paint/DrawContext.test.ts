// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { Renderer } from 'vexflow'
import type { SVGContext } from 'vexflow'
import type { DrawContext } from './DrawContext'

/**
 * ⭐⭐ **THE CLAIM THIS WHOLE STEP RESTS ON: VexFlow's `SVGContext` SATISFIES OUR `DrawContext`.**
 *
 * `DrawContext` implements nothing. Its entire value is that the engine can name *our* type while
 * the object flowing through is still VexFlow's — so the retype moved no pixels, and a recording
 * implementation (the SCENE) becomes a drop-in later. ⛔ If that assignability ever stops holding,
 * every renderer silently goes back to needing VexFlow, and nothing else in the suite would say so.
 *
 * ⚠️ **Which is exactly the kind of claim that rots without a check.** The plan doc measured the
 * cost of the alternative: for 16 days every stated rule was kept while the coupling grew 39%,
 * because no number was being looked at. This file is the assignability half; `lint:paint` is the
 * headcount half.
 *
 * ⭐ Two assertions, deliberately different in kind — a TYPE one the compiler checks, and a RUNTIME
 * one against a real context built in jsdom. The type check alone would pass on a structurally
 * compatible object that does not actually exist; the runtime check alone would miss a signature
 * drift. ⛔ Neither replaces the other.
 */

/** The interface is the SUBJECT here; the value is VexFlow's. jsdom has SVG DOM but no layout, which
 *  is all `Renderer` needs to hand back a context (`reference: jsdom cannot measure glyphs` is about
 *  MEASURING, not about constructing). */
function realSvgContext(): SVGContext {
  const host = document.createElement('div')
  return new Renderer(host, Renderer.Backends.SVG).getContext() as SVGContext
}

/** Every method {@link DrawContext} declares, as data — so the runtime check cannot silently drift
 *  from the interface by testing a subset of it. ⚠️ Keep in step with the interface; the type
 *  assertion below is what fails if a name here is wrong. */
const PRIMITIVES = [
  'beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'closePath', 'stroke', 'fill',
  'fillRect',
  'setFont', 'fillText',
  'setFillStyle', 'setStrokeStyle', 'setLineWidth', 'setLineDash',
  'save', 'restore', 'scale',
  'openGroup', 'closeGroup', 'pointerRect',
] as const satisfies readonly (keyof DrawContext)[]

/**
 * 🚨 **A hand-kept list ROTS**, and `satisfies` only checks that each name IS a primitive — ⛔ not
 * that every primitive is named. U1 added `bezierCurveTo` and both runtime checks above would have
 * gone on passing without it, testing a subset and saying nothing.
 *
 * ⇒ this line fails to COMPILE if `DrawContext` declares something the list omits.
 */
type AssertNever<T extends never> = T
// ⚠️ Exported only so `noUnusedLocals` keeps it: the CHECK is the type argument, not any value.
export type EveryPrimitiveIsListed =
  AssertNever<Exclude<keyof DrawContext, (typeof PRIMITIVES)[number]>>

describe('DrawContext', () => {
  it("⭐⭐ is satisfied by VexFlow's SVGContext — the premise of the whole retype", () => {
    // The assertion IS the assignment: if `SVGContext` ever stops satisfying `DrawContext`, this
    // line fails to compile and `npm run build:check` says so.
    const ctx: DrawContext = realSvgContext()
    expect(ctx).toBeDefined()
  })

  it('⭐ declares nothing the real context does not actually implement', () => {
    const ctx = realSvgContext() as unknown as Record<string, unknown>
    const missing = PRIMITIVES.filter(name => typeof ctx[name] !== 'function')
    expect(missing).toEqual([])
  })

  // 🚨 The break-test for the one above: it has to be able to NOTICE a missing method, or it is a
  // loop over a list that agrees with itself.
  // ⚠️ `Object.create`, ⛔ NOT a spread: `SVGContext`'s methods live on its PROTOTYPE, so
  // `{ ...ctx }` copies none of them and every primitive reads as missing — which is how the first
  // version of this break-test "passed" for the wrong reason and then failed loudly. Shadowing one
  // name on a real prototype chain is the only way to remove exactly one method.
  it('🚨 …and the check can tell — a context missing one primitive is caught', () => {
    const crippled = Object.create(realSvgContext()) as Record<string, unknown>
    crippled.fillRect = undefined
    const missing = PRIMITIVES.filter(name => typeof crippled[name] !== 'function')
    expect(missing).toEqual(['fillRect'])
  })

  it('⛔ stays SMALL — 20 primitives, not a transcription of RenderContext’s ~35', () => {
    // ⭐ Rule 4: a new primitive needs a reason. This number going up is a design decision, so it is
    // written down where a diff shows it. ⭐ 19 → 20 with U1's `bezierCurveTo`, and the reason is
    // that a curve is the one thing in this engine not made of straight edges.
    expect(PRIMITIVES).toHaveLength(20)
  })
})
