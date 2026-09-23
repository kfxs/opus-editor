import { PaletteToggleSet } from './paletteToggleSet'

/**
 * ⭐ **The Keypad's GRACE keys** — its Grace page's `/` (appoggiatura), `*` (acciaccatura) and `-` (bracketed
 * grace), wired the dev toolbar's way (his ask, 2026-09-23: *"wire the grace page of the keypad the same way
 * is wired the dev shell grace pallete"*). A press is routed to the SAME functions the toolbar's buttons call
 * (`interactions/controllers/keypadGraceWiring`); the lights come back from their own lit rules — a SET,
 * because a selection holding a grace and a bracketed grace lights both.
 */
export type GraceKey = 'appoggiatura' | 'acciaccatura' | 'bracketed'

export const createGraceSelection = () => new PaletteToggleSet<GraceKey>()
