import type { WalkSign } from '@/engine/engrave/staff/signWalk'
import type { SignKind } from '@/engine/engrave/staff/signRun'

/**
 * ⭐ **A sign a score stave carries, holding its OWN position** — S4b1 of `docs/vexflow-removal-map.md`.
 *
 * Our clef, meter and barline implement it. The stave's walk (`EngravedStave.format`) sets
 * {@link StaveSign.signX}, `./headerPlacementPass` and `spreadHeaderToSystem` move it, a hand offset
 * (`./clefOffsetPass`) adds to {@link StaveSign.signShift}, and the sign draws at their sum — so VexFlow's
 * own `x` and `xShift` on these objects are no longer read or written by anything.
 */
export interface StaveSign {
  /** What the sign is. */
  readonly signKind: SignKind
  /** The walk's inputs — padding, width, and a barline's metrics. */
  walkInput(): WalkSign
  /** The sign's unshifted origin, in the stave's own space. */
  signX: number
  /** A hand offset, added when the sign is drawn. */
  signShift: number
}

/** Whether a stave modifier is one of ours. */
export function isStaveSign(modifier: object): modifier is StaveSign {
  return typeof (modifier as Partial<StaveSign>).walkInput === 'function'
}
