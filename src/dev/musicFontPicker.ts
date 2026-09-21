/**
 * 🔧 **DEV music-font picker — SCAFFOLDING, not an editor feature** (Phase A of
 * `docs/plans/music-font-switch-plan.md`).
 *
 * A `<select>` over `fonts/musicFont.MUSIC_FONTS`. A change loads the face FIRST (a render in a face
 * that has not arrived engraves — and measures — the Bravura fallback), writes the choice, and asks
 * for a render; the font's generation is in the width and layout keys, so that render re-engraves
 * every bar. ⛔ The choice is not persisted and not in the score.
 *
 * ⚠️ It swaps the FACE only: spacing and line weights are still Bravura's until Phase B.
 */
import { MUSIC_FONTS, activeMusicFont, setActiveMusicFont, type MusicFontId } from '../engine/fonts/musicFont'
import { loadMusicFont } from '../engine/rendering/painter/musicFontFaces'

export function buildMusicFontPicker(renderScore: () => void): HTMLElement {
  const label = document.createElement('label')
  label.className = 'flex items-center gap-1 ml-2 px-2 py-1 rounded border border-dashed border-amber-500/70 '
    + 'text-amber-300 text-xs'
  label.textContent = '🔧 DEV font: '
  label.title = 'Experimental music-font switch — the FACE only; spacing and line weights stay Bravura’s. Not saved.'

  const select = document.createElement('select')
  select.className = 'bg-gray-700 rounded px-1 py-0.5 text-white text-xs'
  for (const row of MUSIC_FONTS) {
    const option = document.createElement('option')
    option.value = row.id
    option.textContent = row.label
    select.appendChild(option)
  }
  select.value = activeMusicFont().id

  select.addEventListener('change', async () => {
    const chosen = MUSIC_FONTS.find(row => row.id === (select.value as MusicFontId))
    if (!chosen) return
    await loadMusicFont(chosen.family)
    // ⚠️ A later pick may have overtaken this one while its face loaded — the select is the truth.
    if (select.value !== chosen.id) return
    if (setActiveMusicFont(chosen.id)) renderScore()
  })

  label.appendChild(select)
  return label
}
