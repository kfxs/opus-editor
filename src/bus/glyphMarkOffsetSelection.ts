import { RequestChannel } from './requestChannel'

/**
 * The Properties offset boxes of a selected user SYMBOL (docs/plans/symbol-plan.md P4): *"set THIS symbol's
 * hand offset to (x, y)"*, ABSOLUTE, in staff spaces (`y` +down). Command-only — `GlyphMarkController`
 * applies it through `engine.glyphMark.setOffset`, the same page limit the arrows meet.
 */
export interface GlyphMarkOffsetRequest {
  id: string
  x: number
  y: number
}

export const createGlyphMarkOffsetSelection = () => new RequestChannel<GlyphMarkOffsetRequest>()
