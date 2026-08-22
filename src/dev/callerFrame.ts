/**
 * TEMPORARY — "who called me?", read off a thrown stack.
 *
 * Two dev instruments need it and neither can be told: `renderCensus` buckets a render by the site
 * that asked for it (an edit and a selection both arrive through one method), and
 * `layoutFlushCensus` buckets a forced layout by the site that read geometry. Both want a NAME they
 * did not have to thread through the code being measured — which is the whole point of a probe.
 *
 * ⚠️ Stack formats are not standardised. This parses V8's and degrades to `'unknown'` anywhere else
 * rather than guessing, because a wrong attribution in a performance table is worse than an absent
 * one: it sends you to optimise a module that was never the problem.
 *
 * 🚨 **And that is not hypothetical — it shipped.** The first version matched `at (?:async )?(\w+)`,
 * which is fine for `at Foo.bar (…)` and catastrophic for an ANONYMOUS frame, whose whole line is
 * `    at http://localhost:5199/src/…/TempoLayout.ts:123:45`. There is no function name there, so the
 * regex happily captured **`http`** — and a real flush census then reported 542 reads and 555 ms, a
 * quarter of all forced-layout time, under a row called `http`. ⛔ Never parse a stack line by
 * grabbing the first word-shaped thing in it.
 *
 * ⛔ Never on a hot path unless something is recording — building a stack is not free.
 */

/** What {@link callerFrame} needs in order to skip past the instrument's own frames. */
export interface CallerFrameOptions {
  /**
   * Where to start scanning. Index 0 is the `Error` line and 1 is {@link callerFrame} itself, so 2
   * is this function's caller — raise it to step over the probe's own wrapper.
   */
  skip?: number
  /** Frames whose name matches are stepped over — the instrument's own plumbing. */
  ignore?: RegExp
  /** How far down to look before giving up. Deep enough to clear a wrapper or two, shallow enough
   *  that a runaway stack cannot turn a probe into the cost it is measuring. */
  depth?: number
}

/**
 * What ONE V8 stack line calls itself — a function name, or failing that a `file:line`.
 *
 * ⭐ The rule is structural rather than lexical, which is what makes it safe: V8 writes a **named**
 * frame as `at NAME (LOCATION)` and an **anonymous** one as `at LOCATION`, with no parentheses. So
 * the presence of the parenthesised tail is what says whether a name exists at all — never the shape
 * of the first token.
 *
 * ⭐ An anonymous frame is not a dead end: `TempoLayout.ts:123` is a better answer than a function
 * name would have been anyway, and it is what a bundled arrow or a callback reduces to.
 *
 * Exported for its spec — literal stack lines are the only honest way to test this, because the
 * frames a test can *synthesise* are exactly the well-behaved ones that never broke.
 */
export function frameName(line: string): string | null {
  const rest = /^\s*at\s+(?:async\s+)?(?:new\s+)?(.+)$/.exec(line)?.[1]
  if (!rest) return null

  // `at NAME (LOCATION)` — the named form. `lastIndexOf` because a name may itself contain spaces
  // (`at Object.<anonymous> (…)`) while the location never ends before the final `)`.
  if (rest.endsWith(')')) {
    const open = rest.lastIndexOf(' (')
    if (open > 0) {
      const name = rest.slice(0, open)
      // ⚠️ Identifier-ish only. `at <anonymous> (…)` and `at eval (…)` carry no information worth a
      // row of their own, so they fall through to the location like any other anonymous frame.
      if (/^[\w$.<>]+$/.test(name) && name !== '<anonymous>' && name !== 'eval') return name
      return shortLocation(rest.slice(open + 2, -1))
    }
  }
  return shortLocation(rest)
}

/**
 * `http://localhost:5199/src/engine/rendering/TempoLayout.ts?t=17…:123:45` → `TempoLayout.ts:123`.
 *
 * ⚠️ Greedy up to the LAST `:line:col`, because the URL is full of colons and a non-greedy match
 * stops at the scheme's — which is the bug this whole module now documents.
 */
function shortLocation(location: string): string | null {
  const at = /^(.*):(\d+):\d+$/.exec(location.trim())
  if (!at) return null
  const file = at[1].split('?')[0].split('/').pop()
  return file ? `${file}:${at[2]}` : null
}

export function callerFrame({ skip = 2, ignore, depth = 8 }: CallerFrameOptions = {}): string {
  const stack = new Error().stack?.split('\n') ?? []
  for (let i = skip; i < Math.min(stack.length, skip + depth); i++) {
    const name = frameName(stack[i] ?? '')
    if (!name) continue
    if (ignore?.test(name)) continue
    return name
  }
  return 'unknown'
}
