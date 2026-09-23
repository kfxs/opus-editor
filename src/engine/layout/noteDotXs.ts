/**
 * ⭐ **Where a note's augmentation DOTS stand** (each dot's LEFT edge), in its OWN staff spaces past its
 * head's anchor — ⭐⭐ the NORMAL note's rule (`rendering/format/dotPlacement` + `engrave/notes/modifierStart`),
 * reading the SAME rows: the head's width + VexFlow's `MODIFIER_RIGHT_GAP_PX`, then either the FLAG's width
 * (a stem-UP flagged note pushes its dots past the flag — `forceFlagRight`) or what the armed dot gap adds
 * over that base (`layout/dotGap` — `__dots.gap`); each further dot one dot's width + the armed dot→dot gap
 * (never under VexFlow's 1 px). Every px row is divided by `STAFF_SPACE_PX`.
 *
 * Lifted out of `layout/graceRoom.graceDotXs` (2026-09-23) so a PARENTHESISED note's brackets can ask it
 * too (`layout/headEnclosure`): a flagged stem-up note's dot stands past its flag, measured in Chromium at
 * 2.5 sp against an unflagged 1.7, and a `)` placed for the unflagged one landed ON the dot (his report).
 */
import type { NoteDuration } from '@/types/music'
import { armedDotGap } from './dotGap'
import { flagGlyph, glyphBox, noteheadInk } from '@/engine/fonts/fontMetrics'
import { MODIFIER_RIGHT_GAP_PX, VEXFLOW_DOT_SPACING } from '@/engine/engrave/inheritedDefaults'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * @param upFlag the note DRAWS a stem-up flag (the beaming rule's answer, which each caller has) — its dots
 *   then stand past the flag. A stem-DOWN flag hangs under the head: nothing for a dot to clear.
 */
export function noteDotXs(note: { duration: NoteDuration; dots?: number }, upFlag: boolean): number[] {
  const px = (v: number) => v / STAFF_SPACE_PX
  const base = px(MODIFIER_RIGHT_GAP_PX)
  const flag = upFlag ? flagGlyph(note.duration, true) : null
  const push = flag ? glyphBox(flag).right : Math.max(0, armedDotGap().head - base)
  const first = noteheadInk(note.duration) + base + push
  const step = glyphBox('augmentationDot').right + Math.max(px(VEXFLOW_DOT_SPACING), armedDotGap().dot)
  return Array.from({ length: Math.max(0, note.dots ?? 0) }, (_, i) => first + i * step)
}
