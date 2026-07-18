# Logging

How console output is gated so development traces stay out of production while genuine faults
still ship.

## The two categories

| Call | When it prints | Use for |
|---|---|---|
| `dbg(...)` | **dev only** (`npm run dev`) | The ~200 development traces — "✓ note added", "[Rest] shift…", flow/debug breadcrumbs. |
| `console.warn(...)` / `console.error(...)` | **always** (dev **and** production) | Genuine faults: caught exceptions, broken invariants, a render that failed. Something you'd want to see from a real user's session. |

`dbg` lives in `src/utils/debug.ts`. A production `vite build` leaves it switched off, so every
`dbg(...)` is a no-op — the traces vanish without touching a single call site.

## How it's wired (framework-agnostic by injection)

`src/utils/debug.ts` is **pure TS** — zero Vue, zero `import.meta`, zero build-tool coupling. It
holds a module-level flag and:

```ts
setDebugLogging(on)   // flip the switch
debugEnabled()        // read it (for guarding expensive logs — see below)
dbg                   // dev-only logger (a swapped binding, see next paragraph)
```

**Why `dbg` is a swapped binding, not a wrapper function (call-site preservation).** DevTools
attributes a `console.log` to whatever *directly* called it. A `dbg = (...a) => console.log(...a)`
wrapper is that direct caller, so **every** log would read `debug.ts:NN` instead of the real site
(`MouseController.ts:1136`) — a genuine debugging regression. So `dbg` is not a wrapper: when enabled
it becomes `console.log.bind(console)` **itself** (a bound native function adds no JS frame, so the
call site is preserved), and when disabled it becomes a no-op. `setDebugLogging` swaps between the
two; `dbg` is an `export let` so the swap reaches importers through the ES-module live binding. Do
not "simplify" this back into a gated wrapper — you'd lose every line number.

The core (engine / interactions / utils / windows) just calls `dbg()` and never asks what
environment it's in. The **composition root** — `src/main.ts`, the one place allowed to know about
the bundler — flips the switch once at startup:

```ts
setDebugLogging(import.meta.env.DEV)   // true under `npm run dev`, false in a production build
```

This keeps the framework-agnostic boundary intact (`lint:boundary` stays green — `@/utils/debug`
is not a Vue import) and means:

- **Production build** → switch off → every `dbg` silent.
- **`npm run dev`** → switch on → traces print.
- **Unit tests** → switch defaults **off**, so test output is quiet unless a test opts in with
  `setDebugLogging(true)`.
- You can still flip it at runtime from the console to chase something in any build.

There is no staging environment today; the only axis is local dev vs. production. If a staging
build is ever added, decide its logging by what you pass to `setDebugLogging` in `main.ts` (e.g.
`import.meta.env.MODE !== 'production'`) — the core doesn't change.

## ⚠️ The template caveat (the thing to remember)

A **suppressed `dbg` still evaluates its arguments.** JavaScript builds the argument list before the
call, so:

```ts
dbg(`m${measure} v${voice} b${beat}`)   // interpolates the full string, THEN calls the no-op → discards it
dbg('m', measure, voice, beat)           // passes values as-is — no string is built
```

Separate arguments are genuinely cheaper when the log is off (no interpolation). We use **templates
anyway** for tight formatting (`m2 v0 b0.5`, not `m 2 v 0 b 0.5`) — and at **once-per-interaction**
frequency the cost of building a short string and throwing it away is microseconds. Not worth
rewriting 200 templates into separate args (that's churn to save nothing, and it wrecks the
formatting).

**Where it DOES matter — hot paths and expensive args.** For a log inside a render loop / per-note /
per-frame, or one whose argument is expensive (e.g. `JSON.stringify(measure)`), neither templates
nor separate args help — guard the whole statement so the work itself is skipped:

```ts
if (debugEnabled()) console.log(`… ${JSON.stringify(measure)} …`)
```

Candidates already noted: `src/dev/renderCensus.ts` dumps, and the full-measure `JSON.stringify` in
`VexFlowRenderer`'s render-failure `console.error`. (Not yet converted — do it if/when they show up
on a profile.)

## Not done yet / follow-ups

- **`console.warn` / `console.error` all still ship to production.** We reviewed them and a curated
  split exists (demote the expected/handled/preview ones — empty-copy, bpm-validation, ghost-note
  preview, "no measure for preview", benign paste-drop — to `dbg`; keep the real faults). Not
  applied yet — pending a decision on the two borderline cases (`ShortcutManager` no-handler,
  time-signature rejected). Until then, the safe default holds: warns/errors are visible in prod.
- **The "keep in production" trace.** There is a log about the **size of a measure** the author
  wants kept in prod (and everywhere). It was **not** identified before the sweep, so it is
  currently a `dbg` like the rest. Once pointed out, flip that one line back to `console.log` (or a
  dedicated always-on helper) so it ships.
- `src/dev/renderCensus.ts` was **left as `console.log`** on purpose — its logs are the dev tool's
  own output (invoked via `__census`), not app traces.
