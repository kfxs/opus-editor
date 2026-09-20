/**
 * SPEC SUPPORT — the two things `MouseController` asks of the score's `<svg>` to turn a mouse event
 * into score coordinates: a point, and a screen matrix. Identity both ways, so a spec's
 * `clientX/clientY` ARE its score x/y. Nine `MouseController.*.test.ts` chapters spelled it.
 */
export function fakeSvg(): SVGSVGElement {
  return {
    createSVGPoint() {
      const p = { x: 0, y: 0, matrixTransform: (_m: unknown) => ({ x: p.x, y: p.y }) }
      return p
    },
    getScreenCTM: () => ({ inverse: () => ({}) }),
  } as unknown as SVGSVGElement
}
