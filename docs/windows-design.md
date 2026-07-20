# Windows — a primitive

**Status: BUILT** (`src/windows/`). `Window`, `WindowManager`, `WindowLayer`, and a small widget
vocabulary. Wired to the palette's *Open Window* button as a test rig.

## What this is

**A `Window` primitive.** You instantiate one — or two, or as many as you need. It appears in the
viewport. You drag it by its title bar, resize it, click it to raise it, and close it.

```ts
const w = windows.open({ title: 'Foo', content: new ScrollText(paras) })
w.setTitle('Bar')
w.close()
```

## Two axes of variation, and NEITHER is subclassing

This is the load-bearing decision of the whole system.

- **The frame varies by PROPERTIES.** `title`, `resizable`, `closable`, `minWidth`, `minHeight`,
  `fitContent`, `opacity`, size, position. **One `Window` class**, options in the constructor,
  defaults for everything.
- **The inside varies by COMPOSITION.** A tree of {@link Widget}s handed to the window.

Never a subclass per kind of window. The moment windows vary, inheritance forces you to name every
*combination* — `ResizableTwoColumnWindow` — while properties just compose: `{resizable: false}`.
A window is never *a different kind of thing*; it is the same frame with different settings. **Ten
kinds of window means ten widget trees and still exactly one `Window` class.**

Ask what a subclass would *override* and the answer is: nothing. It would set a field. **That is the
tell — a subclass that only sets values wanted to be a constructor argument.** (Widgets, by contrast,
*are* an interface with many implementations, and rightly so: `Button.mount()` and
`ScrollText.mount()` build genuinely different DOM. They differ in what they DO. Windows differ only
in what they are SET TO.)

### ⚠️ And behaviour varies by CALLBACK — never by flag

Properties are an answer for **data**. They are not an answer for **behaviour**, and the day a window
needs to vary in behaviour is the day this design gets tested. A Save window that must confirm before
closing; a modal that blocks clicks to the score; a window that refuses to be raised — none of those
is a *value*, each is a decision taken at a moment.

The answer is a callback in the options bag — `onBeforeClose?: () => boolean` — and **not** a
subclass, and **not** a flag. If it isn't, the pressure lands on `WindowOptions`, which grows one
boolean per case: `modal`, `confirmOnClose`, `persistPosition`, `alwaysOnTop`… **That is the same
disease as subclass explosion wearing the other hat, and it is worse**, because ten booleans that
secretly cannot be combined at least *look* legitimate, while ten subclasses were honest about it.

So `WindowOptions` is guarded exactly like the widget vocabulary below: **a new option earns its
place only when a THIRD window needs it.** Two windows wanting a thing is a coincidence; three is a
vocabulary.

> **`opacity` was let in on ONE client, and that is a debt, not a precedent.** The Keypad needs it
> and nothing else does yet. It was allowed because it is unmistakably *data* (a number, 0–1, that
> composes with every other setting and can never secretly conflict with one) and because the
> alternative — the Keypad reaching up out of its box to restyle its own frame — breaks rule 3, which
> is worth more than the rule it bends. **If the next option to ask for entry is a `boolean`, it does
> not get this deal.**

What `opacity` actually is: the **frame background's alpha**, and nothing else. Not `style.opacity`,
which would fade the content too — the glyphs, the keys, the text — and *a panel you can see through
is not the same thing as a panel that has gone faint*. The title bar stays solid whatever the value
(it is the handle you grab and the name you read), and so does whatever the content chooses to draw.

## What this is NOT (yet, or ever)

- **Not docking.** Docking = panels that snap into the frame, split the app, tab together, and
  reflow the score when they open. That is a *layout tree* (geometry is **computed** by dividing
  available space), not a *list of rectangles* (geometry is **stored**). It is a large, fiddly piece
  of work — drop-targeting an abstract tree, splitter min-sizes that propagate, collapsing degenerate
  nodes. **If we ever want it, we buy it** (Golden Layout or dockview core, both vanilla). We do not
  hand-build it. Sibelius 6 — the reference shape here — has no docking at all.
