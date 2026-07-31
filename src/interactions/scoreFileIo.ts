import type { MusicEngine } from '@/engine/MusicEngine'
import { readScoreFile, scoreFilename, wrapScoreJson } from '@/utils/scoreFile'

/**
 * Getting a score IN and OUT — download, open, print — as three functions two surfaces share.
 *
 * The dev shell's Score-JSON panel had these as private handlers, which was fine while it was the
 * only door. File ▸ Export JSON / Import JSON / Export PDF is a second door, and a second door onto
 * a copied implementation is how the two start disagreeing about what a file is. So the actions moved
 * here (`utils/scoreFile` came with them, out of `dev/`, since a built site may not import the shell)
 * and the panel became a caller.
 *
 * Each takes a `status` callback rather than owning any UI: the panel writes to its little grey line,
 * the menu has nowhere to write and passes nothing. Neither is told about the other.
 *
 * ⚠️ Still PROVISIONAL, all of it (docs/json-io-plan.md) — the envelope is not a document format and
 * `loadJSON` REPLACES the open score with no "are you sure". What moved is where the code lives, not
 * how finished it is.
 */

export interface ScoreFileHooks {
  /** Progress / outcome, in a few words. The panel shows it; the menu ignores it. */
  status?: (text: string) => void
  /**
   * Called BEFORE a load swaps the model out. Selection, multi-select and the caret all hold ids into
   * the score being thrown away, and `loadJSON` does not clear them.
   */
  beforeLoad?: () => void
  /** After a successful load — the app's own render path, so highlights come back with it. */
  afterLoad?: () => void
}

/**
 * Download the score as JSON.
 *
 * ⚠️ The MODEL, via `exportJSON()` — never a rendered dump of it. The panel's `<pre>` is a 400ms-stale
 * *view* of the same string, which is exactly what makes reaching for it tempting and wrong.
 */
export function exportScoreJson(engine: MusicEngine, hooks: ScoreFileHooks = {}): void {
  const text = wrapScoreJson(engine.exportJSON(), new Date().toISOString())
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = scoreFilename(engine.getScore().title)
  link.click()
  URL.revokeObjectURL(url)
  hooks.status?.(`exported ${link.download}`)
}

/**
 * Ask for a JSON file and load it, REPLACING the open score.
 *
 * The picker is a real `<input type=file>` created for the one use and thrown away — `showOpenFilePicker`
 * is Chromium-only, and a long-lived hidden input is a thing every caller would have to own a copy of.
 */
export function importScoreJson(engine: MusicEngine, hooks: ScoreFileHooks = {}): void {
  const picker = document.createElement('input')
  picker.type = 'file'
  picker.accept = 'application/json,.json'
  picker.style.display = 'none'
  // In the document, because Safari will not open a picker for a detached input.
  document.body.appendChild(picker)

  // Dismissing the dialog fires `cancel`, never `change` — without this the input would outlive the
  // gesture that made it.
  picker.addEventListener('cancel', () => picker.remove(), { once: true })

  picker.addEventListener('change', () => {
    const file = picker.files?.[0]
    picker.remove()
    if (!file) return
    void loadFile(engine, file, hooks)
  }, { once: true })

  picker.click()
}

async function loadFile(engine: MusicEngine, file: File, hooks: ScoreFileHooks): Promise<void> {
  const { scoreJson, summary } = readScoreFile(await file.text())
  if (scoreJson === null) {
    hooks.status?.(summary)
    return
  }
  // Clear the selection BEFORE the swap: `loadJSON` renders as part of loading, and by then the ids
  // in `selectedItems` name notes that no longer exist. `loadJSON` builds the new model and only then
  // assigns it, so a throw leaves the open score untouched — you are left deselected on a score that
  // is still yours, which is the cheap half of the trade.
  try {
    hooks.beforeLoad?.()
    engine.loadJSON(scoreJson)
  } catch (err) {
    console.error('[score-file] the engine rejected this score — the open score is unchanged.', err)
    hooks.status?.('refused: rejected by the engine (see console)')
    return
  }
  hooks.afterLoad?.()
  hooks.status?.(summary)
}

/**
 * Engrave the whole score again and write it out as a vector PDF.
 *
 * The writer and the glyph outliner are ~600kB of machinery that nobody who never exports should
 * download, so they are imported ON DEMAND — this call is the only door to them, and it stays that
 * way now that two surfaces knock on it.
 */
export async function exportScorePdfFile(engine: MusicEngine, hooks: ScoreFileHooks = {}): Promise<void> {
  hooks.status?.('exporting PDF…')
  try {
    const { exportScorePdf } = await import('@/engine/export/pdfExport')
    // On the surface the editor is showing: a page layout prints as real pages, the sketching canvas
    // as the one tall column it has always been (docs/layout-plan.md P2).
    await exportScorePdf(engine.getScore(), engine.getSurface())
    hooks.status?.('exported PDF')
  } catch (error) {
    console.error('PDF export failed:', error)
    window.alert(`PDF export failed: ${error instanceof Error ? error.message : String(error)}`)
    hooks.status?.('PDF export failed')
  }
}
