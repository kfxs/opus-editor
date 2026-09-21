/**
 * ⭐⭐ **THE SCORE'S TEXT ROLES — one table** (`docs/plans/text-font-switch-plan.md` §5; the survey behind
 * it is `docs/research/score-text-roles-research.md`).
 *
 * Every mature engine has the same shape (survey §4): a few document-level FACES, and under them a flat
 * table of ROLES — each row a face kind, a STYLE and a SIZE — that every draw site asks. We had the
 * roles and no table: sizes were constants beside each mark, in four units (survey §5). This is the
 * table. ⭐ **It moved no pixel**: every row is the value that ran the day it was written
 * (2026-09-21), restated in the portable unit, and each row's comment keeps the source its old
 * constant carried.
 *
 * ## The shape, and why
 *
 * - **Flat and complete (MuseScore's shape), total over {@link TextRole}** — no parent row to inherit
 *   from yet. ⚠️ The survey's option B (a default row + overrides) is open, not rejected: nothing we
 *   draw today is "default text", and a row nobody reads rots (`MEASURE_NUMBER_SIZE_PT` did).
 *   ⛔ So a role joins the union the day something DRAWS it — never "because engines have one".
 * - **`face` says which document-level face answers** — `'words'` (`fonts/textFont`, asked for the
 *   row's style) or `'music'` (`fonts/musicFont`). ⭐ The two `'music'` rows here are exactly the
 *   *symbols inside words*: the door for the THIRD face (a SMuFL "Text" companion —
 *   `docs/research/music-text-fonts-research.md`) is a third value of this column.
 * - **Size in STAFF SPACES of the em** — the unit the engines and the books share (survey §2); points
 *   are derived at the draw ({@link textRoleSizePt}; 1 sp = 7.5 pt on our 10 px staff space).
 *   ⚠️ One row is `'ofItsSign'`: a line mark's parenthesis is sized as a fraction of the sign it wraps
 *   (his taste, tuned by eye — `trillStyle.TRILL_PAREN_SCALE`), so that the two cannot drift. The
 *   fraction stays with the sign; the table owns the row's face and style.
 * - ⛔ No `followsStaffSize` column yet: today that is decided by PLACEMENT (a mark drawn inside its
 *   staff's `scale(k)` group follows it), and a column nothing reads would be a claim nobody checks.
 *
 * ⭐ Every number is one house style's DEFAULT (`docs/plans/music-font-switch-plan.md` §4b): a house
 * style will replace rows here. ⚠️ So readers ask per use — ⛔ never copy a row into a module constant.
 *
 * ⛔ No DOM.
 */
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import { musicFontStack } from '@/engine/fonts/musicFont'
import { textFamily, type TextStyle } from '@/engine/fonts/textFont'

export type TextRole =
  | 'tempoWords'
  | 'tempoSymbol'
  | 'expression'
  | 'dynamicLetters'
  | 'lineParenthesis'

export interface TextRoleRow {
  /** Which document-level face sets it: the score's WORDS, or the MUSIC font. */
  face: 'words' | 'music'
  /** The style the role is set in — for a `'words'` row, what `textFamily` is asked for. */
  style: TextStyle
  /** The em in STAFF SPACES — or `'ofItsSign'`: a fraction of the sign it wraps, owned by that sign. */
  size: number | 'ofItsSign'
}

/** Points per staff space: `STAFF_SPACE_PX` px at the 4/3 px-per-pt every size here is drawn at. */
const PT_PER_SPACE = STAFF_SPACE_PX / (4 / 3)

/** A row stated in the POINTS it was tuned in — so the table's numbers are the ones his eye chose. */
const pt = (points: number): number => points / PT_PER_SPACE

