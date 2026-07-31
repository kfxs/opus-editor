/**
 * The LIVE LINE — a dev-only rule across the shell saying: *everything below this ships.*
 *
 * The dev shell and the application are stacked in one column and look like one page, which is
 * exactly the confusion this removes. Above the line is scaffolding (`dev/`, absent from a built
 * bundle — see `IS_DEV` in App.ts); below it is what a visitor to the demo actually gets. Without
 * the mark the two are told apart only by remembering which strip is which, and the menu bar made
 * that harder rather than easier: it is the first piece of chrome that LOOKS like a dev toolbar and
 * is not one.
 *
 * ⚠️ It is an ANNOTATION, not chrome: amber and dashed, borrowed from nothing else in the UI, so it
 * cannot be mistaken for part of the editor. That is also why it is not drawn in the shared
 * `CHROME` palette — the palette exists to make surfaces agree, and this must disagree with all of
 * them.
 *
 * Deletes with the rest of `dev/`: it is mounted only under `IS_DEV`, and takes a host of its own.
 *
 * ⚠️ Tailwind scans source text for class names, so every one below is a whole literal — never
 * assembled from fragments, which compiles and then silently ships without the style.
 */

export interface LiveBoundaryMarkHandle {
  destroy(): void
}

/** Draw the line into `host`. Left label, dashed rule running out to the right edge. */
export function mountLiveBoundaryMark(host: HTMLElement): LiveBoundaryMarkHandle {
  const row = document.createElement('div')
  row.className = 'flex items-center gap-3 mt-5 mb-1 select-none'

  const label = document.createElement('span')
  // The arrow points DOWN because the claim is about what follows, not about what it sits under.
  label.className = 'text-xs uppercase tracking-widest text-amber-400 whitespace-nowrap'
  label.textContent = 'live build ↓'

  const rule = document.createElement('div')
  rule.className = 'flex-1 border-t border-dashed border-amber-400 opacity-60'

  row.append(label, rule)
  host.appendChild(row)

  return {
    destroy(): void {
      row.remove()
    },
  }
}
