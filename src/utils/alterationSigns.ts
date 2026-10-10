/**
 * ⭐ **THE SIGN TABLE** — every alteration sign a pitch may carry, a ROW each
 * (docs/plans/alteration-signs-plan.md §2).
 *
 * A row is the SIGN as WRITTEN: its id (what the score file stores — `Alteration`, a list of these),
 * the SMuFL glyph it is drawn with, and its RANK — the fixed order of signs, decision B: double flat
 * −4 … flat −2 … sharp +2 … double sharp +4, the quarter-tones taking the odd numbers when they arrive.
 *
 * ⛔ **The rank is an order for WRITING, never a sound.** It answers *"of two pitches on the same
 * line, which is written higher?"* and *"is it sharp-like or flat-like?"*; what a sign SOUNDS like is
 * the tuning's question, asked only in `engine/audio/` (the score holds no tuning —
 * docs/research/alteration-signs-research.md §6).
 *
 * ⭐ The id is the SMuFL name WITHOUT its family prefix (`accidentalSharp` → `sharp`; a Sagittal
 * `accSagittal…` → `sagittal…`): the field that holds it is already called `alteration`, and the full
 * SMuFL name stays in the `glyph` column, where the drawing looks it up. A sign made of two glyphs
 * (♮♯ — decision E) will need a list there, the day it has a row.
 *
 * ⛔ An `Alteration` is never EMPTY and never stored as one: unaltered = no field. Every builder here
 * hands back `undefined` for "unaltered", and {@link alterationField} spreads nothing for it.
 */

import type { Accidental, Alteration, AlterationSignId } from '@/types/music'

export type { Alteration, AlterationSignId }

export interface AlterationSign {
  readonly id: AlterationSignId
  /** The SMuFL glyph the sign is drawn with. */
  readonly glyph: string
  /** ⭐ Its place in the fixed order of signs (decision B) — ⛔ never a sound. */
  readonly rank: number
  /** The string the drawing still names it by (VexFlow's, inherited) — goes with M3. */
  readonly code: string
}

/** ⭐ THE TABLE. A new sign is a ROW here (+ a row in the tuning, when it should sound). */
export const ALTERATION_SIGNS: readonly AlterationSign[] = [
  { id: 'doubleFlat', glyph: 'accidentalDoubleFlat', rank: -4, code: 'bb' },
  { id: 'flat', glyph: 'accidentalFlat', rank: -2, code: 'b' },
  { id: 'sharp', glyph: 'accidentalSharp', rank: 2, code: '#' },
  { id: 'doubleSharp', glyph: 'accidentalDoubleSharp', rank: 4, code: '##' },
]

const BY_ID = new Map(ALTERATION_SIGNS.map(sign => [sign.id, sign]))
const BY_CODE = new Map(ALTERATION_SIGNS.map(sign => [sign.code, sign]))

/** The row of a sign. */
export function alterationSign(id: AlterationSignId): AlterationSign {
  return BY_ID.get(id)!
}

/**
 * The rank of a LIST of signs (a pitch carries a list — decision A). Absent = unaltered = 0.
 * ⚠️ No list holds more than one sign yet; the sum is a placeholder for the day one does
 * (Helmholtz-Ellis), not a decided rule.
 */
export function alterationRank(alteration: Alteration | undefined): number {
  let rank = 0
  for (const id of alteration ?? []) rank += alterationSign(id).rank
  return rank
}

/** Sharp-like (+1), flat-like (−1) or unaltered (0) — read off the rank, ⛔ not a sound. */
export function alterationSide(alteration: Alteration | undefined): -1 | 0 | 1 {
  return Math.sign(alterationRank(alteration)) as -1 | 0 | 1
}

/** ⭐ Do two pitches carry the same signs? Absent and absent are the same; nothing else is. */
export function sameAlteration(a: Alteration | undefined, b: Alteration | undefined): boolean {
  const [x, y] = [a ?? [], b ?? []]
  return x.length === y.length && x.every((id, i) => id === y[i])
}

/** `{ alteration }` to spread into a pitch — ⭐ NOTHING for an unaltered one, so no empty list is stored. */
export function alterationField(alteration: Alteration | undefined): { alteration?: Alteration } {
  return alteration && alteration.length ? { alteration } : {}
}

/**
 * Write an alteration onto a pitch in place — ⭐ DELETING the field for an unaltered one, so an
 * update to a natural never leaves `alteration: undefined` (or `[]`) behind.
 */
export function setAlteration(pitch: { alteration?: Alteration }, alteration: Alteration | undefined): void {
  if (alteration && alteration.length) pitch.alteration = alteration
  else delete pitch.alteration
}

/** One sign as a list — the common case. */
export function oneSign(id: AlterationSignId): Alteration {
  return [id]
}

// ---------------------------------------------------------------------------
// The editor's three-key vocabulary ('#' / 'b' / 'n' — what the Keypad arms)
// ---------------------------------------------------------------------------

/**
 * The armed {@link Accidental} as an alteration: ♯ → sharp, ♭ → flat; ♮ / nothing → unaltered.
 * ⚠️ ♮ is not a sign a pitch STORES — the natural is what the bar's rule draws to cancel.
 */
export function armedAlteration(acc: Accidental | null | undefined): Alteration | undefined {
  if (acc === '#') return oneSign('sharp')
  if (acc === 'b') return oneSign('flat')
  return undefined
}

/**
 * The Keypad key that shows an alteration: ♯ for sharp-like, ♭ for flat-like, none when unaltered.
 * Double signs fall back to the single key (the Keypad has no ♯♯/♭♭ key yet).
 */
export function accidentalOfAlteration(alteration: Alteration | undefined): Accidental | undefined {
  const side = alterationSide(alteration)
  return side > 0 ? '#' : side < 0 ? 'b' : undefined
}

// ---------------------------------------------------------------------------
// The drawing's inherited strings ('#', 'b', '##', 'bb') — M3 retires them
// ---------------------------------------------------------------------------

/** The string the drawing names an alteration by: `''`, `'#'`, `'##'`, `'b'`, `'bb'`. */
export function alterationCode(alteration: Alteration | undefined): string {
  return (alteration ?? []).map(id => alterationSign(id).code).join('')
}

/** ⚠️ The way back from a drawing string ('#', 'bb', …) — `'n'` / `''` are unaltered. */
export function alterationOfCode(code: string | undefined): Alteration | undefined {
  const sign = code ? BY_CODE.get(code) : undefined
  return sign ? oneSign(sign.id) : undefined
}
