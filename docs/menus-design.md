# Menus — the second primitive

**Status: BUILT** (`src/menus/`) — P0–P4. Sibling to `Window` (docs/windows-design.md), not a kind of
it. Right-click the score → the Insert menu: Clef, `Text ▸ Expression` (Ctrl+E), `Text ▸ Tempo`
(Alt+Shift+T), Time Signature and Tuplet. And since P4 there is a **menu bar** across the top of the
app: File · Edit · View · Create · Staff · Play · Window. Every row on it is a real command.

> # ⚠️ THE MENU BAR IS THE DEMO'S. IT IS NOT THE APP'S UI.
>
> Read the next section before touching it, and before treating any part of it as decided.

## ⚠️ The menu bar is PROVISIONAL — the demo's chrome, not a design

The editor is published to GitHub Pages so it can be tried, and so the production bundle can be
watched running. That page is a **demo**. **What the editor's real UI will be is not decided, and
nobody has claimed it will have a menu bar at all.**

So everything about the bar is provisional, and deliberately so:

- **The TITLES are provisional.** File · Edit · View · Create · Staff · Play · Window are the words a
  notation editor conventionally uses. They are not a taxonomy anyone chose; they are what makes a
  strip of chrome legible as a menu bar while we learn whether we want one.
- **The GROUPING is provisional.** Staff carrying both the staff and measure commands, Create being
  the right-click tree under another name, the transport living under Play — each is a reasonable
  guess and none is a decision.
- **What is NOT provisional is the behaviour behind each row.** A row runs the same registered action
  its accelerator runs (`ShortcutManager.run`), or the same `PaletteController` method the dev
  toolbar's button calls, or the same function the dev panel's button calls. Nothing was reimplemented
  for the bar. So if the bar goes, or is replaced by something completely different, **what goes is a
  list of labels** — the commands stay where they live.
- **`buildMenuBarTitles()` in `src/menus/index.ts` is the whole running order**, one line per title.
  Deleting the bar is deleting that function and the `mountMenuBar` call in `App.ts`.

The bar started as pure lorem ipsum (`demoMenus.ts`, since deleted) precisely so that no row could be
mistaken for a promise, and each title graduated to real commands only when its contents were asked
for. That is the pattern to keep: **a row that cannot yet do what it says should not be on the bar,
and a row that works is still not a claim that it belongs there.**

## What this is

Right-click empty paper in Sibelius and you get a floating vertical list; some rows carry a `▸` and
open a flyout to the side. That shape, and nothing else.

```ts
menus.open({ x, y, items })   // viewport pixels; one root menu at a time
```

**The first client is the Insert menu.** It began as a demo — every row lorem ipsum, selecting one
`console.log`s — to prove the primitive exactly as the Lorem window did before the Keypad. The real
commands then replaced those rows one at a time (`Text ▸ Expression` and `Text ▸ Tempo` first, each
running the same action as its keyboard shortcut — see "How a command reaches a controller" below),
and when the last command landed the leftover lorem went with it. Deep chains and separators are the
PRIMITIVE's to prove, and `MenuLayer`'s own tests prove them; a menu the user opens is not the place.

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

**Three more fields have since earned their place** — each when a menu actually wanted it, which is
the guard, and each read as the row is PAINTED (items are built once, at mount, so a captured value
would show whatever was true that morning):

| field | who wanted it | why |
|---|---|---|
| `checked?: () => boolean` | View, Window, Play ▸ Score Sound | a toggle whose state you cannot see is a button you press twice to find out what it did. A panel with no checkable row grows no tick column at all. |
| `disabled?: () => boolean` | Staff | its commands need a bar selected *by a specific gesture*, and nothing on screen says so. A greyed row is the menu saying the command is real and its target is missing. It is skipped by the arrow keys, not merely un-clickable. |
| `label: string \| (() => string)` | Play | one command, one key, and a word that has to say which way it will go: *Play* ⇄ *Stop*. For a row that changes what it SAYS — never one that changes what it DOES. |

**Still not in the vocabulary, on purpose:** radio groups and icons.

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
| `src/menus/insertMenu.ts` | the Insert item tree (all real commands) + the `contextmenu`/Menu-key listeners, **and** `buildCreateMenu` — the bar's Create title is this same tree, not a copy. |
| `src/menus/menuBar.ts` | the BAR: buttons, the lit title, slide-along-to-switch. Knows nothing about what is in the menus. |
| `src/menus/menuCommands.ts` | `MenuToggle` / `MenuCommand` — what a menu module asks the app for: a callback plus the readings the row needs while it is painted. |
| `src/menus/fileMenu.ts` `editMenu.ts` `viewMenu.ts` `staffMenu.ts` `playMenu.ts` `windowMenu.ts` | one module per bar title. Each is a `build…(actions) → MenuBarTitle` and nothing else. |

All of it under `npm run lint:boundary`.

