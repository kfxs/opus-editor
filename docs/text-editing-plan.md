# In-Canvas Text Editing — Plan

Status: **BUILT (2026-06-10) — pending user's manual UI pass.** All checklist items (§9) are
implemented and unit-tested (575 tests green, `build:check` clean); nothing committed yet. Scope of
this pass: let the user **edit a custom-text
dynamic in place on the score** with a seamless, framework-agnostic text editor. Designed so two
future features slot in **without rework**: (1) a **style / property window** to restyle text, and
(2) an eventual **Sibelius-grade** experience (live mixed bold-dynamic-glyph + italic-word typing).
Those two are *designed-for, not built here*.

This supersedes the "in-place edit deferred — custom text = 'Text' placeholder" note in
`docs/dynamics-plan.md`.

---

## 1. Goal (this pass only)

Double-click a custom-text dynamic (`kind:'text'`) → a **caret appears on the score at the mark**,
the underlying engraved text is hidden, and you type/backspace/edit ordinary text that looks
identical to the score text. Enter / click-away commits; Escape cancels. Placing a *new* text mark
drops straight into this editor instead of the current `"Text"` placeholder.

**Out of scope now (but the design must not preclude):** styling controls, multi-line, the
`p/mp/mf/f` bold marks (left exactly as-is — palette-only, not editable yet), and live music-font
substitution while typing.

---

## 2. Decisions locked (from discussion)

1. **Mechanism: DOM-overlay editor, made visually seamless** — a transparent, font-matched editable
   DOM element positioned exactly over the mark; the real glyph is hidden during edit. The browser
   gives us the caret, backspace, arrows, selection, clipboard, Unicode for free. *Not* a hand-rolled
   in-SVG caret. (Cheap way; user approved on the conditions: aligned, original hidden, no visible
   difference.)
2. **Only `kind:'text'` is editable now.** Double-clicking a `level` mark (`p/mp/mf/f`) does nothing
   yet. (Future: a level *picker*, not a text caret — see §7. User explicitly wants to edit those
   later.)
3. **Framework-agnostic.** All logic lives in a controller under `src/interactions/`; only a thin Vue
   bridge in `src/composables/`. Direct DOM/SVG manipulation is fine — it's *framework* coupling
   (Vue refs/components) we avoid, not the DOM. (See memory: framework-agnostic port.)
4. **A generic "editable element" frame**, with the text editor as its first consumer — so lyrics /
   technique / tempo text and the future level picker reuse the same double-click → edit → commit →
   re-render skeleton.

---

## 3. Why this is clean here (codebase precedent)

- **Mode separation is already free — verified.** `ShortcutManager.handleKeyDown`
  (`src/shortcuts/ShortcutManager.ts:81`) skips every music shortcut when focus is in an editable DOM
  node: `isInInput` covers `<input>`, `<textarea>`, and `target.isContentEditable` (`:84`), gated by
  `allowInInput` (`:113`). Crucially, `ShortcutManager` is the **only** global `keydown` listener
  (`:56`); note-entry letters route *through* it — `'a'..'g'` → `enterNoteA..G` (`ShortcutConfig.ts:194`)
  → `keyboard.enterNoteByLetter()` (`useShortcuts.ts:176`) — and `KeyboardController` has **no listener
  of its own**. So while a focusable `contentEditable` overlay holds focus, **note-entry keys
  (a–g, r, t, x, …) are automatically suppressed** with *no new code*. Same mechanism the custom-TS
  dialog relies on.
