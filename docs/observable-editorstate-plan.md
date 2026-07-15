# Framework-agnostic reactive `EditorState` — proposal

**Status:** proposed, not started. This is a sketch to judge cost, not a committed plan.
**Analyzed against the source 2026-07-15** — the Vue set-handler trace and every state-writing
path in `interactions/` were checked; the mechanism holds and no invalidating flaw was found.
The findings are folded in below. The spike remains the gate.

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
      // Per-listener try/catch: the write has already landed by now, so one
      // throwing subscriber must not starve the others.
      if (changed) {
        for (const fn of listeners) {
          try { fn(key as keyof EditorState) }
          catch (e) { console.error('[EditorState] listener failed:', e) }
        }
      }
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

### Why the forwarding holds (traced through Vue 3's handlers)

Vue's `MutableReactiveHandler.set` runs `Reflect.set(target, key, value, receiver)` where
`target` is whatever was passed to `reactive()` — here, the emitting Proxy — so the emit fires
*inside* Vue's write, before Vue's own `trigger()`. Reads have no custom trap, so Vue's dependency
tracking (keyed on the emitting Proxy as target) stays consistent between `track` and `trigger`.
Vue also `toRaw`s incoming values before storing, so the trap's `!==` compares raw-to-raw and
agrees with Vue's own `hasChanged`. The spike's job is to **confirm** this in a test, not discover
it.

And the codebase has none of the things that break double-proxying (checked 2026-07-15): no
`toRaw` / `markRaw` / `isReactive` anywhere, no identity comparison against the raw state, no
`delete state.x`, no getters on `EditorState` (a plain object literal). The Vue-reactivity surface
over the state is ~10 `watch`/`computed`s in `App.vue` and **zero** state-watches in composables
(their only two watches are on element refs) — the migration tail is shorter than it looks.

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

### ⚠️ The one-write-path rule (transition-period law)

During the transition there are **two** proxies over the same raw object, and they are **not
symmetric**:

- a write through the Vue-wrapped `state` fires **both** worlds (Vue forwards into the emitting
  trap);
- a write through the bare emitting proxy fires the emitter but is **invisible to Vue** —
  templates and computeds go stale with no error. This is the worst debugging session this design
  can produce, and one sentence prevents it:

> **While Vue is present, every writer holds the Vue-wrapped instance; the observable's inner
> `state` never leaks to anything that writes.**

Reads are consistent through either proxy (same raw object underneath), so read-only consumers
like `keypadSync` could take either — but pass them the Vue-wrapped one anyway, so the rule has no
exceptions to remember. When Vue leaves, the rule dissolves (one proxy remains).

### The subscriber contract

Vue watchers are batched — today's `App.vue` watches fire once per flush, after state has settled.
The emitter fires synchronously **per write**: `selectNote()` writes ~8 fields → ~8 emits, and the
early ones run against mid-transition state (`selectedNoteId` updated, `selectedDuration` not
yet). So a subscriber must be:

1. **Idempotent** — it is called several times per gesture; the last call settles it.
2. **Torn-state tolerant** — never assume the whole transition has landed when you run.
3. **Never a state writer** — a write from inside a callback is a re-entrant emit; the stores'
   short-circuits are all that stands between that and a loop, and they are incidental protection,
   not a guarantee.

`keypadSync` satisfies all three by construction (pure read → `setHighlight`/`refresh`, each
short-circuiting). If per-write emits ever measurably hurt, a microtask-coalesced flush (queue
keys, dedupe, flush once) exactly reproduces Vue's watch timing — but measure first; don't build
it on suspicion.

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

## Emit coverage — verified against every writer

