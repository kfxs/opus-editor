/**
 * ⭐ **HOW FAR A BEAM MAY BE PUSHED TOWARD ITS NOTEHEADS** — the floor under a beam's hand nudge (his ask,
 * 2026-09-28, and what the first cut showed in Chromium: pushed down six spaces, the beam went THROUGH the heads,
 * the stems stopped shrinking and the beam floated below the notes, detached).
 *
 * A step that shortens the stems is refused when it would leave the group's SHORTEST stem under
 * {@link BEAMED_STEM_MIN_SPACES}. Read off the LAST render (each stem's drawn rect, `rendering/stemInk`), as the
 * tie's band limit is; a step AWAY from the heads only lengthens stems and is never refused here.
 *
 * ⛔ No DOM.
 */
import type { ElementInfo } from '@/engine/ElementRegistry'

/**
 * The shortest stem a pushed beam may leave, in staff spaces. ⭐ Gould p. 315's *"at least 2½ stave-spaces"* — stated
 * there for a beam between two staves (`engrave/beams/crossStaffBeam.minStemSpaces`), and the one sourced number the
 * library holds for a beamed stem's floor. A changeable default; ⏭️ the ordinary beamed group's own minimum is a
 * research follow-up (CLAUDE.md: an engraving number never blocks).
 */
export const BEAMED_STEM_MIN_SPACES = 2.5

/** The stems under a beam's run, in its bar and staff. */
export function beamGroupStems(lines: readonly ElementInfo[], stems: readonly ElementInfo[]): ElementInfo[] {
  if (lines.length === 0) return []
  const { measure, staff } = lines[0]
  const left = Math.min(...lines.map(l => l.bbox.x))
  const right = Math.max(...lines.map(l => l.bbox.x + l.bbox.width))
  return stems.filter(s => s.measure === measure && (s.staff ?? 0) === (staff ?? 0)
    && s.bbox.x + s.bbox.width / 2 >= left - 2 && s.bbox.x + s.bbox.width / 2 <= right + 2)
}

/** Whether the beam drawn as `lines` stands ABOVE its stems (stems up) — its heads below. True when nothing is drawn. */
export function beamStandsAbove(lines: readonly ElementInfo[], stems: readonly ElementInfo[]): boolean {
  if (lines.length === 0 || stems.length === 0) return true
  const beamMid = Math.min(...lines.map(l => l.bbox.y + l.bbox.height / 2))
  const stemMid = stems.reduce((sum, s) => sum + s.bbox.y + s.bbox.height / 2, 0) / stems.length
  return beamMid < stemMid
}

/**
 * Whether moving the beam drawn as `lines` by `dy` staff spaces (screen-signed, + down) keeps every stem of its group
 * at least {@link BEAMED_STEM_MIN_SPACES} long. `stems` is every drawn stem; the group's are those in the lines'
 * bar and staff that stand under the beam's run. `spacePx` is that staff's line spacing.
 */
export function beamNudgeKeepsStems(
  lines: readonly ElementInfo[], stems: readonly ElementInfo[], spacePx: number, dy: number,
): boolean {
  if (lines.length === 0 || dy === 0 || !(spacePx > 0)) return true
  const group = beamGroupStems(lines, stems)
  if (group.length === 0) return true
  // Which way are the heads? A beam ABOVE its stems (stems up) has its heads below, so + (down) shortens them.
  const towardHeads = beamStandsAbove(lines, group) ? dy > 0 : dy < 0
  if (!towardHeads) return true
  const shortest = Math.min(...group.map(s => s.bbox.height))
  return shortest - Math.abs(dy) * spacePx >= BEAMED_STEM_MIN_SPACES * spacePx - 1e-6
}
