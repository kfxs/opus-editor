/**
 * ⭐⭐ **HOW THE VOICES OF ONE COLUMN MAKE ROOM FOR EACH OTHER** — S9g of
 * `docs/vexflow-removal-map.md` (`StaveNote.format`, MIT, transcribed).
 *
 * ## ⭐ What the rule IS
 *
 * > **Two or three notes that start together, in different voices, must not draw over each other.**
 * > The upper and lower voice are compared by the lines they reach (a stem counts; a rest counts by
 * > its glyph's height). When they collide: two identical rests draw once; a rest steps a line out of
 * > the way; two heads a second apart, or that cannot share a head, stand side by side (the second
 * > moved right by a head's width + 2 px); otherwise a stem turns over. With three voices the middle
 * > one is the one that steps aside.
 *
 * The rule answers with {@link VoiceStep}s, in the order VexFlow made them, and the room the column
 * grows to its right. `rendering/modifierColumns` applies the steps through the notes' own setters.
 *
 * ## ⚠️ Most of what it decides is UNDONE — and it is ported anyway
 *
 * `VexFlowRenderer.drawMeasureContent` re-asserts every multi-voice note after `format()` — each rest
 * drawn again, back on its lane line, each stem back to the voice's side, each x-shift back to what it
 * was built with — because this editor stacks its voices itself (`layout/restVoicePlacement`). But
 * three things survive the re-assert, and they are why this is a port and not a deletion:
 *
 * 1. **the column's right shift** — the room a sideways head bought (`rightShift` below);
 * 2. **what the rules AFTER this one see** — the dots, the accidentals, the articulations and the
 *    annotations are stacked BEFORE the re-assert, reading the moved rest line, the turned stem and the
 *    shifted head;
 * 3. **a CENTRED (whole-bar) rest's line** — the re-assert leaves those alone, so a nudge sticks.
 *
 * ⛔ Which of these the editor WANTS is not decided here — this is VexFlow's rule, kept as it drew.
 *
 * ⚠️ Transcribed with its quirks intact, because tidying any of them moves ink:
 * - the "which is shorter" test compares the two DURATION CODES as strings (`'8' < 'q'`);
 * - with two voices where the upper stems down and the lower up, the pair becomes notes 1 and 0 —
 *   whichever two were drawn;
 * - the rest's reach is its glyph's ascent/descent in whole staff spaces, rounded UP; a note's is its
 *   stem's length in spaces, uncapped;
 * - a note's stem length is divided by a literal 10 — VexFlow's own space, {@link STAVE_LINE_DISTANCE_PX}.
 */
import { STAVE_LINE_DISTANCE_PX } from '@/engine/engrave/inheritedDefaults'
import { midLine } from './midLine'

/** One note of the column, as the rule needs it — in VexFlow's line units (a space is a half). */
export interface ColumnVoiceNote {
  /** The line of its LOWEST key. */
  bottomLine: number
  /** The line of its HIGHEST key. */
  topLine: number
  isRest: boolean
  /** A rest's glyph ascent / descent, px (unread for a note). */
  restAscentPx: number
  restDescentPx: number
  /** 1 up, −1 down. */
  stemDirection: number
  /** The stem's full length, px (`getStemLength`). */
  stemLengthPx: number
  /** How far a head stepping aside for this note must go, px (`getVoiceShiftWidth`). */
  voiceShiftPx: number
  /** Whether it draws at all (`renderOptions.draw !== false`). */
  drawn: boolean
  hasStem: boolean
  hasBeam: boolean
  /** VexFlow's duration code — ⚠️ compared as a STRING. */
  duration: string
  /** The glyph code of the lowest / highest key's head. */
  bottomHeadCode: string | undefined
  topHeadCode: string | undefined
  /** How many dots its FIRST key carries. */
  firstKeyDots: number
  /** Its style, serialised — two heads of different styles never merge. */
  styleKey: string
  /** Which voice it belongs to — compared by identity. */
  voiceKey: unknown
}

/** One thing the rule does to a note — `note` indexes the input. */
export type VoiceStep =
  | { kind: 'hide'; note: number }
  /** Move a rest's (only) key by `lines`. */
  | { kind: 'moveRest'; note: number; lines: number }
  | { kind: 'xShift'; note: number; px: number }
  | { kind: 'stem'; note: number; direction: number }

/** How far the side-stepping head stands beyond the other's shift, px. */
export const VOICE_SIDE_STEP_PAD_PX = 2

interface Reach {
  note: number
  line: number
  maxLine: number
  minLine: number
  isRest: boolean
  stemDirection: number
  voiceShift: number
}

/**
 * ⭐ The column's voices, made room for. `unison` is `inheritedDefaults.UNISON_SHARES_HEAD`
 * (VexFlow's `Tables.UNISON`) — whether two heads of one pitch may share a notehead.
 */
