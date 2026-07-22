import type { MusicEngine } from '../engine/MusicEngine'
import { readScoreFile, scoreFilename, wrapScoreJson } from './scoreFile'

/**
 * The live Score-JSON panel — development scaffolding, deliberately kept (docs/remove-vue-plan.md).
 *
 * It POLLS rather than subscribing, and always has: the engine's ScoreModel is a plain object with
 * no change-notification of its own, so there is nothing to listen to. That was true under Vue too —
 * a `computed` never saw an edit, which is why the Vue version polled into a ref. Losing the
 * framework costs this panel nothing; the ref just became a text node.
 *
 * It also carries the Import / Export buttons (docs/json-io-plan.md). They are here, next to the
 * dump, because they are the same provisional thing: a way to get the model in and out while it is
 * still changing weekly. They will not ship here.
 */
const POLL_MS = 400

export interface ScoreJsonPanelDeps {
  getEngine: () => MusicEngine | null
  /**
   * Called BEFORE a load swaps the model out. Selection, multi-select and the caret all hold ids
   * into the score being thrown away; `loadJSON` does not clear them (`__perf.load` in App.ts
   * clears them by hand for the same reason).
   */
  onBeforeLoad: () => void
  /** Called after a successful load — the app's own render path, so highlights come back with it. */
  onAfterLoad: () => void
}

export interface ScoreJsonPanelHandle {
  destroy(): void
}

export function mountScoreJsonPanel(
  host: HTMLElement,
  deps: ScoreJsonPanelDeps,
): ScoreJsonPanelHandle {
  const { getEngine, onBeforeLoad, onAfterLoad } = deps

  const header = document.createElement('div')
  header.className = 'flex items-center gap-2 mb-2'

  const heading = document.createElement('h3')
  heading.className = 'text-xl'
  heading.textContent = 'Score JSON:'

  const copyBtn = button('Copy', 'Copy the score model as JSON to the clipboard')
  const exportBtn = button('Export', 'Download the score model as JSON')
  const importBtn = button('Import', 'Load a score from a JSON file (replaces the open score)')

  const status = document.createElement('span')
  status.className = 'text-sm text-gray-400'

  // The file picker is a real input kept out of sight — `showOpenFilePicker` is Chromium-only.
  const picker = document.createElement('input')
  picker.type = 'file'
  picker.accept = 'application/json,.json'
  picker.className = 'hidden'

  header.append(heading, copyBtn, exportBtn, importBtn, status, picker)

  const pre = document.createElement('pre')
  pre.className = 'bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96'
  pre.textContent = '{}'

  host.append(header, pre)

  /**
   * ⚠️ The export is the MODEL, via `exportJSON()` — never `pre.textContent`. The dump below is a
   * 400ms-stale *view* of the same string, which is exactly what makes reaching for it tempting
   * and wrong (docs/json-io-plan.md).
   */
  function onExport(): void {
    const engine = getEngine()
    if (!engine) return

    const text = wrapScoreJson(engine.exportJSON(), new Date().toISOString())
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = scoreFilename(engine.getScore().title)
    link.click()
    URL.revokeObjectURL(url)
    setStatus(`exported ${link.download}`)
  }

  /**
   * Copy the score JSON to the clipboard. Exists because the `<pre>` below is unselectable in
   * practice: it is re-rendered every 400ms, so a drag-select is wiped before it can be copied.
   *
   * ⚠️ The MODEL, via `exportJSON()` — never `pre.textContent`, for the same reason the export
   * takes that route: the dump is a stale *view* of the string, and being right there is exactly
   * what makes reaching for it tempting and wrong.
   *
   * No envelope. `onExport` wraps the score for a file that has to say what it is and when it was
   * made; this is for pasting into a message, where the envelope is noise and the timestamp would
   * make two otherwise-identical copies differ.
   */
  async function onCopy(): Promise<void> {
    const engine = getEngine()
    if (!engine) return
    const text = engine.exportJSON()
    try {
      await navigator.clipboard.writeText(text)
      setStatus(`copied ${text.length.toLocaleString()} chars`)
    } catch (err) {
      // Clipboard writes need a secure context and can be refused outright. Say so rather than
      // reporting a copy that did not happen — and select the dump so there is still a way out.
      console.error('[score-file] the clipboard refused the write.', err)
      setStatus('refused: clipboard blocked (dump selected — press Ctrl+C)')
      const range = document.createRange()
      range.selectNodeContents(pre)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
    }
  }

  async function onPicked(): Promise<void> {
    const file = picker.files?.[0]
    // Reset first: picking the SAME file twice must fire `change` again (re-importing after an
    // edit is the normal case here).
    picker.value = ''
    if (!file) return

    const engine = getEngine()
    if (!engine) return

    const { scoreJson, summary } = readScoreFile(await file.text())
    if (scoreJson === null) {
      setStatus(summary)
      return
    }

    // Clear the selection BEFORE the swap: `loadJSON` renders as part of loading, and by then the
    // ids in `selectedItems` name notes that no longer exist. `loadJSON` builds the new model and
    // only then assigns it, so a throw leaves the open score untouched — you are left deselected
    // on a score that is still yours, which is the cheap half of the trade.
    try {
      onBeforeLoad()
      engine.loadJSON(scoreJson)
    } catch (err) {
      console.error('[score-file] the engine rejected this score — the open score is unchanged.', err)
      setStatus('refused: rejected by the engine (see console)')
      return
    }
    onAfterLoad()
    setStatus(summary)
  }

  let statusTimer: ReturnType<typeof setTimeout> | undefined
  function setStatus(text: string): void {
    status.textContent = text
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => { status.textContent = '' }, 6000)
  }

  const onImportClick = () => picker.click()
  copyBtn.addEventListener('click', onCopy)
  exportBtn.addEventListener('click', onExport)
  importBtn.addEventListener('click', onImportClick)
  picker.addEventListener('change', onPicked)

  const timer = setInterval(() => {
    pre.textContent = getEngine()?.exportJSON() || '{}'
  }, POLL_MS)

  return {
    destroy(): void {
      clearInterval(timer)
      clearTimeout(statusTimer)
      copyBtn.removeEventListener('click', onCopy)
      exportBtn.removeEventListener('click', onExport)
      importBtn.removeEventListener('click', onImportClick)
      picker.removeEventListener('change', onPicked)
      header.remove()
      pre.remove()
    },
  }
}

function button(label: string, title: string): HTMLButtonElement {
  const node = document.createElement('button')
  // Whole class literals — Tailwind scans source text and never sees a built-up name.
  node.className = 'px-3 py-1 rounded text-sm bg-gray-600 hover:bg-gray-500 text-white'
  node.textContent = label
  node.title = title
  return node
}
