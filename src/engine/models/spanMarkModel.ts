/**
 * ⭐⭐ **WHAT A SPAN MARK IS, IN THE SCORE'S OWN WORDS** — the engine half of the span-mark family's
 * two tables (`docs/span-mark-family-plan-2026-08-24.md` Phase 3, decision D2).
 *
 * A hairpin, an octave line, a pedalling and a trill are *one idea built four times*: a line spanning
 * music, two draggable ends, a rung on the below-staff ladder, a wrap at every system break. This
 * table is where the parts of that idea a **score** can answer live — what the mark is called, how
 * its stored vertical is signed, and where its hand-nudges are kept.
 *
 * ⭐⭐ **TWO TABLES, because the two halves sit on opposite sides of `lint:boundary`.** A mark's ops
 * live in `engine/models/`; the gestures that drive it live in `interactions/`, and `engine/` may not
 * import `interactions/`. So there is no single object that can name both: this one holds the SCORE's
 * vocabulary, {@link SPAN_MARK_TOOLS} holds the EDITOR's, and they are keyed by the same
 * {@link SpanMarkKind}. It is the shape `engine/rendering/ghostTypes.ts` + `interactions/toolGhost.ts`
 * already uses.
 *
 * ⚠️ **This table may name nothing above `engine/models/`** — not `MusicEngine` (the editor's facade,
 * `docs/DESIGN-PRINCIPLES.md` §5), not `engine/rendering/`. Anything that calls an engine METHOD or
 * draws INK belongs in the tools table or beside the drawing; a member here reads the `Score` and
 * nothing else. That is not a style preference: `engine/models/` imports `engine/rendering/` nowhere
 * today, and this table must not be the first.
 *
 * ⭐⭐ **IT IS TOTAL, AND THAT IS THE WHOLE POINT** (the plan's `[A4]`, the clause not to trade away).
 * A registry earns its keep only when the compiler REFUSES a kind that forgot its row — which is why
 * this is a `Record<SpanMarkKind, …>` and ⛔ never an array, never a `Partial<…>`, never an index
 * signature. Each of those three silently accepts a missing kind, and the miss is invisible until the
 * kind that was forgotten ships.
 *
 * ⭐ **When a kind needs a member its siblings have no use for, the SPEC grows an optional member —
 * the TABLE does not become partial.** A total table of specs with optional members still fails to
 * build on a missing *kind*; a `Partial` table does not.
 *
 * ⚠️ The union widens **one kind at a time** — pedal in Phase 3, the octave line in Phase 4 — and each
 * widening makes `tsc` demand the row, which is the totality doing its job rather than a promise that
 * it will.
 */
import type { Score } from '@/types/music'
import { ottavaOffsetOverrideOf, pedalOffsetOverrideOf, trillOffsetOverrideOf } from './engravingOverrides'

/** The span marks driven through the shared family. ⭐ Widening this is how a kind JOINS: `tsc`
 *  then refuses every table until the new row is written. */
export type SpanMarkKind = 'pedal' | 'ottava' | 'trill'

/** A span's two ends, named the way `selectedElement.endpoint` names them. */
export type SpanMarkEnd = 'start' | 'end'

/**
 * Which of a span mark's stored nudges a number names.
 *
 * ⭐ **Three numbers, not four** — the two horizontals are per END, the vertical is ONE for the whole
 * mark. That is the family's shape rather than an economy: a pedal and its own release share a
 * baseline (Gould p. 333), and a bracket's two ends sit on one straight rule, so a second height
 * would be two places the same pixels could come from.
 */
export type SpanMarkOffsetField = SpanMarkEnd | 'vertical'

/** How a kind's stored VERTICAL is signed — the one fact about it that differs across the family. */
export type SpanMarkVertical =
  /** `+` is DOWN the screen, wherever the mark is drawn. The pedal's, because it has one side
   *  permanently: there is no flip for an outward spelling to survive. */
  | 'screen'
  /** `+` is FURTHER FROM THE STAFF. The bracket's and the trill's, because their side is derived
   *  (`shift`, the ornament's placement) and an outward number survives the flip. */
  | 'outward'

/** What the score can say about one kind of span mark. */
export interface SpanMarkModelSpec {
  /** How the mark is named in an undo label and a log line — lower case, as a sentence would say it
   *  ("Add pedal", "· Pedal stamp: …"). */
  noun: string

  /** How this kind's stored vertical is signed. ⭐ Read by the EDGES with a direction on them — the
   *  keyboard's `↑` and the Properties box — and by nothing in between. */
  vertical: SpanMarkVertical

  /** What ONE END of this mark is called in a log line. ⭐ The bracket, the wedge and the trill have
   *  *ends*; a pedalling has two SIGNS (`Ped.` and `✻`) and no drawn line between them, so calling
   *  them ends would name something the reader cannot see. */
  endNoun: string

  /**
   * The mark's stored hand-nudge for one of its three numbers, in staff-spaces; **0 when it carries
   * none**, which is also the engraver's own value.
   *
   * ⚠️ Read from the COMPARTMENT, never from whatever a panel last painted: the number on screen is
   * a picture of the model, never a second copy of it (docs/engraving-overrides-plan.md §8).
   */
  offsetOf(score: Score, id: string, field: SpanMarkOffsetField): number
}

export const SPAN_MARK_MODEL: Record<SpanMarkKind, SpanMarkModelSpec> = {
  pedal: {
    noun: 'pedal',
    // ⭐ SCREEN, and it is the family's odd one out: `PedalOffsetOverride.y` is `+ down` because a
    // pedalling is below the staff permanently, so `outward` would differ from it by a sign that
    // never changes. See that interface's own note.
    vertical: 'screen',
    endNoun: 'sign',
    offsetOf: (score, id, field) => {
      const o = pedalOffsetOverrideOf(score, id)
      if (field === 'vertical') return o?.y ?? 0
      return (field === 'start' ? o?.startX : o?.endX) ?? 0
    },
  },

  ottava: {
    noun: 'ottava',
    // ⭐⭐ OUTWARD, and the exception is earned twice over (see `OttavaOffsetOverride`'s own note): an
    // octave line's side is DERIVED from `shift`, and `x` FLIPS it — so a screen `y` would turn a
    // nudge that cleared the music into a shove into it the moment 8va became 8vb. ⛔ The pedal's
    // spelling cannot simply be copied across.
    vertical: 'outward',
    endNoun: 'end',
    offsetOf: (score, id, field) => {
      const o = ottavaOffsetOverrideOf(score, id)
      if (field === 'vertical') return o?.outward ?? 0
      return (field === 'start' ? o?.startX : o?.endX) ?? 0
    },
  },

  trill: {
    noun: 'trill',
    // ⭐ `outward`, the bracket's spelling — but for the PEDAL's reason rather than the bracket's:
    // there is no straight rule here that a second height could tilt, there is a sign and a wiggle
    // that read as one. It is `outward` because an ornament CAN change sides (`placement`).
    vertical: 'outward',
    endNoun: 'end',
    offsetOf: (score, id, field) => {
      const o = trillOffsetOverrideOf(score, id)
      if (field === 'vertical') return o?.outward ?? 0
      return (field === 'start' ? o?.startX : o?.endX) ?? 0
    },
  },
}
