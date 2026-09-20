/**
 * TUPLETS — the group's shape (what it IS) and its format (how its mark is drawn).
 *
 * One chapter of the score's types — import it through the barrel, `@/types/music`.
 */
import type { NoteDuration, Fraction } from './duration'

/**
 * What a tuplet IS, with no `id` and no position: **N notes of one value in the time of M notes of
 * another**. Two sides, each a count and a note value — MusicXML's `<tuplet-actual>` /
 * `<tuplet-normal>`, and Finale's two dropdowns.
 *
 * It is split out from {@link Tuplet} because this — and NOT the id or the beat — is what gets ARMED
 * (`EditorState.armedTuplet`), what a creation call needs, and what every span calculation reads.
 * See docs/tuplet-extension-plan.md.
 *
 * ⚠️ N:M is TWO INTEGERS, never a `Fraction`: `fracCreate` reduces by gcd, and 6:4 → 3:2 turns a
 * sextuplet into a triplet. The scaling factor `span ÷ (N × unit)` is a Fraction; the identity is not.
 */
export interface TupletShape {
  /** N — how many notes are squeezed in (3 for a triplet). */
  numNotes: number
  /** M — how many they replace (2 for a triplet). ALWAYS a count of {@link baseDuration}, because
   *  that is what the ratio means: both numbers count the same note. What the user typed on the
   *  other side is remembered separately, in {@link normalCount}. */
  notesOccupied: number
  /** The ACTUAL side's note value: what the tuplet's notes are WRITTEN as ('q' for a triplet of
   *  quarters). Also the yardstick the mark's ratio is quoted in. */
  baseDuration: NoteDuration
  /**
   * Dots on that value — a triplet of DOTTED quarters. Absent = 0, which keeps every existing score
   * byte-identical.
   *
   * The unit is a note VALUE, and a note value can be dotted; Finale's two dropdowns list "Dotted
   * Quarter(s)" beside "Quarter(s)", and MusicXML carries `<tuplet-dot>` for the same reason. Without
   * it the dot has nowhere to go and cannot be worked around — `numNotes` counts NOTES, so respelling
   * the group in undotted units would change the ratio into a different tuplet.
   *
   * ⚠️ It must reach every span calculation. That is why they take this whole object
   * ({@link ../utils/musicUtils.tupletSpan}) rather than loose arguments: a function handed the
   * tuplet cannot be handed half of it, and a dropped dot computes a span a third short, silently.
   */
  baseDots?: number
  /**
   * The NORMAL side's own note value — "5 sixteenths in the time of 1 QUARTER".
   *
   * **Absent = the same value as the actual side**, which is what the model meant before this field
   * existed, so every older tuplet reads back identically and nothing migrates. Written only when
   * the user actually said something different.
   *
   * It exists because the ratio alone throws away the question and keeps only the answer: a stored
   * `5:4` cannot say "in the time of *what*", and a mark that prints a note value beside its ratio
   * (Sibelius's *Ratio + note*, Finale's `Xq:Yq`) needs it.
   *
   * ⛔ Not arithmetic — see {@link normalCount}.
   */
  normalDuration?: NoteDuration
  /** Dots on the normal side's value ("in the time of one DOTTED quarter"). Meaningless without
   *  {@link normalDuration}, and ignored when it is absent — the actual side's dots apply then. */
  normalDots?: number
  /**
   * The COUNT the user typed on the normal side — the "4" in "3 dotted quarters in the time of 4
   * eighths".
   *
   * `notesOccupied` is that count CONVERTED into the actual side's value, because that is what the
   * ratio means (both numbers count the same note). The conversion is not reversible: 4 eighths and
   * 2 quarters land on the same `notesOccupied`, and a mark that wants to say which one the user
   * meant has no way to ask.
   *
   * So this is the last of the six values that make up the typed sentence — N, its value, its dots,
   * M, its value, its dots — and with it the entry can be reconstructed exactly. Absent = both sides
   * are the same note value, where `notesOccupied` already IS the typed count.
   *
   * ⛔ Not arithmetic. Nothing computes from it; {@link ../utils/musicUtils.tupletSpan} and friends
   * read the actual side only.
   */
  normalCount?: number
}

/**
 * Tuplet definition (e.g., triplet = 3 notes in the time of 2) — a {@link TupletShape} placed in a
 * bar, with an identity and the engraving overrides that ride on it.
 */
export interface Tuplet extends TupletShape, TupletFormat {
  /** Unique identifier for the tuplet */
  id: string
  /** Beat position where the tuplet starts (exact rational) */
  startBeat: Fraction
  /**
   * Explicit bracket/number placement override. When undefined the side is
   * auto-derived from stem direction (bracket opposite the stems); setting this
   * forces the side, e.g. via the `x` flip. 'above' = LOCATION_TOP, 'below' = LOCATION_BOTTOM.
   */
  placement?: 'above' | 'below'
  /** Staff this tuplet belongs to (a {@link StaffInfo} id); absent = staff 0. See
   *  docs/multi-staff-plan.md §4. Orthogonal to voice (the owning slots carry it). */
  staffId?: string
}

