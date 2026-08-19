/**
 * ⭐ **COPY/PASTE OF A SELECTED ELEMENT** — the second thing the clipboard can hold. His ask,
 * 2026-08-19: *"if i select an expression i want to be able to copy with ctrl c so i can paste it in
 * other place with ctrl v"*.
 *
 * ⭐ **The clip is the MARK, not its place.** What travels is what the user typed and how it reads
 * (`text`, `placement`, the voice it governed); WHERE it lands is the separate {@link PasteAnchor}
 * argument — `utils/clip`'s own split, for its reason: a clip with no position in it is pasteable
 * anywhere, any number of times. No id travels either, so a paste is always a NEW mark rather than
 * a second reference to the copied one.
 *
 * ⭐ **A second kind is a ROW here**, not a branch somewhere else: the union grows an arm, `copyElement`
 * grows a case that reads the model, `pasteElement` grows the case that writes it. Today only the
 * dynamic (which is what an *expression* is in this model — the mark IS its text, see
 * `types/music.ts` `Dynamic`) travels; a clef or a meter would slot in the same way.
 *
 * ⛔ **Nothing about the drawing travels.** A hand-nudged offset lives in the engraving-overrides
 * compartment keyed by the copied mark's id, and that id is exactly what a paste does not reuse —
 * so the new mark arrives at its anchor's default place, which is the honest answer: the nudge was
 * authored against other music.
 */
import type { MusicEngine } from '../engine/MusicEngine'
import type { SelectedElement } from './EditorState'
import type { PasteAnchor } from './pasteAnchor'

/** A copied DYNAMIC — a level (`f`), an expression word (`dolce`) or a mix of both. */
export interface DynamicElementClip {
  kind: 'dynamic'
  /** The whole printed string, verbatim (glyphs + words) — the mark IS its text. */
  text: string
  placement: 'above' | 'below'
  /** The voice it governed; kept only as the fallback when the anchor names no lane. */
  voice?: 0 | 1 | 2 | 3
}

/** One copied on-score element. Grows an arm per kind that learns to travel. */
export type ElementClip = DynamicElementClip

/** What the element clipboard needs off the engine — a Pick, so a spec needs no renderer. */
export type ElementClipEngine = Pick<MusicEngine, 'getDynamicById' | 'addDynamic' | 'staffIdForIndex'>

/** The clip for the currently selected element, or null when that kind cannot travel (yet). */
export function copyElement(engine: ElementClipEngine, element: SelectedElement | null): ElementClip | null {
  if (element?.kind !== 'dynamic') return null
  const dynamic = engine.getDynamicById(element.id)
  if (!dynamic) return null
  return { kind: 'dynamic', text: dynamic.text, placement: dynamic.placement ?? 'below', voice: dynamic.voice }
}

/**
 * Write the clip at `anchor` and answer what should now be SELECTED — the new mark, so a paste
 * leaves you holding what you just made (the note paste's rule). Null when the write was refused.
 */
export function pasteElement(engine: ElementClipEngine, clip: ElementClip, anchor: PasteAnchor): SelectedElement | null {
  switch (clip.kind) {
    case 'dynamic': {
      // The anchor's lane wins where it named one (a note carries voice AND staff); the clip's own
      // is the fallback for the kinds that name neither (a barline is system-wide).
      const staffId = engine.staffIdForIndex(anchor.staff)
      const created = engine.addDynamic(anchor.measure, {
        beat: anchor.beat,
        text: clip.text,
        voice: (anchor.voice ?? clip.voice ?? 0) as 0 | 1 | 2 | 3,
        placement: clip.placement,
        ...(staffId ? { staffId } : {}),
      })
      return created ? { kind: 'dynamic', id: created.id } : null
    }
    default:
      throw new Error(`Unhandled element clip: ${JSON.stringify(clip)}`)
  }
}

/** A short human-readable line for the copy/paste console dump. */
export function elementClipSummary(clip: ElementClip): string {
  return `${clip.kind} "${clip.text}" (${clip.placement})`
}
