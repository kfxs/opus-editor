import type { MusicEngine } from '../engine/MusicEngine'
import { exportScoreJson, importScoreJson } from '../interactions/scoreFileIo'

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
 * still changing weekly. They will not ship here — and since the bar's File menu now offers the same
 * two commands, what they DO is no longer here either: both surfaces call
 * `interactions/scoreFileIo`, and these buttons keep only the status line.
 *
 * `Copy` stays local, because it is the panel's own: it exists because the `<pre>` below is
 * re-rendered every 400ms and so cannot be drag-selected. A menu has no dump to copy.
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

  header.append(heading, copyBtn, exportBtn, importBtn, status)

  const pre = document.createElement('pre')
  pre.className = 'bg-gray-900 p-4 rounded overflow-auto text-xs max-h-96'
  pre.textContent = '{}'

  host.append(header, pre)

  const onExport = (): void => {
    const engine = getEngine()
    if (engine) exportScoreJson(engine, { status: setStatus })
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

  const onImportClick = (): void => {
    const engine = getEngine()
    if (engine) importScoreJson(engine, { status: setStatus, beforeLoad: onBeforeLoad, afterLoad: onAfterLoad })
  }

  let statusTimer: ReturnType<typeof setTimeout> | undefined
  function setStatus(text: string): void {
    status.textContent = text
    clearTimeout(statusTimer)
    statusTimer = setTimeout(() => { status.textContent = '' }, 6000)
  }

  copyBtn.addEventListener('click', onCopy)
  exportBtn.addEventListener('click', onExport)
  importBtn.addEventListener('click', onImportClick)

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