/**
 * The Tuplet window's left column — what the mark says. `undefined` on a {@link Tuplet} = auto.
 *
 * `ratio` quotes both figures in the tuplet's OWN written unit, which is what a bare `5:4` means.
 * `entryRatio` quotes them as the user TYPED them, with each side's note value beside it —
 * `5𝅘𝅥𝅯:1♩` for "five sixteenths in the time of one quarter". The two differ exactly when the sentence
 * used two note values, and that is the case where a bare ratio makes the reader reconstruct the
 * second side. It is printable only because the entry is kept ({@link TupletShape.normalCount} and
 * friends) instead of being folded into the ratio.
 */
export type TupletNumberStyle = 'number' | 'ratio' | 'ratioNote' | 'entryRatio' | 'none'

/**
 * One piece of a printed tuplet mark: a run of text, and whether it is a note GLYPH.
 *
 * A mark is a list of runs rather than a string because its parts are drawn at different sizes — the
 * tuplet figures are cut small inside their em, a `metNote…` fills its own, and one font size for
 * both puts a note twice the height of the numbers. With two note values interleaved
 * (`5𝅘𝅥𝅯:1♩`) the sizes alternate, so a "text plus a trailing glyph" pair cannot describe it.
 */
export interface TupletMarkRun {
  text: string
  /** Drawn in the music font at the smaller note-glyph size. Absent = the figures' size. */
  glyph?: boolean
  /**
   * Leave air BEFORE this run. A gap the renderer measures, not a space character: a music font's
   * space is next to nothing wide, so spelling it would put the runs back to back.
   */
  space?: boolean
}

/** Whether the group gets a bracket. `auto` (and absent) = the renderer's rule — no bracket when a
 *  beam already shows the grouping, one when it does not. */
export type TupletBracket = 'auto' | 'always' | 'never'

/**
 * Where the bracket STOPS — Dorico's three, in its Engraving Options ▸ Tuplets ▸ Horizontal Position,
 * because the real question is three-way and not the tickbox Sibelius offers ("full duration").
 *
 * `lastNote` ends at the right-hand edge of the final notehead — Sibelius's and Finale's untouched
 * behaviour. `division` ends where the group's TIME ends, so the bracket covers a final rest or the
 * full length of a final long note. `beforeNext` ends just short of whatever follows.
 *
 * Absent = the renderer's rule, which is `lastNote` — the long bracket is opt-in, per
 * {@link ../utils/musicUtils.DEFAULT_TUPLET_BRACKET_END}.
 */
export type TupletBracketEnd = 'lastNote' | 'division' | 'beforeNext'

/**
 * The Tuplet dialog's *Format* box: everything about how the group is DRAWN, and nothing about what
 * it plays. A tuplet with no format at all engraves by the renderer's own rules — every field is
 * absent-means-auto, so an ordinary triplet stores nothing and serializes exactly as it always did.
 *
 * One named group, rather than three loose fields, because these travel TOGETHER: the window sets
 * them before the notes exist, they ride on the armed tuplet, and they are written when the group is
 * created. A trio of positional arguments through five call layers is how one of them goes missing.
 *
 * ⚠️ They are HOW IT LOOKS. Nothing here may ever be read by `tupletSpan`, `tupletScale` or anything
 * that computes time — a format that changed the rhythm would be a format that is not a format.
 */
export interface TupletFormat {
  /**
   * What the mark PRINTS: the number alone (`3`), the ratio (`3:2`), the ratio with the note value
   * beside it (`3:2♪`), or nothing. Absent = auto — the rule in
   * {@link ../utils/musicUtils.autoNumberStyle}: the ratio when N is a power of two greater than 2
   * (`4`, `8` — the numbers a reader cannot complete), the bare number otherwise.
   *
   * ⛔ The printed STRING is deliberately not stored. Tempo marks and dynamics are text-as-truth
   * because their text carries meaning nothing else holds; a tuplet is the opposite — the numbers
   * ARE the rhythm, so a stored `"5:4"` would go on saying 5:4 after the tuplet changed and the mark
   * would be lying about the notes under it. Style in, string derived.
   */
  numberStyle?: TupletNumberStyle
  /** Whether the group is bracketed. See {@link TupletBracket}. */
  bracket?: TupletBracket
  /** Where that bracket stops. See {@link TupletBracketEnd}. Meaningless without a bracket, and the
   *  dialog greys it out then — but it is kept, so turning the bracket back on restores the choice. */
  bracketEnd?: TupletBracketEnd
}
