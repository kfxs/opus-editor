# Menus — the second primitive

**Status: BUILT** (`src/menus/`) — P0–P2, and its first REAL commands have landed. Sibling to `Window`
(docs/windows-design.md), not a kind of it. Right-click the score → the Insert menu: `Text ▸ Expression`
(Ctrl+E) and `Text ▸ Tempo` (Alt+Shift+T) are wired; the remaining rows are still lorem placeholders,
replaced one at a time. P3 (keyboard navigation) is not done.

## What this is

Right-click empty paper in Sibelius and you get a floating vertical list; some rows carry a `▸` and
open a flyout to the side. That shape, and nothing else.

```ts
menus.open({ x, y, items })   // viewport pixels; one root menu at a time
```

**The first client is the Insert menu.** It began as a demo — every row lorem ipsum, selecting one
`console.log`s — to prove the primitive exactly as the Lorem window did before the Keypad. The real
commands now replace those rows one at a time: `Text ▸ Expression` and `Text ▸ Tempo` are the first,
each running the same action as its keyboard shortcut (see "How a command reaches a controller" below).

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

**The `shortcut` hint earned its place** (the leaf variant only — a submenu is not a keystroke): a
pure display string echoing `ShortcutConfig`, rendered right-aligned and muted-italic, so `Expression`
shows `Ctrl+E` and `Tempo` shows `Alt+Shift+T`. It is a display echo, not the binding — keep the two in step.

**Still not in the vocabulary, on purpose:** checkmarks, radio groups, disabled rows, icons. Each goes
in when a menu actually wants it — the same guard the widget toolkit lives under.

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
| `src/menus/index.ts` | the app's one layer instance + the `menuActions` command seam (below). |
| `src/menus/insertMenu.ts` | the Insert item tree (real Text commands + remaining lorem) + the `contextmenu`/Menu-key listeners. |

All of it under `npm run lint:boundary`.

## The look, and the three things that were wrong before they were right

- **Glass, like the Keypad — but less of it.** `rgba(31,41,55,0.85)` + `backdrop-filter: blur(4px)`.
  The Keypad can sit at 0.45 because it is a *picture of state you glance at*; a menu is **text you
  read**, and a stave running through a label is a label you read twice. The blur does the other
  half — it pushes the stave lines back so they stop competing with the rows on top of them, and it
  is heavier here (4px) than under the Keypad (1px) precisely because a menu is transient: the music
  going soft for a moment is not read as a rendering fault. The highlighted row stays **fully
  opaque**, so the row under the pointer is unambiguous against whatever music is behind it.
- **Highlight needs BOTH `:hover` and `data-active`.** Hover paints the row under the pointer —
  reading a menu *is* hovering it, and a row you cannot see yourself on is a row you are not sure you
  are about to click. `data-active` is set by the layer on the row that OWNS the open flyout, because
  that row must stay lit once the pointer has left it *for* its flyout, where `:hover` no longer
  holds. Shipping only the second one left the plain rows dead under the pointer.
- **`text-align: left`, explicitly.** Alignment INHERITS: the panel lives inside the score wrapper,
  and whatever centres the music was quietly centring the menu rows too. A menu is a list you scan
  down the left edge of.

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
- ✅ **P2 — the Insert menu.** `insertMenu.ts`: right-click the viewport (or the Menu key) → the Insert
  menu, with submenus (one nested two deep). Native context menu suppressed on the viewport only. It
  began all-lorem; real commands now replace the rows one at a time (`Text ▸ Expression/Tempo` first).
- **P3 — keyboard, not done.** ↑↓ to move, → to open a flyout, ← to leave it, Enter to select. Listed
  so the design isn't shaped *around* its absence; the roving highlight is already a data attribute
  the layer sets, not `:hover`, which is what P3 will need.

## What this is NOT

- **Not a menu bar.** `open({x, y, items})` stays anchor-based, so a File/Edit bar is just another item
  tree anchored at a button's corner when it comes — but it is not built.
- **Not a right-click dispatcher.** Deciding *which* menu belongs to what was clicked (empty paper vs.
  a note vs. a slur) is the caller's job, and lives with the caller — `interactions/`, when there is
  ever a real menu. The menu system only takes `(x, y, items)`.

## How a command reaches a controller

A menu row that runs a real command needs a controller — but the controllers are created inside
`App.vue`'s setup, and the menu is a framework-agnostic singleton that must not import them (and
"add a menu ≠ edit App.vue"). The seam is a plain object, `menuActions`, in `src/menus/index.ts`:

```ts
export const menuActions: InsertMenuActions = {}          // filled by the app's glue
// insertMenu leaf: onSelect: () => actions.insertExpression?.()   // read LATE, at click time
// App.vue (one glue line each): menuActions.insertExpression = () => mouse.insertExpression()
```

The menu reads the callback at **click** time through the shared object, so the item tree can be
built before the app has wired anything. The menu never learns about controllers; `App.vue` never
learns the menu's shape — it only hands over the callback. This is the pattern the eventual menu bar
should reuse. The command *behaviour* itself lives one place (e.g. `MouseController.insertExpression`),
called by both the shortcut and the menu — never copied.
