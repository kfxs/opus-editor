# Rest hide/show plan

Sibelius-style **Ctrl+Shift+H** to hide/show the selected rest(s). A *hidden*
rest is not removed — it is still real musical content (an empty beat must stay
filled), it just stops engraving as a normal black glyph. For now a hidden rest
renders in **gray** so the editor always shows it is there; a future "view
hidden objects" toggle can make it fully invisible (out of scope here).

## Settled decisions

1. **Shortcut**: `Ctrl+Shift+H` (verified against Sibelius — its "Hide or Show"
   toggle; `Ctrl+Shift+S` "show" is not mirrored). The ShortcutManager lowercases
   single keys, so the config key is `'Ctrl+Shift+h'` (like the existing
   `'Ctrl+Shift+z'`).
2. **Scope**: rests only. Notes / text / other elements are ignored (a future
   generalisation of the same compartment, not this plan).
3. **Multi-select**: each selected rest **toggles its own state independently**
   (true Sibelius "Hide or Show"), all in **one undo step** (`runBatch`).
4. **Gray shade**: `#9CA3AF` (Tailwind gray-400 family).
5. **Selection highlight**: a selected hidden rest highlights in its **voice
   colour** (the normal selection highlight wins over the gray), so it is
   obviously selected and obviously toggle-back-able.

## Why an engraving override (and why position-keyed)

Hiding is **presentation, not content** (DESIGN-PRINCIPLES: content ≠
presentation), so it belongs in the `score.engravingOverrides` compartment, not
on the slot. It is the exact twin of the existing **rest vertical-shift**
feature (client #5, `docs/rest-shift-plan.md`):

- Rests have **no durable id** — rest-fill mints fresh ids on every edit — so the
  override cannot hang off a rest id. It hangs off the rest's **position**:
  `restPositionKey(measureId, voice, beat)` = `{measureId}:v{voice}:b{num}/{den}`.
- It must **travel** with the music across rebar / paste / clipboard. The
  rest-shift's `captureRestShifts` / `restoreRestShifts` already walk exactly the
  rest positions we need, so we ride that same path rather than building new
  machinery.

This makes "rest hidden" **client #6** of the compartment. Presence of the
override = hidden; absence = visible (so JSON stays clean and absent ⇒ default,
the compartment's universal rule).

## Implementation (mirrors client #5 at every step)

### 1. Type — `src/types/music.ts`
New interface next to `RestShiftOverride`:

```ts
export interface RestHiddenOverride extends EngravingOverride {
  kind: 'restHidden'   // presence = hidden; no payload
}
```
Update the `EngravingOverrides` doc comment's "not every key is an element id"
note to mention client #6 is position-keyed too (already covers it generically).

### 2. Reader — `src/engine/models/engravingOverrides.ts`
Mirror `restShiftOverrideOf`, but project to a boolean:

```ts
export function restHiddenOf(score: Score, posKey: string): boolean {
  return !!engravingOverrideOf(score, posKey, 'restHidden')
}
```
(reuses the existing `restPositionKey`.)

### 3. Mutator — `src/engine/models/ScoreModel.ts`
Mirror `nudgeRestShift`, but a pure toggle (no accumulation):

```ts
toggleRestHidden(posKey: string): boolean {
  if (restHiddenOf(this.score, posKey)) {
    this.clearEngravingOverride(posKey, 'restHidden')
  } else {
    this.setEngravingOverride(posKey, { kind: 'restHidden' } as RestHiddenOverride)
  }
  return true   // facade owns the undo snapshot (saveOnly)
}
```

### 4. Travel — `src/engine/models/ScoreModel.ts`
Fold the flag into the existing rest capture/restore (one traversal, true twin):

- Widen `CapturedRestShift` → add `hidden?: boolean` (and make `steps` optional,
  or keep `steps: number` defaulting to 0). Capture an entry when the rest has
  **either** a shift **or** the hidden flag; clear both overrides on capture.
- In `restoreRestShifts`, after locating the destination rest (the existing
  "only if a rest of this voice starts exactly here" guard), re-stamp **both**:
  the `restShift` (if `steps !== 0`) and the `restHidden` (if `hidden`).
- Rename is optional; if the dual-purpose makes the names misleading, rename the
  pair to `captureRestEngraving` / `restoreRestEngraving`. Lean: keep the names,
  just extend — minimal churn, the methods already only touch rests.

### 5. Clipboard travel — `src/interactions/clipboard.ts` (+ `ClipboardController.ts`)
Mirror the `restShifts` payload field so copy/paste of a hidden rest keeps it
hidden (parity with the shift, which already travels this way):

- `ClipboardVoice`: add `restHidden?: Array<{ offset: Fraction }>` (offsets
  re-based to the window start, same basis as `events`/`restShifts`).
- Add a `restHiddenInWindow(...)` helper paralleling `restShiftsInWindow`,
  reading via `restHiddenOf`.
- `buildClipboardFromSelection`: populate it; include a lone hidden rest in the
  "usable" check (a hidden-only rest still copies).
- Plumb through `pasteEvents(..., clipRestHidden)` the same way `clipRestShifts`
  is plumbed (MusicEngine + ScoreModel signatures), routed into
  `restoreRestShifts`/`restoreRestEngraving`.
- *Optional / can be a follow-up*: if we want to keep this PR small, ship steps
  1–4 + 6 + 7 first (intra-document hide travels via rebar) and add clipboard
  parity second. Flag for the reviewer; rest-shift shipped clipboard parity in
  one go, so prefer doing the same.

### 6. Render gray — `src/engine/rendering/VexFlowRenderer.ts`

> ⚠️ **DO NOT use `StaveNote.setStyle` for this.** The first attempt did
> (`staveNotes[i].setStyle({ fillStyle, strokeStyle: HIDDEN_REST_COLOR })`) and
> the symptom was *the entire score rendered gray* — staff lines, stems, every
> note drawn after the rest. Root cause: VexFlow's `setStyle` writes `fillStyle`/
> `strokeStyle` into the **shared canvas/SVG drawing context** at draw time and
> never fully resets it, so the color **leaks onto everything drawn afterwards**.
> This is a general trap for any future "color one thing on the stave" work
> (a highlighted stem, a colored accidental, a hidden note). Use the post-render
> **DOM recolor** pattern instead — the same one ghost notes and the selection
> highlight already use.

Two leak-free pieces, both driven off `restHiddenOf`:

**a) The rest glyph** — after `registerSlotElements` (so `getStaveNoteSVGGroup`
is populated), recolor the hidden rest's own SVG group:

```ts
const HIDDEN_REST_COLOR = '#9CA3AF'

private recolorHiddenRests(slots: ChordRest[], measure: Measure, score: Score): void {
  for (const slot of slots) {
    if (slot.type !== 'rest') continue
    if (!restHiddenOf(score, restPositionKey(measure.id, slot.voice ?? 0, slot.beat))) continue
    const groupInfo = this.getStaveNoteSVGGroup(slot.id)
    if (!groupInfo) continue
    groupInfo.group.querySelectorAll('text, path').forEach((el) => {
      ;(el as SVGElement).setAttribute('fill', HIDDEN_REST_COLOR)
      ;(el as SVGElement).style.fill = HIDDEN_REST_COLOR
    })
  }
}
```

**b) The supporting ledger line** for an off-staff whole/half rest
(`drawRestLedgerLines`) — this one *is* safe to color via a VexFlow style
object because it is scoped inside the existing `ctx.save()` / `ctx.restore()`
pair (which restores the context), and we pass the style per-draw rather than
mutating the note:

