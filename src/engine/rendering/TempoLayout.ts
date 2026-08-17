/**
 * Tempo-mark rendering & layout — the render side of {@link TempoMark}
 * (docs/tempo-marks-plan.md §6). Free functions over the passed-in {@link RenderPass} +
 * measure, matching the {@link DynamicsLayout} idiom.
 *
 * Called once per measure from `renderMeasure`, AFTER the voices are formatted and drawn
 * (an anchor note's absolute X does not exist before that).
 *
 * ## Why this does not use VexFlow's `StaveTempo`
 *
 * `StaveTempo` engraves `Allegro (♩ = 120)` for you — but only ever THAT, its way. It brackets
 * the metronome whenever a word is present (no way off), it always puts the word first, and it
 * gates the whole metronome on `duration` (so a unit with no number engraves a broken
 * `Allegro (♩ = )`). A mark is text: the writer decides whether to bracket it, what goes after
 * the number, whether there is a number at all. None of that fits through `StaveTempo`.
 *
 * So we draw the mark's string ourselves — which turns out to be less code than the workarounds
 * were. It is split into RUNS: the note characters (`♩`) are engraved from the music font as real
 * SMuFL glyphs, everything else in the text font, laid left to right. `Element` is VexFlow's own
 * text/glyph primitive with its own metrics — the same one `StaveTempo.draw()` uses internally —
 * so we lose no engraving quality, only its opinions.
 */
import { Element, Metrics, MetricsDefaults, StaveModifierPosition, TimeSignature } from 'vexflow'
import type { RenderContext, Stave, StaveNote } from 'vexflow'
import type { ChordRest, Measure, NoteDuration, TempoMark } from '@/types/music'
import { fracCompare, fracToNumber } from '@/utils/fraction'
import { UNIT_GLYPH, MET_NOTE_GLYPH, MET_AUGMENTATION_DOT } from '@/utils/tempoText'
import { textFirstFamily } from '@/utils/fontStack'
import { TEMPO_GLYPH_FONT_SIZE, TEMPO_INK_ABOVE, TEMPO_INK_BELOW, TEMPO_TEXT_FONT_SIZE } from './tempoStyle'
import type { RenderPass } from './RenderPass'

/**
 * Apply the mark's two sizes (`./tempoStyle`, where they live because the ink extents and the row's
 * clearance are stated against them).
 *
 * `MetricsDefaults` is VexFlow's override surface, but it is GLOBAL and read at `Element`
 * construction, so this is a one-time write at import. `Metrics.getFontInfo` memoizes per key, so
 * the stale FontInfo must be evicted or the write is silently ignored — and **both** keys need
 * evicting, since `StaveTempo.name` inherits its size from `StaveTempo` rather than declaring one.
 *
 * ⭐ The WORDS' size is ours now too. It used to be whatever VexFlow's metric said (14), which
 * measured ~15% under the engraving standard for our staff — see {@link TEMPO_TEXT_FONT_SIZE} for
 * the derivation.
 */
MetricsDefaults.StaveTempo.fontSize = TEMPO_TEXT_FONT_SIZE
MetricsDefaults.StaveTempo.glyph.fontSize = TEMPO_GLYPH_FONT_SIZE
Metrics.clear('StaveTempo.glyph')
Metrics.clear('StaveTempo.name')

/**
 * The SMuFL glyph each note character is engraved as (`♩` → `metNoteQuarterUp`) — the same
 * codepoints VexFlow's `Glyphs` enum uses, and the same ones `StaveTempo` drew.
 *
 * Written out rather than imported: `Glyphs` is exported from VexFlow's CJS bundle but NOT from
 * its ESM entry (nor its type declarations), so `import { Glyphs } from 'vexflow'` type-checks
 * against the CJS shape and then resolves to `undefined` in the browser. These are SMuFL's
 * standardized codepoints; they do not move.
 */
const METRONOME_DOT = MET_AUGMENTATION_DOT
/** The printed character (`\u2669`) \u2192 its metronome glyph, re-keyed from {@link MET_NOTE_GLYPH}. The six
 *  codepoints were written out twice, here and there; a mark and a tuplet that name the same note
 *  value must name it with the same glyph, so there is one table and this is a view of it. */
const NOTE_GLYPH: Record<string, string> = Object.fromEntries(
  (Object.keys(MET_NOTE_GLYPH) as NoteDuration[]).map(d => [UNIT_GLYPH[d], MET_NOTE_GLYPH[d]]),
)

