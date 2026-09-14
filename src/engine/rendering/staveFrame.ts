import type { Stave } from 'vexflow'
import type { StaffFrame } from '@/engine/engrave/staff/staffFrame'

/**
 * ⭐ **THE ONE PLACE a staff's lines are read off a VexFlow `Stave`** — S2 of
 * `docs/vexflow-removal-map.md`. Everything else asks the frame (`engrave/staff/staffFrame`).
 *
 * A SEAM, not a port: the three numbers are the stave's own, so no reader's answer changes. That
 * includes a REUSED bar's stave, which still reports where it was last painted — the frame carries the
 * same staleness, and the readers that correct for it (`staleShift` in `./KeySignaturePass` and
 * `./BarlineRenderer`, `lineY` in `./barlineGap`) keep doing so. ⏭️ When the stave object goes (S4)
 * this is built from the placement instead, and those corrections go with it.
 */
export function staveFrame(stave: Stave): StaffFrame {
  return {
    topLineY: stave.getYForLine(0),
    spacePx: stave.getSpacingBetweenLines(),
    lineCount: stave.getNumLines(),
  }
}
