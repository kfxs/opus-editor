/**
 * ⭐ **WHO CAN BE HANDED OUR SURFACE** — the one-line family that `EngravedStave`'s modifier walk asks.
 *
 * A stave draws its lines on `RenderPass.context` (the recorder during a `recordScene` render, the
 * real painter otherwise) and then walks its modifiers, which still take VexFlow's context because
 * most of them still paint themselves. ⭐ **One at a time, they stopped** — the CLEF on 2026-09-02,
 * the METER on 2026-09-12, the opening BARLINE on 2026-09-13 (`docs/own-engraving-engine.md` P5b) —
 * and each one that has needs telling which surface to draw on. ⚠️ That is every modifier a score
 * stave carries today, ⛔ which does not close the family: `Barline`'s other types, a `Repetition`,
 * a `Volta` and the rest of VexFlow's `StaveModifier`s are all still unmigrated members-in-waiting.
 *
 * 🚨 **This exists so that the third one is a ROW and not a third `instanceof`.** `CLAUDE.md`'s rule:
 * *"A SLICE TOO THIN TO BE LOGIC IS STILL A SLICE — if what you are adding is the twelfth `case` in a
 * family, add the twelfth MODULE and a ROW in its table."* The modifier walk was one `instanceof`
 * away from being that family; implementing this interface is now the whole of joining it.
 *
 * ⚠️ **The guard is structural on purpose.** The members are `EngravedClef`,
 * `EngravedTimeSignature` and `EngravedBarline`, which have no common base but `StaveModifier` —
 * VexFlow's own class tree —
 * and inventing one would mean subclassing across two unrelated VexFlow classes. ⭐ The `implements`
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