/** A piece of the mark's string: a stretch of words, or one music glyph. */
type Run = { glyph: string; text?: undefined } | { text: string; glyph?: undefined }

/**
 * Split the mark's text into what must be drawn from the MUSIC font and what must not.
 *
 * Three kinds of run come out:
 *  - a **note character** (`♩`) — and the dots that follow one (`♩.` is a dotted quarter, not a
 *    full stop) — engraved as its metNote SMuFL glyph. A '.' is only a dot if it follows a note:
 *    'a tempo. Allegro' keeps its full stop.
 *  - an **already-SMuFL glyph** — a private-use character the tempo menu dropped in directly (a
 *    beamed group, a tie, a tuplet bracket, a modulation arrow, a longa/breve). These are drawn in
 *    the music font at glyph size, exactly like the notes; consecutive ones are kept in ONE run so
 *    the font's kerning joins the beams (a beamed pair is `textBlackNote` + `textCont…Beam` +
 *    `textBlackNoteFrac…`, and only the kern pairs make the beam overlap the stems). Note chars are
 *    NOT in this range (`♩` is U+2669, the metronome/text glyphs live in the Private Use Area), so
 *    the two never collide.
 *  - everything else is **text**.
 */
export function splitRuns(text: string): Run[] {
  const runs: Run[] = []
  let pendingText = ''
  let pendingGlyph = ''
  const flushText = () => { if (pendingText) { runs.push({ text: pendingText }); pendingText = '' } }
  const flushGlyph = () => { if (pendingGlyph) { runs.push({ glyph: pendingGlyph }); pendingGlyph = '' } }
  const flush = () => { flushText(); flushGlyph() }

  // Matched by SEQUENCE, not by character: the note symbols are not all one code point. `♩` is
  // (U+2669), but `𝅗𝅥` is a notehead plus a combining stem, and `𝅘𝅥𝅯` adds a combining flag on top —
  // 2 and 3 code points. Scanning character-by-character silently misses every one of those, and
  // a half-note metronome prints as raw text instead of a glyph. Longest first, so `𝅘𝅥𝅯` is never
  // mistaken for the shorter sequence that prefixes it.
  const notes = Object.entries(NOTE_GLYPH).sort(([a], [b]) => b.length - a.length)

  for (let i = 0; i < text.length;) {
    const note = notes.find(([symbol]) => text.startsWith(symbol, i))
    if (note) {
      flush()
      runs.push({ glyph: note[1] })
      i += note[0].length
      while (text[i] === '.') { // the note's augmentation dots ride with it
        runs.push({ glyph: METRONOME_DOT })
        i++
      }
      continue
    }

    // A private-use character is a SMuFL glyph the menu inserted (beam, tie, tuplet, arrow, longa).
    // The whole PUA (U+E000–U+F8FF) is music: nothing else has any business there in tempo text.
    const code = text.charCodeAt(i)
    if (code >= 0xE000 && code <= 0xF8FF) {
      flushText()
      pendingGlyph += text[i]
      i++
      continue
    }

    flushGlyph()
    pendingText += text[i]
    i++
  }
  flush()
  return runs
}

/**
 * Engrave a tempo mark's string at (x, y) — the shared draw used by the score and by the armed
 * tool's ghost preview, so the preview cannot drift from the thing it previews.
 *
 * `Element` is VexFlow's text/glyph primitive: it carries the font from Metrics and measures its
 * own width, which is how the runs are laid end to end.
 */
export function drawTempoText(ctx: RenderContext, text: string, x: number, y: number): void {
  for (const run of splitRuns(text)) {
    // 'StaveTempo.name' is the mark's text font (bold, VexFlow's text face); 'StaveTempo.glyph' is
    // the music font, at the size set above. Both resolved from Metrics, exactly as StaveTempo did.
    const el = new Element(run.glyph ? 'StaveTempo.glyph' : 'StaveTempo.name')

    if (!run.glyph) {
      // …except that VexFlow resolves BOTH from a stack that LEADS with the music font
      // ('Bravura,Academico'). The letters fall through to the text face and look right, but the
      // SPACES do not: Bravura has a space glyph, and a music font's space is next to nothing
      // wide — which is why the mark engraved as `Allegro(♩=144)` however many spaces were in the
      // string. Text runs take the text face first; the glyph run still wants Bravura.
      const f = el.fontInfo
      el.setFont(textFirstFamily(f.family), f.size, f.weight, f.style)
    }

    el.setText(run.glyph ?? keepSpaces(run.text!))
    el.renderText(ctx, x, y)
    x += el.getWidth()
  }
}

