/**
 * Development-only console logging — framework-agnostic (ZERO Vue, ZERO build-tool globals).
 *
 * The core (engine / interactions / utils) calls {@link dbg} without ever asking what environment
 * it runs in. The composition root (`main.ts`) flips the switch ONCE at startup via
 * {@link setDebugLogging}, injecting `import.meta.env.DEV` — so the bundler's environment reaches
 * the app in exactly one place and this module stays pure TS that unit tests (and any future
 * non-Vite host) can drive directly.
 *
 * Categories (see docs/logging.md):
 *   - `dbg(...)`     development trace — the ~200 dev logs. No-op unless enabled → silent in a
 *                    production build (the switch is left off) and quiet in unit tests (off by default).
 *   - `console.warn` / `console.error` stay RAW and always ship: a genuine fault is something you
 *                    want to see from a production session, not a dev-only luxury.
 *
 * ⚠️ THE TEMPLATE CAVEAT (docs/logging.md): a suppressed `dbg` still EVALUATES its arguments — a
 * template literal is interpolated and thrown away. Negligible for the once-per-interaction logs we
 * have, but for anything EXPENSIVE or on a hot render/loop path, guard the whole statement with
 * {@link debugEnabled} so the work itself is skipped, e.g. `if (debugEnabled()) console.log(...)`.
 */

const NOOP = (..._args: unknown[]): void => {}

let enabled = false

/**
 * The development-only logger. A no-op until {@link setDebugLogging} enables it.
 *
 * ⭐ When enabled it is `console.log` **itself** (bound), NOT a wrapper — so DevTools reports the
 * real CALL SITE (`MouseController.ts:1136`), not this file. A `(...a) => console.log(...a)` wrapper
 * would make every single log read `debug.ts:NN`, which is the whole reason this is a swapped
 * binding rather than a gated function. It is an `export let` so the swap in {@link setDebugLogging}
 * propagates to importers via the ES-module live binding.
 */
export let dbg: (...args: unknown[]) => void = NOOP

/** Turn development logging on/off. Called once by the app entry with `import.meta.env.DEV`. */
export function setDebugLogging(on: boolean): void {
  enabled = on
  dbg = on ? console.log.bind(console) : NOOP
}

/** Whether development logging is currently on. Guard expensive / hot-loop logs with this so their
 *  arguments are never even built when logging is off (see the template caveat above). */
export function debugEnabled(): boolean {
  return enabled
}
