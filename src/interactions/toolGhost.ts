/**
 * WHAT THE ARMED TOOL LOOKS LIKE — the one step from the editor's {@link MarkingTool} to the
 * engine's {@link ToolGhost}, and the only place the two vocabularies meet.
 *
 * It is a pure function, deliberately: `RenderController.renderToolGhost` used to be a twelve-case
 * switch over eleven one-line `render*Ghost` methods, and three of those eleven were doing this
 * translation inline (tempo built its mark, dynamic built its text, rest read the armed length)
 * while the other eight did nothing at all. Splitting the translation out leaves the controller with
 * the part that is genuinely its own — take the previous ghost down, make sure the score under it is
 * drawn, tell the census what this render was for — and leaves this testable without a renderer
 * (docs/modularity-plan-2026-07-28.md Phase 2).
 *
 * ⚠️ It answers `null` for a tool with NO preview, which is a real answer and not a failure: the two
 * click-to-type entry tools (`dynamicEntry` from Ctrl+E, `tempoEntry` from Ctrl+Alt+T) signal
 * placement with a blue cursor instead of a ghost, so drawing anything would be wrong — and so would
 * repainting to draw nothing.
 */
import { tempoFieldsFromTool } from '../utils/tempoText'
import { dynamicTextFromTool } from '../utils/dynamics'
import type { NoteDuration } from '../types/music'
import type { MarkingTool } from './EditorState'
import { assertNeverTool } from './EditorState'
import type { ToolGhost } from '../engine/rendering/ghostTypes'

/** The armed note-entry length, which the rest ghost (and only the rest ghost) reads. */
export interface ArmedLength {
  duration: NoteDuration
  dots: number
}

/**
 * The preview for `tool`, or `null` when it has none.
 *
 * EXHAUSTIVE over the armed tools: a thirteenth `MarkingTool` fails to compile at
 * {@link assertNeverTool} until someone decides what it shows at the pointer — the guarantee the old
 * switch gave, kept.
 */
export function toolGhost(tool: MarkingTool, armed: ArmedLength): ToolGhost | null {
  switch (tool.kind) {
    case 'clef': return { kind: 'clef', clef: tool.clef }
    case 'timeSignature': return { kind: 'timeSignature', timeSignature: tool.timeSignature }
    // Through the SAME tool→text step the click uses (MouseController), so the preview shows the
    // string that will actually be engraved. Spreading the raw tool instead left a bare-metronome
    // ghost with no `text` — and a mark with no text draws nothing, so it never appeared.
    case 'tempo': return {
      kind: 'tempo',
      mark: { id: 'ghost-tempo', beat: { num: 0, den: 1 }, ...tempoFieldsFromTool(tool.tempo) },
    }
    // The `'text'` tool previews the custom-text placeholder; a level tool previews its glyph.
    case 'dynamic': return {
      kind: 'dynamic',
      dynamic: { id: 'ghost-dynamic', beat: { num: 0, den: 1 }, text: dynamicTextFromTool(tool.dynamic), placement: 'below' },
    }
    // Stacked, so the ghost reads as everything the click will stamp.
    case 'articulation': return { kind: 'articulation', types: tool.types }
    case 'accidental': return { kind: 'accidental', accidental: tool.sign }
    // The MARK rather than the palette's picture — strokes or the Penderecki sign, both through the
    // one modifier that engraves them, so the preview cannot disagree with what gets engraved.
    case 'tremolo': return { kind: 'tremolo', mark: tool.tremolo }
    // The two valueless stamps carry nothing to preview: their ghost is the mark itself, and WHICH
    // note it lands on is resolved at click time.
    case 'tie': return { kind: 'tie' }
    case 'dot': return { kind: 'dot' }
    // The one stamp whose ghost carries a VALUE, and it reads it from the ARMED length rather than
    // from the tool: a rest IS its duration + dots, and those are the note-entry fields the
    // duration/dot keys go on setting while this tool is live (MARKING_TOOL_USES_ARMED_LENGTH).
    case 'rest': return { kind: 'rest', duration: armed.duration, dots: armed.dots }
    // The other tool with a value to show — and it reads it from the TOOL, not the armed length:
    // the dialog that armed it said how long the gesture lasts (see the `fan` member of MarkingTool).
    case 'fan': return { kind: 'fan', duration: tool.unit, dots: tool.dots }
    // Click-to-type entry: a blue cursor, no ghost. See the header.
    case 'dynamicEntry':
    case 'tempoEntry': return null
    default: return assertNeverTool(tool)
  }
}

/**
 * What the render census calls each ghost (`docs/render-performance-findings.md` §P0.4) — the label
 * `renderProbe().setCause` used to be handed by each of the eleven `render*Ghost` methods.
 *
 * ⚠️ A table and not `` `ghost:${kind}` `` for one reason: `timeSignature`'s label is **`ghost:timesig`**,
 * and these strings are how a recorded session's causes group. Deriving them would silently rename a
 * row in the report — and a census that renames rows across a refactor cannot be compared with the
 * one taken before it, which is the only thing it is for.
 */
export const GHOST_CAUSE: Record<ToolGhost['kind'], string> = {
  clef: 'ghost:clef',
  timeSignature: 'ghost:timesig',
  tempo: 'ghost:tempo',
  dynamic: 'ghost:dynamic',
  articulation: 'ghost:articulation',
  accidental: 'ghost:accidental',
  tremolo: 'ghost:tremolo',
  tie: 'ghost:tie',
  dot: 'ghost:dot',
  rest: 'ghost:rest',
  fan: 'ghost:fan',
}
