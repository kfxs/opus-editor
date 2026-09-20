import type { HeaderSign, SignRun } from '@/engine/engrave/staff/signRun'
import { staveSigns, type EngravedStave } from '../engraved/EngravedStave'
import type { StaveSign } from './staveSign'
import { carriedBy, type PlacedBar } from './staveFrame'

/**
 * ⭐ **A bar's sign run, answered from our own signs** — S4a's seam, and since S4b1 no longer a read of
 * VexFlow's modifiers: each sign holds its own position (`./staveSign`), set by the stave's walk and moved
 * by the header placement. Everything else asks the {@link SignRun}.
 *
 * ⚠️ Still a getter per field, so a reader sees the positions as they are at the moment it asks — the walk
 * runs when the note area is first asked for, and the placement passes move the signs after that.
 */
export function signRun(stave: EngravedStave): SignRun {
  return {
    get opening() { return staveSigns(stave).opening.map(headerSign) },
    get clef() { return firstOf(staveSigns(stave).opening, 'clef') },
    get meter() { return firstOf(staveSigns(stave).opening, 'meter') },
    get endBarlineX() { return staveSigns(stave).closing.find(sign => sign.signKind === 'barline')?.signX },
  }
}

/**
 * ⭐⭐ **The same run where the bar IS this render** — S4e, `./staveFrame`'s placed frames' twin, for ink
 * drawn OUTSIDE the bar's group (`./staveFrame`'s header says which a reader asks). Every x is carried
 * by what the placement moved the bar since its stave was built; a sign's shift and width are its own.
 */
export function placedSignRun(placement: PlacedBar): SignRun {
  const built = signRun(placement.stave)
  const carried = (x: number) => x + carriedBy(placement).dx
  const placed = (sign: HeaderSign): HeaderSign => ({
    kind: sign.kind,
    get x() { return carried(sign.x) },
    get xShift() { return sign.xShift },
    get width() { return sign.width },
  })
  return {
    get opening() { return built.opening.map(placed) },
    get clef() { return built.clef && placed(built.clef) },
    get meter() { return built.meter && placed(built.meter) },
    get endBarlineX() {
      const x = built.endBarlineX
      return x === undefined ? undefined : carried(x)
    },
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