- **Not a panel registry or layout persistence.** No named panel types, no ids to register, no saved
  workspace. If any of those turn out to be wanted, they get designed then.
- **⚠️ Not a UI framework.** See the warning below — this is the failure mode to fear.

---

## The four rules that are actually about the window

These are properties of *a window in this app*, not decisions about what goes inside one, and getting
them wrong is expensive to unpick later. Everything else is open.

### 1. Outside the zoom layer, outside the scroll box

The score DOM today:

```
div.relative.overflow-hidden            ← positioning context, CLIPS
  div.score-container   (scroll box, fixed height = VIEWPORT_HEIGHT)
    div.score-sizer     (natural size × zoom → gives the scrollbars their range)
      div.score-zoom-layer               ← transform: scale(zoom)
        div.p-4  (scoreContent — the VexFlow SVG, wiped by innerHTML='' each render)
        div.play-cursor                  (inside the layer on purpose: it SHOULD scale and scroll)
  div.score-gutter                       ← OUTSIDE the scroll box, OUTSIDE the zoom layer
```

A window is a **sibling of `.score-container`** — i.e. a child of the `.relative.overflow-hidden`
wrapper — positioned in **viewport pixels**.

> **Windows live INSIDE the viewport.** The whole application is meant to live inside the viewport,
> so the layer is mounted in that wrapper: `overflow-hidden` clips windows to the score area, and
> the drag arithmetic is clamped to **the host's box, not the browser's**, so a window cannot be
> dragged out over the palette or the JSON panel. Mounting it at the app root instead — letting
> windows float over the whole application, Sibelius-style — was considered and **rejected**.

- Outside the **zoom layer** ⇒ `transform: scale(zoom)` never touches it. **Window size is UI scale;
  score zoom is music scale — independent axes.** At 25% a window stays legible; at 400% it doesn't
  become a wall. Scaling chrome with the music is a bug, not a feature.
- Outside the **scroll box** ⇒ it doesn't scroll away with the music. A window that slides off-screen
  when you scroll to bar 40 isn't a window, it's a sticker on the paper.

**"In the viewport" describes where a window _appears_, not where it lives in the DOM.** The frozen
linear-view gutter already proves the pattern: same three requirements, same solution — a sibling of
the scroll box, with `GutterController` applying the zoom scalar by hand where it needs it. A window
needs the scalar even less than the gutter does: not at all.

*Corollary (P6, docs/render-performance-plan.md):* zoom also moves the **visible rect**, which
`onViewChange` hands to the engine to decide whether to re-engrave. A window outside the scroll box
participates in neither half of zoom — it doesn't scale, and merely *covering* the score doesn't
change the visible rect. Correct: music under a window is still engraved, just hidden.

### 2. `pointer-events: none` on the layer, `auto` on each window

An overlay spanning the viewport otherwise **eats every click meant for the score** — the score's
mouse handlers are on the scroll box, and a full-size sibling on top intercepts them. With the layer
transparent to the pointer and each window opaque to it, clicks pass straight through empty space to
the music.

### 3. Content never knows where it is

*(This is the one rule that keeps a later move to docking cheap — see the coupling section below.)*

A window's content **fills the box it is handed**, and never reads its own `x`/`y`/size from
anywhere but that box. **Geometry lives in the window system, never in the content.**

That is the whole insurance policy, and it costs nothing to obey now. Floating **stores** geometry
(a flat list of rectangles); docking **computes** it (a tree, dividing up available space). The two
shapes have nothing in common — but if the content never *asks* where it is, swapping one for the
other doesn't touch the content at all.

The practical consequence, worth stating on its own: **content must survive being handed any size.**
A docking layout resizes things to sizes nobody chose. Content that only works at its "natural" size
is content that can never be docked.

### 4. Closed means the nodes are GONE

Not `display: none`, not a hidden `v-if` branch, and **not a pile of window `<div>`s sitting in
`App.vue`'s template**. Open ⇒ code creates the elements. Close ⇒ code removes them. The DOM reflects
exactly the windows that exist right now, and `App.vue` never mentions a window at all.

---

# 🚨 NOTHING ABOUT A WINDOW IS EVER WRITTEN IN `App.vue`

