/**
 * 🔧 The body the dev shell's two font pickers share (`musicFontPicker`, `textFontPicker`): a dashed-amber
 * labelled `<select>` over a table of faces, with a note beside it. A change LOADS the face first (a
 * render in a face that has not arrived draws — and measures — a fallback), then writes the choice,
 * then asks for a render. SCAFFOLDING: nothing here is persisted.
 */
import { loadMusicFont } from '../engine/rendering/painter/musicFontFaces'

export interface DevFontSelect<Id extends string> {
  label: string
  title: string
  rows: readonly { id: Id; family: string; label: string }[]
  active: () => Id
  /** Writes the choice; true when it changed. */
  choose: (id: Id) => boolean
  /** The note beside the select for the ACTIVE face — its text and its tooltip. */
  note: () => { text: string; title: string }
  renderScore: () => void
}

export function buildDevFontSelect<Id extends string>(spec: DevFontSelect<Id>): HTMLElement {
  const label = document.createElement('label')
  label.className = 'flex items-center gap-1 ml-2 px-2 py-1 rounded border border-dashed border-amber-500/70 '
    + 'text-amber-300 text-xs'
  label.textContent = spec.label
  label.title = spec.title

  const select = document.createElement('select')
  select.className = 'bg-gray-700 rounded px-1 py-0.5 text-white text-xs'
  for (const row of spec.rows) {
    const option = document.createElement('option')
    option.value = row.id
    option.textContent = row.label
    select.appendChild(option)
  }
  select.value = spec.active()

  const note = document.createElement('span')
  note.className = 'text-amber-200/80'
  const showNote = () => {
    const { text, title } = spec.note()
    note.textContent = text
    note.title = title
  }
  showNote()

  select.addEventListener('change', async () => {
    const chosen = spec.rows.find(row => row.id === select.value)
    if (!chosen) return
    await loadMusicFont(chosen.family)
    // ⚠️ A later pick may have overtaken this one while its face loaded — the select is the truth.
    if (select.value !== chosen.id) return
    if (spec.choose(chosen.id)) spec.renderScore()
    showNote()
  })

  label.appendChild(select)
  label.appendChild(note)
  return label
}
