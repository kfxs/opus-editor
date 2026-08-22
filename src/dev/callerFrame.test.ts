/**
 * Subject: {@link callerFrame}, sitting beside this file.
 *
 * ⚠️ It parses a V8 stack, so what is worth pinning is not the happy path — it is that a
 * MISATTRIBUTION cannot happen quietly. A performance table that names the wrong module sends you to
 * optimise code that was never the problem, which is strictly worse than a table that says nothing.
 */
import { describe, it, expect } from 'vitest'
import { callerFrame } from './callerFrame'

/** Stands in for an instrument's own wrapper — the frame that must never be reported. */
function probeWrapper(opts?: Parameters<typeof callerFrame>[0]): string {
  return callerFrame(opts)
}

function theRealCaller(): string {
  return probeWrapper({ skip: 3 })
}

describe('callerFrame', () => {
  it('⭐ names the caller, stepping over the instrument that asked', () => {
    expect(theRealCaller()).toBe('theRealCaller')
  })

  it('🚨 `ignore` steps past a wrapper even when `skip` is too shallow to clear it', () => {
    // ⚠️ This is the belt to `skip`'s braces. A minifier or an inline can move a frame, and the
    // difference between the two answers here is the difference between a useful table and a table
    // where every row names the probe.
    const withSkipAlone = probeWrapper({ skip: 2 })
    const withIgnore = probeWrapper({ skip: 2, ignore: /probeWrapper/ })

    expect(withSkipAlone).toBe('probeWrapper')
    expect(withIgnore).not.toBe('probeWrapper')
  })

  it("⛔ answers 'unknown' rather than guessing when it runs out of stack", () => {
    expect(callerFrame({ skip: 500 })).toBe('unknown')
  })

  it('⚠️ looks only `depth` frames deep — a runaway stack may not become the cost being measured', () => {
    // Everything within reach is ignored, so there is nothing left to report.
    expect(callerFrame({ ignore: /.*/, depth: 3 })).toBe('unknown')
  })
})
