/**
 * ⭐⭐ **THE HIT BOX A CLICK RESOLVES AGAINST, COMPUTED FROM THE INK** — P6b, one element kind at a
 * time (`docs/own-engraving-engine.md` §5 P6).
 *
 * > *"A box is COMPUTED from what was drawn, not measured off the page and not asked of an object."*
 *
 * ## ⭐ What changes, and it is one sentence per column
 *
 * | | the box today | the box here |
 * |---|---|---|
 * | where it comes from | `Element.getBoundingBox()` — this object's `x`/`y` fields plus a font measurement | the stamp that actually painted the sign (`rendering/sceneInk`) |
 * | how tall it is | the **font's LINE BOX**, over three times the glyph (`e2e/sceneBox.e2e.ts`) | the glyph's own outline, from `fonts/GLYPH_BOXES` |
 * | where it can be checked | a browser, by clicking | ⭐ jsdom, as arithmetic |
 *
 * ⭐⭐ **That last row is the point of P6.** Two bugs reached his screen on 2026-09-14 — an accidental
 * filed under the wrong pitch, and a chord's five pitches sharing one head centre — and both were
 * hit-box bugs that no unit test could have caught, because a hit box could only be looked at.
 *
 * ## ⚠️ Why each kind gets its own function rather than one generic one
 *
 * A hit box is not always the ink: a stem's true rect is a pixel and a half wide and every test pads
 * it, a span mark's box is a band over the notes it covers, and a note is hit semantically off its
 * notehead. ⭐ So this file grows a FUNCTION PER KIND as the kinds migrate — it is P6b's table — and
 * ⛔ never a single `hitBoxOf(anything)` that would have to decide those cases by type-switching.
 *
 * ## 🚨 The fallback is VexFlow's own box, and it is LOUD on purpose
 *
 * It is not a guess — it is the other ruler, the one shipping today — but it is still a fallback
 * that *only runs when the truth said no*, and this migration's standing lesson is that such a
 * branch wins silently ([[reference_an_or_fallback_only_runs_when_the_truth_said_no]]). ⇒ every
 * crossing is `dbg`-reported with the glyph that caused it, and the specs pin that the ordinary path
 * never takes it.
 */
import { dbg } from '@/utils/debug'
import type { SceneBox } from '@/engine/scene/sceneBox'
import type { EngravedAccidental } from './EngravedAccidental'

/**
 * ⭐ **ONE ACCIDENTAL'S HIT BOX — the first kind to migrate** (2026-09-14).
 *
 * ⚠️ In the coordinates the sign was DRAWN in, which are the same ones `getBoundingBox()` answered
 * in: pre-transform, so a small staff's `scale(k)` is still `ElementRegistry.add`'s to apply. ⭐ That
 * is why this is a swap and not a migration — the space does not change, only the ruler.
 *
 * @returns null when neither ruler has an answer — the sign has not been drawn yet.
 */
export function accidentalHitBox(accidental: EngravedAccidental): SceneBox | null {
  const ours = accidental.drawnInk()
  if (ours) return ours
  // ⚠️ Reachable only for a sign that has not DRAWN: since S12e a cautionary sign and a glyph outside
  // the font table are refused at construction. `drawnHitBox.test.ts` keeps that true, not assumed.
  dbg(
    `⚠️ [hit-box] accidental "${accidental.getText()}" has no ink box of ours — ` +
      `falling back to the line-box (docs/own-engraving-engine.md §5 P6b).`,
  )
  const box = accidental.getBoundingBox()
  return box ? { x: box.x, y: box.y, width: box.w, height: box.h } : null
}
