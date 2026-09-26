/**
 * ⭐ **A NOTE'S WRITTEN DURATION, PARSED** — S12j-d3 of `docs/history/vexflow-removal-map.md` (`Note.parseDuration`
 * + `Note.parseNoteStruct` + `Tables.durationToTicks`, MIT, transcribed): a token like `'q'`, `'8d'`,
 * `'hr'` or `'16dd'` → the duration as written, its dots, its note type, and its length in ticks.
 *
 * ## ⭐ What the rule IS
 *
 * > **A token is a duration (a number, or `w`/`h`/`q`), any dots, and a type letter (`n` note, `r` rest…).
 * > Its length is the whole note's ticks divided by the duration, each dot adding half of the last
 * > addition — and a dot that would halve below one tick makes the token invalid.**
 *
 * ⚠️ The duration is kept AS WRITTEN (`'q'`, not `'4'`) — VexFlow's `duration` field is the parse's
 * output, and only its table lookups sanitize (`w`→`1`, `h`→`2`, `q`→`4`).
 */
import { TICK_RESOLUTION } from '@/engine/layout/tickCount'

/** VexFlow's `durationAliases` — the letters a token may use for a duration. */
const DURATION_ALIASES: Readonly<Record<string, string>> = { w: '1', h: '2', q: '4', b: '256' }

/**
 * VexFlow's `durations` table — a duration's length in ticks at `TICK_RESOLUTION` per whole note.
 * ⭐ + `'1/4'` (the longa) and `'512'` — ours, `docs/plans/other-durations-plan.md` P1: VexFlow's table
 * stopped at the breve and the 256th. A 512th is 32 ticks, so its dots stay whole down to the fifth.
 */
const DURATION_TICKS: Readonly<Record<string, number>> = {
  '1/4': TICK_RESOLUTION * 4, '1/2': TICK_RESOLUTION * 2,
  '1': TICK_RESOLUTION, '2': TICK_RESOLUTION / 2, '4': TICK_RESOLUTION / 4, '8': TICK_RESOLUTION / 8,
  '16': TICK_RESOLUTION / 16, '32': TICK_RESOLUTION / 32, '64': TICK_RESOLUTION / 64,
  '128': TICK_RESOLUTION / 128, '256': TICK_RESOLUTION / 256, '512': TICK_RESOLUTION / 512,
}

/** A parsed token — `Note.parseNoteStruct`'s answer, the fields a note keeps. */
export interface ParsedDuration {
  /** As written: `'q'`, `'8'`, `'w'`… */
  duration: string
  dots: number
  /** `'n'` a note, `'r'` a rest — VexFlow's type letter. */
  type: string
  /** Each key's own type (a key `'c/4/x'` names one), else the note's. */
  customTypes: string[]
  ticks: number
}

/**
 * Parse a note's duration token — `undefined` for a token VexFlow would refuse (no duration, an unknown
 * one, a dot below one tick). `dots` given explicitly wins over the token's own.
 */
export function parseNoteDuration(token: string, keys: readonly string[] = [], dotsGiven?: number): ParsedDuration | undefined {
  if (!token) return undefined
  const match = /(\d*\/?\d+|[a-z])(d*)([nrhms]|$)/.exec(token)
  if (!match) return undefined
  const duration = match[1]
  const type = match[3] || 'n'
  const customTypes = keys.map(k => {
    const parts = k.split('/')
    return parts && parts.length === 3 ? parts[2] : type
  })
  const sanitized = DURATION_ALIASES[duration] ?? duration
  let ticks = DURATION_TICKS[sanitized]
  if (ticks === undefined) throw new Error(`The provided duration is not valid: ${sanitized}`)
  if (!ticks) return undefined
  const dots = dotsGiven ? dotsGiven : match[2].length
  let currentTicks = ticks
  for (let i = 0; i < dots; i++) {
    if (currentTicks <= 1) return undefined
    currentTicks = currentTicks / 2
    ticks += currentTicks
  }
  return { duration, dots, type, customTypes, ticks }
}
