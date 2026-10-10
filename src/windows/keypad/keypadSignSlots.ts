import type { DrawnSignId } from '@/types/music'

/**
 * ⭐ **WHICH SIGN EACH KEYPAD SIGN-KEY HOLDS** — the Keypad's sign keys are SLOTS, each holding a sign
 * id as DATA (docs/plans/alteration-signs-plan.md §4, rules 2 + 3; K1).
 *
 * A slot is named by its KEY, so page one's `7 8 9` and the Accidentals page's `7 8 9` are the same
 * three slots — the two pages cannot disagree, which is what wiring them "the same" (his ask,
 * 2026-09-30) always meant. A key's picture, its tooltip, what it presses and when it lights are all
 * read from the sign it holds: give a slot another sign and it shows and does the other sign, with no
 * code changed. That is the whole infrastructure a future accidental PALETTE needs (rule 1: it presses
 * the same `bus.accidental` seam) — ⛔ and no palette UI is built.
 *
 * ⭐ ONE table, Sibelius's layout as the default (his "Sibelius first"). Reassigning a slot is
 * session-only — `__keypad.slot(…)` from the console proves it works; ⛔ nothing saves it.
 *
 * Beside the page store (`./keypadPageSelection`) and shaped like it — one current value per slot,
 * a subscribe that fires on a REAL change — and ⛔ not on the bus for the same reason: its vocabulary
 * (which key is a slot) is the Keypad's.
 */
export const DEFAULT_SIGN_SLOTS: Readonly<Record<string, DrawnSignId>> = {
  '/': 'doubleSharp',
  '*': 'doubleFlat',
  '7': 'natural',
  '8': 'sharp',
  '9': 'flat',
  // ⭐ K4 — the quarter-tones, where Sibelius puts them: `5` quarter sharp, `6` quarter flat,
  //    `2` three-quarter sharp, `3` three-quarter flat.
  '5': 'quarterToneSharpStein',
  '6': 'quarterToneFlatStein',
  '2': 'threeQuarterTonesSharpStein',
  '3': 'threeQuarterTonesFlatZimmermann',
}

let slots: Record<string, DrawnSignId> = { ...DEFAULT_SIGN_SLOTS }
const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) fn()
}

export const keypadSignSlots = {
  /** The sign the slot on `key` holds — undefined for a key that is not a sign slot. */
  get: (key: string): DrawnSignId | undefined => slots[key],
  /** Every slot and its sign, in the table's order. */
  all: (): Readonly<Record<string, DrawnSignId>> => ({ ...slots }),
  /** Give a slot another sign. ⛔ Only a key that IS a slot — a typo must not invent one. */
  set(key: string, sign: DrawnSignId): void {
    if (!(key in DEFAULT_SIGN_SLOTS)) throw new Error(`[keypad] "${key}" is not a sign slot — slots: ${Object.keys(DEFAULT_SIGN_SLOTS).join(' ')}`)
    if (slots[key] === sign) return
    slots = { ...slots, [key]: sign }
    notify()
  },
  /** Back to Sibelius's layout. */
  reset(): void {
    slots = { ...DEFAULT_SIGN_SLOTS }
    notify()
  },
  /** Repaint hook: the panel re-lays its grid from here. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
