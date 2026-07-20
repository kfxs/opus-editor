import type { EditorState } from './EditorState'
import type { MenuItem } from '../menus/MenuItem'

/**
 * A source decouples the editor from *what* is being edited. The
 * {@link TextEditController} knows nothing about dynamics / lyrics / etc. — each
 * editable text type supplies its own source (see {@link DynamicTextSource}).
 */
export interface EditableTextSource {
  /** Stable id of the target (mirrored into `state.editingText.targetId`). */
  readonly targetId: string
  /** Discriminator for the kind of target (mirrored into `state.editingText.kind`). */
  readonly kind: 'dynamic' | 'tempo'
  /** True when the target was *just placed*; an empty commit deletes it. */
  readonly isNew: boolean
  /** Current text to seed the editor with. */
  getText(): string
  /**
   * Optional pre-styled seed for the box, as trusted HTML — lets a source paint different
   * runs in different fonts/sizes (a dynamic's big glyph `mp` beside small italic words), which
   * a single-font contenteditable can't. `null`/absent ⇒ the box is seeded from {@link getText}
   * as plain text. The typed text is always read back via `textContent`, so the HTML is display
   * only; a source that returns HTML must ensure its `textContent` is the string {@link commit}
   * expects. MUST be built by the source (never user-supplied) — it is assigned as innerHTML. */
  getSeedHtml?(): string | null
  /** Keys this editor turns into caret insertions (see {@link TextEditInsertion}).
   *  Absent ⇒ every key is ordinary typing. */
  getInsertions?(): TextEditInsertion[]
  /**
   * Items for the editor's WORD MENU (Sibelius's term). Absent ⇒ the gesture is left to the browser.
   * The insert API is handed in by the DOM layer, which owns the caret: the source says WHAT the
   * rows are, the overlay knows HOW to put something where the cursor is — the same split as
   * {@link getInsertions}, so a menu belongs to the editor that declares it and to no other.
   */
  getContextMenu?(insert: TextEditInsert): MenuItem[]
  /** Where to place the overlay, in viewport (client) pixels. */
  getScreenRect(): { x: number; y: number; width: number; height: number }
  /**
   * The engraved text's BASELINE, in viewport pixels — optional, but the only way the
   * overlay can sit exactly on top of the glyph it replaces. SVG text is positioned by
   * its baseline, an HTML box by the top of its line box, so aligning the two *tops*
   * always leaves the HTML font's internal leading in between. A source that can measure
   * its `<text>` node reports the baseline here and {@link TextEditDom} corrects for it.
   */
  getBaselineY?(): number | undefined
  /** Font to match the engraving so the typed text looks identical. */
  getFontCSS(): { fontFamily: string; fontSize: string; fontStyle: string; color: string; fontWeight?: string }
  /** Persist the typed text (model write + re-render). The empty-text rule lives
   *  here, keyed on {@link isNew}: empty + new ⇒ delete; empty + existing ⇒ keep. */
  commit(text: string): void
  /** Abandon the edit (Escape). A *new* target removes itself; an existing one is
   *  left untouched. */
  cancel(): void
  /** Toggle the underlying engraved glyph's visibility while editing. */
  hideOriginal(hidden: boolean): void
}

/**
 * A key that, while the overlay is focused, inserts a fixed fragment at the caret instead of
 * typing a character. Sources declare their own — the DOM layer knows only "match key, insert
 * html" — so a shortcut belongs to the editor that defines it (Ctrl+F ⇒ a forte chip in the
 * dynamic editor) and is absent everywhere else.
 */
export interface TextEditInsertion {
  /** `KeyboardEvent.key`, matched case-insensitively. Ignored when {@link code} is set. */
  key?: string
  /**
   * `KeyboardEvent.code` — the PHYSICAL key, matched exactly. Use this for keys `key` cannot tell
   * apart: the numeric KEYPAD (`Numpad1`…`Numpad9`, `NumpadDecimal`), whose digits share a `key`
   * with the top row. That distinction matters here — the top-row `Ctrl+1…9` is the browser's own
   * tab-switch, which a page cannot preventDefault, so a keypad shortcut is the only one that can
   * actually fire. Independent of NumLock (the `code` is `Numpad1` either way).
   */
  code?: string
  /** Required modifier (Cmd on macOS is accepted for `ctrl`). */
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  /** Trusted HTML inserted at the caret. Same provenance rule as
   *  {@link EditableTextSource.getSeedHtml}: source-built, never user-supplied. */
  html: string
}

/**
 * What a menu row can put into the editor at the caret. Two doors, because the editor holds two
 * kinds of thing: prose you can backspace through a character at a time, and an atomic glyph chip.
 * A source picks per row — which is how one palette offers `dolce` and `sfz` side by side without
 * either becoming the other.
 */
export interface TextEditInsert {
  /** Plain words, in the box's own font. Escaped by the DOM layer; safe for any string. */
  text(text: string): void
  /** Trusted, SOURCE-BUILT markup (a glyph chip). Same provenance rule as
   *  {@link EditableTextSource.getSeedHtml} — never user-supplied, it is assigned as innerHTML. */
  html(html: string): void
}