export function stackVoices(
  notes: readonly ColumnVoiceNote[],
  unison: boolean,
): { steps: VoiceStep[]; rightShift: number } {
  const steps: VoiceStep[] = []
  if (notes.length < 2) return { steps, rightShift: 0 }

  const reach: Reach[] = notes.map((n, i) => {
    const stemSpaces = n.stemLengthPx / STAVE_LINE_DISTANCE_PX
    const line = n.bottomLine
    return {
      note: i,
      line,
      maxLine: n.isRest
        ? line + Math.ceil(n.restAscentPx / STAVE_LINE_DISTANCE_PX)
        : n.stemDirection === 1 ? n.topLine + stemSpaces : n.topLine,
      minLine: n.isRest
        ? line - Math.ceil(n.restDescentPx / STAVE_LINE_DISTANCE_PX)
        : n.stemDirection === 1 ? n.bottomLine : n.bottomLine - stemSpaces,
      isRest: n.isRest,
      stemDirection: n.stemDirection,
      voiceShift: n.voiceShiftPx,
    }
  })

  const moveRest = (rest: Reach, lines: number): void => {
    rest.line += lines
    rest.maxLine += lines
    rest.minLine += lines
    steps.push({ kind: 'moveRest', note: rest.note, lines })
  }
  const setStem = (r: Reach, direction: number): void => {
    r.stemDirection = direction
    steps.push({ kind: 'stem', note: r.note, direction })
  }
  const setXShift = (r: Reach, px: number): void => {
    steps.push({ kind: 'xShift', note: r.note, px })
  }
  const hide = (r: Reach): void => {
    steps.push({ kind: 'hide', note: r.note })
  }
  const of = (r: Reach): ColumnVoiceNote => notes[r.note]

  // Which of the first three draw — ⚠️ only the first three are ever considered.
  const draw = [false, false, false]
  for (let i = 0; i < notes.length; i++) draw[i] = notes[i].drawn

  let upper: Reach
  let middle: Reach | undefined
  let lower: Reach
  let voices: 2 | 3
  if (draw[0] && draw[1] && draw[2]) {
    voices = 3
    upper = reach[0]; middle = reach[1]; lower = reach[2]
  } else if (draw[0] && draw[1]) {
    voices = 2
    upper = reach[0]; lower = reach[1]
  } else if (draw[0] && draw[2]) {
    voices = 2
    upper = reach[0]; lower = reach[2]
  } else if (draw[1] && draw[2]) {
    voices = 2
    upper = reach[1]; lower = reach[2]
  } else {
    return { steps, rightShift: 0 }
  }
  // ⚠️ Notes 1 and 0, whichever two were drawn.
  if (voices === 2 && upper.stemDirection === -1 && lower.stemDirection === 1) {
    upper = reach[1]
    lower = reach[0]
  }

  const voiceXShift = Math.max(upper.voiceShift, lower.voiceShift)
  let xShift = 0

  if (voices === 2) {
    const u = of(upper)
    const l = of(lower)
    const lineSpacing = u.hasStem && l.hasStem && upper.stemDirection === lower.stemDirection ? 0.0 : 0.5
    if (lower.isRest && upper.isRest && u.duration === l.duration) {
      hide(lower)
    } else if (upper.minLine <= lower.maxLine + lineSpacing) {
      if (upper.isRest) {
        moveRest(upper, 1)
      } else if (lower.isRest) {
        moveRest(lower, -1)
      } else {
        const lineDiff = Math.abs(upper.line - lower.line)
        if (u.hasStem && l.hasStem) {
          if (
            !unison ||
            u.bottomHeadCode !== l.topHeadCode ||
            u.firstKeyDots !== l.firstKeyDots ||
            (lineDiff < 1 && lineDiff > 0) ||
            u.styleKey !== l.styleKey
          ) {
            xShift = voiceXShift + VOICE_SIDE_STEP_PAD_PX
            setXShift(upper.stemDirection === lower.stemDirection ? upper : lower, xShift)
          } else if (u.voiceKey !== l.voiceKey) {
            if (upper.stemDirection === lower.stemDirection) {
              if (upper.line !== lower.line) {
                xShift = voiceXShift + VOICE_SIDE_STEP_PAD_PX
                setXShift(upper, xShift)
              } else if (lower.stemDirection === 1) {
                setStem(lower, -1)
              }
            }
          }
        } else if (lineDiff < 1) {
          xShift = voiceXShift + VOICE_SIDE_STEP_PAD_PX
          // ⚠️ A STRING comparison of the duration codes, as VexFlow wrote it.
          setXShift(u.duration < l.duration ? upper : lower, xShift)
        } else if (u.hasStem) {
          setStem(upper, -upper.stemDirection)
        } else if (l.hasStem) {
          setStem(lower, -lower.stemDirection)
        }
      }
    }
    return { steps, rightShift: xShift }
  }

  const mid = middle as Reach
  // The middle voice steps right, and the outer stems turn outward where no beam holds them.
  const middleStepsAside = (): void => {
    xShift = voiceXShift + VOICE_SIDE_STEP_PAD_PX
    setXShift(mid, xShift)
    if (!of(lower).hasBeam) setStem(lower, -1)
    if (upper.minLine <= lower.maxLine && !of(upper).hasBeam) setStem(upper, 1)
  }

  if (mid.isRest && !upper.isRest && !lower.isRest) {
    if (upper.minLine <= mid.maxLine || mid.minLine <= lower.maxLine) {
      const restHeight = mid.maxLine - mid.minLine
      const space = upper.minLine - lower.maxLine
      if (restHeight < space) {
        // Centre the rest between the other two: ⚠️ `getKeyLine(0) − delta`, as `+ (−delta)`.
        moveRest(mid, -(mid.line - midLine(upper.minLine, lower.maxLine)))
      } else {
        middleStepsAside()
      }
      return { steps, rightShift: xShift }
    }
  }
  if (upper.isRest && mid.isRest && lower.isRest) {
    hide(upper)
    hide(lower)
    return { steps, rightShift: xShift }
  }
  if (mid.isRest && upper.isRest && mid.minLine <= lower.maxLine) hide(mid)
  if (mid.isRest && lower.isRest && upper.minLine <= mid.maxLine) hide(mid)
  if (upper.isRest && upper.minLine <= mid.maxLine) moveRest(upper, 1)
  if (lower.isRest && mid.minLine <= lower.maxLine) moveRest(lower, -1)
  if (upper.minLine <= mid.maxLine + 0.5 || mid.minLine <= lower.maxLine) middleStepsAside()
  return { steps, rightShift: xShift }
}
