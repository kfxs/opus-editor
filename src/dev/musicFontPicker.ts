/**
 * 🔧 **DEV music-font picker — SCAFFOLDING, not an editor feature** (Phase A of
 * `docs/plans/music-font-switch-plan.md`).
 *
 * A `<select>` over `fonts/musicFont.MUSIC_FONTS`. A change loads the face FIRST (a render in a face
 * that has not arrived engraves — and measures — the Bravura fallback), writes the choice, and asks
 * for a render; the font's generation is in the width and layout keys, so that render re-engraves
 * every bar. ⛔ The choice is not persisted and not in the score.
 *
 * ⭐ Since Phase B the face brings its own METRICS (`fonts/fontMetrics` reads one table per face) —
 * line weights and the rest heights are the face's; ⚠️ the rest of the ink table is still Bravura's
 * (plan B4). The note beside the select says how many glyphs the face lacks and took WHOLE from
 * Bravura; its tooltip names them, so a bracket that does not match is explained, not puzzling.
 */
import { MUSIC_FONTS, activeMusicFont, setActiveMusicFont } from '../engine/fonts/musicFont'
import { fallbackDefaults, fallbackGlyphs } from '../engine/fonts/fontMetrics'
import { buildDevFontSelect } from './devFontSelect'

export function buildMusicFontPicker(renderScore: () => void): HTMLElement {
  return buildDevFontSelect({
    label: '🔧 DEV font: ',
    title: 'Experimental music-font switch — the face, its line weights and its ink. Not saved.',
    rows: MUSIC_FONTS,
    active: () => activeMusicFont().id,
    choose: setActiveMusicFont,
    note: () => {
      const glyphs = fallbackGlyphs()
      const defaults = fallbackDefaults()
      return {
        text: glyphs.length ? ` ${glyphs.length} from Bravura` : '',
        title: [
          glyphs.length ? `Glyphs this face lacks, drawn and measured in Bravura: ${glyphs.join(', ')}` : '',
          defaults.length ? `Engraving defaults it does not state (Bravura’s): ${defaults.join(', ')}` : '',
        ].filter(Boolean).join('\n'),
      }
    },
    renderScore,
  })
}
