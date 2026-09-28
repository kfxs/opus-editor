import { RequestChannel } from './requestChannel'

/**
 * The Symbols window's *Add symbol* button (docs/plans/symbol-plan.md P2): *"put THIS glyph on the event
 * THIS note or rest belongs to"*. Command-only — the window publishes, `GlyphMarkController` (the one place
 * that holds the engine) applies it, and neither imports the other.
 */
export interface GlyphMarkAddRequest {
  /** A chord head's pitch id or a rest's slot id — what the selection names. */
  noteId: string
  /** The SMuFL canonical name. */
  glyph: string
}

export const createGlyphMarkAddSelection = () => new RequestChannel<GlyphMarkAddRequest>()
