import type { Score } from '@/types/music'

/**
 * 🚧 **THE SCORE'S OWN TEXT — its title and its composer, as one family.** 🚧
 *
 * ⛔ **Scaffolding.** Read `engine/rendering/ScoreHeaderPass`'s note first: what heads a real score is
 * a FRAME of text items — title, subtitle, composer, lyricist, arranger, copyright, per-page headers
 * — each an engraved object with an id, a placement and its own overrides. What we have is two
 * optional strings on `Score`, and this module is the whole of what may be done to them.
 *
 * ⭐ **It is a table, not two copies.** The title and the composer differ in exactly one place — the
 * field they live in — so they are addressed by a {@link ScoreTextField} everywhere: one write, one
 * clear, one selection kind, one dialog, one drawn row. ⚠️ A third string ("subtitle", "arranger")
 * does NOT arrive by adding a third `case`; it is either a row in this union — if it really is one
 * more `Score` field — or the signal that the sketch has outlived itself and the frame is due.
 *
 * ⭐⭐ **BLANK MEANS ABSENT.** Every write here deletes the key rather than storing `''`, and every
 * read treats a blank string as nothing. There is no difference between *"this score has no
 * composer"* and *"its composer is the empty string"*, so the model is not allowed to hold two
 * representations of it — that conflation is what `Score.title`'s own note refuses, and it is why an
 * exported file has no `title` key at all once the title is deleted (his ask, 2026-08-27).
 */

/** Which of the score's own text fields. ⭐ The discriminator every layer in this family carries. */
export type ScoreTextField = 'title' | 'composer'

/** Both fields, in the order they are DRAWN and listed — title above, composer under it. Exported
 *  so a menu, a dialog or a pass can iterate the family rather than naming its members. */
export const SCORE_TEXT_FIELDS: readonly ScoreTextField[] = ['title', 'composer']

/** What that field says, or `undefined` when it says nothing. ⭐ A blank string reads as ABSENT —
 *  see the module note; nothing downstream should have to trim again. */
export function scoreText(score: Score, field: ScoreTextField): string | undefined {
  const value = score[field]?.trim()
  return value ? value : undefined
}

/**
 * Write one field — or DELETE it, when what was typed is blank.
 *
 * @returns whether the score changed, so a caller can skip the undo entry and the repaint.
 */
export function setScoreText(score: Score, field: ScoreTextField, text: string): boolean {
  const next = text.trim()
  if (!next) return clearScoreText(score, field)
  if (score[field] === next) return false
  score[field] = next
  return true
}

/**
 * Remove one field. ⭐ `delete`, so the key is gone from the exported JSON entirely.
 *
 * @returns whether the score changed — false when there was nothing there.
 */
export function clearScoreText(score: Score, field: ScoreTextField): boolean {
  if (score[field] === undefined) return false
  delete score[field]
  return true
}