## Defining a window is composing widgets. That is plain TS. It has NOTHING to do with Vue.

**`App.vue`'s entire share of the window system is TWO LINES — forever:**

```ts
import { windows } from '@/windows'

onMounted(()   => windows.mount(scoreViewport.value))  // here is the box
onUnmounted(() => windows.destroy())                   // and here is how long it lives
```

Those two exist only because **Vue owns the DOM node and the lifecycle hooks** — the layer must be
handed a host element, and told when that element starts and stops existing. **That is the whole
reason, and it does not generalise to anything else. The app donates a box; the window system does
everything else.**

The layer *instance* is deliberately NOT one of those lines: it lives in `src/windows/index.ts`, so
any framework-agnostic module can `import { windows }` and open one — a shortcut handler, a
controller in `interactions/`, the engine. Were the instance owned by the component, the component
would have to hand it to every opener, and "add a window" would once again mean "edit `App.vue`".

**The test of this design: adding a window with a text input touches zero Vue.** A new `.ts` module
composing the widgets, and something plain-TS to call it. No template edit, no ref, no flag.

The ways to erase even those two lines are all worse, and it is worth knowing why:

- `WindowLayer` calling `document.querySelector('.score-viewport')` itself ⇒ the vanilla layer now
  has a hidden dependency on the Vue app's markup. **More** coupled, not less.
- a `useWindows()` composable, or a `v-windows` directive ⇒ *relocation*, not elimination — and it
  puts Vue code **inside** the window system, which is the exact thing being prevented.

**Every window lives in its own plain-TS module** — `src/windows/demo/loremWindows.ts` is the
pattern: `export function openLoremWindow(windows: WindowLayer): Window`. A `.vue` file may *call*
it. It may never *contain* it.

| ❌ never in a `.vue` file | ✅ where it goes |
|---|---|
| the widget tree (`new Column([...])`) | a plain `.ts` module |
| window options (title, size, `fitContent`) | same module |
| button callbacks, content, layout | same module |
| a window `<div>`, a `v-if`, a `<FloatingWindow>` | nowhere. Ever. |

**Why this matters more than it looks.** The window system is vanilla by construction — it imports
no framework, so it ports to React/Lit/anything for free. **The moment a window's definition sits in
`App.vue`, that window does not port.** You'd have preserved the engine and thrown away every actual
window. The value of "framework-agnostic" is not in the `WindowLayer`; it is in *the windows*.

It also has a plain day-to-day payoff: **adding a window touches zero markup.** No template edit, no
`v-if` flag, no ref. You write a module and call it.

*(This drifted once already: the Lorem tree was written inline in `App.vue` and had to be moved out.
It reads as harmless — it is one function — which is exactly why it needs a rule and not judgement.)*

### Opening a window at STARTUP: `windows.whenMounted(fn)`

A window cannot open before the app has donated the box — `open()` throws if the layer has no frame
to put it in. So anything that wants to be up when the editor starts **queues** instead of racing
Vue's `onMounted`:

```ts
windows.whenMounted(() => openKeypadWindow(windows))   // runs the moment there IS a box
```

The alternative was for the opener to *be* the third line of `App.vue`, and the whole point of the
section above is that there is no third line. If the layer is already mounted, `fn` simply runs now.

---

## The first real panel: the Keypad (`src/windows/keypad/`)

The Lorem window proved the system worked; the **Keypad** is the first window that is actually *for*
something, and it is the pattern to copy. Three files, zero Vue:

| file | what it is |
|---|---|
| `keypadLayouts.ts` | **data only.** `KEYPAD_PAGES` — pages of 17 cells in reading order, each with the numpad key it sits on, an action name, an icon, how it LIGHTS, and (for a wired key) the model value it carries. No DOM. |
| `KeypadWidget.ts` | one `Widget` that builds the current page's grid, turns pages (the `+` key / numpad `+`), and paints each key from the right source (see the seam below). |
| `index.ts` | `openKeypadWindow()` + the Ctrl+Alt+K toggle. |

Three things it established that the next panel will want:

