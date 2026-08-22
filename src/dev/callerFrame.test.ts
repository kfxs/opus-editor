/**
 * Subject: {@link callerFrame}, sitting beside this file.
 *
 * ⚠️ It parses a V8 stack, so what is worth pinning is not the happy path — it is that a
 * MISATTRIBUTION cannot happen quietly. A performance table that names the wrong module sends you to
 * optimise code that was never the problem, which is strictly worse than a table that says nothing.
 */
import { describe, it, expect } from 'vitest'
import { callerFrame, frameName } from './callerFrame'

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

/**
 * 🚨🚨 **The regression this module exists for.** The first parser grabbed the first word-shaped
 * token on the line, which is right for a named frame and catastrophic for an anonymous one — a real
 * `__flush` dump reported 542 reads and 555 ms, a quarter of all forced-layout time, under a row
 * called **`http`**.
 *
 * ⚠️ Literal lines, not synthesised stacks: the frames a test can *produce* are precisely the
 * well-behaved named ones that never broke. These are copied from what V8 actually writes.
 */
describe('frameName — one V8 stack line', () => {
  it('⭐ names a plain function', () => {
    expect(frameName('    at hintBarlines (http://localhost:5199/src/engine/rendering/barlineInk.ts:124:31)'))
      .toBe('hintBarlines')
  })

  it('⭐ keeps the receiver on a method', () => {
    expect(frameName('    at MouseController.clientToSvg (http://localhost:5199/src/interactions/MouseController.ts:666:8)'))
      .toBe('MouseController.clientToSvg')
  })

  it('🚨 an ANONYMOUS frame reports its FILE, never the URL scheme', () => {
    const line = '    at http://localhost:5199/src/engine/rendering/TempoLayout.ts:123:45'
    expect(frameName(line), 'the bug printed `http` here').toBe('TempoLayout.ts:123')
  })

  it('🚨 …including through a Vite query string, which is full of extra colons', () => {
    expect(frameName('    at http://localhost:5199/src/engine/rendering/TempoLayout.ts?t=1755000000000:9:3'))
      .toBe('TempoLayout.ts:9')
  })

  it('⛔ a frame that only calls itself `<anonymous>` or `eval` falls through to its file', () => {
    expect(frameName('    at <anonymous> (http://localhost:5199/src/App.ts:42:7)')).toBe('App.ts:42')
    expect(frameName('    at eval (http://localhost:5199/src/App.ts:42:7)')).toBe('App.ts:42')
  })

  it('reads past the decorations V8 adds', () => {
    expect(frameName('    at async loadScore (http://x/src/a.ts:1:1)')).toBe('loadScore')
    expect(frameName('    at new VexFlowRenderer (http://x/src/b.ts:2:2)')).toBe('VexFlowRenderer')
  })

  it("⛔ answers null on anything it does not recognise, rather than inventing a row", () => {
    expect(frameName('Error')).toBeNull()
    expect(frameName('')).toBeNull()
    expect(frameName('    at native')).toBeNull()
  })
})
