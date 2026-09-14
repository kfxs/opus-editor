import type { Stave } from 'vexflow'
import type { HeaderSign, SignRun } from '@/engine/engrave/staff/signRun'
import { staveSigns } from './EngravedStave'
import type { StaveSign } from './staveSign'

/**
 * ⭐ **A bar's sign run, answered from our own signs** — S4a's seam, and since S4b1 no longer a read of
 * VexFlow's modifiers: each sign holds its own position (`./staveSign`), set by the stave's walk and moved
 * by the header placement. Everything else asks the {@link SignRun}.
 *
 * ⚠️ Still a getter per field, so a reader sees the positions as they are at the moment it asks — the walk
 * runs when the note area is first asked for, and the placement passes move the signs after that.
 */
export function signRun(stave: Stave): SignRun {
  return {
    get opening() { return staveSigns(stave).opening.map(headerSign) },
    get clef() { return firstOf(staveSigns(stave).opening, 'clef') },
    get meter() { return firstOf(staveSigns(stave).opening, 'meter') },
    get endBarlineX() { return staveSigns(stave).closing.find(sign => sign.signKind === 'barline')?.signX },
  }
}

function firstOf(signs: readonly StaveSign[], kind: StaveSign['signKind']): HeaderSign | undefined {
  const sign = signs.find(candidate => candidate.signKind === kind)
  return sign ? headerSign(sign) : undefined
}

function headerSign(sign: StaveSign): HeaderSign {
  return {
    kind: sign.signKind,
    get x() { return sign.signX },
    get xShift() { return sign.signShift },
    get width() { return sign.walkInput().width },
  }
}
