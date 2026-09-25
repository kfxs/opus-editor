import { RequestChannel } from './requestChannel'

/**
 * The seam the Properties **glissando** controls publish through (docs/plans/glissando-plan.md, the later list:
 * side · end · direction — his ask, 2026-09-25: *"for gliss post with no target or for pre gliss we should be
 * able to make also the direction"*). **Command-only**, the tuplet's twin: the window writes *"this glissando
 * comes into its note"* and {@link GlissandoEditController}, the one place that holds the engine, applies it.
 * ⚠️ A PARTIAL request — each control publishes only what it changed.
 * ⛔ A CONTENT edit — where the line goes is meaning — so each takes an undo entry.
 */
export interface GlissandoEditRequest {
  glissandoId: string
  side?: 'before' | 'after'
  end?: 'none' | 'next'
  direction?: 'up' | 'down'
}

/** GlissandoEditController handles it — the one place that holds the engine. */
export const createGlissandoEditSelection = () => new RequestChannel<GlissandoEditRequest>()
