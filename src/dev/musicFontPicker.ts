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
import { MUSIC_FONTS, activeMusicFont, setActiveMusicFont, type MusicFontId } from '../engine/fonts/musicFont'
import { loadMusicFont } from '../engine/rendering/painter/musicFontFaces'
import { fallbackDefaults, fallbackGlyphs } from '../engine/fonts/fontMetrics'

export function buildMusicFontPicker(renderScore: () => void): HTMLElement {
  const label = document.createElement('label')
  label.className = 'flex items-center gap-1 ml-2 px-2 py-1 rounded border border-dashed border-amber-500/70 '
    + 'text-amber-300 text-xs'
  label.textContent = '🔧 DEV font: '
  label.title = 'Experimental music-font switch — the face and its own line weights; most spacing ink is still Bravura’s. Not saved.'

  const select = document.createElement('select')
  select.className = 'bg-gray-700 rounded px-1 py-0.5 text-white text-xs'
  for (const row of MUSIC_FONTS) {
    const option = document.createElement('option')
    option.value = row.id
    option.textContent = row.label
    select.appendChild(option)
  }
  select.value = activeMusicFont().id

  const borrowed = document.createElement('span')
  borrowed.className = 'text-amber-200/80'
  const showBorrowed = () => {
    const glyphs = fallbackGlyphs()
    const defaults = fallbackDefaults()
    borrowed.textContent = glyphs.length ? ` ${glyphs.length} from Bravura` : ''
    borrowed.title = [
      glyphs.length ? `Glyphs this face lacks, drawn and measured in Bravura: ${glyphs.join(', ')}` : '',
      defaults.length ? `Engraving defaults it does not state (Bravura’s): ${defaults.join(', ')}` : '',
    ].filter(Boolean).join('\n')
  }
  showBorrowed()

  select.addEventListener('change', async () => {
    const chosen = MUSIC_FONTS.find(row => row.id === (select.value as MusicFontId))
    if (!chosen) return
    await loadMusicFont(chosen.family)
    // ⚠️ A later pick may have overtaken this one while its face loaded — the select is the truth.
    if (select.value !== chosen.id) return
    if (setActiveMusicFont(chosen.id)) renderScore()
    showBorrowed()
  })

  label.appendChild(select)
  label.appendChild(borrowed)
  return label
}