- **A panel that is a picture of state.** The lit keys ARE the panel's reason to exist — this
  duration, this accidental, these articulations. *What* a key's light means (exclusive-and-always-on,
  exclusive-or-none, independent, or no light at all) is declared **per cell in the data**, not coded
  per button, so the rules stay a column of a table.
- **Its own DOM, not new toolkit widgets.** A 4×5 grid with merged keys is not new layout
  *vocabulary*; it is one panel that happens to be shaped like a numeric keypad. See the toolkit
  warning below. *If a SECOND window ever wants a grid of icon keys, that is when `Grid` moves into
  the toolkit — with the Keypad as its first client, not before.*
- **A widget may tighten the box it is handed** (`host.style.padding`, `overflow`) — the containers
  already do this. It still never asks *where* that box is. Rule 3 holds.

### Connecting a Vue-free panel back to the editor: the seam

The Keypad is no longer only a picture — its keys drive the score (select mode, note duration,
accidentals). But a `windows/` module **must not import Vue** (`lint:boundary`), and it cannot watch a
Vue ref. So the connection is a plain-TS **observable in `interactions/`** that App.vue mirrors the
reactive `EditorState` into and out of. The panel imports the store, never Vue; App.vue is the only
place the two worlds touch.

Two shapes, by need:

- **`toolMode`** — a single value both sides agree on (entry ↔ selection). App.vue `watch`es the
  reactive tool into it and `subscribe`s back out; `set` short-circuits on no change so the round-trip
  can't loop.
- **`PaletteSelection<T>`** (`durationSelection`, `accidentalSelection`) — a palette value is *two*
  things, so it has **two channels**: **HIGHLIGHT** (which value to light, nullable — a pure mirror of
  state, for the lit key) and **PRESS** (a command that ALWAYS fires — the user hit this key). The
  press channel exists because an accidental *toggles off*: re-pressing the armed value is a real
  event that a state-mirror's "no change" guard would swallow. Because the mirror only ever touches
  HIGHLIGHT and a key press only ever fires PRESS, a Keypad press and a Vue-palette click stay
  distinct — the action never double-applies, and no guard is needed. App.vue routes a press out
  through the palette's own `setDuration`/`setAccidental`, the SAME method the Vue button calls, so
  both drive the identical path.

One thing lives on the Vue side *for now*: the RULE for **what to highlight** (a value is shown only
in entry mode, or in selection mode with a note selected — never when nothing/​a non-note is selected)
is a `computed` in App.vue, read by both the Keypad (via the mirror) and the Vue palette buttons. When
the Vue palette eventually retires, that rule moves into `interactions/` and the panel is unchanged.

### ⚠️ `fitContent` resizes through `setSize`, which clamps to `minWidth`

The trap, and it cost real time: the Keypad is 149px wide, the DEFAULT `minWidth` is **160**. The
window silently came out 11px too wide and every one of those pixels landed on one side of the grid,
which looks exactly like a padding bug and is not one. **A window narrower than the defaults must
declare its own `minWidth`.** (The defaults are written for a dialog; a panel is not a dialog.)

## The dialogs: Clef and Time Signature (`src/windows/clefWindow.ts`, `timeSignatureWindow.ts`)

Both are Sibelius-shaped, and both were built LOOK-FIRST — drawn, argued over, and only then wired.
The shape of a dialog is itself a decision (which options exist, and which are grouped), and it is
cheaper to argue with a picture than with a wired feature.

Three conventions they share, worth copying into the next one:

- **`center: true`, not the cascade.** A dialog you summoned belongs where you are already looking.
  The layer centres it AFTER `fitContent` has settled the height, then clears the flag — centring is
  an OPENING act, never a standing rule that fights a drag.
- **They ARM; they do not place.** OK arms the clef/meter and closes; the next click on the score
  says WHERE, through the same placement path the palettes used. What travels with it are the
  properties of the change about to be made (a meter's grouping and symbol, the courtesy decision,
  the pickup) — none of which has anywhere else to wait until the target bar is known.
- **The arming method is NOT the palette's toggle.** `armClef`/`armTimeSignature` are idempotent;
  `setClef`/`setTimeSignature` toggle, because a palette button is its own indicator and re-pressing
  the lit one means "off". Routing a dialog's OK through the toggle made confirming the
  already-armed value silently disarm it.

