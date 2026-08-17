/**
 * {@link toolGhost} — the armed tool, as the engine will be asked to draw it.
 *
 * The point of this file is that it needs NO renderer. The translation used to live inside eleven
 * `RenderController.render*Ghost` methods, each of which reached for a `MusicEngine`, so the three
 * that actually did work (tempo built its mark, dynamic built its text, rest read the armed length)
 * could only be checked through a draw. As a pure function it is checked directly — and the two
 * tools that must NOT preview can be stated as a fact rather than as an absence of ink.
 */
import { describe, it, expect } from 'vitest'
import { toolGhost, GHOST_CAUSE } from './toolGhost'
import type { MarkingTool } from './EditorState'
import { levelToGlyphString } from '@/utils/dynamics'

/** The armed note-entry length — only the rest ghost reads it. */
const ARMED = { duration: 'h' as const, dots: 1 }

describe('toolGhost — the armed tool becomes what the engine draws', () => {
  it('carries the plain payloads straight across', () => {
    expect(toolGhost({ kind: 'clef', clef: 'bass' }, ARMED)).toEqual({ kind: 'clef', clef: 'bass' })
    expect(toolGhost({ kind: 'timeSignature', timeSignature: { numerator: 3, denominator: 4 } }, ARMED))
      .toEqual({ kind: 'timeSignature', timeSignature: { numerator: 3, denominator: 4 } })
    expect(toolGhost({ kind: 'articulation', types: ['accent', 'staccato'] }, ARMED))
      .toEqual({ kind: 'articulation', types: ['accent', 'staccato'] })
    expect(toolGhost({ kind: 'accidental', sign: '#' }, ARMED)).toEqual({ kind: 'accidental', accidental: '#' })
    expect(toolGhost({ kind: 'tremolo', tremolo: 3 }, ARMED)).toEqual({ kind: 'tremolo', mark: 3 })
    expect(toolGhost({ kind: 'tremolo', tremolo: 'penderecki' }, ARMED))
      .toEqual({ kind: 'tremolo', mark: 'penderecki' })
  })

  it('the valueless stamps carry nothing but their kind', () => {
    expect(toolGhost({ kind: 'tie' }, ARMED)).toEqual({ kind: 'tie' })
    expect(toolGhost({ kind: 'dot' }, ARMED)).toEqual({ kind: 'dot' })
    // The `tr` joined them on 2026-08-17 — a stamped trill is ONE note's, so there is no length to
    // carry, and no `continuation` either: the parenthesised `(tr)` is a fact about a trill that
    // already exists on an earlier system.
    expect(toolGhost({ kind: 'trill' }, ARMED)).toEqual({ kind: 'trill' })
  })

  it('⭐ the whole LADDER family previews — the three tools that changed their minds (his calls, 2026-08-17)', () => {
    // All three used to answer null, on the argument that the mark is drawn away from the pointer at
    // a height the click has not decided. What the cursor answers is WHAT the click makes.
    expect(toolGhost({ kind: 'trill' }, ARMED)).not.toBeNull()
    expect(toolGhost({ kind: 'ottava', shift: 1 }, ARMED)).not.toBeNull()
    expect(toolGhost({ kind: 'pedal' }, ARMED)).not.toBeNull()
    // …and the two spanner stamps beside them still do not, for the one reason left on the list:
    // both ends unpicked, so an arc or a wedge at the pointer would have to invent them.
    for (const tool of [{ kind: 'slur' }, { kind: 'hairpin', type: 'cresc' }] as MarkingTool[]) {
      expect(toolGhost(tool, ARMED), `${tool.kind} still has no ghost`).toBeNull()
    }
  })

  it('⭐⭐ the OTTAVA ghost carries the SIGNED shift — `8va` and `8ba` are different glyphs', () => {
    // The whole point of previewing this one: two palette rows differ in a single number, and behind
    // a blue caret they armed identically. A ghost that dropped the sign would too.
    expect(toolGhost({ kind: 'ottava', shift: 1 }, ARMED)).toEqual({ kind: 'ottava', shift: 1 })
    expect(toolGhost({ kind: 'ottava', shift: -1 }, ARMED)).toEqual({ kind: 'ottava', shift: -1 })
    expect(toolGhost({ kind: 'ottava', shift: -2 }, ARMED)).toEqual({ kind: 'ottava', shift: -2 })
  })

  it('⭐ the REST ghost takes the ARMED length, not anything on the tool', () => {
    // A rest tool has no length of its own — it reads selectedDuration/selectedDots, which is why
    // the duration and dot keys stay live under it (MARKING_TOOL_USES_ARMED_LENGTH).
    expect(toolGhost({ kind: 'rest' }, ARMED)).toEqual({ kind: 'rest', duration: 'h', dots: 1 })
    expect(toolGhost({ kind: 'rest' }, { duration: '16', dots: 0 }))
      .toEqual({ kind: 'rest', duration: '16', dots: 0 })
  })

  it('⭐ the TEMPO ghost is a finished mark with TEXT — a mark with none draws nothing', () => {
    // The bug this pins: spreading the raw tool left a bare-metronome ghost with no `text`, and a
    // tempo mark with no text draws nothing at all, so the preview never appeared.
    const ghost = toolGhost({ kind: 'tempo', tempo: { text: 'Allegro', bpm: 120, unit: 'q', showMetronome: true } }, ARMED)
    expect(ghost).toMatchObject({ kind: 'tempo' })
    const mark = (ghost as { kind: 'tempo'; mark: { text: string; bpm?: number } }).mark
    expect(mark.text).toContain('Allegro')
    expect(mark.text).toContain('120') // the composed string, exactly what the click will engrave
    expect(mark.bpm).toBe(120)
  })

  it('a metronome-only tempo tool still previews its text', () => {
    const ghost = toolGhost({ kind: 'tempo', tempo: { bpm: 60, unit: 'h', showMetronome: true } }, ARMED)
    const mark = (ghost as { kind: 'tempo'; mark: { text: string } }).mark
    expect(mark.text).toContain('60')
  })

  it('⭐ the DYNAMIC ghost resolves the tool to the glyph string it will engrave', () => {
    const ghost = toolGhost({ kind: 'dynamic', dynamic: 'f' }, ARMED)
    expect(ghost).toMatchObject({ kind: 'dynamic' })
    const dyn = (ghost as { kind: 'dynamic'; dynamic: { text: string; placement: string } }).dynamic
    expect(dyn.text).toBe(levelToGlyphString('f'))
    expect(dyn.placement).toBe('below')
  })

  it('the custom-text dynamic tool previews the placeholder, not an empty mark', () => {
    const dyn = (toolGhost({ kind: 'dynamic', dynamic: 'text' }, ARMED) as { dynamic: { text: string } }).dynamic
    expect(dyn.text.length).toBeGreaterThan(0)
  })

  it('⭐ the two click-to-type entry tools have NO ghost — null is the answer, not a failure', () => {
    // A blue cursor signals "click to place & type", so drawing anything would be wrong. The
    // controller uses the null to skip the repaint entirely.
    expect(toolGhost({ kind: 'dynamicEntry' }, ARMED)).toBeNull()
    expect(toolGhost({ kind: 'tempoEntry' }, ARMED)).toBeNull()
  })

  it('every armed tool is answered — the whole MarkingTool union, none forgotten', () => {
    const all: MarkingTool[] = [
      { kind: 'clef', clef: 'treble' },
      { kind: 'timeSignature', timeSignature: { numerator: 4, denominator: 4 } },
      { kind: 'dynamic', dynamic: 'p' },
      { kind: 'tempo', tempo: { text: 'Largo' } },
      { kind: 'articulation', types: ['accent'] },
      { kind: 'accidental', sign: 'b' },
      { kind: 'tremolo', tremolo: 2 },
      { kind: 'tie' },
      { kind: 'dot' },
      { kind: 'rest' },
      { kind: 'fan', attacks: 4, unit: '16', dots: 0, direction: 'accel' },
      { kind: 'trill' },
      { kind: 'dynamicEntry' },
      { kind: 'tempoEntry' },
      { kind: 'slur' },
      { kind: 'hairpin', type: 'dim' },
      { kind: 'ottava', shift: -1 },
      { kind: 'pedal' },
    ]
    // Fourteen draw, four deliberately do not — and nothing throws on the way past.
    expect(all.filter(t => toolGhost(t, ARMED) !== null)).toHaveLength(14)
  })
})

