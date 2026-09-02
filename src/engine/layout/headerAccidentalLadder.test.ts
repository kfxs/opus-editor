/**
 * Subject: `./headerAccidentalLadder` — the ROWS themselves, and which one is armed.
 *
 * ⚠️ **The wiring is next door.** `headerInk.test.ts` owns *"does `headerToNoteGap` read the armed
 * row"*; this file owns *"are the rows what their sources say"*. ⭐ The split follows the module the
 * `expect(...)` identifiers are on, which is the rule in CLAUDE.md — the table is the subject here.
 *
 * 🚨 What is worth pinning about a table of house styles is not its numbers one by one — those are
 * quoted in the module and would only be transcribed twice — but the CLAIMS the table makes as a
 * whole: that decision D is untouched by every row, that Gould's rows honour her own floor, that
 * LilyPond's deliberately does not, and that the armed row answers the report that caused the table
 * to exist.
 */
import { afterEach, describe, it, expect } from 'vitest'
import {
  HEADER_ACCIDENTAL_FLOOR, HEADER_TO_NOTE, HEADER_TO_NOTE_AFTER_SIGN,
} from './headerInk'
import {
  ACTIVE_HEADER_GAP_RULE, HEADER_GAP_RULES, armedHeaderGapRule, headerGapGeneration,
  headerGapSettings, resetHeaderGapRule, setHeaderGapRule,
} from './headerAccidentalLadder'

describe('the rows', () => {
  afterEach(() => resetHeaderGapRule())

  it('⛔ every row reproduces decision D — the plain column is NOT open', () => {
    for (const [name, rule] of Object.entries(HEADER_GAP_RULES)) {
      expect(rule.sign[0], `${name} after a clef`).toBe(HEADER_TO_NOTE_AFTER_SIGN)
      expect(rule.meter[0], `${name} after a meter`).toBe(HEADER_TO_NOTE)
    }
  })

  it('⭐ every row cites where it came from — a row is a SOURCE, never an invention', () => {
    for (const [name, rule] of Object.entries(HEADER_GAP_RULES)) {
      expect(rule.source.length, `${name} has no source`).toBeGreaterThan(10)
    }
  })

  it("🚨 the BOOK's rows respect Gould's floor of one stave-space", () => {
    // *"an accidental should never be closer to a preceding symbol than one stave-space"* — p. 42.
    for (const name of ['gould', 'gouldDrawn', 'musescore', 'none'] as const) {
      for (const gap of [...HEADER_GAP_RULES[name].sign, ...HEADER_GAP_RULES[name].meter]) {
        expect(gap, `${name} draws ${gap}`).toBeGreaterThanOrEqual(HEADER_ACCIDENTAL_FLOOR)
      }
    }
  })

  it("🚨🚨 …and LILYPOND deliberately does NOT — that disagreement is why its row is here", () => {
    // Its only floor is 0.3 staff spaces of clear white (`lily/staff-spacing.cc:211–213`), against
    // Gould's one full space. ⛔ Pinned so nobody 'fixes' the row into agreeing with her.
    expect(Math.min(...HEADER_GAP_RULES.lilypond.sign, ...HEADER_GAP_RULES.lilypond.meter))
      .toBeLessThan(HEADER_ACCIDENTAL_FLOOR)
  })

  it('⭐⭐ HIS REPORT, pinned: the armed row is looser after a METER than her printed table', () => {
    // *"i the case of the clef is not problem but when there is a time signature, is a little too
    // close to the time signature"* (2026-09-02). ⏳ Not a decision — his eye has not chosen a row
    // yet — but the armed one must at least answer the direction he reported.
    expect(armedHeaderGapRule().meter[1]).toBeGreaterThan(HEADER_GAP_RULES.gould.meter[1])
  })

  it('⭐⭐ …and MUSESCORE is what ships — his choice, 2026-09-02', () => {
    // *"lets make musescore default"*, after comparing all four rows then on his own music.
    expect(ACTIVE_HEADER_GAP_RULE).toBe('musescore')
    expect(armedHeaderGapRule()).toBe(HEADER_GAP_RULES.musescore)
  })
})

describe('arming a row', () => {
  afterEach(() => resetHeaderGapRule())

  it('⛔ an unknown name is REFUSED, ⛔ never silently ignored', () => {
    const before = headerGapSettings().rule
    expect(setHeaderGapRule('nonsense' as never)).toBe(false)
    expect(headerGapSettings().rule, 'unchanged').toBe(before)
  })

  it('🚨 the GENERATION moves on every write — it is what invalidates the width cache', () => {
    // ⛔ Without this in `laneFingerprint` and `layoutStateKey`, arming a row hands back every bar's
    //    MEMOISED width and the console reports a success that moved nothing
    //    (`reference_render_width_key_vs_shape_key`).
    const start = headerGapGeneration()
    expect(setHeaderGapRule('gould')).toBe(true)
    expect(headerGapGeneration()).toBeGreaterThan(start)
    resetHeaderGapRule()
    expect(headerGapGeneration()).toBeGreaterThan(start + 1)
  })

  it('⭐ reset goes back to what shipped', () => {
    setHeaderGapRule('none')
    resetHeaderGapRule()
    expect(headerGapSettings().rule).toBe(ACTIVE_HEADER_GAP_RULE)
  })
})
