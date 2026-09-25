/**
 * ⭐ **THE NOTE PASS — every selected note (or rest) painted in ITS voice's colour**, and the one
 * painter that does it. A note is not a `SelectedElement` kind (the selection is two things — see
 * `EditorState`), so this has no row in `ELEMENT_SPECS`; it is the set pass `RenderController` runs
 * first, and the painter a kind that points AT a note borrows (the slur's armed anchor).
 *
 * ⭐ **A selected note lights what hangs off it** — accidental, articulations, dots, brackets, tie, tremolo —
 * and each of those is painted by ITS OWN kind's module (`paintNoteDots`, `paintNoteTie`, …), the
 * same painter that kind's `highlight` row calls. One owner per ink; this only says which belong.
 */
import { ELEMENT_SELECTION_FILL, ELEMENT_SELECTION_STROKE } from '@/utils/selectionColors'
import { voiceFillColor, voiceStrokeColor } from '@/utils/voiceColors'
import { paintNoteAccidentals } from './accidental'
import { paintNoteArticulations } from './articulation'
import { paintNoteDots } from './dot'
import { paintNoteEnclosure } from './enclosure'
import type { HighlightContext } from './highlightContext'
import { paintNoteTie } from './tie'
import { paintNoteGlissando } from './glissando'
import { paintNoteTremolo } from './tremolo'

export function paintSelectedNotes(ctx: HighlightContext): void {
  const engine = ctx.engine

  // Highlight every selected note in ITS voice's colour (V1 blue, V2 green —
  // Sibelius-style; replaces the old uniform orange for notes/rests). Each is
  // recolored inside its own SVG group, so N highlights is the single-note
  // highlight applied N times (no cross-bleed).
  for (const item of ctx.state.selectedItems.values()) {
    if (item.kind !== 'note') continue
    const voice = engine.getNote(item.id)?.voice ?? 0
    paintNote(ctx, item.id, voiceFillColor(voice), voiceStrokeColor(voice))
  }
}

/** Recolor one note's notehead + stem (or a rest's glyph) inside its own SVG group.
 *  Every real caller passes the note's VOICE colour (voiceColors); the default here is only a
 *  fallback and uses the generic element-selection colour, never the voice-3 orange. */
