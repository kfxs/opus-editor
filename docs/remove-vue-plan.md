# Removing Vue

Branch: `remove-vue`. The editor core has been framework-agnostic for months
(`lint:boundary` enforces it); this finishes the job by replacing the last
framework-dependent layer — the app shell — with plain TypeScript.

**Vite stays.** Vite is not Vue: with no `@vitejs/plugin-vue`, `vite build` is
just a TypeScript bundler. "A standalone app on Vite" is what already exists,
minus one plugin.

## The shape: a dev shell around the viewport

What is inside the **viewport** is the application. Everything around it — the
toolbar and the Score-JSON panel — is **development scaffolding**, and it is
*kept*, because it is useful while building. Vue is currently playing the role of
that shell; our own thin wrapper takes the role over.

This is the decision that unblocked the port: the toolbar does **not** need to be
redesigned, rehomed onto the Keypad, or rebuilt on the widget framework. It stays
exactly as it is, transcribed into plain DOM. Its Tailwind class strings copy
across verbatim (Tailwind's content glob already covers `.ts`).

> ⚠️ Keep each class string a whole literal. Tailwind scans for literal text, so a
> class assembled by concatenation silently vanishes from the build.

**The seam:** the shell may read `EditorState` and call palette/controller
methods; nothing inside the viewport may know the shell exists. Hold that line and
deleting the scaffolding is one file, not an excavation — the same discipline
`lint:boundary` already enforces inward.

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
3. **App.vue → App.ts.** The script (~426 lines) ports almost mechanically:
   `ref`/`shallowRef` → plain `let`, `onMounted`/`onUnmounted` → `init()`/
   `dispose()`, the single `watch` (`state.isPanning`) → `onStateChange`. The
   template (~378 lines) splits into the score scaffold (~70 lines of nested divs,
   `v-show` → `style.display`, `v-if` → create/remove) and the dev shell above.
   The three `computed`s only fed the toolbar; `durationHighlight`/`dotHighlight`
   in `keypadSync.ts` are already the shared rule.
4. **Drop the plugin and the deps.** `vue`, `@vitejs/plugin-vue`, `vue-tsc`,
   `eslint-plugin-vue`; `build:check` swaps `vue-tsc` → `tsc --noEmit`. Only safe
   after step 3 — it breaks `.vue` parsing instantly.

`useShortcuts` and `useViewport` are the last two composables. `useShortcuts`
imports Vue for a single `type Ref`; `useViewport` holds ~15 lines of real
lifecycle and already exposes `attach`/`detach`. Both fold into step 3.

## What made this cheap

No Vue component tests exist — no `@vue/test-utils`, no mounted-component specs.
The whole suite is framework-agnostic already, so removing Vue breaks no test.
And `windows/content/widgets.ts` already proved the alternative: 34 kB of
`Button`/`Select`/`RadioGroup`/`Checkbox`/`GlyphSelect`, styled with inline
`el.style.*` and zero Tailwind.
