/**
 * 🔧 **`__durations` — the long values' house-style rows, from the console** (docs/plans/other-durations-plan.md P4).
 *
 * - `.breveHead('round' | 'square')` / `.longaHead(…)` — the head a breve / longa is drawn with (`fonts/longHeads`);
 * - `.longaStem('right' | 'normal')` — the side a longa's DOWN stem stands on (`layout/longaStem`);
 * - `.barRest('convention' | 'whole' | 'lilypond')` — the glyph a whole-bar rest draws (`layout/barRestStyle`).
 *
 * Each re-renders. ⛔ An unknown name is refused and said so — a typo that looked like it worked would be
 * the worst possible instrument. Nothing is saved: these are the preset menu's rows, not the score's.
 */
import { dbg } from '@/utils/debug'
import { LONG_HEADS, longHeadSettings, resetLongHeads, setLongHead, type LongHeadShape } from '@/engine/fonts/longHeads'
import { LONGA_STEM_SIDES, longaStemSide, resetLongaStemSide, setLongaStemSide, type LongaStemSide } from '@/engine/layout/longaStem'
import { BAR_REST_STYLES, barRestStyle, resetBarRestStyle, setBarRestStyle, type BarRestStyle } from '@/engine/layout/barRestStyle'

export interface DurationsSettings {
  breveHead: LongHeadShape
  longaHead: LongHeadShape
  longaStem: LongaStemSide
  barRest: BarRestStyle
}

export interface DurationsConsole {
  breveHead(shape: LongHeadShape): DurationsSettings
  longaHead(shape: LongHeadShape): DurationsSettings
  longaStem(side: LongaStemSide): DurationsSettings
  barRest(style: BarRestStyle): DurationsSettings
  reset(): DurationsSettings
}

function settings(): DurationsSettings {
  const heads = longHeadSettings()
  return { breveHead: heads.breve, longaHead: heads.longa, longaStem: longaStemSide(), barRest: barRestStyle() }
}

export function durationsConsole(render: () => void): DurationsConsole {
  const apply = (ok: boolean, refusal: string): DurationsSettings => {
    if (!ok) {
      dbg(`[durations] ⛔ ${refusal}`)
      return settings()
    }
    render()
    const s = settings()
    dbg(`[durations] armed: breve head ${s.breveHead} · longa head ${s.longaHead} · longa stem ${s.longaStem} · bar rest ${s.barRest}`)
    return s
  }
  const heads = Object.keys(LONG_HEADS).map(n => `'${n}'`).join(', ')
  return {
    breveHead: shape => apply(setLongHead('breve', shape), `no such head: ${shape} — try ${heads}`),
    longaHead: shape => apply(setLongHead('longa', shape), `no such head: ${shape} — try ${heads}`),
    longaStem: side => apply(setLongaStemSide(side), `no such side: ${side} — try ${LONGA_STEM_SIDES.map(n => `'${n}'`).join(', ')}`),
    barRest: style => apply(setBarRestStyle(style), `no such style: ${style} — try ${BAR_REST_STYLES.map(n => `'${n}'`).join(', ')}`),
    reset: () => {
      resetLongHeads()
      resetLongaStemSide()
      resetBarRestStyle()
      return apply(true, '')
    },
  }
}