A window that opens another (Time Signature → Beam and Rest Groups) just calls the opener; the value
being edited stays with the window that will COMMIT it, and the child is only an editor for it.

## What goes inside: widgets

A window holds **one** child. To get a tree, that child is a **container** that holds more. Every
node in the tree — window child, grid cell, row item — satisfies the same three-line contract, which
is why they nest with no special cases:

```ts
interface Widget {
  mount(host: HTMLElement): void   // you are handed a box; fill it
  destroy?(): void                 // the window closed; release anything outside your own subtree
}
```

The vocabulary, and it is meant to stay this short:

| | |
|---|---|
| `Column`, `Row` | children stacked / laid out, with a `gap` and one optional `grow` child |
| `Columns` | equal side-by-side cells, each independent — one can scroll while another doesn't |
| `GroupBox` | a bordered frame with a caption — says "these controls are one idea", which a gap cannot |
| `ScrollText`, `Label`, `Button`, `TextInput` | the leaves. `Button` takes an `onClick` callback and knows nothing about what it is for |
| `Checkbox`, `RadioGroup`, `Select`, `NumberInput` | the form controls a dialog needs. **Native `<input>`s tinted with `accent-color`** — a hand-drawn checkbox re-implements focus, keyboard toggling and the label hit-target, and gets each slightly wrong. Only the colour is ours |
| `ChoiceList`, `GlyphSelect` | pick ONE from drawn things: a scrolling box of pictures (clefs), and a dropdown whose rows are glyphs (note values) |

Those last two arrived with the Clef and Time Signature dialogs and are the toolkit's answer to a
recurring shape — "choose a notation" — which is why they know no music: the caller draws the rows
and names their values.

A Save window is then assembled, not written:

```ts
windows.open({
  title: 'Save', width: 380, height: 150, resizable: false,
  content: new Column([
    new Label('File name'),
    name,                                            // a TextInput
    new Row([new Button('Cancel', () => w.close()),
             new Button('Save', () => save(name.value), { variant: 'primary' })],
            { align: 'end' }),
  ], { grow: 1 }),
})
```

Nothing in that tree measures itself or asks where it is — rule 3, doing real work rather than
sitting there as a principle. Resize the window to its floor and every widget still behaves.

### A dialog is not a menu, and a dropdown is not either

`GlyphSelect` began as a button that opened the MENU layer, and that was wrong twice over. A menu is
a list of COMMANDS; a dropdown is a picker with a CURRENT VALUE, which must be visible the moment
the list opens and must move under the arrow keys — and `MenuItem` deliberately refuses checkmarks
and radio groups, so the one thing a dropdown needs is the one thing that type is designed not to
have. Its row metrics are tuned for the score's context menu too, so the list came out mis-sized
inside a window. **One object owns its field and its list.**

### Dialog keys: `onCancel` and `onAccept`

Escape and Enter are window OPTIONS, not something each dialog wires by hand:

```ts
windows.open({ …, onCancel: () => win.close(), onAccept: accept })
```

Callbacks rather than an `escapable` / `defaultButton` flag, for the reason the whole file argues:
Escape means "close" to a dialog, "step back" to a wizard, "revert" to an editor; a flag could only
ever have named one of them. Each key goes to the **frontmost window that CLAIMS it** — the standing
panels (Keypad, Properties) declare neither, so Escape over the score still means deselect while
they are up, and raising a panel above a dialog does not steal the dialog's keys.

⚠️ The layer listens on `document` in the CAPTURE phase, so the editor's own Escape cannot beat it —
which also means it runs before any handler a control INSIDE a window could register. A control that
owns the keyboard while it is open (a dropdown: Enter chooses a row, Escape shuts the list) marks
itself `data-owns-keys` and the layer stands down. It cannot wait to be told; it has to ask.

### ⚠️ The toolkit STAYS TINY — this is the failure mode to fear

This is exactly the road on which people accidentally rebuild React: add layout, then events, then
data binding, then form state, and eighteen months later you have a worse Vue that only you maintain.

