# Menus — the second primitive

**Status: BUILT** (`src/menus/`) — P0–P2. Sibling to `Window` (docs/windows-design.md), not a kind of
it. Right-click the score and a lorem menu opens; P3 (keyboard navigation) is not done.

## What this is

Right-click empty paper in Sibelius and you get a floating vertical list; some rows carry a `▸` and
open a flyout to the side. That shape, and nothing else.

```ts
menus.open({ x, y, items })   // viewport pixels; one root menu at a time
```

**The first client is a demo.** Every row's label is lorem ipsum, some rows have a submenu and some
don't, and selecting one does `console.log(label)`. No score command is wired to a row — this exists
to prove the primitive, exactly as the Lorem window did before the Keypad.

## A menu is NOT a Window

The window doc's own test: ask what a subclass would *override*. For a menu the answer is nearly
everything. A window is persistent, dragged by a title bar, resized by grips, stacked among peers,
closed by a ✕, and **clamped** to the viewport. A menu has no title bar and no grips, is never
dragged, is never stacked (there is one chain, or none), is placed **at the pointer**, **flips** when
it would run off an edge, and dies on Escape / outside click / selection.

Spelling that with `WindowOptions` costs `chrome: false`, `draggable: false`, `dismissOnOutsideClick`,
`flipPlacement` — four booleans that secretly cannot be combined, which is the precise disease the
window doc's *behaviour varies by callback, never by flag* section exists to prevent.

So: a second primitive, which **inherits the window's four rules unchanged** — outside the zoom layer
and the scroll box; layer transparent to the pointer; content never knows where it is; closed means
the nodes are GONE.

## Items are DATA. One renderer paints them.

The Keypad already settled this: `keypadLayouts.ts` is a table of cells and `KeypadWidget` paints
from it. A menu is a *tree* of rows and one renderer that paints from it.

```ts
export type MenuItem =
  | { label: string; onSelect: () => void }   // a leaf
  | { label: string; items: MenuItem[] }      // opens a flyout
  | { separator: true }
```

A **discriminated union**, not `{ label, onSelect?, items? }` with both optional. A row that has both
is nonsense, and the union makes that nonsense *unspellable* rather than merely discouraged.

**Not in the vocabulary yet, on purpose:** checkmarks, radio groups, shortcut hints, disabled rows,
icons. Each goes in when a *third* menu wants it — the same guard the widget toolkit lives under.

**And it is emphatically not `new Column([new Button(...)])`.** Reusing the widget toolkit would make
a menu "a chromeless window full of buttons", and then hover-to-open-flyout, the roving highlight and
keyboard navigation all get bolted onto `Button` — which knows nothing about what it is for and must
keep knowing nothing.

## The four rules, as they land on a menu

| rule | what it means here |
|---|---|
| 1. outside zoom, outside scroll | `MenuLayer` is a **second layer div in the same host** the app already donated, at a higher z-index than the window layer. A menu is never under a window — including one opened *from* a window. |
| 2. `pointer-events: none` on the layer | …with the scrim (below) as the one deliberate exception, and only while a menu is open. |
| 3. content never knows where it is | A `MenuItem` carries a label and a callback. **It never learns its x/y, and never that it is in a flyout.** Placement — flip, clamp, which side the submenu opens on — is entirely the menu system's arithmetic, and is a pure function worth unit-testing without a browser. |
| 4. closed means the nodes are gone | Dismiss ⇒ `remove()`. No hidden `display: none` menu parked in the DOM. |

## The two decisions that are actually about the menu

### 1. The dismissing click is SWALLOWED

While a menu is open, a transparent full-viewport **scrim** sits under it with `pointer-events: auto`.
Clicking outside the menu closes it **and the click goes no further**.

The alternative — a capture-phase document listener that dismisses and lets the click through — means
the click that closes a menu also **places a note where you clicked**. That is a bug you would report.
Cost of the scrim, accepted: dismiss-then-act is two clicks. Every real editor charges this.

### 2. It FLIPS, it does not clamp

A window near the right edge is clamped back inside. A menu near the right edge that got clamped
would sit **under your own cursor**. So a menu opens right-and-down from the click by default, and
flips to left / up when it would overflow the host box. A flyout flips side the same way. Clipped to
the score viewport like every window — never over the palette.

## Mounting: `App.vue` still holds TWO lines, forever

`App.vue` already donates the box (`windows.mount(scoreViewport)`). The menu layer needs **that same
box**, and must not become a third line. `whenMounted` is extended to hand the host through:

```ts
// src/menus/index.ts
windows.whenMounted((host) => menus.mount(host))
```

so a `.vue` file never learns that menus exist. Same shape as `installKeypad`.

## Files

| file | what it is |
|---|---|
| `src/menus/MenuItem.ts` | the union above. Data, no DOM. |
| `src/menus/placement.ts` | pure: (anchor, size, host box) → position, flipped. Testable with no browser. |
| `src/menus/MenuLayer.ts` | the DOM: the scrim, the root list, the flyouts, dismissal. No framework. |
| `src/menus/index.ts` | the app's one layer instance, so any plain-TS module can open a menu. |
| `src/menus/demo/loremMenu.ts` | the lorem item tree + the `contextmenu` listener on the viewport. |

All of it under `npm run lint:boundary`.

## ⚠️ The trap it walked into: `mousedown` had no button guard

`MouseController.handleMouseDown` ran on **any** button. Nobody noticed, because the `click` event
never fires for button 2 — so a right-click could not *place* a note, and the bug stayed invisible.
But mousedown is where selection changes, drags arm and box-select arms, and all of that was firing
on a right-click already. Add a context menu and it fires *underneath the menu you just opened*.

Fixed with one line (`if (event.button !== 0) return`) and a test that arms a paste and right-clicks.
**The general lesson is the one this repo keeps relearning: a constraint you ADD is a test you didn't
know you were running.** The menu didn't create this; it revealed it.

## Phases

- ✅ **P0 — the primitive.** `MenuLayer.mount/open/close`, the scrim, the root list, `placement.ts` +
  its 8 tests.
- ✅ **P1 — flyouts.** Hover on a `▸` row opens the child after 140 ms — *every* row's claim is
  delayed, not just a submenu's, because an immediate collapse on entering a plain sibling row is
  exactly what kills the flyout you were diagonally travelling to. Clicking a `▸` row opens it now.
  Escape closes **one level**, not the whole chain.
- ✅ **P2 — the demo.** `demo/loremMenu.ts`: right-click the viewport → lorem rows, two of them with
  submenus (one nested two deep), select ⇒ `console.log`. Native context menu suppressed on the
  viewport only.
- **P3 — keyboard, not done.** ↑↓ to move, → to open a flyout, ← to leave it, Enter to select. Listed
  so the design isn't shaped *around* its absence; the roving highlight is already a data attribute
  the layer sets, not `:hover`, which is what P3 will need.

## What this is NOT

- **Not a menu bar**, not a command registry, not a keyboard-shortcut-hint system. A menu is handed an
  item tree by whoever opens it; it does not look anything up.
- **Not a right-click dispatcher.** Deciding *which* menu belongs to what was clicked (empty paper vs.
  a note vs. a slur) is the caller's job, and lives with the caller — `interactions/`, when there is
  ever a real menu. The menu system only takes `(x, y, items)`.