```ts
const ledgerStyle = hidden
  ? { ...stave.getDefaultLedgerLineStyle(), strokeStyle: HIDDEN_REST_COLOR }
  : stave.getDefaultLedgerLineStyle()
```

The rest stays fully registered (`registerSlotElements`), so it remains
hit-testable and selectable to toggle back.

### 7. Facade — `src/engine/MusicEngine.ts`
Mirror `nudgeRestShift` (resolve id → posKey, no per-rest undo — the batch is
owned by the shortcut handler, see below):

```ts
toggleRestHidden(restId: string): boolean {
  const note = this.scoreModel.getNote(restId)
  if (!note || !note.isRest) return false
  const measure = this.scoreModel.getMeasure(note.measure)
  if (!measure) return false
  const key = restPositionKey(measure.id, note.voice ?? 0, note.beat)
  const hidden = !restHiddenOf(this.scoreModel.getScore(), key)
  this.scoreModel.toggleRestHidden(key)
  console.log(`[Rest] ${hidden ? 'hide' : 'show'} rest ${restId} (${key})`)
  return true
}
```
(No `saveOnly` here — the multi-rest batch in the handler owns the single undo
snapshot, matching how `deleteSelected` batches articulations.)

### 8. Shortcut — `ShortcutConfig.ts` + `useShortcuts.ts`
- `ShortcutConfig.ts`:
  ```ts
  'Ctrl+Shift+h': { action: 'toggleRestHidden',
    description: 'Hide or show the selected rest(s) (Sibelius-style)' },
  ```
- `useShortcuts.ts` — toggle **every selected rest** in one batch:
  ```ts
  toggleRestHidden: () => {
    const eng = engine.value
    if (!eng) return
    const restIds = [...state.selectedItems.values()]
      .filter(i => i.kind === 'note')
      .map(i => i.id)
      .filter(id => eng.getNote(id)?.isRest)
    if (!restIds.length) return
    eng.runBatch(`Hide/Show ${restIds.length} rest(s)`, () => {
      for (const id of restIds) eng.toggleRestHidden(id)
    })
    renderer.renderScore()
  },
  ```

### 9. Highlight (no change expected)
The selection highlight recolors the rest glyph in its voice colour inside the
rest's own SVG group (`HighlightController.highlightNote`, rest branch — the one
just fixed to raise its group to the DOM front). Both the gray (step 6a) and the
highlight are post-render DOM recolors of the same `text`/`path` elements; the
highlight runs **after** the gray recolor, so the voice colour naturally wins
while selected (it overwrites both `setAttribute('fill')` and `style.fill`).
Deselecting re-renders, which re-applies the gray.

## Tests
- `engravingOverrides` / `ScoreModel`: `toggleRestHidden` set→clear→set; key
  reduction (`2/4` vs `1/2`).
- Travel: a hidden rest survives a time-signature rebar that keeps a rest at that
  offset; is dropped when the new tiling has no rest there (benign, same rule as
  shift).
- Clipboard (if shipped in this PR): copy a hidden rest, paste elsewhere → still
  hidden.
- Facade: `toggleRestHidden` returns false for a non-rest / missing id.

## Out of scope (future)
- A global "View ▸ Hidden objects" toggle to switch hidden rests between gray and
  fully invisible.
- Hiding notes / text / other element kinds (generalise client #6 from
  position-keyed rests to id-keyed elements).
- A palette button for hide/show (shortcut-only for now).
