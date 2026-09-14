/**
 * ⭐ **WHO CAN BE HANDED OUR SURFACE** — the one-line family a NOTE's modifier walk asks.
 *
 * A note draws its heads on `RenderPass.context` (the recorder during a `recordScene` render, the real
 * painter otherwise) and then walks its modifiers, which still take VexFlow's context because most of
 * them still paint themselves. ⭐ **One at a time, they stopped** — the accidental, the augmentation dot
 * and the articulation (P3f/P3g) — and each one that has needs telling which surface to draw on.
 *
 * ⚠️ **The stave's signs left this family in S4c** (`docs/vexflow-removal-map.md`): the clef, the meter
 * and the opening barline joined it in P5b, and are now plain objects of ours that the stave hands its
 * surface directly (`./staveSign`'s `drawSign`).
 *
 * 🚨 **This exists so that the third one is a ROW and not a third `instanceof`.** `CLAUDE.md`'s rule:
 * *"A SLICE TOO THIN TO BE LOGIC IS STILL A SLICE — if what you are adding is the twelfth `case` in a
 * family, add the twelfth MODULE and a ROW in its table."* The modifier walk was one `instanceof`
 * away from being that family; implementing this interface is now the whole of joining it.
 *
 * ⚠️ **The guard is structural on purpose.** The members are `EngravedAccidental`, `EngravedDot` and
 * `EngravedArticulation`, which have no common base but VexFlow's `Modifier` — and inventing one would
 * mean subclassing across unrelated VexFlow classes. ⭐ The `implements`
 * clause on each member is what makes the set checkable at compile time; this only finds them again.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'

/**
 * A drawn thing that takes its surface from whoever is rendering it, rather than from
 * `checkContext()`.
 *
 * ⚠️ Implementers must treat an unset surface as a FALLBACK to the VexFlow context, ⛔ never as a
 * reason not to draw: an unset surface is a lost SCENE entry and ⛔ never a lost pixel.
 */
export interface InkSurfaceAware {
  setInkSurface(ctx: DrawContext): void
}

/** Whether this object draws through a surface we can hand it. */
export function acceptsInkSurface(value: object): value is InkSurfaceAware {
  return typeof (value as Partial<InkSurfaceAware>).setInkSurface === 'function'
}