export function paintNote(
  ctx: HighlightContext,
  noteId: string,
  fillColor = ELEMENT_SELECTION_FILL,
  strokeColor = ELEMENT_SELECTION_STROKE,
): void {
  const engine = ctx.engine

  // Recolor the note's OWN rendered SVG group, never a document-wide region. VexFlow
  // draws each StaveNote's ledger lines, stem and noteheads inside one
  // `<g class="stavenote">`, so confining the recolor to that group makes the
  // selection highlight bleed-free in both directions (the old approach scanned a
  // synthetic band that overlapped the staff line above or below).
  const SELECTION_COLOR = fillColor
  const SELECTION_STROKE = strokeColor

  const colorFill = (el: Element) => {
    const svgEl = el as SVGElement
    ctx.setAttr(svgEl, 'fill', SELECTION_COLOR)
    ctx.setStyleProp(svgEl, 'fill', SELECTION_COLOR)
    ctx.addClass(svgEl, 'selected-note')
  }
  const colorStroke = (el: Element) => {
    const svgEl = el as SVGElement
    ctx.setAttr(svgEl, 'stroke', SELECTION_STROKE)
    ctx.setStyleProp(svgEl, 'stroke', SELECTION_STROKE)
    ctx.addClass(svgEl, 'selected-note')
  }

  // ⭐ A FANNED MEMBER has no `StaveNote`, so its ink lives in the group the fan renderer drew it
  // into (docs/plans/fanned-beam-pitches-plan.md §2 P3) — head, accidental, ledger lines and stem, all
  // ours, all in one place. The shared beam is untouched because it is drawn OUTSIDE that group.
  //
  // ⚠️ **A GLYPH IS FILLED, NEVER STROKED.** Handing the accidental a stroke as well as a fill
  // outlines it, and an outlined glyph reads as BOLD — the first thing he noticed. Same split as
  // everywhere else here: `text` glyphs take `colorFill`, the drawn lines (stem, ledgers) take
  // `colorStroke`.
  const memberInfo = engine.getFanMemberSVGGroup(noteId)
  if (memberInfo) {
    const heads = memberInfo.group.querySelectorAll('g.notehead')
    // A member with several pitches shares one stem, exactly as a chord does: this pitch's head,
    // plus the ink that belongs to the member as a whole.
    const head = heads[memberInfo.noteIndex] ?? heads[0]
    head?.querySelectorAll('text, path').forEach(colorFill)
    for (const el of memberInfo.group.children) {
      if (el.tagName === 'g') continue // another head of this member — not this pitch
      if (el.tagName === 'text') colorFill(el) // the accidental
      else colorStroke(el)                     // the stem and its ledger lines
    }
    ctx.raiseToFront(memberInfo.group)
    return
  }

  const groupInfo = engine.getStaveNoteSVGGroup(noteId)
  if (!groupInfo) return
  const { group, noteIndex, stem } = groupInfo

  const isRest = engine.getElementById(noteId)?.type === 'rest'

  if (isRest) {
    // A rest is a single glyph — color every glyph in its group, EXCEPT a dynamic attached to
    // this rest: an Annotation modifier renders its `<g class="annotation">` glyph NESTED
    // inside the rest's `stavenote` group, so the broad `text, path` sweep would recolor the
    // (unselected) dynamic too — the bleed the user saw when selecting a rest that carries a
    // dynamic. The dynamic owns its own selection highlight (its `ink` row).
    group.querySelectorAll('text, path').forEach(el => {
      if (el.closest('.annotation')) return
      colorFill(el)
    })
    // Two voices' rests can be vertically nudged to the same spot; whichever group
    // is later in the DOM paints on top, so the recolored rest can be hidden behind
    // the other voice. Raise this rest's group to the front (same reasoning as the
    // unison-notehead case below); `clearHighlights` puts it back where it was.
    ctx.raiseToFront(group)
    return
  }

  // Rule: color what belongs solely to this note — its notehead and stem — and never
  // shared structure (the beam bar, staff lines, barlines).
  //
  // The flag (the hook on an unbeamed 8th/16th) is intentionally NOT highlighted: it
  // is reserved to become its own selectable element later, like accidentals and ties.
  // Do not add it here without revisiting that decision.

  // Stem: resolved by identity, so it works whether the note drew its own stem
  // (unbeamed) or the beam drew it (beamed). A chord's single stem is shared by its
  // noteheads, which is correct — it is still this note's stem.
  if (stem) stem.querySelectorAll('path, line').forEach(colorStroke)

  // Notehead: noteheads draw in key order (low→high), matching the stored noteIndex,
  // so in a chord we color exactly the selected head. Color only its first glyph (the
  // head), not any accidental/dots drawn in the same group.
  const noteheads = group.querySelectorAll('g.notehead')
  const target = noteheads[noteIndex] ?? (noteheads.length === 1 ? noteheads[0] : null)
  const head = target
    ? target.querySelector('text, path')
    : group.querySelector('g.notehead text, g.notehead path')
  if (head) colorFill(head)

  // Also light this note's accidental (♯/♭/♮), articulations, dots, brackets, tie, glissando and tremolo,
  // so a selected note reads as fully selected — head + stem + accidental + articulations + dots + brackets
  // + tie + glissando + mark.
  paintNoteAccidentals(ctx, noteId, group, SELECTION_COLOR)
  paintNoteArticulations(ctx, noteId, SELECTION_COLOR)
  paintNoteDots(ctx, noteId, SELECTION_COLOR)
  paintNoteEnclosure(ctx, noteId, SELECTION_COLOR)
  paintNoteTie(ctx, noteId, SELECTION_COLOR)
  paintNoteGlissando(ctx, noteId, SELECTION_COLOR)
  paintNoteTremolo(ctx, noteId, SELECTION_COLOR)

  // Multi-voice unison: the other voice draws a notehead at the SAME pixel spot in a
  // sibling `stavenote` group. Whichever is later in the DOM paints on top, so the
  // recolored head can be hidden behind the other voice. Raise this note's group to
  // the front of its parent so its (now coloured) head is the one that shows;
  // clearHighlights restores the original sibling order.
  ctx.raiseToFront(group)
}