/**
 * Spaces that SVG cannot swallow.
 *
 * A run is a fragment of the mark — `'Moderato '`, `' = 112'` — so its spaces are at the EDGES,
 * and SVG collapses leading/trailing whitespace in a `<text>` node. The word then paints hard
 * against the ♩ and the ♩ hard against the `=`, even though the layout advanced past the space
 * (our width is measured WITH it) — the mark looked right in the editor and wrong on the page.
 *
 * `xml:space="preserve"` is the documented cure and it did NOT work here, so we sidestep the
 * renderer's whitespace rules entirely: a non-breaking space is not whitespace to collapse. It is
 * the same width as the space it replaces, and the string on the page is unaffected — this is a
 * RENDER-time substitution only, never stored (the model keeps the plain spaces you typed).
 */
function keepSpaces(text: string): string {
  return text.replace(/ /g, '\u00A0') // U+00A0 NO-BREAK SPACE
}

/**
 * The x a mark anchors to.
 *
 * A mark ON THE DOWNBEAT belongs to the BAR, not to the note that happens to open it, so it is
 * left-aligned with the START OF THE BAR — {@link barOpeningX}. Anchoring it to the first note
 * instead pushed `Allegro` a clef-plus-time-signature width into the bar.
 *
 * A mark placed LATER in the bar has no bar opening to hang off, so it takes the absolute X of
 * the first note/rest at-or-after its beat (the gesture `DynamicsLayout` uses), falling back to
 * the bar's note-start X when the beat is empty or the bar's notes were all deleted.
 */
export function anchorX(mark: TempoMark, slots: ChordRest[], staveNotes: StaveNote[], stave: Stave): number {
  if (fracToNumber(mark.beat) === 0) return barOpeningX(stave)

  for (let i = 0; i < slots.length; i++) {
    if (fracCompare(slots[i].beat, mark.beat) >= 0) {
      try {
        return staveNotes[i].getAbsoluteX()
      } catch {
        break // not formatted (shouldn't happen post-draw) — fall through to the bar start
      }
    }
  }
  return stave.getNoteStartX()
}

/**
 * Where a bar "opens", for a mark on its downbeat: the TIME SIGNATURE if the bar prints one, else
 * the barline.
 *
 * Not the clef. A tempo mark sits clear of it — this is LilyPond's default (metronome marks
 * break-align to the time signature) and what printed scores look like.
 *
 * The x is read off the glyph rather than derived from a clef width: `Stave.format()` assigns
 * every begin-modifier its x, and the stave is drawn before we run, so the number is exact and
 * survives a clef change, a key signature, or a wider time signature. Most bars carry no time
 * signature at all (only openings and changes do) — and there the barline IS the bar's opening,
 * with nothing between it and the notes.
 */
function barOpeningX(stave: Stave): number {
  const [timeSig] = stave.getModifiers(StaveModifierPosition.BEGIN, TimeSignature.CATEGORY)
  return timeSig ? timeSig.getX() : stave.getX()
}

/**
 * Draw the measure's tempo marks above the staff and register each one's rendered bbox for
 * hit-testing.
 *
 * SCOPE: a mark is drawn above its scope's TOP staff — it governs the clock, not a staff, so it is
 * engraved once per system, not once per staff. v1 has exactly one scope (the whole system), which
 * resolves to staff 0; the guard is written in terms of the scope so polytempo only has to change
 * the resolver, not this call. Without it, a grand staff would print `Allegro` above every staff
 * and register duplicate ids.
 */
