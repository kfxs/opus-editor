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

import type { Accidental, Alteration, AlterationSignId, DrawnSignId, NaturalBeforeSignId } from '@/types/music'

export type { Alteration, AlterationSignId, DrawnSignId }

export interface AlterationSign<Id extends DrawnSignId = AlterationSignId> {
  readonly id: Id
  /** The SMuFL glyph the sign is drawn with. */
  readonly glyph: string
  /** ⭐ Its place in the fixed order of signs (decision B) — ⛔ never a sound. */
  readonly rank: number
  /** Its text in a pitch LABEL and a note key string (`C#4`, `'c#/4'` — VexFlow's spelling, kept). */
  readonly code: string
}

/** ⭐ THE TABLE. A new sign is a ROW here (+ a row in the tuning, when it should sound). */
export const ALTERATION_SIGNS: readonly AlterationSign[] = [
  { id: 'doubleFlat', glyph: 'accidentalDoubleFlat', rank: -4, code: 'bb' },
  // ⭐ K4 — the quarter-tones take the ODD ranks (decision B), between the signs they sit between. Gould p. 96
  //    (*"recommended that all four … are used"*), Stein's and Zimmermann's glyphs as Sibelius draws them.
  //    Codes: VexFlow's own (`db` `d` `+` `++`) — a LABEL only.
  { id: 'threeQuarterTonesFlatZimmermann', glyph: 'accidentalThreeQuarterTonesFlatZimmermann', rank: -3, code: 'db' },
  { id: 'flat', glyph: 'accidentalFlat', rank: -2, code: 'b' },
  { id: 'quarterToneFlatStein', glyph: 'accidentalQuarterToneFlatStein', rank: -1, code: 'd' },
  { id: 'quarterToneSharpStein', glyph: 'accidentalQuarterToneSharpStein', rank: 1, code: '+' },
  { id: 'sharp', glyph: 'accidentalSharp', rank: 2, code: '#' },
  { id: 'threeQuarterTonesSharpStein', glyph: 'accidentalThreeQuarterTonesSharpStein', rank: 3, code: '++' },
  { id: 'doubleSharp', glyph: 'accidentalDoubleSharp', rank: 4, code: '##' },
  // ⭐ K7 — Gould's ARROW quarter-tones (his Keypad, 2026-10-10): the same odd ranks as Stein's signs they stand
  //    for (a rank is an ORDER, ties allowed). Codes: the plain sign's + `^` / `v` — a LABEL only.
  { id: 'threeQuarterTonesFlatArrowDown', glyph: 'accidentalThreeQuarterTonesFlatArrowDown', rank: -3, code: 'bv' },
  { id: 'quarterToneFlatArrowUp', glyph: 'accidentalQuarterToneFlatArrowUp', rank: -1, code: 'b^' },
  { id: 'quarterToneSharpNaturalArrowUp', glyph: 'accidentalQuarterToneSharpNaturalArrowUp', rank: 1, code: 'n^' },
  { id: 'quarterToneSharpArrowDown', glyph: 'accidentalQuarterToneSharpArrowDown', rank: 1, code: '#v' },
  { id: 'threeQuarterTonesSharpArrowUp', glyph: 'accidentalThreeQuarterTonesSharpArrowUp', rank: 3, code: '#^' },
]

/**
 * ⭐ The NATURAL's row — a sign the page DRAWS (a cancellation, a courtesy) and ⛔ a pitch never
 * stores. It sits outside {@link ALTERATION_SIGNS} on purpose: that table is what a pitch may carry.
 */
export const NATURAL_SIGN: AlterationSign<'natural'> = { id: 'natural', glyph: 'accidentalNatural', rank: 0, code: 'n' }

/**
 * ⭐ **♮♯ and ♮♭** (K5) — DRAWN signs the editor arms like any other, ⛔ never stored: each stands for its `stores`
 * sign plus `NotePitch.naturalBefore` (decision C: the note IS a plain sharp / flat; the natural in front is how it
 * is drawn). The glyph is the font's own precomposed pair. Rank = the stored sign's.
 */
export const NATURAL_BEFORE_SIGNS: readonly (AlterationSign<NaturalBeforeSignId> & { readonly stores: AlterationSignId })[] = [
  { id: 'naturalSharp', glyph: 'accidentalNaturalSharp', rank: 2, code: 'n#', stores: 'sharp' },
  { id: 'naturalFlat', glyph: 'accidentalNaturalFlat', rank: -2, code: 'nb', stores: 'flat' },
]

const BY_ID = new Map<DrawnSignId, AlterationSign<DrawnSignId>>(
  [...ALTERATION_SIGNS, NATURAL_SIGN, ...NATURAL_BEFORE_SIGNS].map(sign => [sign.id, sign]))
const STORES = new Map<DrawnSignId, AlterationSignId>(NATURAL_BEFORE_SIGNS.map(s => [s.id, s.stores]))
const NATURAL_BEFORE_OF = new Map<AlterationSignId, NaturalBeforeSignId>(NATURAL_BEFORE_SIGNS.map(s => [s.stores, s.id]))
const BY_CODE = new Map(ALTERATION_SIGNS.map(sign => [sign.code, sign]))

/** The row of a sign. */
export function alterationSign(id: AlterationSignId): AlterationSign {
  return BY_ID.get(id) as AlterationSign
}