- **Position is known; font must be sourced deliberately.** Each placed dynamic is registered in
  `ElementRegistry` with an SVG-space `bbox` (`VexFlowRenderer.registerDynamics`, `:1448`; the click
  hit-test that reuses it is `MouseController.ts:214`). **Caveat:** `getDynamicSVGGroup(id)` (`:2261`)
  returns only the SVG *group* — the annotation's resolved `fontInfo` is **not** publicly exposed (it's
  read internally in the ghost path, `:2428`). So `getFontCSS()` cannot just "copy the annotation font."
  Source it one of three ways (in order of preference): (a) return the known constants directly —
  `DYNAMIC_TEXT_FONT` / `DYNAMIC_TEXT_SIZE` / `style:'italic'` from `buildDynamicAnnotation` (`:458`),
  which also lines up with the future `textStyle` field; (b) read `getComputedStyle` off the group's
  `<text>` node; (c) add a small `getDynamicFontInfo(id)` accessor. Plan uses (a).
- **Commit path exists, but does NOT re-render.** `MusicEngine.updateDynamic(id, { text })` (`:359`)
  updates the model + saves undo + refreshes the playback score — it does **not** call `renderScore`;
  the MouseController caller does that today. So `source.commit()` must invoke the render callback
  itself (don't assume the engine redraws).
- **No double-click is wired yet.** The canvas div only has click/mousedown/move/up/leave
  (`App.vue:368`); `@dblclick` must be added → a new `MouseController.handleDoubleClick`.

---

## 4. Architecture

### 4.1 State (`EditorState`)
Add a single field marking that text editing is active. Add it in **both** places: the `EditorState`
interface *and* the `createEditorState()` factory default (`EditorState.ts:74`) — easy to miss the
factory.
```ts
editingText: { targetId: string; kind: 'dynamic'; isNew: boolean } | null   // null = not editing
```
While non-null: the ghost cursor / note preview are suppressed **and** `handleClick` /
`handleMouseMove` early-return (see §5.4 — this is what stops a stray mark on commit-click). `kind` is
a discriminator so the same field serves future text types (`'lyric'`, `'technique'`, …) without a new
field each time. `isNew` carries the empty-text rule's "just placed vs existing" signal to the source.

### 4.2 The generic frame — `EditableTextSource`
A tiny interface that decouples *the editor* from *what is being edited*. The text editor knows
nothing about dynamics:
```ts
interface EditableTextSource {
  getText(): string                       // current text to seed the editor
  getScreenRect(): { x; y; width; height }// where to place the overlay (page coords)
  getFontCSS(): { fontFamily; fontSize; fontStyle; color }  // to match the engraving
  commit(text: string): void              // write back to the model (+ re-render)
  cancel(): void                          // restore, no change
  hideOriginal(hidden: boolean): void     // toggle the underlying glyph's visibility
}
```
Dynamics supply a `DynamicTextSource` implementation (reads/writes `Dynamic.text` via
`engine.updateDynamic`; rect from registry bbox + container offset; font from the annotation). Future
text types each supply their own — the controller is untouched.

### 4.3 The editor — `TextEditController` (`src/interactions/TextEditController.ts`)
Framework-agnostic, vanilla DOM. Responsibilities:
- `open(source: EditableTextSource)`: create the overlay element, seed text, position + font-match,
  `source.hideOriginal(true)`, focus, place caret.
- Handle **commit** (Enter / blur / click-away) → `source.commit(value)` then `close()`.
- Handle **cancel** (Escape) → `source.cancel()` then `close()`.
- `close()`: `source.hideOriginal(false)`, remove overlay, clear `state.editingText`.
- **Commit re-renders.** `MusicEngine.updateDynamic` does *not* redraw (§3), so `source.commit` ends by
  calling the render callback. `cancel` only needs `hideOriginal(false)` — no model change, no redraw.
- **Stay modal — no re-render mid-edit.** Between `open` and `commit`/`cancel`, nothing should call
  `renderScore`: a re-render rebuilds the dynamic's SVG group, orphaning the `opacity:0` hide and
  leaving the overlay geometry stale. The `editingText` guard in §5.4 keeps the canvas handlers quiet;
  just don't trigger a redraw from elsewhere while editing.
- **Empty-text rule:** committing empty text deletes a *newly placed* mark (a blank dynamic is
  meaningless) and, for an *existing* mark, is treated as cancel (keep prior text). The source reads the
  `isNew` flag (threaded via `state.editingText`, set by the place-new path in §5.2) to tell the two
  apart. Encapsulated in the source's `commit`, not the controller.

**Overlay substrate:** a `contentEditable` `<div>` (not `<input>`). Today it holds a single italic
run — behaves like a one-line text box — but `contentEditable` is the **growth path** to per-character
fonts (the Sibelius mixed bold-glyph + italic case) and to style spans, with no substrate swap later.
It also already trips `isInInput` for the shortcut guard.

### 4.4 Vue bridge — `src/composables/useTextEditing.ts`
Thin adapter mirroring `useKeyboardEntry.ts`: constructs `TextEditController` with ref-getters and the
render callback. No logic.

---

## 5. Interaction flow

### 5.1 Edit existing — double-click (selection tool)
`@dblclick` on canvas → `MouseController.handleDoubleClick(e)` → `textDynamicIdAt(x,y)` (bbox hit-test +
`kind:'text'` check). If a text mark is hit → build a `DynamicTextSource` (`isNew:false`) →
`textEdit.open(source)`. A single click **always uses the active tool** (do NOT reserve text-mark clicks
for editing — an earlier attempt at that was rejected: with a tool selected, clicking must use the
tool). So double-click editing is cleanest in the **selection** tool, where single clicks just select.

### 5.2 Place new — drop default text, do NOT auto-open the editor
In `MouseController.handleClick`, the `'text'` dynamics tool drops a `DEFAULT_DYNAMIC_TEXT` (`'Text'`)
mark and re-renders — it does **not** open the editor (user request: "just drop the default text").
Editing is always via double-click afterwards (§5.1). A real default (not empty) guarantees a visible,
hit-testable bbox — an empty mark may register no bbox, which silently breaks the double-click hit-test.

### 5.3 Commit / cancel
As in §4.3. Commit re-renders via the render callback (the engine path does *not* redraw on its own).

### 5.4 The commit-click guard (don't plant a stray mark)
Click-away-to-commit fires a canvas `click` after the overlay closes. Two defenses, both implemented:
- **`DomTextEdit` swallows the click in capture phase** (primary): an outside `mousedown` commits and
  registers a one-shot capture-phase `click` swallower, so the trailing click never reaches the canvas.
- **`handleClick` / `handleMouseMove` / `handleMouseDown` early-return while `state.editingText` is
  non-null** (belt): any in-flight canvas event during edit is ignored, and the hover ghost is
  suppressed.

---

## 6. Visual seamlessness (the "not noticeable" requirement)

- **Geometry (the container scrolls — don't just add an offset).** The registry bbox is in SVG user
  space, and `score-container` is `overflow-auto` (`App.vue:367`), so a naive "add the container's page
  offset" breaks the moment the score is scrolled or zoomed. Reuse the existing transform instead:
  `MouseController.clientToSvg` already maps client→SVG via `svg.getScreenCTM().inverse()`; run it
  **forward** (`getScreenCTM()`, no inverse) to map the bbox's SVG corner → screen px, and position the
  overlay `fixed` at those client coords. This is scroll/zoom-correct for free. Width can grow with
  content; anchor by the mark's left/baseline.
- **Font:** copy `font-family`, `font-size`, `font-style: italic`, and `color` from the annotation's
  resolved `fontInfo` so the typed glyphs match the engraving.
- **Hide the original — by NOT rendering it (implemented).** CSS-hiding the annotation group proved
  unreliable in practice (doubled text persisted). Instead the renderer **skips the suppressed dynamic**:
  `engine.setSuppressedDynamicId(id)` → re-render → the glyph isn't drawn at all; restore with
  `setSuppressedDynamicId(null)` + re-render on close. Robust by construction — nothing to see through.
  Caveat this creates: suppressing removes the mark's bbox from the registry, so the overlay position
  must be **snapshotted before** the suppress-render — `DynamicTextSource` caches its screen rect in its
  constructor (see §4.3's "no re-render mid-edit" is relaxed to "exactly one suppress-render on open,
  using a pre-captured rect").
- **Chrome-free:** transparent background, no border/outline, caret visible. Styling lives in the
  engine-owned `notation.css` (where the ghost/selection styles already moved), so it travels across
  frameworks.

---

## 7. Future extension points (designed-for, NOT built now)

- **Style / property window.** Add an optional `Dynamic.textStyle?: { fontFamily?; size?; italic?;
  bold?; color? }`. The renderer reads it (absent = current italic default); the property window
  writes it via `updateDynamic`; the overlay reads it via `getFontCSS()` so editing reflects the chosen
  style. Backward-compatible (optional field). **Nothing to build now beyond leaving the field room.**
- **Sibelius-grade live mixed-font.** The `contentEditable` substrate is the growth path. Adding a
  token-substitution layer (recognized dynamic letters → music-font spans, live as you type) and/or a
  parse-on-commit step (leading dynamic tokens → real glyphs + italic remainder) plugs in at the
  source's `commit`/the editor's input handler. The data model would grow toward a mixed "text run"
  then; the **`EditableTextSource` seam is exactly where that lands** — the controller stays put.
- **Editing the bold `p/mp/mf/f` marks.** Same double-click frame, but the source opens a **level
  picker** widget instead of the text caret (these are fixed music-font symbols + playback meaning, not
  free text — re-rendered genuinely by VexFlow, so always pixel-perfect). Shares open/commit/close;
  different widget. (User wants this later.)
- **Other text types** (lyrics, technique "pizz."/"arco", tempo words): each is a new
  `EditableTextSource`; the `TextEditController` is reused unchanged.

---

## 8. Testing

- **Unit (jsdom or pure):** `TextEditController` state transitions (open → commit, open → cancel),
  the empty-text rule, and that `editingText` is set/cleared. Source-side: `DynamicTextSource.commit`
  calls `updateDynamic` / deletes on empty.
- **Manual (user-run):** double-click a text dynamic → edit → Enter commits, Escape reverts,
  click-away commits; place a new text mark → type immediately; empty + Enter removes it; confirm
  note-entry keys do nothing while the caret is active; confirm the overlay is visually flush with the
  engraving.

---

## 9. Progress

- [x] `EditableTextSource` interface + `editingText` field (`{ targetId; kind; isNew }`) — in the
      interface **and** `createEditorState()` default (`EditorState.ts`)
- [x] `TextEditController` (open / commit→render-callback / cancel / close, empty-text rule via `isNew`,
      no re-render mid-edit). DOM split behind injectable `TextEditDom`; real impl `DomTextEdit.ts`
- [x] `DynamicTextSource` — rect via forward `getScreenCTM()` (scroll-correct); font from the
      `DYNAMIC_TEXT_*` constants (extracted to `engine/rendering/dynamicStyle.ts`); `commit`→
      `updateDynamic` + render / delete-on-empty-when-`isNew`. New `getDynamicById` on ScoreModel+engine
- [x] `@dblclick` wiring + `MouseController.handleDoubleClick` (hit-test text dynamics, selection tool)
- [x] New-placement opens the editor + **disarms `selectedDynamic`** (replaces the `"Text"` placeholder)
- [x] `editingText` guard: `handleClick` + `handleMouseMove` + `handleMouseDown` early-return while
      editing. Plus `DomTextEdit` swallows the commit-click in capture phase (the real defense)
- [x] Seamless styling (font-match, hide original via `opacity:0`, chrome-free) in `notation.css`
      (`.text-edit-overlay`)
- [x] Vue bridge `useTextEditing.ts` (+ threaded through `useMouseInteraction` / `App.vue`)
- [x] Unit tests (`TextEditController.test.ts`, `DynamicTextSource.test.ts` — 14 cases). **Manual UI
      pass still owed by the user** (see §8).
