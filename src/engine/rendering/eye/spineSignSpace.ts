/**
 * ⭐ **A HEADER SIGN ON THE SPINE — picked, and moved** (`docs/plans/bent-staff-plan.md` §9; his ask 2026-09-28:
 * *"select independently too the clef and the time signature and be able to move it too"*).
 *
 * Two things, both the spine's own:
 *
 * - **the TAG** a drawn clef or meter carries ({@link SPINE_SIGN_ATTR}), so a click in the panel can name it —
 *   in the ENGINE's words ({@link SpineSign}); the editor translates it into its own selection, as it does a
 *   barline (⛔ the engine may not import `interactions/`);
 * - **its SPACE** — room before the sign along the path, the note's knob (`./spineColumnSpace`) for a header
 *   sign: it MOVES the sign and everything after it (the key signature, the meter, the music), ⛔ never an
 *   offset of the ink. It widens the gap before the sign in the header's lined-up COLUMNS
 *   (`./spineHeader.spineHeaderColumns`), so every staff's clef (or meter) at that bar moves together and the
 *   system's signs stay lined up. Tighter stops when the sign meets what stands before it (the gap reaches 0).
 *
 * ⚠️ **Kept for the SESSION only**, held by the panel (plan §9.3 C — undecided). ⛔ No DOM.
 */
import type { Score } from '@/types/music'

/** The header signs the spine lets you pick and move — the engine's names for them. */
export type SpineSign =
  | { kind: 'clef'; measure: number; staff: number }
  | { kind: 'timeSignature'; measure: number }

/** The attribute a drawn clef or meter carries — {@link spineSignTag}'s value. */
export const SPINE_SIGN_ATTR = 'data-spine-sign'

/** A sign as its tag: `clef:<bar>:<staff index>` or `timeSignature:<bar>`. */
export function spineSignTag(sign: SpineSign): string {
  return sign.kind === 'clef' ? `clef:${sign.measure}:${sign.staff}` : `timeSignature:${sign.measure}`
}

/** A tag back to its sign — undefined for anything else. */
export function spineSignFromTag(tag: string | null | undefined): SpineSign | undefined {
  const [kind, measure, staff] = (tag ?? '').split(':')
  if (kind === 'clef' && measure && staff) return { kind, measure: Number(measure), staff: Number(staff) }
  if (kind === 'timeSignature' && measure) return { kind, measure: Number(measure) }
  return undefined
}

/** Whether two signs are the same one. */
export function sameSpineSign(a: SpineSign | null | undefined, b: SpineSign | null | undefined): boolean {
  return !!a && !!b && spineSignTag(a) === spineSignTag(b)
}

/** The header COLUMN a sign stands in — the kind of part (`./spineHeader`) whose gap its space widens. */
export type SpineSignColumn = 'clef' | 'meter'
const columnOf = (sign: SpineSign): SpineSignColumn => (sign.kind === 'clef' ? 'clef' : 'meter')

/** `<measure id>:clef` / `<measure id>:meter` → staff spaces before that column of the bar's header. */
export type SpineSignSpaces = ReadonlyMap<string, number>

/** The key a sign's space is kept by — its bar's ID (a rebar keeps it) and its header column. */
export function spineSignSpaceKey(score: Score, sign: SpineSign): string | undefined {
  const measure = score.measures.find(m => m.number === sign.measure)
  return measure && `${measure.id}:${columnOf(sign)}`
}

/** The px each header column of the bar with this id is pushed along by — what `spineHeaderColumns` adds to its gaps. */
export function spineSignShift(
  spaces: SpineSignSpaces | undefined, measureId: string, spacePx: number,
): Partial<Record<SpineSignColumn, number>> {
  if (!spaces || spaces.size === 0) return {}
  const shift: Partial<Record<SpineSignColumn, number>> = {}
  for (const column of ['clef', 'meter'] as const) {
    const space = spaces.get(`${measureId}:${column}`)
    if (space) shift[column] = space * spacePx
  }
  return shift
}
