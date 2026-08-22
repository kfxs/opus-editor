/**
 * TEMPORARY — "who called me?", read off a thrown stack.
 *
 * Two dev instruments need it and neither can be told: `renderCensus` buckets a render by the site
 * that asked for it (an edit and a selection both arrive through one method), and
 * `layoutFlushCensus` buckets a forced layout by the site that read geometry. Both want a NAME they
 * did not have to thread through the code being measured — which is the whole point of a probe.
 *
 * ⚠️ Stack formats are not standardised. This parses V8's (`    at Foo.bar (url:line:col)`) and
 * degrades to `'unknown'` anywhere else rather than guessing, because a wrong attribution in a
 * performance table is worse than an absent one: it sends you to optimise the wrong module.
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

export function callerFrame({ skip = 2, ignore, depth = 8 }: CallerFrameOptions = {}): string {
  const stack = new Error().stack?.split('\n') ?? []
  for (let i = skip; i < Math.min(stack.length, skip + depth); i++) {
    // Chrome: "    at MouseController.handleClick (http://…/MouseController.ts:231:20)"
    const name = /at (?:async )?([\w$.<>]+)/.exec(stack[i] ?? '')?.[1]
    if (!name) continue
    if (ignore?.test(name)) continue
    return name
  }
  return 'unknown'
}