describe('GHOST_CAUSE — the census labels', () => {
  it('names every ghost kind, so setCause can never be handed undefined', () => {
    for (const tool of [
      { kind: 'clef', clef: 'treble' }, { kind: 'timeSignature', timeSignature: { numerator: 4, denominator: 4 } },
      { kind: 'dynamic', dynamic: 'p' }, { kind: 'tempo', tempo: { text: 'Largo' } },
      { kind: 'articulation', types: ['accent'] }, { kind: 'accidental', sign: 'b' },
      { kind: 'tremolo', tremolo: 2 }, { kind: 'tie' }, { kind: 'dot' }, { kind: 'rest' },
      { kind: 'trill' }, { kind: 'ottava', shift: 1 }, { kind: 'pedal' },
    ] as MarkingTool[]) {
      const ghost = toolGhost(tool, ARMED)!
      expect(GHOST_CAUSE[ghost.kind], `${ghost.kind} has a cause`).toMatch(/^ghost:/)
    }
  })

  it('⚠️ keeps the labels the census was recorded with — timeSignature is `ghost:timesig`', () => {
    // Deriving `ghost:${kind}` would silently rename a row, and a census that renames rows across a
    // refactor cannot be compared with the one taken before it.
    expect(GHOST_CAUSE.timeSignature).toBe('ghost:timesig')
    expect(GHOST_CAUSE.clef).toBe('ghost:clef')
  })
})
