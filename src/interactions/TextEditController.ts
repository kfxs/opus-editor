import type { EditorState } from './EditorState'

/**
 * A source decouples the editor from *what* is being edited. The
 * {@link TextEditController} knows nothing about dynamics / lyrics / etc. — each
 * editable text type supplies its own source (see {@link DynamicTextSource}).
 */
export interface EditableTextSource {
  /** Stable id of the target (mirrored into `state.editingText.targetId`). */
  readonly targetId: string
  /** Discriminator for the kind of target (mirrored into `state.editingText.kind`). */
  readonly kind: 'dynamic'
  /** True when the target was *just placed*; an empty commit deletes it. */
  readonly isNew: boolean
  /** Current text to seed the editor with. */
  getText(): string
  /** Where to place the overlay, in viewport (client) pixels. */
  getScreenRect(): { x: number; y: number; width: number; height: number }
  /** Font to match the engraving so the typed text looks identical. */
  getFontCSS(): { fontFamily: string; fontSize: string; fontStyle: string; color: string }
  /** Persist the typed text (model write + re-render). The empty-text rule lives
   *  here, keyed on {@link isNew}: empty + new ⇒ delete; empty + existing ⇒ keep. */
  commit(text: string): void
  /** Abandon the edit (Escape). A *new* target removes itself; an existing one is
   *  left untouched. */
  cancel(): void
  /** Toggle the underlying engraved glyph's visibility while editing. */
  hideOriginal(hidden: boolean): void
}

/** Options handed to the DOM layer when the overlay is mounted. */
export interface TextEditMountOptions {
  text: string
  rect: { x: number; y: number; width: number; height: number }
  font: { fontFamily: string; fontSize: string; fontStyle: string; color: string }
  /** Called by the DOM layer on Enter / click-away. */
  onCommit: () => void
  /** Called by the DOM layer on Escape. */
  onCancel: () => void
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
 * Framework-agnostic in-canvas text editor. Drives a seamless DOM overlay over an
 * engraved mark: open seeds + shows the overlay and hides the original; Enter /
 * click-away commits; Escape cancels; close restores and clears state.
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
      rect: source.getScreenRect(),
      font: source.getFontCSS(),
      onCommit: () => this.commit(),
      onCancel: () => this.cancel(),
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

  /** Abandon the edit (Escape). Closes, then lets the source restore itself. */
  cancel(): void {
    const source = this.source
    if (!source) return
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
