import { describe, it, expect } from 'vitest'
import {
  accidentalMeetsLedger,
  ledgerAccidentalClearance,
  ledgerLevels,
  LEDGER_ACCIDENTAL_GAP,
  LEDGER_OVERHANG_BESIDE_ACCIDENTAL,
  VEXFLOW_ACCIDENTAL_STANDOFF,
} from './ledgerAccidentalClearance'

// The fan's own two numbers (FanPass), so the arithmetic is exercised with both callers' inputs.
const FAN_STANDOFF = 2

describe('ledgerLevels', () => {
  it('is empty for a note inside the staff — nothing to clear', () => {
    expect(ledgerLevels([1, 3, 5])).toEqual([])
  })

  it('counts the whole lines from 6 up and from 0 down, not the spaces between', () => {
    expect(ledgerLevels([7])).toEqual([6, 7])
    expect(ledgerLevels([-1])).toEqual([0, -1])
    // A head in the space above the first ledger still needs that ledger and no more.
    expect(ledgerLevels([6.5])).toEqual([6])
  })

  it('reads the extremes of a CHORD, so an inner note shares the outer note’s lines', () => {
    expect(ledgerLevels([-1.5, 2])).toEqual([0, -1])
  })
})

describe('accidentalMeetsLedger', () => {
  it('is false inside the staff, where there are no ledger lines to meet', () => {
    expect(accidentalMeetsLedger(3, [1, 3])).toBe(false)
  })

  it('is true for a sign on a ledger line, and for one whose glyph merely REACHES it', () => {
    expect(accidentalMeetsLedger(0, [0])).toBe(true)
    // B3 hangs in the space under the ledger at 0 — the sharp's arms still cross it.
    expect(accidentalMeetsLedger(-0.5, [-0.5])).toBe(true)
  })

  it('is false for the top of a chord whose ledger lines are all far below it', () => {
    expect(accidentalMeetsLedger(5.5, [0, 5.5])).toBe(false)
  })
})

describe('ledgerAccidentalClearance', () => {
  it('asks for nothing when the note has no ledger lines', () => {
    expect(ledgerAccidentalClearance(3, [1, 3], LEDGER_OVERHANG_BESIDE_ACCIDENTAL, VEXFLOW_ACCIDENTAL_STANDOFF)).toBe(0)
  })

  it('moves the sign the distance the trimmed line still asks for', () => {
    // Real notes: a 2px overhang against a 3px standoff — 1px opens the 2px gap.
    expect(ledgerAccidentalClearance(0, [0], LEDGER_OVERHANG_BESIDE_ACCIDENTAL, VEXFLOW_ACCIDENTAL_STANDOFF))
      .toBe(LEDGER_OVERHANG_BESIDE_ACCIDENTAL + LEDGER_ACCIDENTAL_GAP - VEXFLOW_ACCIDENTAL_STANDOFF)
    // The fan's members stand closer to begin with, so they give up more.
    expect(ledgerAccidentalClearance(0, [0], LEDGER_OVERHANG_BESIDE_ACCIDENTAL, FAN_STANDOFF)).toBe(2)
  })

  it('asks for MORE where the line keeps its full overhang', () => {
    expect(ledgerAccidentalClearance(0, [0], 3, VEXFLOW_ACCIDENTAL_STANDOFF)).toBe(2)
  })

  it('leaves alone a sign far enough from every ledger line', () => {
    expect(ledgerAccidentalClearance(5.5, [0, 5.5], LEDGER_OVERHANG_BESIDE_ACCIDENTAL, FAN_STANDOFF)).toBe(0)
  })

  it('never asks for a negative amount, however generous the standoff already is', () => {
    expect(ledgerAccidentalClearance(0, [0], 3, 99)).toBe(0)
  })
})
