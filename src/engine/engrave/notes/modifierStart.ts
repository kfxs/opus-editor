/**
 * ⭐⭐ **WHERE A NOTE OFFERS ITS MODIFIERS A PLACE TO STAND** — S5a of `docs/vexflow-removal-map.md`.
 *
 * Every modifier of a note — its accidental, its dots, its articulations, an annotation — asks the note
 * one question before it places itself: *where do I start, on this side of you?* That answer is this
 * module. It is a transcription of VexFlow 5's `StaveNote.getModifierStartXY` (`stavenote.js`, MIT —
 * the numbers are `../inheritedDefaults`' rows), so the modifiers' own placement rules (`Accidental.format`,
 * `Dot.format`, `Articulation.format`, still VexFlow's — S5b–e) receive exactly the point they always did.
 *
 * | side | x |
 * |---|---|
 * | left | the note's origin − {@link MODIFIER_LEFT_OFFSET_PX} |
 * | right | origin + head width + the note's own shift + {@link MODIFIER_RIGHT_GAP_PX}, and past the FLAG when the stem is up and the head is the inner one (or the caller forces it — a dot does) |
 * | above / below | origin + half the head width — ⚠️ ⛔ without the note's shift |
 * | center | the origin |
 *
 * …and y is the head's own y, moved off a REST's line by {@link REST_MODIFIER_LINE_SHIFT}.
 *
 * ## ⭐ The one part that is the EDITOR's, not VexFlow's — the {@link MarkAnchor}
 *
 * A mark above or below is where two things of ours enter, both on that side only: a hand-nudged note
 * OFFSET (`docs/note-offset-plan.md`), which the note's shift does not carry there, and STEM ALIGNMENT —
 * a stem-side mark centred on the stem instead of the head (`docs/articulation-stem-align.md`). They used
 * to reach this answer by replacing the note's method per note at render time, the repo's one live
 * monkeypatch (`own-engraving-engine.md` §2.4). They are now an input.
 *
 * ⛔ No note, no stave, no VexFlow: the caller reads the note (`rendering/EngravedNote`).
 */
import {
  MODIFIER_LEFT_OFFSET_PX, MODIFIER_RIGHT_GAP_PX, REST_MODIFIER_LINE_SHIFT,
} from '@/engine/engrave/inheritedDefaults'

/** Which side of the note a modifier stands on. */
export type ModifierSide = 'center' | 'left' | 'right' | 'above' | 'below'

/** A stem pointing UP — VexFlow's `Stem.UP`, the sign a note's stem direction is written with. */
const STEM_UP = 1
const STEM_DOWN = -1

/**
 * ⭐ The editor's hold on a mark ABOVE or BELOW a note. Absent for every note that has neither — and
 * today it is set only on a note that carries an ARTICULATION (`ScoreRenderer.applyNoteOffsets`), which
 * is the condition the monkeypatch it replaced ran under.
 */
export interface MarkAnchor {
  /** The note's hand offset in px, which a mark follows on both sides. */
  offsetPx: number
  /** Centre the STEM-side marks on the stem rather than the head. */
  stemAlign: boolean
}

/** What the note answers. The two thunks are read only on the branch that needs them, as VexFlow did. */
export interface ModifierStartNote {
  /** The note's origin — `getAbsoluteX()`. */
  originX: number
  /** The first head's glyph width. */
  glyphWidth: number
  /** The note's own x shift. */
  xShift: number
  /** {@link STEM_UP} or −1. */
  stemDirection: number
  hasFlag: boolean
  flagWidth: () => number
  hasStem: boolean
  stemX: () => number
  /** How many heads the note has — which one is INNER depends on it. */
  headCount: number
  /** The y of the head the modifier belongs to. */
  headY: number
  /** That head's drawn glyph — a rest's decides {@link REST_MODIFIER_LINE_SHIFT}. */
  headGlyph: string
  spacePx: number
  markAnchor?: MarkAnchor
}

/** The head nearest the flag: the top one of a stem-up chord, the bottom one of a stem-down chord. */
function isInnerHead(index: number, note: ModifierStartNote): boolean {
  return index === (note.stemDirection === STEM_UP ? note.headCount - 1 : 0)
}

/**
 * ⭐ Where a modifier on `side` of head `index` starts. `forceFlagRight` pushes a RIGHT modifier past
 * the flag whichever head it belongs to — the dot asks for it.
 */
export function modifierStart(
  side: ModifierSide,
  index: number,
  note: ModifierStartNote,
  forceFlagRight = false,
): { x: number; y: number } {
  let x = 0
  if (side === 'left') {
    x = -MODIFIER_LEFT_OFFSET_PX
  } else if (side === 'right') {
    x = note.glyphWidth + note.xShift + MODIFIER_RIGHT_GAP_PX
    if (note.stemDirection === STEM_UP && note.hasFlag && (forceFlagRight || isInnerHead(index, note))) {
      x += note.flagWidth()
    }
  } else if (side === 'above' || side === 'below') {
    x = note.glyphWidth / 2
  }
  const start = {
    x: note.originX + x,
    y: note.headY + (REST_MODIFIER_LINE_SHIFT[note.headGlyph] ?? 0) * note.spacePx,
  }

  const anchor = note.markAnchor
  if (anchor && (side === 'above' || side === 'below')) {
    const stemSide = (side === 'above' && note.stemDirection === STEM_UP)
      || (side === 'below' && note.stemDirection === STEM_DOWN)
    // ⚠️ A stemless note (a whole note) has no stem to align to, so it keeps the head's centre — and
    //    then follows the offset like any other mark.
    if (anchor.stemAlign && stemSide && note.hasStem) start.x = note.stemX()
    else start.x += anchor.offsetPx
  }
  return start
}