⚠️ **A menu that ships may not import `dev/`.** The shell has to keep deleting cleanly, so two
modules graduated out of it when the bar reached them: `dev/staffSizeToggle` → `interactions/`, and
`dev/scoreFile` → `utils/` with the actions it needed collected into `interactions/scoreFileIo.ts`
(one implementation, called by the dev panel, the dev toolbar button and the File menu alike).

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
  menu, with submenus. Native context menu suppressed on the viewport only. It began all-lorem; real
  commands replaced the rows one at a time (`Text ▸ Expression/Tempo` first) until none were left.
- ✅ **P4 — the menu bar.** `menuBar.ts` + one module per title, mounted above the score viewport. It
  needed no new placement rule: a button's bottom edge is a negative y in the layer's box, and
  `placement.ts` clamps it to the top of the score, which is where a dropdown belongs. `MenuLayer`
  gained exactly one option, `onClose`, because the lit title outlives the click that opened it.
  ⚠️ **Provisional — see the warning at the top of this file.**
- **P3 — keyboard, not done.** ↑↓ to move, → to open a flyout, ← to leave it, Enter to select. Listed
  so the design isn't shaped *around* its absence; the roving highlight is already a data attribute
  the layer sets, not `:hover`, which is what P3 will need.

## What this is NOT

- **Not a *committed* menu bar.** One exists (P4) and it is the demo's, not a design — the warning at
  the top of this file is the whole story. What the primitive promised has held, though: `open({x, y,
  items})` stayed anchor-based, and the bar turned out to be exactly "another item tree anchored at a
  button's corner", with no change to the layer beyond one `onClose` callback.
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

## Palettes: columns, keyboard grid, and specimen labels

The expression editor's word menu (Sibelius's term) made the primitive grow three things. All are
opt-in — an ordinary single-column command menu is byte-for-byte the menu described above.

**Columns.** A `{ columnBreak: true }` item, mirroring `separator`. Items stay ONE FLAT LIST, so
building, measuring, hover intent and the keyboard's row order all keep working; a panel switches to
flex columns only when a break is present. Placement needed no change at all — it is pure and
size-driven, so a much wider panel already flips and clamps correctly.

Columns are not decoration. Stacked, the expressions palette is ~29 rows and runs off the bottom of
the viewport; side by side it is ~17 and fits. That is the whole argument.

**The keyboard is a grid.** `↑/↓` walk a COLUMN, `←/→` cross columns. `RowRef` carries
`{ column, row }` for this; for a single-stack menu every row is column 0, so it is unchanged.

- The existing meanings WIN where a key had one. A row showing `▶` promised `→` opens it, so
  `openHighlightedSubmenu()` reports whether it did and `→` only steps a column when it did not.
  `←` still backs out of a flyout, and steps a column only on a root panel — where it did nothing
  before. Both additions fill genuinely dead keys.
- **Nothing wraps, in either axis.** Running off the bottom back to the top moves the highlight the
  whole height of the panel opposite to the key: you lose your place, and at the foot of a long list
  you cannot tell whether Down did nothing or did everything. Sideways is the same argument — the
  columns are genuinely side by side. Ends clamp; a sideways step keeps its vertical position,
  settling on the last row of a shorter column rather than landing on nothing.

**The keyboard can own a menu.** Three highlight sources exist (`:hover`, the flyout owner, the
arrow row) and only ONE may ever look like "the row Enter commits".

- Arrow keys claim the menu: the layer takes `menu-layer-keyboard`, which hides the cursor and mutes
  `:hover`. Control returns on real pointer movement, gated on DISTANCE from where the pointer sat —
  a stationary mouse still emits events, and treating those as intent would undo the mode the moment
  a flyout appeared under the cursor.
- `pointerenter` fires when a panel opens UNDER a stationary pointer, so hover must **stand down
  entirely** while the keyboard drives, not merely be restyled.
- `MenuOptions.viaKeyboard` — a menu summoned by a KEYSTROKE starts in keyboard mode. Only the caller
  knows which input asked; the layer cannot tell. Wire it at every keyboard entry point:
  `installInsertMenu`'s Menu-key path is the worst offender, because it opens AT the last pointer
  position, so the row under the pointer was guaranteed to light up as a selection the keyboard did
  not own — leaving `→` doing nothing and `↓` starting from the top.
- An arrow pressed at a freshly-opened menu must always DO something; from nowhere it lands on the
  first row rather than being swallowed.

**Specimen labels.** `labelFont?: 'music' | 'italic'` sets a label the way the score will engrave it
— dynamics in Bravura (showing the PRECOMPOSED glyph, the exact character the engraver draws),
expression words in the score's serif italic. On a palette the label is not decoration, it is the
mark: a row reading `sfz` in the system font describes a dynamic, one reading the glyph is one. ONE
field rather than a `music` and an `italic` flag, because a label set in both is nonsense and this
makes it unspellable — the same reason `MenuItem` is a discriminated union at all. Leaf-only: a
submenu is a word.

⚠️ The italic stack is spelled in `MenuLayer`'s CSS rather than imported from the renderer's
`DYNAMIC_TEXT_FONT`. A second place to edit if the score's expression face changes — accepted
because `menus/` reaching into `engine/` would be a far worse coupling.
