import type { MenuItem } from './MenuItem'

/**
 * **File ▸ Examples** — the scores that ship WITH the editor, as a table.
 *
 * A demo needs something to open that is not "the score you happen to have". Import already opens a
 * file the user brought; this is the other half — a short shelf of scores the editor carries, each
 * one there to show a piece of the notation off (a fanned beam, a four-voice bar, an ottava) without
 * anyone having to build it first.
 *
 * ⭐ ONE TABLE, `EXAMPLES`, and the menu is painted from it. An example is a ROW here — an id, a
 * label, and the file it names under `public/examples/`. Nothing about the menu changes when the
 * shelf grows, which is the whole reason this is a module and not four rows inlined in `fileMenu`.
 *
 * ⚠️ **Opening one REPLACES the open score, with no confirmation** — the same warning Import carries,
 * and for the same reason: it is the same load path (`interactions/scoreFileIo.ts`), reached from a
 * row that is one click away rather than a file picker away. ⛔ Never a second loader.
 */

/**
 * One score on the shelf. `file` is its name under `public/examples/` — FETCHED at run time
 * (`${BASE_URL}examples/<file>`), the way `public/smufl/*.json` is, never imported into the bundle.
 * See that folder's README for the envelope and for adding one.
 */
export interface ExampleScore {
  id: string
  label: string
  file: string
}

/**
 * THE SHELF. Adding an example is a row here plus the file beside it, and nothing else.
 *
 * ⚠️ The label is the score's own title, not a description of what it demonstrates: the menu names
 * pieces, and the piece is what the user is choosing.
 */
export const EXAMPLES: ExampleScore[] = [
  // A plain hyphen with spaces around it, not an em dash: at menu-row size the long rule reads as a
  // gap in the title rather than as a separator between the composer and the piece.
  { id: 'prelude-bwv846', label: 'Bach - Prelude in C, BWV 846', file: 'prelude-bwv846.json' },
]

/** What the menu ASKS THE APP FOR: the load itself. The menu never fetches and never engraves. */
export interface ExamplesMenuActions {
  /**
   * Open a shipped example, REPLACING the open score. Takes the ROW, not a path — where examples
   * live is `scoreFileIo`'s business, and the menu should not learn a URL shape.
   */
  openExample?: { run: (example: ExampleScore) => void }
}

/**
 * Build the **Examples** submenu — a row per example, or a greyed placeholder while the shelf is
 * empty.
 *
 * A submenu rather than a flat run of File rows: the shelf is meant to grow, and a File menu that is
 * mostly example titles has stopped being a File menu.
 */
export function buildExamplesMenu(actions: ExamplesMenuActions): MenuItem {
  if (EXAMPLES.length === 0) {
    return {
      label: 'Examples',
      items: [{ label: 'No examples yet', onSelect: () => {}, disabled: () => true }],
    }
  }
  return {
    label: 'Examples',
    items: EXAMPLES.map((example) => ({
      label: example.label,
      onSelect: () => actions.openExample?.run(example),
      // Greyed if the app never wired the opener — the row says the command exists and its target
      // does not, rather than swallowing the click.
      disabled: () => !actions.openExample,
    })),
  }
}
