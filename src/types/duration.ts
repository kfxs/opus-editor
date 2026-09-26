/**
 * The written LENGTHS — a note value's name, and the exact `Fraction` every beat is counted in.
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { Fraction } from '../utils/fraction'
export type { Fraction }

/**
 * Note duration types supported by the editor
 */
export type NoteDuration = 'longa' | 'breve' | 'w' | 'h' | 'q' | '8' | '16' | '32' | '64' | '128' | '256' | '512'