/** The row of a DRAWN sign — the natural included. */
export function drawnSign(id: DrawnSignId): AlterationSign<DrawnSignId> {
  return BY_ID.get(id)!
}

/**
 * ⭐ The sign an alteration DRAWS — its sign, or the natural for none (asked only where a sign IS drawn).
 * ⚠️ One glyph per pitch today: a list of several (Helmholtz-Ellis) draws its FIRST until the drawing
 * learns to stack them — no stored list holds more than one yet.
 */
export function drawnSignOf(alteration: Alteration | undefined): DrawnSignId {
  return alteration?.[0] ?? 'natural'
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
// The armed sign (what a Keypad SLOT holds — K1: any sign of the table, or the natural)
// ---------------------------------------------------------------------------

/**
 * The armed {@link Accidental} as an alteration: a sign is itself; ♮ / nothing → unaltered.
 * ⚠️ ♮ is not a sign a pitch STORES — the natural is what the bar's rule draws to cancel.
 */
export function armedAlteration(acc: Accidental | null | undefined): Alteration | undefined {
  if (!acc || acc === 'natural') return undefined
  return oneSign(STORES.get(acc) ?? (acc as AlterationSignId))
}

/** ⭐ Does the armed sign draw a NATURAL before it — ♮♯ / ♮♭ (K5)? Then the pitch carries `naturalBefore`. */
export function armsNaturalBefore(acc: Accidental | null | undefined): boolean {
  return !!acc && STORES.has(acc)
}

/** The `naturalBefore` an armed sign writes — `true` for ♮♯ / ♮♭, ⭐ `undefined` (= take it OFF) for any other. */
export function naturalBeforeOfArmed(acc: Accidental | null | undefined): true | undefined {
  return armsNaturalBefore(acc) ? true : undefined
}

/**
 * ⭐ What an armed sign asks the entered note to SHOW beyond its alteration — the natural is drawn on purpose
 * (`forceAccidental`), ♮♯ / ♮♭ carry `naturalBefore` (K5). Spread into an entry's params: ONE answer for every door.
 */
export function armedDisplay(acc: Accidental | null | undefined): { forceAccidental?: true; naturalBefore?: true } {
  if (acc === 'natural') return { forceAccidental: true }
  return armsNaturalBefore(acc) ? { naturalBefore: true } : {}
}

/**
 * ⭐ Does a note SHOW the armed sign — the editor's toggle question (`MusicEngine.noteDisplaysAccidental`)? It
 * carries the sign (♮♯ and ♯ store the same one: the ♮, `naturalBefore`, tells them apart — K5) AND the sign is on
 * the page: forced, or not silently in force from the bar or the key (`prevailing`).
 */
export function showsArmedSign(
  note: { alteration?: Alteration; naturalBefore?: true; forceAccidental?: boolean },
  acc: Accidental,
  prevailing: Alteration | undefined,
): boolean {
  const target = armedAlteration(acc)
  if (!sameAlteration(note.alteration, target) || (note.naturalBefore === true) !== armsNaturalBefore(acc)) return false
  return note.forceAccidental === true || !sameAlteration(prevailing, target)
}

/** Write `naturalBefore` onto a pitch in place — ⭐ DELETING it for "no", absent being its only spelling. */
export function setNaturalBeforeField(pitch: { naturalBefore?: true }, on: true | undefined | boolean): void {
  if (on) pitch.naturalBefore = true
  else delete pitch.naturalBefore
}

/**
 * ⭐ The sign a pitch DRAWS, its ♮ included: its alteration's sign, or ♮♯ / ♮♭ when it carries `naturalBefore` and
 * its sign has such a row (a plain sharp / flat). ⛔ Asked only where a sign IS drawn.
 */
export function drawnSignOfPitch(pitch: { alteration?: Alteration; naturalBefore?: true }): DrawnSignId {
  const sign = drawnSignOf(pitch.alteration)
  if (!pitch.naturalBefore || pitch.alteration?.length !== 1) return sign
  return NATURAL_BEFORE_OF.get(pitch.alteration[0]) ?? sign
}

/** Is the armed sign the NATURAL — the one that is drawn on purpose (`forceAccidental`), never stored? */
export function armsNatural(acc: Accidental | null | undefined): boolean {
  return acc === 'natural'
}

/** The sign an alteration lights on the Keypad — its own (a double lights the double's slot); none unaltered. ⭐ With
 *  `naturalBefore` (K5) a plain sharp / flat lights ♮♯ / ♮♭. */
export function accidentalOfAlteration(alteration: Alteration | undefined, naturalBefore?: true): Accidental | undefined {
  if (!alteration?.length) return undefined
  return drawnSignOfPitch({ alteration, naturalBefore })
}

// ---------------------------------------------------------------------------
// The label strings ('#', 'b', '##', 'bb') — a pitch LABEL and a note key string, ⛔ not the drawing
// ---------------------------------------------------------------------------

/** An alteration's label text: `''`, `'#'`, `'##'`, `'b'`, `'bb'` (`C#4`, `'c#/4'`). */
export function alterationCode(alteration: Alteration | undefined): string {
  return (alteration ?? []).map(id => alterationSign(id).code).join('')
}

/** ⚠️ The way back from a label string ('#', 'bb', …) — `'n'` / `''` are unaltered. */
export function alterationOfCode(code: string | undefined): Alteration | undefined {
  const sign = code ? BY_CODE.get(code) : undefined
  return sign ? oneSign(sign.id) : undefined
}
