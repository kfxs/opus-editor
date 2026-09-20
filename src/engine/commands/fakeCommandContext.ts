/**
 * ⚠️ **SPEC SUPPORT — not shipped behaviour.** A {@link CommandContext} a commands spec can stand up
 * with no `MusicEngine`, no renderer and no playback: a REAL `ScoreModel` (so the ops run for real),
 * undo seams that RECORD instead of pushing history, and limits that can be told to refuse.
 *
 * What a commands module adds over its ops is exactly what this makes visible: which seam an edit
 * records through (one entry per edit · none per preview frame · one per drop), and that a refused
 * limit means nothing was written and nothing recorded.
 */
import type { ElementInfo } from '../ElementRegistry'
import { ScoreModel } from '../models/ScoreModel'
import type { CommandContext } from './commandContext'

export interface FakeCommandContext extends CommandContext {
  score: ScoreModel
  /** Every seam call, in order: `mutate:Add trill`, `dirty`, `previewed:Move trill end`. */
  log: string[]
  /** How many UNDO ENTRIES were asked for — every `mutate` and every `commitPreviewed`. */
  undoEntries(): number
  /** The limits' answers; all true until a spec says otherwise. */
  allow: { page: boolean; band: boolean; spanEnd: boolean }
  /** What the limits were ASKED, so a spec can read the SCREEN deltas a command converted to. */
  asked: { limit: 'page' | 'band' | 'spanEnd'; dx: number; dy: number }[]
  /** What the registry answers for `getByType` — nothing drawn unless a spec draws it. */
  drawn: ElementInfo[]
}

export function fakeCommandContext(score = new ScoreModel()): FakeCommandContext {
  const ctx: FakeCommandContext = {
    score,
    log: [],
    undoEntries: () => ctx.log.filter(l => !l.startsWith('dirty')).length,
    allow: { page: true, band: true, spanEnd: true },
    asked: [],
    drawn: [],
    model: () => ctx.score,
    registry: () => ({ getByType: type => ctx.drawn.filter(e => e.type === type) }),
    mutate: d => { ctx.log.push(`mutate:${d}`) },
    markDirty: () => { ctx.log.push('dirty') },
    commitPreviewed: d => { ctx.log.push(`previewed:${d}`) },
    runBatch: (_d, fn) => { fn(); return true },
    staffIdForIndex: () => undefined,
    limits: {
      nudgeStaysOnPage: (_t, _id, dx, dy) => { ctx.asked.push({ limit: 'page', dx, dy }); return ctx.allow.page },
      nudgeStaysInBand: (_ink, _m, _s, dy) => { ctx.asked.push({ limit: 'band', dx: 0, dy }); return ctx.allow.band },
      spanEndStaysOnPage: (_t, _id, _w, dx) => { ctx.asked.push({ limit: 'spanEnd', dx, dy: 0 }); return ctx.allow.spanEnd },
    },
  }
  return ctx
}