The design's real risk is limit #2 below (nested mutations don't emit): `SelectionController`
mutates `state.selectedItems` (a Map) in place at ~20 sites, which the top-level trap never sees.
Checked 2026-07-15, every mutation path — `selectNote`, `selectNotes`, `selectMeasureContents`,
`toggleNote` (both branches), `extendSelectionTo`, `selectArticulation`, `toggleArticulation` —
**ends by reassigning top-level scalars**, and `selectionBase` gets a **fresh array** every time,
so an emit fires on every selection change — including the sneaky case (Ctrl-click deselecting a
non-anchor note, where `selectedNoteId` doesn't change). Undo funnels through
`selection.selectNote()` (`useShortcuts`), so even the engine-derived tie/articulation highlights
refresh after undo. Coverage is complete today.

But it is coverage **by convention, not by construction** — nothing stops a future selection path
from mutating only the Map and notifying no one. So:

> **Invariant (promote to a code comment on `selectedItems` when this lands):** every selection
> mutation must end by assigning `selectionBase` (or another top-level scalar). The structural fix
> — reassigning the Map wholesale (`state.selectedItems = new Map(…)`) so the emit can't be
> forgotten — is a mechanical follow-on refactor of `SelectionController`, not a blocker.

## The payoff: the Proxy is permanent, Vue is the temporary layer

The emitter is not scaffolding to throw away — it is the end-state reactivity. When Vue eventually
leaves, you **peel off one line** (`reactive(observable)` → just `observable`) and delete
`App.vue`'s watches/routes. `keypadSync` never changes, because it never depended on Vue — it
depended on `subscribe`, which is still there. Vue was just a subscriber that happened to also
render.

### `subscribe` is the universal adapter, not just Keypad plumbing

React's `useSyncExternalStore(subscribe, getSnapshot)` wants **exactly** this contract; Svelte
stores and an Angular service consume it just as directly. When the port happens, the next
framework becomes what Vue becomes after this change: one subscriber among many. The Keypad is
merely the first consumer that proves it.

### `toolMode` collapses — the first seam deleted

The store's entire reason to exist ("a plain-TS panel cannot watch a Vue ref" — `toolMode.ts`)
disappears once the state has its own `subscribe`. The `App.vue` mirror watch retires, and the
keypad-originated follow-through (`disarmPositionalTools()` + `renderScore()`) moves into the same
interactions-side wiring module as the press routes. One of the four ad-hoc stores this design
generalises is deleted outright, not just generalised.

## Honest costs and limits

1. **Spike the `reactive(proxy)` composition FIRST.** The forwarding was traced through Vue's
   handlers above and should hold, but ~20 lines and a handful of tests settle it as fact before
   anything is built on it. The spike must cover:
   - a `watch` / `computed` / template binding fires on a write through the Vue-wrapped state
     (the forwarding, end to end);
   - Map instrumentation still works through the double proxy — `state.selectedItems.set(…)`
     triggers a Vue watcher that iterates the map (HighlightController-style consumers depend on
     it);
   - a write through the **bare** emitting proxy does *not* trigger Vue — confirming the
     one-write-path rule as fact rather than discovering it in production;
   - emit ordering: emitter listeners fire synchronously, before Vue's batched flush;
   - identity edges: `toRaw(state)` returns the emitting proxy, not raw; `has` / `deleteProperty`
     fall through untrapped (nothing in the codebase uses them on state today — verified).
   This is the one thing that can invalidate the whole approach; settle it cheaply.
2. **Nested mutations don't emit.** `state.selectedItems.set(…)` (a `Map`) or writing a field
   *inside* `selectedMeasureRange` mutates a nested object — the top-level `set` trap never sees
   it, so no event fires. Verified above: every current writer ends with a top-level scalar
   assignment, so coverage is complete **today** — but hold the invariant (see "Emit coverage"),
   because the failure mode is silent.
3. **It is coarse, not auto-tracked.** Plain-TS subscribers get "a key changed," not Vue's "this
   computed depends on this field." That is fine here (cheap, short-circuiting refreshes) — it is a
   change-notification, deliberately small. Do not mistake it for a general Vue-reactivity
   replacement; the point is NOT to rebuild React.
4. **It is a project, not an edit.** The Proxy + `keypadSync` is ~a day. Moving *every* control's
   sync off `App.vue` and proving parity is the longer tail — but incremental: one control at a
   time, the `App.vue` watch deleted as each moves. (The tail is short, per the surface census
   above: ~10 watch/computeds, all in `App.vue`.)

## Recommendation

- **Spike #1 now**, as a standalone throwaway — it is an afternoon, and it retires the only real
  risk in the design.
- If it holds, land the Proxy + `keypadSync` for the five already-wired controls (duration,
  accidental, articulation, dot, tie). That is the real cord-cut demo, and proves the seam before
  porting the remaining controls (clef / time signature / dynamics / tempo / tuplet / beam / rest)
  onto the Keypad's later pages.
- Then decide ordering against the remaining Keypad feature work (rest key, `this.voice` →
  `activeVoice`, page 2): the two-channel stores already work, so features don't *need* the proxy
  first. What is **not** fine is wiring many more controls through the App.vue-watch pattern in
  the meantime — each one added now is one more to migrate later, and avoiding exactly that
  accumulation is the strongest practical argument for doing the proxy sooner rather than later.
- **Fallback if the spike fails** (not expected): `@vue/reactivity` standalone as the agnostic
  core — framework-independent and battle-tested, and it would solve nested-Map emits for free.
  But it is permanent machinery, and a Vue-ecosystem dependency in the very layer `lint:boundary`
  exists to keep clean. Reach for it only on spike failure.
- Leave the rest of the migration as follow-on.

## Related

- `docs/ARCHITECTURE.md` — the framework-agnostic boundary (`App.vue → composables → interactions →
  engine`), enforced by `npm run lint:boundary`.
- The existing store seams this generalises: `interactions/toolMode.ts`,
  `interactions/paletteSelection.ts`, `interactions/paletteToggleSet.ts`.
