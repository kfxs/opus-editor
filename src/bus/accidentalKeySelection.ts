import { PaletteToggleSet } from './paletteToggleSet'

/**
 * ⭐ **The Keypad Accidentals page's keys that are NOT sign slots** — today its `Enter`, the accidental's
 * parentheses (docs/plans/alteration-signs-plan.md K3); K5's ♮♯ / ♮♭ join it. A press is routed by
 * `interactions/controllers/keypadAccidentalWiring`; the lights come back from their own lit rules — a SET,
 * like the Grace page's (`./graceSelection`), so two such keys can light together.
 *
 * ⛔ The SIGN keys (`/ * 7 8 9`) are not here: they are slots on `bus.accidental` (K1), and `0` is its REMOVE (K2).
 */
export type AccidentalKey = 'parenthesised'

export const createAccidentalKeySelection = () => new PaletteToggleSet<AccidentalKey>()
