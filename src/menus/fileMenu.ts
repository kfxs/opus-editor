import type { MenuBarTitle } from './menuBar'
import type { MenuCommand } from './menuCommands'

/**
 * The **File** menu — getting a score out of the editor and back in.
 *
 * Three rows, and they are the three the editor actually has (`interactions/scoreFileIo.ts`). What is
 * NOT here says as much: no New, no Open Recent, no Save. There is nothing to save TO — the editor
 * has no document store, and a Save that quietly downloaded a file would be a promise about
 * persistence that nothing behind it keeps. Export/Import is the honest shape of what exists.
 *
 * ⚠️ **Import replaces the open score, with no confirmation.** That is the behaviour the dev panel's
 * button has always had, and putting it on the menu bar does not make it safer — it makes it
 * REACHABLE, by someone who has not read this file. A "discard the current score?" step is the first
 * thing this menu should grow when the demo stops being a demo (docs/json-io-plan.md).
 *
 * The dev shell's Score-JSON panel keeps its own Copy button and is not duplicated here: copying the
 * model as text is a debugging move, and it exists because that panel's dump cannot be selected.
 */

export interface FileMenuActions {
  /** Re-engrave the score and download a vector PDF. Slow — a whole second engraving. */
  exportPdf?: MenuCommand
  /** Download the score model as JSON, in the file envelope. */
  exportJson?: MenuCommand
  /** Open a JSON file, REPLACING the open score. */
  importJson?: MenuCommand
}

/** Build the File menu. None of the three has a key bound, so none prints one. */
export function buildFileMenu(actions: FileMenuActions): MenuBarTitle {
  return {
    label: 'File',
    items: [
      { label: 'Export PDF', onSelect: () => actions.exportPdf?.run() },
      { separator: true },
      { label: 'Export JSON', onSelect: () => actions.exportJson?.run() },
      { label: 'Import JSON…', onSelect: () => actions.importJson?.run() },
    ],
  }
}