export const TEXT_ROLES: Record<TextRole, TextRoleRow> = {
  /**
   * A tempo's words — **bold roman** (Gould p. 182; Ross p. A-46; Gerou & Lusk p. 142), **18 pt =
   * 2.40 sp**: the top of the verified band (LilyPond 2.2 · MuseScore 2.42), raised from 14 after
   * his report of 2026-08-13 ("too small"). Deliberately LARGER than {@link TEXT_ROLES.expression} —
   * a tempo outranks an expression word (MuseScore states the same gap, 12 pt against 10).
   */
  tempoWords: { face: 'words', style: 'bold', size: pt(18) },
  /**
   * The ♩ of a metronome mark — a SYMBOL INSIDE WORDS, from the music font's text-sized `metNote…`
   * cut (U+ECA0–ECB7), **20 pt = 2.67 sp** against the 18 pt words: tuned by eye so the note reads
   * with `Allegro (♩ = 144)`. ⚠️ Where the glyph sits against the words' baseline is the FACE's:
   * Bravura's and Leipzig's hang below it (−141 / −126 of 1000), Sebastian's sits on it.
   */
  tempoSymbol: { face: 'music', style: 'regular', size: pt(20) },
  /**
   * Expression words and a dynamic's prose (`dolce`, `cresc.`, `sempre`) — **italic, never bold**
   * (Gould pp. 101, 492), **16 pt = 2.13 sp**: near the top of the band (MuseScore 2.02 · LilyPond
   * 2.20), raised from 14 on 2026-08-13; = Gould's lyric rule (x-height 1 sp ⇒ 2.14 in Academico).
   */
  expression: { face: 'words', style: 'italic', size: pt(16) },
  /**
   * A dynamic's LETTERS (*p f m s z r n*) inside that prose — the music font's glyphs at its root
   * size, **30 pt = 4 sp**, so a `p` beside `dolce` is the same `p` as one standing alone.
   * ⭐ Drawn as a RATIO of this to {@link TEXT_ROLES.expression} (`DynamicsLayout`), which is what
   * keeps the two independent: resizing the prose does not resize the letters.
   */
  dynamicLetters: { face: 'music', style: 'regular', size: pt(30) },
  /**
   * The `( )` round a trill or an ottava sign — italic words-face brackets (SMuFL has no
   * parenthesised `tr`, so every program improvises). ⭐ Sized `'ofItsSign'`: 0.52 of the sign's
   * glyph size, his eye alone (`trillStyle`, `ottavaStyle`) — 13.52 pt = 1.80 sp today.
   */
  lineParenthesis: { face: 'words', style: 'italic', size: 'ofItsSign' },
}

/** The roles whose size the table states outright — everything but an `'ofItsSign'` row. */
export type SizedTextRole = Exclude<TextRole, 'lineParenthesis'>

/** A role's em in staff spaces. */
export function textRoleSpaces(role: SizedTextRole): number {
  return TEXT_ROLES[role].size as number
}

/**
 * A role's size in POINTS — what `setFont` / `font-size="Npt"` take. ⚠️ Rounded to a millionth of a
 * point: a size goes into the SVG's markup, and `18 / 7.5 × 7.5` must come back as `18`, not
 * `18.000000000000004`.
 */
export function textRoleSizePt(role: SizedTextRole): number {
  return Math.round(textRoleSpaces(role) * PT_PER_SPACE * 1e6) / 1e6
}

/**
 * The CSS family stack a role is set in: the words' face in the row's style, or the music stack.
 * ⚠️ A `'words'` run that may carry a music glyph (a tempo mark, a dynamic) appends the music faces
 * itself (`fonts/musicFont.musicOnlyStack`) — that is a fact about the RUN, not the role.
 */
export function textRoleFamily(role: TextRole): string {
  const row = TEXT_ROLES[role]
  return row.face === 'words' ? textFamily(row.style) : musicFontStack()
}

/** The CSS weight / style words of a row's style. */
export function textRoleWeight(role: TextRole): 'normal' | 'bold' {
  const style = TEXT_ROLES[role].style
  return style === 'bold' || style === 'boldItalic' ? 'bold' : 'normal'
}

export function textRoleSlant(role: TextRole): 'normal' | 'italic' {
  const style = TEXT_ROLES[role].style
  return style === 'italic' || style === 'boldItalic' ? 'italic' : 'normal'
}
