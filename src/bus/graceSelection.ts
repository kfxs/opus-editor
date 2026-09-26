import { PaletteToggleSet } from './paletteToggleSet'

/**
 * ⭐ **The Keypad's GRACE keys** — its Grace page's `/` (appoggiatura), `*` (acciaccatura) and `-` (bracketed
 * grace), wired the dev toolbar's way (his ask, 2026-09-23: *"wire the grace page of the keypad the same way
 * is wired the dev shell grace pallete"*). A press is routed to the SAME functions the toolbar's buttons call
 * (`interactions/controllers/keypadGraceWiring`); the lights come back from their own lit rules — a SET,
 * because a selection holding a grace and a bracketed grace lights both.
 *
 * ⭐ …and its `1` (the parenthesised note), wired the dev toolbar's `paren.` way (his ask, 2026-09-26) — the
 * same seam, so the page's wired keys are one family — and its `2` / `3` (double / triple dot), the
 * toolbar's `..` / `...` (his ask, the same day) — its `0`, the full-bar rest (the toolbar's `full bar`) — and
 * its `.`, the glissando (the toolbar's `gliss`) — and its `Enter`, cue size (the toolbar's `cue`).
 */
export type GraceKey = 'appoggiatura' | 'acciaccatura' | 'bracketed' | 'parenthesised' | 'doubleDot' | 'tripleDot' | 'barRest' | 'gliss' | 'cue'

export const createGraceSelection = () => new PaletteToggleSet<GraceKey>()
