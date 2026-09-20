/**
 * ⭐ **THE KEY SIGNATURE STAMP'S GHOST** — the armed signature itself, following the cursor.
 *
 * Its own module rather than another function in {@link GhostRenderer}, per CLAUDE.md's rule: the
 * table there gains a ROW (`GHOST_DRAWERS`) and the drawing lives here, beside {@link BarlineGhost} /
 * {@link PedalGhost} / {@link OttavaGhost} / {@link TrillGhost}.
 *
 * ⭐⭐ **IT SHOWS THE SHAPE, NOT JUST THE SIGNS** — the row is drawn at the staff LINES the signature
 * actually sits on (`keySignatureLayout.keySignatureLines`), so G major and F major are told apart by
 * their picture and not only by one glyph. Five palette buttons that arm identically behind one blue
 * caret is the `8va`/`8vb` case exactly, and his standing rule from the barline ghost's day —
 * *"we need ghosts for every case using the glyph"*.
 *
 * ⭐ **The pass's own arithmetic, reused whole**: the same {@link KEY_ACCIDENTAL_GAP} advance step
 * that `KeySignaturePass` draws with and `keySignatureExtent` reserves room with. ⛔ Never the drawn
 * width of the glyph just rendered — in jsdom that is 0, and the row would stack itself at one x
 * while agreeing with itself.
 *
 * ⚠️ **A GHOST HAS NO STAFF**, which is what decides the two numbers here. It is drawn on the
 * NOMINAL five-line staff at the score's own size (`STAFF_SPACE_PX`) — the barline ghost's argument
 * verbatim — so the line table's rows become plain offsets from the cursor, with line 3 (the middle
 * line) at the pointer. The clef is the nominal `treble` for the same reason: there is no staff under
 * the cursor to read one from, and the placement table's shape is what the preview is for.
 *
 * ⛔ A signature with NO signs (C major, an open key) draws nothing, and {@link drawSignGhost}
 * answers false for it — the tool is armed, the pointer simply has nothing to show. That is the same
 * hole the SIGNPOST is owed for (docs/plans/key-signature-plan.md §5), and ⛔ it is not patched here with
 * an invented placeholder glyph.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { drawGlyph } from '../glyphPainter'
import type { KeySignature } from '@/types/music'
import { KEY_ACCIDENTAL_GAP, keySignatureLines, signGlyph } from '@/engine/layout/keySignatureLayout'
import { glyphBox } from '@/engine/fonts/fontMetrics'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { SIGN_CHARS, SIGN_FONT_SIZE } from '../KeySignaturePass'
import { drawSignGhost } from './ghostCursor'

/** The class `ScoreRenderer.clearGhosts` sweeps this ghost by — it must be in
 *  `GHOST_GROUP_SELECTOR`, or the ghost smears one copy per mouse position.
 *  The bare name `openGroup` writes (VexFlow's `vf-` prefix is gone since S15c). */
export const KEY_SIGNATURE_GHOST_GROUP_CLASS = 'ghost-keysig'

/** The staff line the cursor sits on — the middle one, so a signature's signs spread either side of
 *  the pointer as they do either side of the staff's middle line. `keySignatureLines` counts lines
 *  from the BOTTOM up, which is why 3 is the middle of five. */
const CURSOR_LINE = 3

/**
 * Draw the armed signature at the cursor. Returns false when nothing measurable was drawn — see
 * {@link drawSignGhost}, which owns that answer for the family (and which jsdom always gives).
 *
 * ⚠️ At x = 0, like every sign ghost: `drawSignGhost` measures what was drawn and translates it into
 * the standard ghost position, so a drawer that parked itself would be parking twice.
 */
export function drawKeySignatureGhost(
  ctx: DrawContext, cursorX: number, cursorY: number, key: KeySignature,
): boolean {
  if (key.alterations.length === 0) return false
  // The nominal staff — see the header. `treble` is the placement table's own default column, and the
  // clef under the pointer is unknown until the click lands.
  const lines = keySignatureLines(key, 'treble')
  return drawSignGhost(ctx, 'ghost-keysig', cursorX, cursorY, () => {
    let x = 0
    key.alterations.forEach((alteration, i) => {
      const glyph = signGlyph(alteration.alter)
      if (!glyph) return
      const char = SIGN_CHARS[glyph]
      if (!char) return
      drawGlyph(ctx, 'KeySignatureGhost.sign', char, x,
        cursorY - (lines[i] - CURSOR_LINE) * STAFF_SPACE_PX, SIGN_FONT_SIZE)
      x += (glyphBox(glyph).advance + KEY_ACCIDENTAL_GAP) * STAFF_SPACE_PX
    })
  })
}