The discipline that prevents it:

- **Widgets are dumb DOM builders.** No reactivity, no data binding, no layout engine, no lifecycle
  beyond `mount`/`destroy`.
- **The vocabulary above is close to complete.** Add a widget only when a *third* window needs the
  same thing. The toolkit earns its keep on what REPEATS.
- **Anything genuinely complicated does not get a widget.** It gets a framework component mounted
  into the box — that is what the `mount(host)` contract is *for*, and it is the one place a
  framework is allowed to touch the window system. A Vue `<Teleport>` into the host today; a React
  `createPortal` tomorrow.

---

## Pure JS, because the DOM is not a framework

> "Framework-agnostic" has never meant "no DOM". It means **no Vue**.

So the window **chrome itself is vanilla DOM** — `document.createElement` for the frame, title bar
and resize handles; direct `style.transform` / `width` / `height` writes while dragging; `remove()`
on close. It imports no framework, therefore **there is nothing to port**: it runs unchanged in a
React, Lit, or hand-rolled app.

Built, and all of it under `npm run lint:boundary`, so Vue cannot leak in:

| file | what it is |
|---|---|
| `Window.ts` | the class you instantiate and hold. Properties + its own geometry. No DOM. |
| `WindowManager.ts` | only what one window can't know: who else is open, who's on top, how big the world is. No DOM. |
| `WindowLayer.ts` | the DOM. Builds the frame, drags it, removes it. No framework. |
| `index.ts` | the app's one layer instance, so any plain-TS module can open a window. |
| `content/Widget.ts`, `layout.ts`, `widgets.ts` | the widget contract, the containers, the leaves. |

`App.vue` holds two lines of it: `windows.mount(scoreViewport)` and `windows.destroy()`.

Two things fall out of that:

- **Dragging is faster this way.** Direct style writes on `pointermove` never go through a reactive
  system. The slur handles and the staff-spacing drag already work exactly like this.
- **The geometry is pure and testable.** Drag delta → clamped position, resize from an edge or
  corner, bring-to-front, z-order: plain functions over plain state, no browser needed. `lint:boundary`
  keeps the framework out.

`App.vue` gains **one line** — mounting the layer — and never mentions a window again.

### Why not WinBox.js?

It's the good vanilla floating-window library (no deps, ~10 kB, genuinely framework-agnostic) and we
still shouldn't use it. What it gives is exactly **the cheap part** — drag, resize, z-order, minimize.
What it charges is that a **third-party** library now **owns that DOM**: its elements, its theming,
its lifecycle, sitting in the middle of the one layer we're trying to keep replaceable. Bad trade for
a few hundred lines of geometry we can unit-test.

Per [[feedback_prefer_library_primitive_and_proportionate]], the question is "does the library
already do it?" — here the answer is *yes, and the doing is the easy half.* (The judgement flips for
docking, which is why that one gets bought if it's ever wanted.)

---

## If docking is ever wanted, what does the move cost?

Two things, and only two. Neither is work to do *now* — this section exists so we don't accidentally
make them expensive.

**1. It costs nothing on the content side — if rule 3 held.** Content that never asked where it was
doesn't care that geometry is suddenly computed by a tree instead of stored in a rectangle. The move
is then: drop in Golden Layout (or dockview core), hand it the same content, throw away the rectangle
list. **Building the cheap floating thing correctly _is_ the preparation** — there is no separate
prep task to schedule, and nothing to build ahead of time. There is only rule 3.

**2. It would eat `VIEWPORT_HEIGHT`.** This is the one genuine coupling. The score viewport is a
fixed height computed from `VIEWPORT_LINES` staff lines (`engine/rendering/layoutConfig.ts`). A
*docked* score is "whatever space is left over" after the docked things take their bites, so its
height would come from the layout, not from a constant. **Floating windows never ask this question**
— they *cover* the score, they don't *displace* it.

Nothing to do now. If we ever touch that constant again, the cheap hedge is to treat the viewport
height as **an input the app supplies to the renderer**, not something the renderer decides for
itself. Then the app supplies a constant today and a layout-derived number later, and the renderer
never knows the difference.
