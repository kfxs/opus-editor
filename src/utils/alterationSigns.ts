/**
 * ⭐ **THE SIGN TABLE** — every alteration sign a pitch may carry, a ROW each
 * (docs/plans/alteration-signs-plan.md §2).
 *
 * A row is the SIGN as WRITTEN: its id (what the score file will store, M2), the SMuFL glyph it is
 * drawn with, and its RANK — the fixed order of signs, decision B: double flat −4 … flat −2 … sharp +2
 * … double sharp +4, the quarter-tones taking the odd numbers when they arrive.
 *
 * ⛔ **The rank is an order for WRITING, never a sound.** It answers *"of two pitches on the same
 * line, which is written higher?"*; what a sign SOUNDS like is the tuning's question, asked only in
 * `engine/audio/` (the score holds no tuning — docs/research/alteration-signs-research.md §6).
 *
 * ⭐ The id is the SMuFL name WITHOUT its family prefix (`accidentalSharp` → `sharp`; a Sagittal
 * `accSagittal…` → `sagittal…`): the field that holds it is already called `alteration`, and the full
 * SMuFL name stays in the `glyph` column, where the drawing looks it up. A sign made of two glyphs
 * (♮♯ — decision E) will need a list there, the day it has a row.
 *
 * ⚠️ M0: the score still stores `alter` (a number). {@link signsOfAlter} is the bridge from that
 * number to the table, and leaves when M2 flips the storage.
 */

import type { PitchAlter } from '@/types/music'

/** A sign's id — the SMuFL glyph name without its `accidental` / `acc` prefix. */
export type AlterationSignId = 'doubleFlat' | 'flat' | 'sharp' | 'doubleSharp'

export interface AlterationSign {
  readonly id: AlterationSignId
  /** The SMuFL glyph the sign is drawn with. */
  readonly glyph: string
  /** ⭐ Its place in the fixed order of signs (decision B) — ⛔ never a sound. */
  readonly rank: number
}

/** ⭐ THE TABLE. A new sign is a ROW here (+ a row in the tuning, when it should sound). */
export const ALTERATION_SIGNS: readonly AlterationSign[] = [
  { id: 'doubleFlat', glyph: 'accidentalDoubleFlat', rank: -4 },
  { id: 'flat', glyph: 'accidentalFlat', rank: -2 },
  { id: 'sharp', glyph: 'accidentalSharp', rank: 2 },
  { id: 'doubleSharp', glyph: 'accidentalDoubleSharp', rank: 4 },
]

const BY_ID = new Map(ALTERATION_SIGNS.map(sign => [sign.id, sign]))

/** The row of a sign. */
export function alterationSign(id: AlterationSignId): AlterationSign {
  return BY_ID.get(id)!
}

/**
 * The rank of a LIST of signs (a pitch carries a list — decision A). Absent or empty = unaltered = 0.
 * ⚠️ No list holds more than one sign yet; the sum is a placeholder for the day one does
 * (Helmholtz-Ellis), not a decided rule.
 */
export function alterationRank(signs: readonly AlterationSignId[] | undefined): number {
  let rank = 0
  for (const id of signs ?? []) rank += alterationSign(id).rank
  return rank
}

const ALTER_SIGNS: Record<PitchAlter, readonly AlterationSignId[]> = {
  [-2]: ['doubleFlat'],
  [-1]: ['flat'],
  [0]: [],
  [1]: ['sharp'],
  [2]: ['doubleSharp'],
}

/** ⚠️ M0's BRIDGE — today's stored number as the signs it means. Leaves with M2. */
export function signsOfAlter(alter: number | undefined): readonly AlterationSignId[] {
  return ALTER_SIGNS[(alter ?? 0) as PitchAlter] ?? []
}
