# Removing Vue — DONE

Branch: `remove-vue`. The editor core had been framework-agnostic for months
(`lint:boundary` enforced it); this finished the job by replacing the last
framework-dependent layer — the app shell — with plain TypeScript. All four steps
below are complete: there is no Vue in the project.

Kept as the record of *why* the shape is what it is, and of the traps found on the
way. The one thing to carry forward: **new UI is a module that builds its own
elements and subscribes to `EditorState`** — see `windows/`, `menus/`, `dev/`.

**Vite stays.** Vite is not Vue: with no `@vitejs/plugin-vue`, `vite build` is
just a TypeScript bundler. "A standalone app on Vite" is what already exists,
minus one plugin.

## The shape: a dev shell around the viewport

What is inside the **viewport** is the application. Everything around it — the
toolbar and the Score-JSON panel — is **development scaffolding**, and it is
*kept*, because it is useful while building. Vue was playing the role of that
shell; `App.ts` plus `src/dev/` took the role over.

This is the decision that unblocked the port: the toolbar did **not** need to be
redesigned, rehomed onto the Keypad, or rebuilt on the widget framework. It stayed
exactly as it was, transcribed into plain DOM. Its Tailwind class strings copied
across verbatim (Tailwind's content glob already covers `.ts`).

> ⚠️ Keep each class string a whole literal. Tailwind scans for literal text, so a
> class assembled by concatenation silently vanishes from the build.

**The seam:** the shell may read `EditorState` and call palette/controller
methods; nothing inside the viewport may know the shell exists. Hold that line and
deleting the scaffolding is one file, not an excavation — the same discipline
`lint:boundary` already enforces inward.

> **Graduation, not wholesale rehoming (2026-07-23).** The shell staying whole
> does not freeze every widget in it. As a *product* surface absorbs a control, that
> control can leave the workbench individually. First to go: the `Voice:` buttons —
> the Keypad's voice row (V1–4 + All, on the `voiceSelection` seam) now owns voice
> selection, so the toolbar's stale V1/V2 pair was deleted. The rule of thumb: the
> dev shell exercises the *engine*; the Keypad (and a future in-viewport palette,
> another view over the same seams) is the *product* surface. A control graduates
> when it crosses that line. See `docs/multi-voice-plan.md` §13.

## Reactivity without a framework

Everything the toolbar highlights is an `EditorState` field — `selectedTool`,
`viewMode`, `activeVoice`, `selectedBeam`, `playbackState`, and the
measure/staff-context pair. So the shell is **one subscriber** that re-applies
button classes when state changes.

That is exactly what `wireKeypadSync` and `wireSelectionInspection` already do,
with no Vue in their loop. **The Keypad is the existence proof**: a live,
state-mirroring control surface that is already framework-free. The toolbar
becomes `wireDevToolbar(state, palette, onStateChange)` beside them.

`const state = reactive(bareState)` simply goes away — the observable Proxy
carries its own change-notification, which was the whole point of
`docs/observable-editorstate-plan.md`. The one-write-path trap documented in
`App.vue` disappears with it.

The Score-JSON panel is already framework-free in spirit: it *polls*
`exportJSON()` every 400 ms into a ref precisely because the engine is not
reactive. It becomes `el.textContent = …` on the same timer.

## Ordering (each step compiles, tests stay green)

1. **✅ Delete Pinia.** Installed, mounted, never used — no `defineStore`
   anywhere. Gone from `main.ts` and `package.json`. (It stays in
   `.eslintrc.boundary.json`'s restricted list on purpose, to block a comeback.)
2. **✅ Collapse the eight shim composables.** `useHighlight`, `useRenderer`,
   `useSelection`, `usePalette`, `useKeyboardEntry`, `useMouseInteraction`,
   `useTextEditing`, `useGutter` did one thing: turn `Ref<T>` into
   `() => ref.value`. The controllers **already take getters**, so `App.vue`
   constructs them directly and the files are deleted. Lifecycle the shims owned
   (`mouse.setup/teardown`, the gutter's `watch` + `detach`) moved to `App.vue`
   **at the same positions**, so hook registration order — and therefore run
   order — is unchanged.
3. **✅ App.vue → App.ts**, in two commits so there was a testable point in the
   middle. First the dev shell moved out to `src/dev/` while Vue still hosted it
   (donating two empty divs); then the remainder became `App.ts`, which builds the
   score DOM itself. `ref` → plain `let`, `onMounted`/`onUnmounted` → straight-line
   code plus `destroy()`, `v-show` → `style.display`, `v-if` → a hidden element
   whose getter reports null. The last two composables moved inward rather than
   being ported — neither was really about Vue: `useShortcuts` →
   `interactions/shortcutWiring.ts` (it imported Vue for a single `type Ref`), and
   `useViewport` → `interactions/ViewportHost.ts` (elements as getters, lifecycle
   as explicit `attach`/`detach`). `src/composables/` is gone.
4. **✅ Dropped the plugin and the deps.** `vue`, `@vitejs/plugin-vue`, `vue-tsc`,
   `eslint-plugin-vue`; `build:check` runs `tsc --noEmit`, and `.eslintrc.json` no
   longer loads the Vue parser. Bundle: 1,724 kB → 1,665 kB.

## What replaced each Vue feature

| Vue | Now |
|---|---|
| `reactive(state)` + template bindings | `EditorState`'s emitting Proxy; one `onStateChange` subscriber per concern |
| `computed` for button highlights | the shared rules in `keypadSync.ts`, re-asked on each state change |
| `v-if` (gutter) | the element always exists, hidden; `getElement()` returns null when hidden, so the controller sees what `v-if` gave it — and its DOM position never changes |
| `v-show` (play cursor) | `style.display` |
| `onMounted` / `onUnmounted` | straight-line construction + `destroy()` |
| `ref` on an element | the element itself — `App.ts` built it |
| SFC `<style>` | `src/app.css` |

## What made this cheap

No Vue component tests exist — no `@vue/test-utils`, no mounted-component specs.
The whole suite is framework-agnostic already, so removing Vue breaks no test.
And `windows/content/widgets.ts` already proved the alternative: 34 kB of
`Button`/`Select`/`RadioGroup`/`Checkbox`/`GlyphSelect`, styled with inline
`el.style.*` and zero Tailwind.
