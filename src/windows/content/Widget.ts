/**
 * What goes inside a window — and inside other widgets.
 *
 * The whole contract: you are handed a box, you fill it. Nothing more. A widget never asks where it
 * is, how big it is, or who its parent is (docs/windows-design.md, rule 3), which is why the same
 * object works as a window's only child, as one cell of a Columns, or as a row in a Column.
 *
 * `destroy()` runs when the window closes — closed means the nodes are gone, so anything registered
 * OUTSIDE the widget's own subtree (a document listener, a timer, an observer) must be released
 * here. A widget that owns nothing but its own DOM can omit it. A container must call `destroy()`
 * on its children.
 *
 * ⚠️ THE TOOLKIT STAYS TINY, ON PURPOSE. Widgets are dumb DOM builders: no reactivity, no data
 * binding, no layout engine. That vocabulary — Column, Row, Columns, ScrollText, Button, Label —
 * is enough to assemble a Save dialog, and stopping there is what keeps this from slowly becoming
 * a worse copy of Vue. Anything genuinely complicated does NOT get a widget: it gets a framework
 * component mounted into the box. The toolkit earns its keep on the parts that REPEAT.
 */
export interface Widget {
  mount(host: HTMLElement): void
  destroy?(): void
}

/** A widget that holds other widgets. Mounts them, and destroys them with itself. */
export abstract class Container implements Widget {
  protected constructor(protected readonly children: Widget[]) {}

  abstract mount(host: HTMLElement): void

  destroy(): void {
    for (const child of this.children) child.destroy?.()
  }
}
