import type { MusicEngine } from '@/engine/MusicEngine'
import { dbg } from '@/utils/debug'
import { readScoreFile, scoreFilename, wrapScoreJson, type ScoreFileView } from '@/utils/scoreFile'

/**
 * Getting a score IN and OUT — download, open, print — as the functions two surfaces share.
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

interface ScoreFileHooks {
  /** Progress / outcome, in a few words. The panel shows it; the menu ignores it. */
  status?: (text: string) => void
  /**
   * Called BEFORE a load swaps the model out. Selection, multi-select and the caret all hold ids into
   * the score being thrown away, and `loadJSON` does not clear them.
   */
  beforeLoad?: () => void
  /** After a successful load — the app's own render path, so highlights come back with it. */
  afterLoad?: () => void
  /**
   * ⭐ **What the FILE said about how it was being looked at** — the envelope's `view` block
   * (`utils/scoreFile.ScoreFileView`), handed over so the app can apply it through the SAME path a
   * menu toggle takes (`PaletteController.setJustifyLastLine`: engine, then state, then render).
   *
   * ⛔ Called only when the file actually carries the block — absent means the file does not say,
   * ⛔ never "turn it off", so a score written before this existed leaves the session alone.
   *
   * ⚠️ It is deliberately a HOOK rather than a call into the palette from here: this module owns
   * files, and the mirror on `EditorState` belongs to whoever owns the toolbar.
   */
  applyView?: (view: ScoreFileView) => void
}

/**
 * Download the score as JSON.
 *
 * ⚠️ The MODEL, via `exportJSON()` — never a rendered dump of it. The panel's `<pre>` is a 400ms-stale
 * *view* of the same string, which is exactly what makes reaching for it tempting and wrong.
 */
export function exportScoreJson(engine: MusicEngine, hooks: ScoreFileHooks = {}): void {
  // ⭐ The engine is asked how the score is being LOOKED at, and that travels in the ENVELOPE beside
  //   the model — ⛔ never inside it (`utils/scoreFile.ScoreFileView` says why at length).
  const text = wrapScoreJson(engine.exportJSON(), new Date().toISOString(), {
    justifyLastLine: engine.getJustifyLastLine(),
  })
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

/**
 * Open one of the scores the editor SHIPS with, REPLACING the open score.
 *
 * The third door, and deliberately the same room: an example is a file in the same envelope, so it
 * arrives at the same `loadScoreText` the picker feeds, with the same refusal path and the same
 * hooks. What differs is only how the text is got — a `fetch` of `public/examples/`, not a picker —
 * because an example needs no gesture to choose it; the menu row already did that.
 *
 * ⚠️ Fetched, never imported: `public/` is served verbatim in dev and copied into `dist/`, so a
 * 450 kB Prelude stays out of the bundle for the sessions that never open it.
 */
export async function openExampleScore(
  engine: MusicEngine,
  file: string,
  hooks: ScoreFileHooks = {},
): Promise<void> {
  const env = (import.meta as unknown as { env?: { BASE_URL?: string } }).env
  const url = `${env?.BASE_URL ?? '/'}examples/${file}`
  hooks.status?.(`opening ${file}…`)
  // The menu passes no `status`, so the console is the ONLY place this door reports from. Both
  // halves are traced — the fetch and the swap — because they fail differently: a missing file is a
  // 404 here, a bad file is a refusal in `loadScoreText`.
  dbg(`[example] open ${file} ← ${url}`)
  let text: string
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    text = await response.text()
    dbg(`[example] fetched ${file} — ${text.length} chars`)
  } catch (err) {
    // The file ships with the app, so a miss here is a BUILD fault (a row naming a file nobody
    // added), not a user's bad input. Say which one, and leave the open score alone.
    console.error(`[score-file] cannot fetch the example at ${url} — is it in public/examples/?`, err)
    hooks.status?.(`refused: cannot open ${file} (see console)`)
    return
  }
  loadScoreText(engine, text, hooks)
}

async function loadFile(engine: MusicEngine, file: File, hooks: ScoreFileHooks): Promise<void> {
  loadScoreText(engine, await file.text(), hooks)
}

/** The one swap, whatever brought the text — a picked file or a shipped example. */
function loadScoreText(engine: MusicEngine, text: string, hooks: ScoreFileHooks): void {
  const { scoreJson, summary, view } = readScoreFile(text)
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
  // ⚠️ BEFORE `afterLoad`, which is the app's render: applying the view re-casts the score
  //    (`justifyLastLine` is in `layoutStateKey`), so doing it after would render twice and show the
  //    old casting for a frame. ⛔ And only when the file SAID something — see `applyView`.
  if (view) hooks.applyView?.(view)
  hooks.afterLoad?.()
  hooks.status?.(summary)
  const score = engine.getScore()
  dbg(`[score-file] ${summary} — "${score.title}" (${score.measures.length} bars, ${score.staves?.length ?? 1} staves)`)
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
