# Framework-agnostic reactive `EditorState` — proposal

**Status:** proposed, not started. This is a sketch to judge cost, not a committed plan.

## Why

The Keypad (`src/windows/keypad/`) now *drives* the score as a co-equal peer of the Vue
palette — duration, accidental, articulation, dot, tie, select-mode all route through the same
`PaletteController` methods the Vue buttons call. But it is **not independent of Vue**, and the
reason is narrow and specific:

- `EditorState` (the *type*) is framework-agnostic — a plain interface + `createEditorState()`
  factory in `interactions/`, no Vue import.
- But the live instance the whole app runs on is `reactive(createEditorState())`, minted in
  `App.vue`. The **change-notification** — the thing that says "selection changed, go update the
  Keypad" — is Vue's, wrapped on in `App.vue`.

So the Keypad's read-sync (reflecting the selected note's state as lit keys) flows entirely
through `App.vue` `watch`es, and its press-routing through `App.vue` `onPress` handlers. Delete
`App.vue` and the Keypad goes stale. The dependency is not the **state** (portable) — it is the
**"who tells you it changed"** (Vue, today).

Goal: give the state its **own** reactivity instead of renting Vue's, so plain-TS code can observe
changes directly and the Vue palette becomes *one subscriber among many* rather than the
load-bearing reactivity engine.

## The constraint that shapes the design

One `state` object must serve **both** worlds during the transition:

1. **Vue auto-tracking** — every existing `computed` / template / `watch` keeps working *untouched*.
   Vue re-runs a computed because it read `state.x`; that must keep happening.
2. **A framework-agnostic "it changed" signal** — a `subscribe(fn)` plain-TS can consume.

This rules out most designs. In particular it rules out an explicit `store.set('key', v)` mutator
(the repo's `toolMode.set` idiom): Vue only fires its dependents when you write *through its
proxy*, so a `set()` writing to a plain underlying object leaves Vue templates stale — unless
`set()` writes through the Vue proxy, which drags Vue into the framework-agnostic store. The two
fight. The only object that can be written naturally, wrapped by Vue, **and** emit its own events
at once is a **Proxy**.

## The design: an emitting Proxy

The state grows the same `get`/`set`/`subscribe` shape the repo's stores (`toolMode`,
`PaletteSelection`) already use — without importing Vue.

```ts
// interactions/EditorState.ts — still framework-agnostic, still no Vue import
type StateListener = (key: keyof EditorState) => void

export interface ObservableEditorState {
  state: EditorState                       // read & write it exactly as today
  subscribe(fn: StateListener): () => void // the framework-agnostic "it changed"
}

export function createObservableEditorState(): ObservableEditorState {
  const raw = createEditorState()                 // the plain object, unchanged
  const listeners = new Set<StateListener>()
  const state = new Proxy(raw, {
    set(target, key, value) {
      const changed = target[key as keyof EditorState] !== value
      Reflect.set(target, key, value)
      if (changed) for (const fn of listeners) fn(key as keyof EditorState)
      return true
    },
  })
  return {
    state,
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  }
}
```

That Proxy **is** the framework-agnostic reactivity.

### Vue keeps working — one line changes

```ts
// App.vue — the ONLY change on the Vue side
const { state: observable, subscribe: onStateChange } = createObservableEditorState()
const state = reactive(observable)   // Vue wraps the emitting proxy
```

A write from anywhere — `this.state.selectedNoteId = id` — now travels: Vue's set trap →
`Reflect.set(myProxy, …)` → **my** set trap (writes raw **and** emits) → Vue triggers its own
dependents. Both worlds fire from one assignment. Every existing computed, `watch`, and template
keeps auto-tracking, untouched.

### The Keypad sheds its App.vue dependency

The read-sync moves from `App.vue` `watch`es into a plain-TS module subscribing to `onStateChange`:

