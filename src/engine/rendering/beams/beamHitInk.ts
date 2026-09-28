/**
 * ⭐ **A BEAM'S CLICKABLE INK — each drawn beam line as its own `'beamGroup'` entry** (his ask, 2026-09-28: *"if I
 * have a beamed group I cannot select a beam like individual element"*).
 *
 * One entry per LINE the beam draws (the primary and every secondary / fractional line), each carrying:
 *
 * - `points` — the line's four corners, its top edge and that edge moved by the beam's (signed) thickness: the
 *   slanted band that was filled, so a press is tested against the INK and the heads and stems beneath a
 *   beam keep their own presses (a slanted beam's box would swallow them);
 * - `noteId` — the group's ANCHOR, its first NOTE (a chord's lowest pitch — the stem's anchor; a beamed rest
 *   before it is passed over): the one thing that names the same beam from one render to the next, as the stem
 *   and the flag are named. ⭐ A note, never a rest, because the highlight finds the beam THROUGH that note's
 *   stem — a beamed stem is drawn inside its beam's `g.beam`.
 *
 * ⛔ **No drawn id.** `g.beam`'s id is a render counter (`beam5` in one render, `beam3` in the next), and the
 * registry a translated bar keeps must be exactly the one a fresh draw files (`ScoreRenderer.incrementalRedraw`'s
 * spec caught the first cut carrying it).
 *
 * ⛔ **Not the `'beam'` entries** the renderer already files: those keep a zero-size box on purpose, and what a
 * beam's box SHOULD be is an open decision (`docs/history/vexflow-removal-map.md` §9.4 #2). This is a separate
 * type, read only by the beam's selection (`interactions/elements/beamGroup`).
 *
 * ⚠️ Ordinary in-bar beams only. A beam that crosses a barline or a system break, a fanned beam and a
 * grace group's beam are drawn by other passes and are not filed here yet.
 *
 * ⛔ No DOM.
 */
import type { ElementRegistry } from '@/engine/ElementRegistry'
import type { ChordRest } from '@/types/music'
import { spellingToMidi } from '@/utils/pitchSpelling'
import type { EngravedBeam } from '../engraved/EngravedBeam'
import type { EngravedNote } from '../engraved/EngravedNote'

/** The id a chord is selected by as a beam's ANCHOR — its lowest pitch (the stem's anchor); a rest has none. */
export function beamAnchorId(slot: ChordRest): string | undefined {
  if (slot.type !== 'chord') return undefined
  const lowest = [...slot.notes].sort(
    (a, b) => spellingToMidi(a.step, a.alter, a.octave) - spellingToMidi(b.step, b.alter, b.octave),
  )[0]
  return lowest?.id
}

/** A beam line's band: its top edge, and that edge moved by the (signed) thickness. */
export function beamLineBand(
  line: { startX: number; startY: number; endX: number; endY: number }, thickness: number,
): { x: number; y: number }[] {
  return [
    { x: line.startX, y: line.startY },
    { x: line.endX, y: line.endY },
    { x: line.endX, y: line.endY + thickness },
    { x: line.startX, y: line.startY + thickness },
  ]
}

/**
 * File every line of `beams` (drawn in this bar, on this staff) as `'beamGroup'` ink. `slots` and `notes` are the
 * bar's parallel arrays — slot `i` drew note `i` — which is how a beam's first NOTE finds its anchor. A beam of
 * rests alone files nothing.
 */
export function registerBeamHitInk(
  registry: ElementRegistry,
  beams: readonly EngravedBeam[],
  slots: readonly ChordRest[],
  notes: readonly EngravedNote[],
  measureNumber: number,
  staffIndex: number,
): void {
  for (const beam of beams) {
    try {
      const noteId = beam.notes.map(note => slots[notes.indexOf(note)]).map(slot => slot && beamAnchorId(slot)).find(Boolean)
      if (!noteId) continue
      const { lines, thickness } = beam.drawnLines()
      for (const line of lines) {
        const points = beamLineBand(line, thickness)
        const xs = points.map(p => p.x)
        const ys = points.map(p => p.y)
        const x = Math.min(...xs)
        const y = Math.min(...ys)
        const width = Math.max(...xs) - x
        const height = Math.max(...ys) - y
        if (![x, y, width, height].every(Number.isFinite) || width <= 0) continue
        registry.add({
          type: 'beamGroup',
          noteId,
          measure: measureNumber,
          staff: staffIndex,
          points,
          bbox: { x, y, width, height },
        })
      }
    } catch (_e) { /* a beam's lines are only real once it has been formatted */ }
  }
}