export function drawTempoMarks(
  pass: RenderPass,
  measure: Measure,
  stave: Stave,
  staffIndex: number,
  slots: ChordRest[],
  staveNotes: StaveNote[],
): void {
  if (!measure.tempos?.length) return
  if (staffIndex !== topStaffIndexForScope(undefined)) return

  const ctx = pass.context

  for (const mark of measure.tempos) {
    if (mark.id === pass.suppressedTempoId) continue // being edited in the text overlay
    if (!mark.text) continue // nothing printed (a mark that only sounds)

    // ⚠️ **NOT the mark's row — only where it is drawn before one is decided.** Until P0b of
    // docs/ottava-plan.md this WAS the answer, and it was a constant: `getYForTopText(1)` resolves
    // to a baseline 2 staff spaces above the top line, blind to ledger lines, to a dynamic above the
    // staff, to a trill and to an 8va bracket. `./tempoLinePass` now translates every mark onto the
    // row its music leaves free, so what survives here is an ORIGIN — the pass measures its move
    // from the `<text>` baseline this puts down. ⛔ Do not compute the real y here: it is a fact
    // about the SYSTEM, and a measure-scope answer would have to join `MeasureRedrawKey`'s shape key
    // (see that pass's header for what that costs).
    const y = stave.getYForTopText(1)
    const x = anchorX(mark, slots, staveNotes, stave)

    // OUR group, carrying the mark's id → '#vf-<id>', which is what the registry bbox, the
    // selection highlight and the text-edit overlay all address it by.
    const group = ctx.openGroup('tempo', mark.id) as SVGGElement
    try {
      drawTempoText(ctx, mark.text, x, y)
    } finally {
      ctx.closeGroup() // never leave the group open — everything after would nest inside it
    }

    try {
      const box = group.getBBox()
      if (box.width > 0 || box.height > 0) {
        pass.elementRegistry.add({
          type: 'tempo',
          id: mark.id,
          measure: measure.number,
          beat: fracToNumber(mark.beat),
          // ⚠️⚠️ **HORIZONTAL from the group, VERTICAL from the BASELINE — never the group's y/height.**
          // A mark containing a metronome glyph has a MUSIC-font run in it, and `getBBox` unions that
          // run's full em box: measured at **86 px tall** for one 14 pt line of text
          // (`Allegretto ♩ = 60`), reaching from above the mark all the way down past the staff's top
          // line. His report, 2026-08-13: clicking a `tr` selected the tempo mark, because the trill's
          // box sat entirely inside that one and `ELEMENT_HIT_ORDER` asks tempo first.
          // ⭐ So the box is rebuilt from the number that actually says where the ink is — the
          // baseline we just drew at — plus `tempoStyle`'s tight extents. Exactly what
          // `DynamicsLayout` does for the same reason (`reference_vexflow_annotation_pointer_rect`),
          // and it is why those two constants are shared with the row rather than private to it.
          bbox: {
            x: box.x,
            y: y - TEMPO_INK_ABOVE,
            width: box.width,
            height: TEMPO_INK_ABOVE + TEMPO_INK_BELOW,
          },
          // ⭐⭐ THE ATTACHMENT GUIDE'S TWO ENDS — the second kind to draw one (his call, 2026-08-17,
          // the dynamic's having been the first). Both are captured here because both are
          // measurements, and `HighlightController.applyAnchorGuideLine` only draws what the render
          // measured (docs/dynamic-offset-plan.md).
          //
          // ⭐ **What a tempo mark is attached to is a PLACE IN TIME, not a note** — which is why
          // this end is `x` (the same {@link anchorX} the mark is drawn from: the bar's opening for a
          // downbeat mark, the note at-or-after the beat for a later one) at the staff's TOP LINE,
          // and not a notehead. ⛔ Deliberately unlike the dynamic's, whose anchor IS its note so the
          // guide tracks a pitch change: a tempo does not belong to a pitch, and following one up and
          // down would say it did. It is also what MuseScore's generic `dragAnchorLines` does — the
          // parent segment's x at the staff's near edge (`engravingitem.cpp:2343-2366`).
          // The mark's own end: the ink corner NEAREST the staff, i.e. its BOTTOM-left, since a tempo
          // is engraved above. The mirror of the below-staff dynamic's top-left, and the reason the
          // rule is "nearest the staff" rather than "the top".
          // ⚠️ From the tight extents rather than the font table: a tempo mark is mostly PROSE in a
          // serif face, which Bravura cannot speak for (`./dynamicMarkInk` answers null for exactly
          // this). `TEMPO_INK_BELOW` is the descender depth these constants already state.
          guides: [{ from: { x: box.x, y: y + TEMPO_INK_BELOW }, to: { x, y: stave.getYForLine(0) } }],
        })
      }
    } catch {
      /* getBBox throws in jsdom / before layout — the mark still drew */
    }
  }
}

/**
 * The index of the staff a scope's marks are engraved above. v1: one scope = the whole system =
 * the top staff. Polytempo would map a StaffGroup id → its topmost staff.
 */
function topStaffIndexForScope(_scopeId: string | undefined): number {
  return 0
}