```ts
// interactions/keypadSync.ts — framework-agnostic, NOT App.vue
export function wireKeypadSync(state: EditorState, palette: PaletteController,
                               subscribe: (fn: StateListener) => () => void) {
  const sync = () => {
    durationSelection.setHighlight(noNoteInSelection(state) ? null : state.selectedDuration)
    accidentalSelection.setHighlight(noNoteInSelection(state) ? null : state.selectedAccidental)
    dotSelection.setHighlight(dotHighlight(state))
    palette.refreshArticulationSelection()
    palette.refreshTieSelection()
  }
  sync()                    // prime
  return subscribe(sync)    // fire on every state change — cheap: every setX short-circuits
}
```

Firing all of it on *any* key change is fine — each `setHighlight`/`refresh` short-circuits on
no-change. If it ever needs to be tighter, `subscribe` can take a key filter (measure first). The
`noNoteInSelection` / `highlighted*` rules move out of `App.vue` computeds into this module, where
they belong. The press routes (`onPress`) likewise register here / where `PaletteController` is
built, not in `App.vue`.

### Concrete before/after — the dot control

```
BEFORE (App.vue owns the sync):
  const highlightedDot = computed(() => noNoteInSelection() ? null : state.selectedDots<1 ? null : 'dot')
  watch(highlightedDot, d => dotSelection.setHighlight(d), { immediate: true })
  const stopDotPress = dotSelection.onPress(() => palette.toggleDot())

AFTER (interactions/ owns it; App.vue holds nothing about dots):
  // in keypadSync.sync():  dotSelection.setHighlight(dotHighlight(state))
  // press route registered where PaletteController is built, not in App.vue
```

## The payoff: the Proxy is permanent, Vue is the temporary layer

The emitter is not scaffolding to throw away — it is the end-state reactivity. When Vue eventually
leaves, you **peel off one line** (`reactive(observable)` → just `observable`) and delete
`App.vue`'s watches/routes. `keypadSync` never changes, because it never depended on Vue — it
depended on `subscribe`, which is still there. Vue was just a subscriber that happened to also
render.

## Honest costs and limits

1. **Spike the `reactive(proxy)` composition FIRST.** The forwarding above is how Vue's handlers
   *should* behave, but proxy-under-proxy has edge cases (identity / `toRaw`, `has`,
   `deleteProperty`). ~20 lines and one test settle whether it holds before anything is built on
   it. This is the one thing that can invalidate the whole approach; settle it cheaply.
2. **Nested mutations don't emit.** `state.selectedItems.set(…)` (a `Map`) or writing a field
   *inside* `selectedMeasureRange` mutates a nested object — the top-level `set` trap never sees
   it, so no event fires. Top-level assignments (`selectedNoteId`, `selectedDots`, `selectedTool`,
   the anchor recompute) all emit fine, which covers what the Keypad reflects — but it is a real
   edge to document, not a silent bug to discover later.
3. **It is coarse, not auto-tracked.** Plain-TS subscribers get "a key changed," not Vue's "this
   computed depends on this field." That is fine here (cheap, short-circuiting refreshes) — it is a
   change-notification, deliberately small. Do not mistake it for a general Vue-reactivity
   replacement; the point is NOT to rebuild React.
4. **It is a project, not an edit.** The Proxy + `keypadSync` is ~a day. Moving *every* control's
   sync off `App.vue` and proving parity is the longer tail — but incremental: one control at a
   time, the `App.vue` watch deleted as each moves.

## Recommendation

- **Spike #1 first** (the composition test) as a standalone throwaway — it is the gate.
- If it holds, land the Proxy + `keypadSync` for the five already-wired controls (duration,
  accidental, articulation, dot, tie). That is the real cord-cut demo, and proves the seam before
  porting the remaining controls (clef / time signature / dynamics / tempo / tuplet / beam / rest)
  onto the Keypad's later pages.
- Leave the rest of the migration as follow-on.

## Related

- `docs/ARCHITECTURE.md` — the framework-agnostic boundary (`App.vue → composables → interactions →
  engine`), enforced by `npm run lint:boundary`.
- The existing store seams this generalises: `interactions/toolMode.ts`,
  `interactions/paletteSelection.ts`, `interactions/paletteToggleSet.ts`.
