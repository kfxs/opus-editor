/**
 * WHAT THE ENGINE CAN DRAW AT THE CURSOR — the payload of every marking-tool ghost, in one union.
 *
 * ⚠️ **This type exists to keep an arrow pointing the right way.** The obvious shape for
 * `drawToolGhost` was to take the editor's armed `MarkingTool` (`interactions/EditorState.ts`)
 * straight down into the renderer. That inverts `App.ts → interactions → engine`: the engine would
 * import the editor, and the score layer's package boundary (docs/DESIGN-PRINCIPLES.md §5) would be
 * quietly gone. Nothing would have said so — `.eslintrc.boundary.json` fenced only `utils/`,
 * `types/` and `engine/models/` off from `@/interactions` when this was written, so a
 * `tool: MarkingTool` parameter in `VexFlowRenderer` passed all four `build:check` gates. The fence
 * now covers `src/engine/**` too; this union is the other half of the fix.
 *
 * And the two really are different vocabularies, which is why the fence costs nothing:
 *
 *  - a `MarkingTool` says what the NEXT CLICK will do; a `ToolGhost` says what is on the page now.
 *    `dynamicEntry` and `tempoEntry` are armed tools with no ghost at all (a blue cursor says
 *    "click to type"), so they have no member here;
 *  - the tempo and dynamic ghosts carry a resolved MARK, not a tool — the editor runs the same
 *    tool→text step the click uses (`tempoFieldsFromTool` / `dynamicTextFromTool`), so the preview
 *    is the string that will be engraved;
 *  - the rest ghost carries the ARMED LENGTH rather than a tool field, because a rest tool has no
 *    length of its own — it reads `selectedDuration`/`selectedDots` (see
 *    `MARKING_TOOL_USES_ARMED_LENGTH`).
 *
 * The `MarkingTool → ToolGhost` step is `interactions/toolGhost.ts`, on the editor side where the
 * armed state lives. Adding a ghost is a member here, a row in `GHOST_DRAWERS`, and a case there.
 *
 * ⚠️ NOT here: the ghost NOTE. It is not a marking tool — it rides the armed duration / accidental /
 * tuplet and is drawn IN the bar it will land in (it needs the render's own layout), so it keeps its
 * own path through `drawGhostNote` / `renderScoreWithPreview`. See {@link GhostRenderer}'s header
 * for the two families.
 */
import type {
  Clef, TimeSignature, TempoMark, Dynamic, ArticulationType, TremoloMark, NoteDuration, Ottava,
  Accidental as ScoreAccidental,
} from '@/types/music'

export type ToolGhost =
  | { kind: 'clef'; clef: Clef }
  | { kind: 'timeSignature'; timeSignature: TimeSignature }
  /** The finished mark ('Allegro (♩ = 120)'), so what you see is what gets engraved. */
  | { kind: 'tempo'; mark: TempoMark }
  /** The finished mark too — a level's glyph, or the custom-text placeholder. */
  | { kind: 'dynamic'; dynamic: Dynamic }
  /** ADDITIVE: everything the click will stamp, stacked. */
  | { kind: 'articulation'; types: ArticulationType[] }
  | { kind: 'accidental'; accidental: ScoreAccidental }
  | { kind: 'tremolo'; mark: TremoloMark }
  /** VALUELESS — the mark itself; WHICH note it lands on is resolved at click time. */
  | { kind: 'tie' }
  | { kind: 'dot' }
  /**
   * The `tr`, valueless for the same reason — and the one member added AFTER its family had settled
   * on showing nothing.
   *
   * ⚠️ It carries no length, and that is not an omission: a stamped trill is ONE note's
   * (`interactions/trillStamp.ts`), and how long it sounds comes from the ties. It carries no
   * `continuation` either — the parenthesised `(tr)` says "carried over from the last system", which
   * is a fact about a trill that does not exist yet. See `./TrillGhost` for why this exists at all,
   * against what §6 of the plan had decided.
   */
  | { kind: 'trill' }
  /**
   * The octave numeral — `8va` or `8ba`, and it CARRIES THE SIGNED SHIFT because those are two
   * different glyphs (`OTTAVA_NUMERAL_GLYPHS`, and his call that made them so).
   *
   * ⚠️ The BRACKET is not part of it: a dashed line with a hook has a length, and the click has
   * picked neither end. The numeral is the part the click certainly stamps. See `./OttavaGhost`.
   */
  | { kind: 'ottava'; shift: Ottava['shift'] }
  /** The one ghost with a value to show, and it is the armed length: a rest IS its duration. */
  | { kind: 'rest'; duration: NoteDuration; dots: number }
  /**
   * The feather stamp: the NOTEHEAD of the value the dialog typed, dot and all — and nothing else.
   *
   * A head with no stem, because the stem is not the stamp's to promise: what a fan draws over the
   * note it lands on is a beam ramp the {@link FanPass} builds, not the single stem VexFlow would
   * put under a lone half note. The head is the part that is true either way — it says which value
   * and which pitch the click will place, which is the whole question at the cursor.
   */
  | { kind: 'fan'; duration: NoteDuration; dots: number }
