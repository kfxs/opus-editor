/**
 * 🔧 **`__bracketed` — the P0 door onto BRACKETED graces** (`docs/plans/bracketed-grace-plan.md` P0).
 * Nothing draws them yet (P1), so this is how the model is poked and its round trip proved:
 *
 * ```js
 *   // select a note (or a grace) first — or pass its pitch id as the last argument
 *   __bracketed.add('before', 'Bb3')   // beside the selected note; on a grace: the pre-bend into it
 *   __bracketed.add('after', 'D5')     // the trill note's side (a grace refuses it — B5)
 *   __bracketed.list()                 // every one in the score, where it hangs
 *   __bracketed.remove(pitchId)        // one undo entry
 *   __bracketed.roundTrip()            // export → load → the same lists? (ids and all)
 * ```
 *
 * ⛔ **SCAFFOLDING, and it deletes cleanly**: it calls `engine.bracketed` and nothing else; `App.ts`
 * wires it. ⏭️ Goes when P2's stamp can enter one by hand.
 */
import { dbg } from '@/utils/debug'
import type { MusicEngine } from '@/engine/MusicEngine'
import type { BracketedGrace, PitchSpelling, Score } from '@/types/music'
import { BRACKETED_SIDES, bracketedOf, type BracketedSide } from '@/utils/bracketedGraces'
import { GRACE_SIDES, graceGroupOf } from '@/utils/graceNotes'

export interface BracketedConsole {
  add(side: BracketedSide, spelling: string, targetNoteId?: string): string | null
  remove(pitchId: string): boolean
  list(): string[]
  roundTrip(): boolean
}

const ALTERS: Record<string, PitchSpelling['alter']> = { '': 0, '#': 1, '##': 2, b: -1, bb: -2, n: 0 }

/** `'Bb3'` → a spelling; `'Fn4'` forces the natural. Null for anything else. */
function parseSpelling(text: string): (PitchSpelling & { forceAccidental?: boolean }) | null {
  const m = /^([A-Ga-g])(##|#|bb|b|n)?(-?\d)$/.exec(text.trim())
  if (!m) return null
  const spelling: PitchSpelling & { forceAccidental?: boolean } = {
    step: m[1].toUpperCase() as PitchSpelling['step'], alter: ALTERS[m[2] ?? ''], octave: Number(m[3]),
  }
  if (m[2] === 'n') spelling.forceAccidental = true
  return spelling
}

/** Every list in the score, as lines: where it hangs, the side, the heads with their ids. */
function describe(score: Score): string[] {
  const lines: string[] = []
  const show = (where: string, list: readonly BracketedGrace[] | undefined, side: BracketedSide) => {
    list?.forEach((b, k) => lines.push(`${where} ${side}[${k}]: ${b.pitches.map(p => `${p.step}${p.alter ? (p.alter > 0 ? '#'.repeat(p.alter) : 'b'.repeat(-p.alter)) : ''}${p.octave} (${p.id})`).join(' + ')}`))
  }
  for (const m of score.measures) {
    for (const slot of m.slots) {
      for (const gs of GRACE_SIDES) {
        graceGroupOf(slot, gs)?.notes.forEach((g, i) => show(`bar ${m.number} ${slot.type} ${slot.id} · grace ${gs}[${i}]`, g.bracketedBefore, 'before'))
      }
      if (slot.type === 'chord') for (const side of BRACKETED_SIDES) show(`bar ${m.number} chord ${slot.id}`, bracketedOf(slot, side), side)
    }
  }
  return lines
}

export function bracketedConsole(deps: {
  getEngine: () => MusicEngine | null
  selectedNoteId: () => string | null
}): BracketedConsole {
  return {
    add: (side, text, targetNoteId) => {
      const engine = deps.getEngine()
      const target = targetNoteId ?? deps.selectedNoteId()
      const spelling = parseSpelling(text)
      if (!engine || !target || !spelling || !BRACKETED_SIDES.includes(side)) {
        dbg(`[bracketed] ⛔ add(side, spelling[, noteId]) — side 'before'|'after', spelling like 'Bb3', and a selected note or an id`)
        return null
      }
      const made = engine.bracketed.add(target, side, spelling)
      if (!made) return null
      dbg(`[bracketed] + ${side} ${text} → ${made.pitches[0].id} (nothing is drawn until P1)`)
      return made.pitches[0].id
    },
    remove: (pitchId) => deps.getEngine()?.bracketed.remove([pitchId]) ?? false,
    list: () => {
      const engine = deps.getEngine()
      const lines = engine ? describe(engine.getScore()) : []
      dbg(lines.length ? `[bracketed]\n${lines.join('\n')}` : '[bracketed] none in the score')
      return lines
    },
    roundTrip: () => {
      const engine = deps.getEngine()
      if (!engine) return false
      const before = describe(engine.getScore())
      engine.loadJSON(engine.exportJSON())
      engine.renderScore()
      const after = describe(engine.getScore())
      const same = before.join('\n') === after.join('\n')
      dbg(`[bracketed] round trip ${same ? '✓ identical' : '✗ CHANGED'} — ${before.length} list entr${before.length === 1 ? 'y' : 'ies'}`)
      return same
    },
  }
}
