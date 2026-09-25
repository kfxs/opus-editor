import { bus } from '@/bus'
import type { TupletBracket, TupletBracketEnd, TupletNumberStyle } from '@/types/music'
import { DEFAULT_TUPLET_BRACKET_END } from '@/utils/musicUtils'
import type { TupletOffsetOverride } from '@/types/music'
import { buildSelect, scalarOffsetRow } from '../rows'
import { live, overrideOf, type PanelRows } from './panel'

/**
 * ⭐ A selected TUPLET's panel — the Tuplet WINDOW's *Format* box, for a tuplet that already stands (his ask,
 * 2026-09-25: *"the user should be able to select for the brackets: auto, show, hide"*, then *"the other formats
 * that we have for the tuplet in the tuplet palette should be able to reconfigure manually by the user in the
 * properties"*). The window *"can only dress a tuplet it is creating"*; this is the way to restyle one.
 * The OFFSET first (his call), then three choices, each its own row and its own publish (a PARTIAL request,
 * the barline's shape):
 *   • **offset y** — the hand's vertical nudge, the arrows' number typed (`bus.tupletOffset`);
 *   • **number** — what the mark prints; `auto` is the rule (`utils/musicUtils.autoNumberStyle`);
 *   • **bracket** — `auto` (only where no beam shows the group), show, hide;
 *   • **bracket end** — at the last note, the full duration (`division`), or short of the next note.
 * A DUMB PUBLISHER, like the barline's chooser: it writes to `bus.tupletEdit` and never touches the engine.
 */
export const tupletRows: PanelRows<'tuplet'> = (element) => {
  const tuplet = live(element.data)
  if (!tuplet) return []
  const publish = (edit: Omit<Parameters<typeof bus.tupletEdit.set>[0], 'tupletId'>) => bus.tupletEdit.set({ tupletId: tuplet.id, ...edit })
  return [
    // ⭐ FIRST — his call (*"lets make the offset the first option in the properties"*): the hand's vertical
    //    nudge, the arrows' number typed, through `bus.tupletOffset`.
    scalarOffsetRow('offset y (sp)', overrideOf<TupletOffsetOverride>(element, 'tupletOffset')?.y ?? 0,
      'Vertical offset of the bracket and its number, + is DOWN — the arrows’ number, typed',
      y => bus.tupletOffset.set({ tupletId: tuplet.id, y })),
    buildSelect('number', NUMBER_STYLES, tuplet.numberStyle ?? 'auto',
      'What the mark prints — auto follows the rule: the ratio where the number alone cannot be completed. A content edit, so it is undoable.',
      value => publish({ numberStyle: value })),
    buildSelect('bracket', BRACKETS, tuplet.bracket ?? 'auto',
      'The bracket over the group — auto draws one only where no beam shows the group. A content edit, so it is undoable.',
      value => publish({ bracket: value })),
    buildSelect('bracket end', BRACKET_ENDS, tuplet.bracketEnd ?? DEFAULT_TUPLET_BRACKET_END,
      'Where the bracket stops — the last note, the group’s full duration, or short of the next note.',
      value => publish({ bracketEnd: value })),
  ]
}

/** The words a musician says, mapped to the ENGINE's vocabulary (⛔ not a copy of its unions) — the Tuplet
 *  window's own lists, with an `auto` where the model's absent field is the rule. */
const NUMBER_STYLES: Array<[TupletNumberStyle | 'auto', string]> = [
  ['auto', 'auto'],
  ['number', 'number  3'],
  ['ratio', 'ratio  3:2'],
  ['entryRatio', 'entry ratio'],
  ['ratioNote', 'ratio + note  3:2♪'],
  ['none', 'none'],
]
const BRACKETS: Array<[TupletBracket, string]> = [
  ['auto', 'auto — only when unbeamed'],
  ['always', 'show'],
  ['never', 'hide'],
]
const BRACKET_ENDS: Array<[TupletBracketEnd, string]> = [
  ['lastNote', 'last note'],
  ['division', 'full duration'],
  ['beforeNext', 'before the next note'],
]
