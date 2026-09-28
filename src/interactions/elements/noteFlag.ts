/**
 * A note's FLAG — the hook on an unbeamed 8th, 16th… (his ask, 2026-09-28: *"the stem and the accidentals are
 * individual selectable elements, i want also make the individual flag a selectable element"*). The stem's
 * twin: selection only — nothing acts on a selected flag yet, and Delete declines (a flag is what a flagged
 * duration looks like, not an object you can remove).
 *
 * Its rect is the flag's own drawn box (`engine/rendering/stemInk`), registered as `'noteFlag'` against the
 * slot's anchor note, one per slot — a chord has one flag, as it has one stem.
 */
import { dbg } from '@/utils/debug'
import type { ClickableElementSpec } from './chain'
import type { HighlightContext } from './highlightContext'
import { selectedOf } from '../state/EditorState'
import { voiceFillColor } from '@/utils/voiceColors'
import type { ElementRegistry } from '@/engine/ElementRegistry'

/** How far past its ink a flag still takes a press, px — a hook is thin at its end. A changeable default. */
const NOTE_FLAG_CLICK_PAD = 2
/**
 * ⭐ How close to its STEM's centre line a press is the stem's, not the flag's, px either side. The flag's ink
 * hangs ALONGSIDE the stem, and a flagged stem is short — seen in Chromium 2026-09-28: a C4 eighth's stem shows
 * 23 px and the flag covered all of it, so the stem could not be picked. The line is the stem's, the hook the
 * flag's. A changeable default.
 */
const NOTE_FLAG_STEM_BAND = 2

export const NOTE_FLAG_ELEMENT: ClickableElementSpec = {
  kind: 'noteFlag',
  /**
   * Select a slot's FLAG. THE NOTE COMES FIRST, as for the stem: a press the notehead owns stays the note's —
   * and a press ON the stem's line stays the stem's ({@link NOTE_FLAG_STEM_BAND}).
   * Containment on the flag's own ink (padded a little), the nearest flag winning where two padded boxes
   * meet — never nearest-note, for the stem's reason: the flag hangs at the TIP, a stem-length from its head.
   */
  hit({ registry, x, y, closestElement }, deps) {
    if (closestElement && registry.hitsNoteOrRestBody(closestElement, x, y)) return false
    const noteId = noteFlagAt(registry, x, y)
    if (!noteId) return false
    // ⭐ ON the stem's line, the press is the stem's — it is asked right after (`./chain`).
    const stem = registry.getByType('stem').find(el => el.noteId === noteId)
    if (stem && Math.abs(x - (stem.bbox.x + stem.bbox.width / 2)) <= NOTE_FLAG_STEM_BAND) return false
    dbg(`✓ Flag selected | noteId:${noteId}`)
    // The shared tail clears the whole note selection, so only the flag shows selected — as the stem.
    return deps.pick({ kind: 'noteFlag', noteId })
  },

  highlight: paintSelectedNoteFlag,
}

/** The anchor note of the flag under (x, y), or null — containment on the registered `'noteFlag'` rects. */
export function noteFlagAt(registry: ElementRegistry, x: number, y: number): string | null {
  let best: string | null = null
  let bestDx = Infinity
  for (const el of registry.getByType('noteFlag')) {
    const b = el.bbox
    if (x < b.x - NOTE_FLAG_CLICK_PAD || x > b.x + b.width + NOTE_FLAG_CLICK_PAD) continue
    if (y < b.y - NOTE_FLAG_CLICK_PAD || y > b.y + b.height + NOTE_FLAG_CLICK_PAD) continue
    const dx = Math.abs(x - (b.x + b.width / 2))
    if (el.noteId && dx < bestDx) {
      bestDx = dx
      best = el.noteId
    }
  }
  return best
}

/**
 * Highlight the selected FLAG — its own glyph inside the note's `stavenote` group, in the slot's voice colour
 * like every other sub-element. A glyph, so FILLED. ⚠️ Only THIS note's flag: a grace note is a `stavenote`
 * of its own, drawn inside its host, and its flag is not the host's (`./notePaint`'s rule).
 */
export function paintSelectedNoteFlag(ctx: HighlightContext): void {
  const engine = ctx.engine
  const noteId = selectedOf(ctx.state, 'noteFlag')?.noteId
  if (!noteId) return
  const group = engine.getStaveNoteSVGGroup(noteId)?.group
  if (!group) return
  const color = voiceFillColor(engine.getNote(noteId)?.voice ?? 0)
  group.querySelectorAll('g.flag').forEach(flag => {
    if (flag.parentElement?.closest('g.stavenote') !== group) return
    flag.querySelectorAll('text, path').forEach(el => {
      const svgEl = el as SVGElement
      ctx.setAttr(svgEl, 'fill', color)
      ctx.setStyleProp(svgEl, 'fill', color)
      ctx.addClass(svgEl, 'selected-flag')
    })
  })
}
