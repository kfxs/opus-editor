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

/**
 * ⭐ **How far ONE END of a beam may be dragged toward the heads** — the floor for a square's drag (his ask, 2026-09-28:
 * control the angle). Moving one end by Δ changes each stem in proportion to where it stands: 0 at the OTHER end's
 * stem, Δ at the dragged end's, linear between. So the tightest stem decides — never the dragged one alone.
 *
 * Read ONCE, at the press, off the drawn stems (a drag may not read its own outcome); the answer is then a fixed
 * bound the gesture clamps to. @returns the least Δ, in staff spaces AWAY from the heads (≤ 0), the end may take
 * from where it was drawn.
 */
export function beamEndDragFloor(
  lines: readonly ElementInfo[], stems: readonly ElementInfo[], spacePx: number, which: 'start' | 'end',
): number {
  const group = [...beamGroupStems(lines, stems)].sort((a, b) => a.bbox.x - b.bbox.x)
  if (group.length < 2 || !(spacePx > 0)) return -Infinity
  const x = (s: ElementInfo) => s.bbox.x + s.bbox.width / 2
  const moving = which === 'start' ? x(group[0]) : x(group[group.length - 1])
  const fixed = which === 'start' ? x(group[group.length - 1]) : x(group[0])
  let least = -Infinity
  for (const stem of group) {
    const t = (x(stem) - fixed) / (moving - fixed)
    if (!(t > 1e-6)) continue
    least = Math.max(least, (BEAMED_STEM_MIN_SPACES * spacePx - stem.bbox.height) / (t * spacePx))
  }
  return Math.min(0, least)
}

/**
 * ⭐ **How far the WHOLE beam may be dragged toward the heads** — every stem changes by the same Δ, so the SHORTEST
 * decides. Read once at the press, like {@link beamEndDragFloor}. @returns the least Δ (≤ 0), staff spaces AWAY.
 */
export function beamBodyDragFloor(lines: readonly ElementInfo[], stems: readonly ElementInfo[], spacePx: number): number {
  const group = beamGroupStems(lines, stems)
  if (group.length === 0 || !(spacePx > 0)) return -Infinity
  const shortest = Math.min(...group.map(s => s.bbox.height))
  return Math.min(0, (BEAMED_STEM_MIN_SPACES * spacePx - shortest) / spacePx)
}
