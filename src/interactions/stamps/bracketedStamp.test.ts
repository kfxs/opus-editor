import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MusicEngine } from '../../engine/MusicEngine'
import type { ElementInfo, ElementRegistry } from '../../engine/ElementRegistry'
import { createEditorState, type EditorState } from '../state/EditorState'
import { stampBracketedAtClick } from './bracketedStamp'
import { stampGraceAtClick } from './graceStamp'
import { bracketedGhostHead } from '../../engine/rendering/ghosts/BracketedGhost'
import { fracCreate as frac } from '../../utils/fraction'
import type { Chord } from '@/types/music'

/**
 * The bracketed stamp's click (docs/plans/bracketed-grace-plan.md P2). The `MusicEngine` is real; the
 * PIXEL steps are stubbed, as in `graceStamp.test.ts`.
 */
vi.mock('../../engine/rendering/ScoreRenderer', async () => (await import('@/testing/engineStubs')).scoreRendererStub())
vi.mock('../../engine/audio/PlaybackEngine', async () => (await import('@/testing/engineStubs')).playbackEngineStub())

describe('stampBracketedAtClick', () => {
  let engine: MusicEngine
  let state: EditorState
  let render: () => void
  let hostId: string
  let restId: string

  const registry = (elements: ElementInfo[]) =>
    ({ getByType: (type: string) => elements.filter(e => e.type === type), getStaffGeometry: () => ({ lineSpacing: 10 }) }) as unknown as ElementRegistry
  /** The POINTER x that stands the ghost's head centred on `headCentre` — judged at the ghost (his rule). */
  const aim = (headCentre: number) => {
    const head = bracketedGhostHead(0, state.selectedDuration, state.selectedAccidental, 10)
    return headCentre - (head.left + head.right) / 2
  }
  const at = (type: 'note' | 'rest', id: string, headX: number): ElementInfo =>
    ({ type, id, measure: 1, staff: 0, headX, bbox: { x: headX - 5, y: 0, width: 10, height: 10 } })
  const chord = (): Chord => engine.getScore().measures[0].slots.find((s): s is Chord => s.type === 'chord')!

  beforeEach(() => {
    engine = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    hostId = engine.addNoteAtBeat({ step: 'E', octave: 5, duration: 'q', measure: 1, beat: frac(1, 1) })!.id
    restId = engine.getScore().measures[0].slots.find(s => s.type === 'rest')!.id
    vi.spyOn(engine, 'pixelToMeasure').mockReturnValue(1)
    vi.spyOn(engine, 'pixelToPosition').mockReturnValue({ measure: 1, beat: frac(1, 1), spelling: { step: 'D', alter: 0, octave: 5 }, staff: 0 })
    state = createEditorState()
    render = vi.fn()
  })

  it('does not touch a click when the tool is not armed', () => {
    expect(stampBracketedAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)).toBe(false)
  })

  it('⭐ puts a bracketed grace of the CLICK\'s pitch before the nearest note — one undo entry, the tool stays armed', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    expect(stampBracketedAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)).toBe(true)
    expect(chord().bracketedBefore).toEqual([{ pitches: [expect.objectContaining({ step: 'D', alter: 0, octave: 5 })], duration: 'q' }])
    expect(render).toHaveBeenCalled()
    expect(state.selectedMarkingTool).toEqual({ kind: 'bracketedGrace', side: 'before' })
    engine.undo()
    expect('bracketedBefore' in chord()).toBe(false)
  })

  it('⭐ its head is the ARMED value — a half key lit, a hollow head (B7 revised)', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    state.selectedDuration = 'h'
    stampBracketedAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)
    expect(chord().bracketedBefore![0].duration).toBe('h')
  })

  it('⭐ the ARMED accidental spells it — and an armed ♮ is FORCED', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    state.selectedAccidental = 'b'
    stampBracketedAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)
    expect(chord().bracketedBefore![0].pitches[0]).toMatchObject({ step: 'D', alter: -1 })
    state.selectedAccidental = 'n'
    stampBracketedAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)
    expect(chord().bracketedBefore![1].pitches[0]).toMatchObject({ alter: 0, forceAccidental: true })
  })

  it('⭐ B10 REVERSED: on a REST it hangs on the rest — his report: "similar to grace stamp on empty measure"', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    expect(stampBracketedAtClick(state, engine, registry([at('rest', restId, 40)]), aim(40), 50, render)).toBe(true)
    const rest = engine.getScore().measures[0].slots.find(s => s.id === restId)!
    expect(rest.bracketedBefore).toEqual([{ pitches: [expect.objectContaining({ step: 'D', octave: 5 })], duration: 'q' }])
  })

  it('⭐ on a WHOLE-BAR rest, the rest becomes a one-beat rest at the click\'s beat first (the grace\'s rule)', () => {
    const empty = new MusicEngine({ container: {} as unknown as HTMLElement, width: 800, height: 400 })
    const measureRest = empty.getScore().measures[0].slots[0]
    expect(measureRest.type === 'rest' && measureRest.isMeasureRest).toBe(true)
    vi.spyOn(empty, 'pixelToMeasure').mockReturnValue(1)
    vi.spyOn(empty, 'pixelToPosition').mockReturnValue({ measure: 1, beat: frac(2, 1), spelling: { step: 'D', alter: 0, octave: 5 }, staff: 0 })
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    stampBracketedAtClick(state, empty, registry([at('rest', measureRest.id, 100)]), aim(100), 50, render)
    const slots = empty.getScore().measures[0].slots
    const holder = slots.find(s => s.bracketedBefore)!
    expect(holder.type).toBe('rest')
    expect(holder.duration).toBe('q')
    expect(holder.beat).toEqual(frac(2, 1))
  })

  it('a miss is a no-op that still takes the click', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    expect(stampBracketedAtClick(state, engine, registry([]), aim(400), 50, render)).toBe(true)
    expect(render).not.toHaveBeenCalled()
  })

  it('⭐ the grace stamp\'s door hands the click on — MouseController needs no line of its own', () => {
    state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
    expect(stampGraceAtClick(state, engine, registry([at('note', hostId, 100)]), aim(90), 50, render)).toBe(true)
    expect(chord().bracketedBefore).toHaveLength(1)
    expect(chord().graceBefore).toBeUndefined()
  })

  describe('⭐ P3 — in a GRACE group, the click targets a GRACE', () => {
    /** Two graces before the note, drawn at 60 and 75 (heads 10 wide), the note at 100. */
    const withGraces = () => {
      const g1 = engine.grace.addGrace(hostId, 'before', { step: 'G', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
      const g2 = engine.grace.addGrace(hostId, 'before', { step: 'A', alter: 0, octave: 4 }, 'appoggiatura', { duration: '8' })!
      const reg = registry([at('note', g1.pitches[0].id, 60), at('note', g2.pitches[0].id, 75), at('note', hostId, 100)])
      state.selectedMarkingTool = { kind: 'bracketedGrace', side: 'before' }
      return { g1, g2, reg }
    }

    it('a click in the GAP between two graces puts it before the grace to the RIGHT — the pre-bend into it', () => {
      const { g1, g2, reg } = withGraces()
      stampBracketedAtClick(state, engine, reg, aim(67.5), 50, render)
      expect(g2.bracketedBefore).toHaveLength(1)
      expect('bracketedBefore' in g1).toBe(false)
      expect('bracketedBefore' in chord()).toBe(false)
    })

    it('a click ON a grace puts it before THAT grace', () => {
      const { g1, reg } = withGraces()
      stampBracketedAtClick(state, engine, reg, aim(60), 50, render)
      expect(g1.bracketedBefore).toHaveLength(1)
    })

    it('a click PAST the last grace puts it before the note itself', () => {
      const { g1, g2, reg } = withGraces()
      stampBracketedAtClick(state, engine, reg, aim(90), 50, render)
      expect(chord().bracketedBefore).toHaveLength(1)
      expect('bracketedBefore' in g1 || 'bracketedBefore' in g2).toBe(false)
    })
  })
})
