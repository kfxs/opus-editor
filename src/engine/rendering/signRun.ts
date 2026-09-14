import { Barline, Clef, StaveModifierPosition, TimeSignature } from 'vexflow'
import type { Stave, StaveModifier } from 'vexflow'
import type { HeaderSign, SignKind, SignRun } from '@/engine/engrave/staff/signRun'

/**
 * ⭐ **THE ONE PLACE a bar's signs are read off a VexFlow `Stave`'s modifiers** — S4a of
 * `docs/vexflow-removal-map.md`. Everything else asks the {@link SignRun}.
 *
 * A SEAM, the same shape as `./staveFrame`'s `barFrame` and `./noteRuler`: every field is a getter, so
 * each value is read at the moment a reader asks. ⚠️ That matters twice here — a modifier has no `x`
 * until `Stave.format()` has walked the run, and `./headerPlacementPass` and `spreadHeaderToSystem`
 * MOVE the signs after that walk, so a copy taken at any other moment would be someone else's answer.
 */
export function signRun(stave: Stave): SignRun {
  const firstOpening = (category: string): HeaderSign | undefined => {
    const modifier = stave.getModifiers(StaveModifierPosition.BEGIN, category)[0]
    return modifier ? headerSign(modifier) : undefined
  }
  return {
    get opening() { return stave.getModifiers(StaveModifierPosition.BEGIN).map(headerSign) },
    get clef() { return firstOpening(Clef.CATEGORY) },
    get meter() { return firstOpening(TimeSignature.CATEGORY) },
    get endBarlineX() { return stave.getModifiers(StaveModifierPosition.END, Barline.CATEGORY)[0]?.getX() },
  }
}

function headerSign(modifier: StaveModifier): HeaderSign {
  return {
    kind: kindOf(modifier.getCategory()),
    get x() { return modifier.getX() },
    get xShift() { return modifier.getXShift() },
    get width() { return modifier.getWidth() },
  }
}

function kindOf(category: string): SignKind {
  if (category === Barline.CATEGORY) return 'barline'
  if (category === Clef.CATEGORY) return 'clef'
  if (category === TimeSignature.CATEGORY) return 'meter'
  return 'other'
}
