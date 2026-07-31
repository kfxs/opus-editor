import { CHROME } from '@/utils/chromeColors'
import type { MenuLayer } from './MenuLayer'
import type { MenuItem } from './MenuItem'

/**
 * The MENU BAR — the strip of titles across the top of the app, and the second thing built on the
 * menu primitive. It paints buttons and decides which tree belongs to which one; the panels
 * themselves are {@link MenuLayer}'s, unchanged. That was the primitive's stated promise from the
 * day it was written: *"a File menu is just another item tree, anchored at the bottom-left corner of
 * a button instead of at a click."* This file is that anchor and nothing more.
 *
 * ⚠️ It knows NOTHING about what is in the menus. The trees arrive as a parameter, the same way the
 * Insert menu receives its actions — so the placeholder set the demo currently shows
 * ({@link ./demoMenus}) can be replaced wholesale without this file changing a line.
 *
 * WHERE THE PANEL LANDS. The bar sits directly ABOVE the box the menu layer fills (the score
 * viewport), so a button's bottom edge is at a NEGATIVE y in the layer's coordinates and
 * `placement.ts` clamps it to 0 — the panel opens flush with the top of the score, immediately under
 * the bar, which is exactly where a dropdown belongs. No special case is needed for that, and none is
 * written here: the bar hands over the corner it wants and the placement rules do the rest.
 */

const STYLE_ID = 'menu-bar-styles'

const CSS = `
.menu-bar {
  display: flex;
  align-items: center;
  gap: 2px;
  height: 34px;
  padding: 0 8px;
  background: rgb(${CHROME.glassRgb});
  border-bottom: 1px solid ${CHROME.edge};
  color: ${CHROME.ink};
  font-family: system-ui, sans-serif;
  font-size: 13px;
  /* Chrome, not a document: dragging along the bar must not smear a text selection. */
  user-select: none;
}
.menu-bar-brand {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 0 12px 0 6px;
  white-space: nowrap;
}
/* The wordmark is an <h1> (see the brand option below). Its size, weight and margins are therefore
   stated here rather than left to the browser's own heading defaults — 2em, bold, a block margin —
   which would make the bar three times too tall. Written out even though Tailwind's preflight
   already resets headings: this module ships its own stylesheet and must not depend on someone
   else's reset being loaded. */
.menu-bar-brand-name {
  font-size: inherit;
  font-weight: 600;
  letter-spacing: 0.01em;
  margin: 0;
}
.menu-bar-title {
  padding: 4px 10px;
  border-radius: 4px;
  cursor: default;
  white-space: nowrap;
}
/* A title lights on hover EVEN WHEN NOTHING IS OPEN — this row is the app's only always-visible
   affordance, so it has to answer "is this a thing I can press?" before it is pressed. Softer than
   the accent, which is reserved for the ONE title whose menu is actually down. */
.menu-bar-title:hover {
  background: rgba(255, 255, 255, 0.08);
}
.menu-bar-title[data-open="true"],
.menu-bar-title[data-open="true"]:hover {
  background: ${CHROME.accent};
  color: #fff;
}
.menu-bar-spacer {
  flex: 1;
}
`

/** One top-level entry: the word on the bar, and the tree it drops. */
export interface MenuBarTitle {
  label: string
  items: MenuItem[]
}

export interface MenuBarHandle {
  destroy(): void
}

export interface MenuBarOptions {
  /**
   * The wordmark at the left. Rendered as the page's `<h1>` — the bar is the only always-visible
   * text chrome, so it is where the document's one heading belongs, and a search engine reading the
   * page finds a name rather than a menu of lorem. Its heading defaults are overridden in the CSS
   * above, so this is a semantic change and NOT a visual one.
   */
  brand?: string
}

/**
 * Build the bar into `host` and wire it to the app's menu layer.
 *
 * @param host  the strip's own box, provided by the app (a bar is chrome the app lays out, unlike a
 *              window or a menu, which float over the score and take the viewport for themselves).
 * @param menus the layer the panels open in — a parameter, never the singleton imported by name, so
 *              this stays a definition module (`docs/DESIGN-PRINCIPLES.md` boundary case 5).
 */
export function mountMenuBar(
  host: HTMLElement,
  menus: MenuLayer,
  titles: MenuBarTitle[],
  opts: MenuBarOptions = {},
): MenuBarHandle {
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = CSS
    document.head.appendChild(style)
  }

  const bar = document.createElement('div')
  bar.className = 'menu-bar'

  if (opts.brand) {
    const brand = document.createElement('div')
    brand.className = 'menu-bar-brand'
    // <h1>, not <span> — the page's one heading, for SEO. Looks identical: the heading defaults are
    // pinned in `.menu-bar-brand-name`.
    const name = document.createElement('h1')
    name.className = 'menu-bar-brand-name'
    name.textContent = opts.brand
    brand.appendChild(name)
    bar.appendChild(brand)
  }

  /** The title whose menu is currently down, or null. The bar's whole state. */
  let open: HTMLElement | null = null

  function light(el: HTMLElement | null): void {
    if (open) delete open.dataset.open
    open = el
    if (el) el.dataset.open = 'true'
  }

  function openTitle(el: HTMLElement, title: MenuBarTitle): void {
    const layerBox = menus.host?.getBoundingClientRect()
    if (!layerBox) return
    const box = el.getBoundingClientRect()
    // The button's BOTTOM-LEFT corner: a dropdown hangs from the title, it does not cover it.
    menus.open({
      x: box.left - layerBox.left,
      y: box.bottom - layerBox.top,
      items: title.items,
      // The lit title outlives the click that opened it, so only the layer can say when to put it
      // out — Escape, a click on the score, or another menu replacing this one. Guarded on identity
      // because `open()` closes the previous menu first, and that stale close must not un-light the
      // title we are in the middle of lighting.
      onClose: () => { if (open === el) light(null) },
    })
    light(el)
  }

  for (const title of titles) {
    const el = document.createElement('div')
    el.className = 'menu-bar-title'
    el.textContent = title.label

    // pointerdown, not click: the menu layer's own scrim dismisses on pointerdown, so a click-based
    // toggle would fire AFTER the scrim had already closed this menu and would re-open it — the
    // second press on a title would never shut it.
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      // A press on the title that is already down CLOSES it. The bar is not covered by the scrim
      // (the layer fills the score, which is below), so this press is ours to interpret.
      if (open === el) menus.close()
      else openTitle(el, title)
    })

    // Once a menu is down, sliding along the bar walks between them without a second press — the one
    // menu-bar behaviour everyone has in their fingers. Doing nothing while CLOSED is equally part of
    // it: a bar that dropped a panel on mere passage would ambush anyone crossing it.
    el.addEventListener('pointerenter', () => {
      if (open && open !== el) openTitle(el, title)
    })

    bar.appendChild(el)
  }

  const spacer = document.createElement('div')
  spacer.className = 'menu-bar-spacer'
  bar.appendChild(spacer)

  host.appendChild(bar)

  return {
    destroy(): void {
      if (open) menus.close()
      bar.remove()
    },
  }
}