/** Options handed to the DOM layer when the overlay is mounted. */
export interface TextEditMountOptions {
  text: string
  /** Trusted pre-styled seed HTML (see {@link EditableTextSource.getSeedHtml}). When present,
   *  the box is seeded with this instead of plain `text`; `textContent` still yields `text`. */
  html?: string | null
  rect: { x: number; y: number; width: number; height: number }
  /** Viewport-pixel baseline of the engraved text, when the source can measure it
   *  (see {@link EditableTextSource.getBaselineY}). Absent ⇒ align tops. */
  baselineY?: number
  /** Caret-insertion keys this editor accepts (see {@link EditableTextSource.getInsertions}). */
  insertions?: TextEditInsertion[]
  /** Right-click word-menu builder (see {@link EditableTextSource.getContextMenu}). The DOM layer
   *  calls this with its own caret-insert function when the menu is actually opened, so the rows
   *  are built fresh against a live caret rather than captured at mount. */
  buildContextMenu?: (insert: TextEditInsert) => MenuItem[]
  font: { fontFamily: string; fontSize: string; fontStyle: string; color: string; fontWeight?: string }
  /** Called by the DOM layer on Enter / click-away. */
  onCommit: () => void
  /** Called by the DOM layer on Escape. Escape FINISHES the edit — see
   *  {@link TextEditController.escape} for what that means and why it is not a cancel. */
  onEscape: () => void
}

/**
 * The DOM bits the controller needs, behind an interface so the controller's
 * state machine is unit-testable in a no-DOM (node) environment with a fake. The
 * real implementation is {@link DomTextEdit}.
 */
export interface TextEditDom {
  mount(opts: TextEditMountOptions): void
  /** The overlay's current text (trimmed). Valid between mount and unmount. */
  getText(): string
  unmount(): void
}

/**
 * Compare two texts the way the SOURCES will read them, so "did this change?" agrees with what a
 * commit would actually write: the box hands back non-breaking spaces where the user typed plain
 * ones, and every source trims. Without this, opening a mark and touching nothing could still count
 * as an edit.
 */
function normalizeText(text: string): string {
  return text.replace(/\u00A0/g, ' ').trim()
}

/**
 * Framework-agnostic in-canvas text editor. Drives a seamless DOM overlay over an
 * engraved mark: open seeds + shows the overlay and hides the original; Enter /
 * click-away commits; Escape FINISHES (commits a changed text, cancels an untouched one — see
 * {@link escape}); close restores and clears state.
 *
 * It owns *no* knowledge of the score model — that lives in the {@link EditableTextSource}.
 * The overlay's DOM lives in {@link TextEditDom} (injected) so this class stays pure.
 */
export class TextEditController {
  private source: EditableTextSource | null = null

  constructor(
    private state: EditorState,
    private dom: TextEditDom,
  ) {}

  /** True while an edit is in progress (canvas handlers consult this to stay quiet). */
  isEditing(): boolean {
    return this.source !== null
  }

  /** Begin editing `source`. Commits any edit already in progress first. */
  open(source: EditableTextSource): void {
    if (this.source) this.commit()

    this.source = source
    this.state.editingText = { targetId: source.targetId, kind: source.kind, isNew: source.isNew }
    source.hideOriginal(true)

    this.dom.mount({
      text: source.getText(),
      html: source.getSeedHtml?.(),
      rect: source.getScreenRect(),
      baselineY: source.getBaselineY?.(),
      insertions: source.getInsertions?.(),
      buildContextMenu: source.getContextMenu ? (insert) => source.getContextMenu!(insert) : undefined,
      font: source.getFontCSS(),
      onCommit: () => this.commit(),
      onEscape: () => this.escape(),
    })
  }

  /** Commit the current text (Enter / click-away). Closes, then writes — the model
   *  re-renders on write, replacing the (already-restored) original glyph. */
  commit(): void {
    const source = this.source
    if (!source) return
    const text = this.dom.getText()
    this.close()
    source.commit(text)
  }

  /**
   * Escape — FINISH the edit, which is not the same as abandoning it.
   *
   * Escape used to throw the typing away, and losing a phrase you had just typed because you
   * reached for the key that means "I'm done" is not a trade anyone would take. Sibelius ends text
   * entry on Escape and keeps the text; so do we.
   *
   * Whether there was "an edit" is answered by the TEXT — what is in the box versus what seeded it
   * — and never by tracking keystrokes: a dirty flag is state that can drift, and this cannot.
   *
   *   - **Changed** → commit it, exactly as Enter would. Clearing the text and pressing Escape
   *     therefore deletes the mark, because {@link commit} already reads empty as "remove" — the
   *     same meaning it has on Enter, so the two keys never disagree.
   *   - **Untouched** → cancel, and the source restores itself. This is what makes a freshly placed
   *     blank mark vanish when you change your mind, and it is why an untouched existing mark
   *     writes NOTHING: committing identical text would push an undo entry for a no-op.
   *
   * The cost, stated plainly: there is no longer a gesture that DISCARDS a change. Ctrl+Z is the
   * way back from a typo. That is the deal Sibelius makes too.
   */
  escape(): void {
    const source = this.source
    if (!source) return
    if (normalizeText(this.dom.getText()) !== normalizeText(source.getText())) {
      this.commit()
      return
    }
    this.close()
    source.cancel()
  }

  /** Tear down the overlay, restore the original glyph, and clear editing state.
   *  Never re-renders — staying modal until commit/cancel keeps the SVG group and
   *  overlay geometry valid (see docs/text-editing-plan.md §4.3). */
  private close(): void {
    const source = this.source
    if (!source) return
    this.dom.unmount()
    source.hideOriginal(false)
    this.source = null
    this.state.editingText = null
  }
}
