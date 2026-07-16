import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PaletteController } from './PaletteController'
import { createEditorState, type EditorState } from './EditorState'
import { dotHighlight } from './keypadSync'

// PaletteController is framework-agnostic; stub its callbacks.
function makeController(state: EditorState): PaletteController {
  return new PaletteController(
    () => null,           // getEngine — no engine needed for arm/disarm
    state,
    vi.fn(),              // renderScore
    vi.fn(),              // renderPreview
    () => null,           // getLastMousePosition
    vi.fn(),              // selectNote
  )
}

describe('PaletteController — time signature tool', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('arms a time signature and switches to the entry tool', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    expect(state.selectedTimeSignature).toEqual({ numerator: 6, denominator: 8 })
    expect(state.selectedTool).toBe('entry')
    expect(state.selectedNoteId).toBeNull()
  })

  it('clicking the armed signature again disarms it', () => {
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    expect(state.selectedTimeSignature).toBeNull()
  })

  it('arming a different signature replaces the armed one', () => {
    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    palette.setTimeSignature({ numerator: 7, denominator: 8 })
    expect(state.selectedTimeSignature).toEqual({ numerator: 7, denominator: 8 })
  })

  it('is mutually exclusive with the clef tool', () => {
    palette.setClef('bass')
    palette.setTimeSignature({ numerator: 5, denominator: 8 })
    expect(state.selectedClef).toBeNull()
    expect(state.selectedTimeSignature).toEqual({ numerator: 5, denominator: 8 })

    palette.setClef('treble')
    expect(state.selectedTimeSignature).toBeNull()
    expect(state.selectedClef).toBe('treble')
  })

  it('selecting a duration disarms the time-signature tool', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    palette.setDuration('8')
    expect(state.selectedTimeSignature).toBeNull()
  })

  it('resetToDefaults clears the armed signature', () => {
    palette.setTimeSignature({ numerator: 6, denominator: 8 })
    palette.resetToDefaults()
    expect(state.selectedTimeSignature).toBeNull()
  })
})

describe('PaletteController — dynamics tool', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('arms a level dynamic and switches to the entry tool', () => {
    palette.setDynamic('mf')
    expect(state.selectedDynamic).toBe('mf')
    expect(state.selectedTool).toBe('entry')
    expect(state.selectedNoteId).toBeNull()
  })

  it('arms the custom-text tool', () => {
    palette.setDynamic('text')
    expect(state.selectedDynamic).toBe('text')
  })

  it('clicking the armed dynamic again disarms it', () => {
    palette.setDynamic('p')
    palette.setDynamic('p')
    expect(state.selectedDynamic).toBeNull()
  })

  it('arming a different dynamic replaces the armed one', () => {
    palette.setDynamic('p')
    palette.setDynamic('f')
    expect(state.selectedDynamic).toBe('f')
  })

  it('is mutually exclusive with the clef and time-signature tools', () => {
    palette.setClef('bass')
    palette.setDynamic('mf')
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDynamic).toBe('mf')

    palette.setTimeSignature({ numerator: 3, denominator: 4 })
    expect(state.selectedDynamic).toBeNull()
    expect(state.selectedTimeSignature).toEqual({ numerator: 3, denominator: 4 })

    palette.setClef('treble')
    expect(state.selectedTimeSignature).toBeNull()

    palette.setDynamic('p')
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDynamic).toBe('p')
  })

  it('selecting a duration disarms the dynamics tool', () => {
    palette.setDynamic('mf')
    palette.setDuration('8')
    expect(state.selectedDynamic).toBeNull()
  })

  it('resetToDefaults clears the armed dynamic', () => {
    palette.setDynamic('f')
    palette.resetToDefaults()
    expect(state.selectedDynamic).toBeNull()
  })
})

describe('PaletteController — disarmPositionalTools', () => {
  let state: EditorState
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    palette = makeController(state)
  })

  it('clears the armed clef / time signature / dynamic', () => {
    palette.setDynamic('f')
    state.selectedClef = 'bass'
    state.selectedTimeSignature = { numerator: 3, denominator: 4 }
    palette.disarmPositionalTools()
    expect(state.selectedClef).toBeNull()
    expect(state.selectedTimeSignature).toBeNull()
    expect(state.selectedDynamic).toBeNull()
  })

  it('leaves note-entry settings (duration, accidental) untouched', () => {
    palette.setDuration('8')
    palette.setAccidental('#')
    palette.setClef('alto')
    palette.disarmPositionalTools()
    expect(state.selectedClef).toBeNull()
    expect(state.selectedDuration).toBe('8')
    expect(state.selectedAccidental).toBe('#')
  })
})

describe('PaletteController — setActiveVoice (move selection vs arm entry)', () => {
  let state: EditorState
  let moveSelectionToVoice: ReturnType<typeof vi.fn>
  let renderScore: ReturnType<typeof vi.fn>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    moveSelectionToVoice = vi.fn(() => true)
    renderScore = vi.fn()
    const fakeEngine = { moveSelectionToVoice } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      renderScore as unknown as () => void,
      vi.fn(),       // renderPreview
      () => null,    // getLastMousePosition
      vi.fn(),       // selectNote
    )
  })

  it('moves the selected note(s) into the chosen voice (selection mode) — UI voice 2 → model voice 1', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'note-1'
    state.selectedItems.set('note:note-1', { kind: 'note', id: 'note-1' })

    palette.setActiveVoice(2)

    expect(moveSelectionToVoice).toHaveBeenCalledWith(['note-1'], 1)
    expect(renderScore).toHaveBeenCalled()
    expect(state.selectedTool).toBe('selection') // stayed in selection, did NOT arm entry
    expect(state.activeVoice).toBe(2)
  })

  it('falls back to selectedNoteId when the multi-select map is empty', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'solo'

    palette.setActiveVoice(1)

    expect(moveSelectionToVoice).toHaveBeenCalledWith(['solo'], 0)
  })

  it('arms entry (no move) when in selection mode with nothing selected', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = null

    palette.setActiveVoice(2)

    expect(moveSelectionToVoice).not.toHaveBeenCalled()
    expect(state.selectedTool).toBe('entry')
  })

  it('does not move while in entry mode (just arms the voice)', () => {
    state.selectedTool = 'entry'

    palette.setActiveVoice(2)

    expect(moveSelectionToVoice).not.toHaveBeenCalled()
    expect(state.activeVoice).toBe(2)
  })
})

describe('PaletteController — accidental stamp tool', () => {
  let state: EditorState
  let renderScore: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let setNoteAccidental: ReturnType<typeof vi.fn>
  let notes: Record<string, { id: string; isRest?: boolean; alter: number }>
  let displays: Set<string> // ids that "already display" the queried accidental (stubbed)
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    renderScore = vi.fn()
    selectNote = vi.fn()
    setNoteAccidental = vi.fn()
    notes = {}
    displays = new Set()
    const fakeEngine = {
      getNote: (id: string) => notes[id] ?? null,
      noteDisplaysAccidental: (id: string) => displays.has(id),
      setNoteAccidental,
      getPrevailingAlter: () => 0,
      updateNote: vi.fn(),
      updateUndoNoteId: vi.fn(),
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      renderScore as unknown as () => void,
      vi.fn(),       // renderPreview
      () => null,    // getLastMousePosition
      selectNote as unknown as (id: string | null) => void,
    )
  })

  it('arms the stamp (entry mode) when in selection mode with nothing selected', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#')
    expect(state.selectedAccidentalTool).toBe('#')
    expect(state.selectedTool).toBe('entry')
    expect(setNoteAccidental).not.toHaveBeenCalled()
  })

  it('arms the stamp even when a lingering cursor note sits in selectedNoteId (empty selection set)', () => {
    // After note entry + Esc, selectedNoteId holds the cursor note but selectedItems is empty —
    // that reads as "nothing selected", so a press must arm the stamp, not apply to the cursor note.
    state.selectedTool = 'selection'
    state.selectedNoteId = 'cursor'
    notes['cursor'] = { id: 'cursor', alter: 0 }
    palette.setAccidental('#')
    expect(state.selectedAccidentalTool).toBe('#')
    expect(state.selectedTool).toBe('entry')
    expect(setNoteAccidental).not.toHaveBeenCalled()
  })

  it('applies to a real selection instead of arming', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    state.selectedItems.set('note:n1', { kind: 'note', id: 'n1' })
    notes['n1'] = { id: 'n1', alter: 0 }
    palette.setAccidental('#')
    expect(setNoteAccidental).toHaveBeenCalledWith('n1', '#')
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedTool).toBe('selection')
  })

  it('re-pressing the armed accidental disarms back to selection', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('b')
    palette.setAccidental('b')
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedTool).toBe('selection')
  })

  it('pressing a different accidental swaps the armed one (no stacking)', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#')
    palette.setAccidental('n')
    expect(state.selectedAccidentalTool).toBe('n')
    expect(state.selectedTool).toBe('entry')
  })

  it('is mutually exclusive with the articulation stamp', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#')
    expect(state.selectedAccidentalTool).toBe('#')
    palette.toggleAccent() // arming an articulation stamp switches tools
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedArticulationTools).toEqual(['accent'])

    palette.setAccidental('b') // and back
    expect(state.selectedArticulationTools).toEqual([])
    expect(state.selectedAccidentalTool).toBe('b')
  })

  it('a duration press promotes the stamp into "accidental + duration" note entry', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#')
    palette.setDuration('8')
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedAccidental).toBe('#')
    expect(state.selectedDuration).toBe('8')
    expect(state.selectedTool).toBe('entry')
  })

  it('disarmPositionalTools clears the armed stamp', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#')
    palette.disarmPositionalTools()
    expect(state.selectedAccidentalTool).toBeNull()
  })

  it('a fresh duration press (nothing selected) drops a stale armed accidental', () => {
    // Simulate: entered a sharp note, then Esc'd to nothing selected — selectedAccidental lingers.
    state.selectedTool = 'selection'
    state.selectedNoteId = null
    state.selectedAccidental = '#'
    palette.setDuration('q')
    expect(state.selectedAccidental).toBeNull()
    expect(state.selectedTool).toBe('entry')
  })

  it('still carries the accidental in the "sharp → duration" promote gesture', () => {
    state.selectedTool = 'selection'
    palette.setAccidental('#') // arms the stamp, switches to entry mode
    palette.setDuration('q')   // promotes into note entry (lands in the entry branch, not fresh)
    expect(state.selectedAccidental).toBe('#')
    expect(state.selectedTool).toBe('entry')
  })
})

describe('PaletteController — tie stamp tool', () => {
  let state: EditorState
  let tieSelectionFn: ReturnType<typeof vi.fn>
  let toggleTieFn: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let notes: Record<string, { id: string; isRest?: boolean; tiedTo?: string }>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    tieSelectionFn = vi.fn()
    toggleTieFn = vi.fn()
    selectNote = vi.fn()
    notes = {}
    const fakeEngine = {
      getNote: (id: string) => notes[id] ?? null,
      tieSelection: tieSelectionFn,
      toggleTie: toggleTieFn,
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      vi.fn(),       // renderScore
      vi.fn(),       // renderPreview
      () => null,    // getLastMousePosition
      selectNote as unknown as (id: string | null) => void,
    )
  })

  it('arms the stamp (entry mode) when in selection mode with nothing selected', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    expect(state.selectedTieTool).toBe(true)
    expect(state.selectedTool).toBe('entry')
    expect(tieSelectionFn).not.toHaveBeenCalled()
  })

  it('arms the stamp even when a lingering cursor note sits in selectedNoteId (empty selection set)', () => {
    // After note entry + Esc, selectedNoteId holds the cursor note but selectedItems is empty —
    // that reads as "nothing selected", so a press must arm the stamp, not tie the cursor note.
    state.selectedTool = 'selection'
    state.selectedNoteId = 'cursor'
    notes['cursor'] = { id: 'cursor' }
    palette.toggleTie()
    expect(state.selectedTieTool).toBe(true)
    expect(state.selectedTool).toBe('entry')
    expect(tieSelectionFn).not.toHaveBeenCalled()
  })

  it('ties a real selection instead of arming', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    state.selectedItems.set('note:n1', { kind: 'note', id: 'n1' })
    notes['n1'] = { id: 'n1' }
    palette.toggleTie()
    expect(tieSelectionFn).toHaveBeenCalledWith(['n1'])
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedTool).toBe('selection')
  })

  it('re-pressing the tie key disarms back to selection', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    palette.toggleTie()
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedTool).toBe('selection')
    expect(tieSelectionFn).not.toHaveBeenCalled()
  })

  it('is mutually exclusive with the accidental and articulation stamps', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    expect(state.selectedTieTool).toBe(true)

    palette.setAccidental('#') // arming an accidental stamp switches tools
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedAccidentalTool).toBe('#')

    palette.toggleTie() // and back
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedTieTool).toBe(true)

    palette.toggleAccent() // an articulation stamp takes over too
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedArticulationTools).toEqual(['accent'])

    palette.toggleTie()
    expect(state.selectedArticulationTools).toEqual([])
    expect(state.selectedTieTool).toBe(true)
  })

  it('a duration press disarms the stamp — there is no entry-mode tie to promote into', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    palette.setDuration('8')
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedDuration).toBe('8')
    expect(state.selectedTool).toBe('entry') // plain note entry
  })

  it('disarmPositionalTools clears the armed stamp', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    palette.disarmPositionalTools()
    expect(state.selectedTieTool).toBe(false)
  })

  it('lights the Keypad tie key while armed', () => {
    state.selectedTool = 'selection'
    palette.toggleTie()
    expect(palette.noteHasTie()).toBe(true)
  })

  it('lights no articulation key while armed (a stale arm-for-next-note flag must not leak)', () => {
    // The stamp arms into ENTRY mode, where noteHas* falls through to the arm-for-next-note flags.
    state.accent = true // left over from an earlier note-entry session
    state.selectedTool = 'selection'
    palette.toggleTie()
    expect(palette.noteHasAccent()).toBe(false)
  })

  it('still ties the cursor note in entry mode (no stamp armed)', () => {
    // Entry mode is untouched by the stamp: Enter straight after entering a note still ties it.
    state.selectedTool = 'entry'
    state.selectedNoteId = 'n1'
    notes['n1'] = { id: 'n1' }
    palette.toggleTie()
    expect(tieSelectionFn).toHaveBeenCalledWith(['n1'])
    expect(state.selectedTieTool).toBe(false)
  })
})

/**
 * Arming a tool from the keyboard must show its ghost AT ONCE — not on the next mouse move.
 *
 * A duration press always did (it previewed the ghost note straight away); the four marking stamps
 * did not, because the only preview wired into this controller was `renderPreview`, which draws a
 * ghost NOTE — the wrong preview for a stamp, so they drew nothing and the editor looked inert until
 * you jogged the pointer. Both now go through RenderController.renderToolGhost, which dispatches on
 * what is armed. Here that callback is a spy: what matters is that arming CALLS it, at the pointer.
 */
describe('PaletteController — arming a tool previews it immediately', () => {
  let state: EditorState
  let renderArmedGhost: ReturnType<typeof vi.fn>
  let palette: PaletteController
  const POINTER = { x: 120, y: 90 }

  beforeEach(() => {
    state = createEditorState()
    renderArmedGhost = vi.fn()
    const fakeEngine = {
      getNote: () => null,
      updateNote: vi.fn(),
      runBatch: (_l: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      vi.fn(),                 // renderScore
      renderArmedGhost as unknown as (c: { x: number; y: number }) => void,
      () => POINTER,           // the pointer is over the canvas
      vi.fn(),                 // selectNote
    )
    state.selectedTool = 'selection'
  })

  const arm: Array<[string, () => void]> = [
    ['duration', () => palette.setDuration('q')],
    ['accidental stamp', () => palette.setAccidental('#')],
    ['articulation stamp', () => palette.toggleAccent()],
    ['tie stamp', () => palette.toggleTie()],
    ['dot stamp', () => palette.toggleDot()],
  ]

  for (const [label, press] of arm) {
    it(`${label}: the ghost is drawn on the keypress, at the pointer`, () => {
      press()
      expect(renderArmedGhost).toHaveBeenCalledWith(POINTER)
    })
  }

  it('swapping the armed accidental redraws the ghost with the NEW sign', () => {
    palette.setAccidental('#') // arms the stamp
    renderArmedGhost.mockClear()
    palette.setAccidental('b') // ♯ → ♭ while armed: the ghost must change NOW, not on a mouse move
    expect(state.selectedAccidentalTool).toBe('b')
    expect(renderArmedGhost).toHaveBeenCalledWith(POINTER)
  })

  it('adding an articulation to the armed set redraws the stacked ghost', () => {
    palette.toggleAccent()
    renderArmedGhost.mockClear()
    palette.toggleStaccato() // the set grows → the ghost restacks
    expect(state.selectedArticulationTools).toEqual(['accent', 'staccato'])
    expect(renderArmedGhost).toHaveBeenCalledWith(POINTER)
  })

  it('DISARMING draws no ghost — back in selection mode there is nothing to preview', () => {
    // The same branch handles swap and disarm, so previewing unconditionally would draw a ghost
    // NOTE over a selection-mode score (renderPreview does not check the mode itself).
    palette.setAccidental('#')
    renderArmedGhost.mockClear()
    palette.setAccidental('#') // re-press disarms
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedTool).toBe('selection')
    expect(renderArmedGhost).not.toHaveBeenCalled()
  })

  it('draws no ghost when the pointer has never been over the canvas', () => {
    const p = new PaletteController(
      () => null, state, vi.fn(),
      renderArmedGhost as unknown as (c: { x: number; y: number }) => void,
      () => null, // pointer unknown
      vi.fn(),
    )
    p.setAccidental('#')
    expect(state.selectedAccidentalTool).toBe('#') // still armed…
    expect(renderArmedGhost).not.toHaveBeenCalled() // …but there is nowhere to draw it yet
  })
})

describe('PaletteController — dot stamp tool', () => {
  let state: EditorState
  let updateNote: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let notes: Record<string, { id: string; isRest?: boolean; dots?: number }>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    updateNote = vi.fn()
    selectNote = vi.fn()
    notes = {}
    const fakeEngine = {
      getNote: (id: string) => notes[id] ?? null,
      updateNote,
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      vi.fn(),       // renderScore
      vi.fn(),       // renderPreview
      () => null,    // getLastMousePosition
      selectNote as unknown as (id: string | null) => void,
    )
  })

  it('arms the stamp (entry mode) when in selection mode with nothing selected', () => {
    // This used to flip to entry mode with the dot armed, drawing a ghost NOTE — the same thing the
    // articulation and accidental presses used to do before their stamps.
    state.selectedTool = 'selection'
    palette.toggleDot()
    expect(state.selectedDotTool).toBe(true)
    expect(state.selectedTool).toBe('entry')
    expect(updateNote).not.toHaveBeenCalled()
  })

  it('arms the stamp even when a lingering cursor note sits in selectedNoteId (empty selection set)', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'cursor'
    notes['cursor'] = { id: 'cursor' }
    palette.toggleDot()
    expect(state.selectedDotTool).toBe(true)
    expect(updateNote).not.toHaveBeenCalled()
  })

  it('dots a real selection instead of arming', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    state.selectedItems.set('note:n1', { kind: 'note', id: 'n1' })
    notes['n1'] = { id: 'n1' }
    palette.toggleDot()
    expect(updateNote).toHaveBeenCalledWith('n1', { dots: 1 })
    expect(state.selectedDotTool).toBe(false)
  })

  it('re-pressing the dot key disarms back to selection', () => {
    state.selectedTool = 'selection'
    palette.toggleDot()
    palette.toggleDot()
    expect(state.selectedDotTool).toBe(false)
    expect(state.selectedTool).toBe('selection')
  })

  it('is mutually exclusive with the other three stamps', () => {
    state.selectedTool = 'selection'
    palette.toggleDot()
    expect(state.selectedDotTool).toBe(true)

    palette.setAccidental('#')
    expect(state.selectedDotTool).toBe(false)
    expect(state.selectedAccidentalTool).toBe('#')

    palette.toggleDot()
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedDotTool).toBe(true)

    palette.toggleAccent()
    expect(state.selectedDotTool).toBe(false)

    palette.toggleDot()
    expect(state.selectedArticulationTools).toEqual([])
    expect(state.selectedDotTool).toBe(true)

    palette.toggleTie()
    expect(state.selectedDotTool).toBe(false)
    expect(state.selectedTieTool).toBe(true)

    palette.toggleDot()
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedDotTool).toBe(true)
  })

  it('a duration press promotes the stamp into "dotted duration" note entry', () => {
    // Unlike the tie, the dot HAS an entry-mode home (selectedDots) — so it promotes rather than
    // just disarming, and must survive setDuration's own `selectedDots = 0` reset.
    state.selectedTool = 'selection'
    palette.toggleDot()
    palette.setDuration('q')
    expect(state.selectedDotTool).toBe(false)
    expect(state.selectedDots).toBe(1)
    expect(state.selectedDuration).toBe('q')
    expect(state.selectedTool).toBe('entry')
  })

  it('a plain duration press (no stamp) still clears a stale dot', () => {
    state.selectedTool = 'selection'
    state.selectedDots = 1 // left over from an earlier entry session
    palette.setDuration('8')
    expect(state.selectedDots).toBe(0)
  })

  it('disarmPositionalTools clears the armed stamp', () => {
    state.selectedTool = 'selection'
    palette.toggleDot()
    palette.disarmPositionalTools()
    expect(state.selectedDotTool).toBe(false)
  })

  it('lights the dot key, and no articulation key, while armed', () => {
    state.accent = true // stale from an earlier note-entry session
    state.selectedTool = 'selection'
    palette.toggleDot()
    expect(dotHighlight(state)).toBe('dot')
    expect(palette.noteHasAccent()).toBe(false)
  })
})

describe('PaletteController — editing a selected dot', () => {
  let state: EditorState
  let updateNote: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    updateNote = vi.fn()
    selectNote = vi.fn()
    const fakeEngine = {
      getNote: (id: string) => ({ id, dots: 1 }),
      updateNote,
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine, state, vi.fn(), vi.fn(), () => null,
      selectNote as unknown as (id: string | null) => void,
    )
  })

  it('removes the selected dots and does NOT arm the stamp', () => {
    // Clicking a dot clears the note selection, so without its own branch — ordered ahead of the arm
    // — the press would read as "nothing selected" and arm the stamp instead of editing what IS
    // selected. Same trap as the tie's.
    state.selectedTool = 'selection'
    state.selectedDotNoteId = 'n1'
    palette.toggleDot()
    expect(updateNote).toHaveBeenCalledWith('n1', { dots: 0 })
    expect(state.selectedDotTool).toBe(false)
    expect(state.selectedDotNoteId).toBeNull()
    expect(selectNote).toHaveBeenCalledWith(null) // switch-off leaves nothing selected
  })

  it('lights the dot key while the dots are selected', () => {
    state.selectedDotNoteId = 'n1'
    expect(dotHighlight(state)).toBe('dot')
  })
})

describe('PaletteController — editing a selected tie', () => {
  let state: EditorState
  let toggleTieFn: ReturnType<typeof vi.fn>
  let tieSelectionFn: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    toggleTieFn = vi.fn()
    tieSelectionFn = vi.fn()
    selectNote = vi.fn()
    const fakeEngine = {
      getNote: (id: string) => ({ id, tiedTo: 'n2' }),
      toggleTie: toggleTieFn,
      tieSelection: tieSelectionFn,
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      vi.fn(),
      vi.fn(),
      () => null,
      selectNote as unknown as (id: string | null) => void,
    )
  })

  it('removes the selected tie and does NOT arm the stamp', () => {
    // Clicking a tie clears the note selection outright, so without its own branch the press would
    // read as "nothing selected" and arm the stamp instead of editing the thing that IS selected.
    state.selectedTool = 'selection'
    state.selectedTieFromNoteId = 'n1'
    palette.toggleTie()
    expect(toggleTieFn).toHaveBeenCalledWith('n1')
    expect(state.selectedTieTool).toBe(false)
    expect(state.selectedTieFromNoteId).toBeNull()
  })

  it('leaves nothing selected after the removal (the Keypad switch-off rule)', () => {
    state.selectedTool = 'selection'
    state.selectedTieFromNoteId = 'n1'
    palette.toggleTie()
    expect(selectNote).toHaveBeenCalledWith(null)
  })

  it('lights the Keypad tie key while a tie is selected', () => {
    state.selectedTieFromNoteId = 'n1'
    expect(palette.noteHasTie()).toBe(true)
  })
})

describe('PaletteController — editing a selected accidental glyph', () => {
  let state: EditorState
  let renderScore: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let setNoteAccidental: ReturnType<typeof vi.fn>
  let updateNote: ReturnType<typeof vi.fn>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    renderScore = vi.fn()
    selectNote = vi.fn()
    setNoteAccidental = vi.fn()
    updateNote = vi.fn()
    const fakeEngine = {
      getNote: (id: string) => ({ id, alter: 1 }),
      setNoteAccidental,
      getPrevailingAlter: () => 0,
      updateNote,
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      renderScore as unknown as () => void,
      vi.fn(),
      () => null,
      selectNote as unknown as (id: string | null) => void,
    )
    // A standalone sharp glyph on note "n1" is selected in the score.
    state.selectedTool = 'selection'
    state.selectedAccidentalNoteId = 'n1'
    state.selectedAccidentalType = '#'
  })

  it('pressing the SAME accidental removes it (reverts to prevailing) and clears the selection', () => {
    palette.setAccidental('#')
    expect(updateNote).toHaveBeenCalledWith('n1', { alter: 0, forceAccidental: undefined })
    expect(state.selectedAccidentalNoteId).toBeNull()
    expect(state.selectedAccidentalType).toBeNull()
    // Switch-off leaves NOTHING selected (unlike the Del key, which keeps the note) — otherwise the
    // keypad would show a stray duration for an invisible selection.
    expect(selectNote).toHaveBeenCalledWith(null)
    expect(setNoteAccidental).not.toHaveBeenCalled()
  })

  it('a null "remove" also deletes the selected accidental', () => {
    palette.setAccidental(null)
    expect(updateNote).toHaveBeenCalledWith('n1', { alter: 0, forceAccidental: undefined })
    expect(state.selectedAccidentalNoteId).toBeNull()
  })

  it('pressing a DIFFERENT accidental changes it and keeps it selected', () => {
    palette.setAccidental('b')
    expect(setNoteAccidental).toHaveBeenCalledWith('n1', 'b')
    expect(state.selectedAccidentalNoteId).toBe('n1') // still selected
    expect(state.selectedAccidentalType).toBe('b')    // now the flat
    expect(updateNote).not.toHaveBeenCalled()
  })

  it('does not arm the stamp while an accidental is selected', () => {
    palette.setAccidental('b')
    expect(state.selectedAccidentalTool).toBeNull()
    expect(state.selectedTool).toBe('selection')
  })
})

describe('PaletteController — editing a selected articulation group', () => {
  let state: EditorState
  let selectNote: ReturnType<typeof vi.fn>
  let arts: Record<string, string[]> // per-note articulation sets, mutated by toggleArticulation
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    selectNote = vi.fn()
    arts = {}
    const fakeEngine = {
      getNote: (id: string) => ({ id, articulations: arts[id] ?? [] }),
      toggleArticulation: (id: string, type: string) => {
        const set = arts[id] ?? (arts[id] = [])
        const i = set.indexOf(type)
        if (i >= 0) set.splice(i, 1)
        else set.push(type)
      },
      runBatch: (_label: string, fn: () => void) => fn(),
    } as unknown as import('../engine/MusicEngine').MusicEngine
    palette = new PaletteController(
      () => fakeEngine,
      state,
      vi.fn(),
      vi.fn(),
      () => null,
      selectNote as unknown as (id: string | null) => void,
    )
    // A standalone articulation GROUP on note "n1" (currently an accent) is selected.
    state.selectedTool = 'selection'
    arts['n1'] = ['accent']
    state.selectedItems.set('articulation:n1', { kind: 'articulation', noteId: 'n1', type: '' })
    state.selectedArticulationNoteId = 'n1'
  })

  it('additively ADDS a missing articulation, keeping the group selected', () => {
    palette.toggleStaccato()
    expect(arts['n1'].sort()).toEqual(['accent', 'staccato'])
    expect(state.selectedArticulationNoteId).toBe('n1') // still selected
    expect(state.selectedArticulationTools).toEqual([]) // did NOT arm the stamp
  })

  it('removes an articulation the group has; the group stays selected while others remain', () => {
    arts['n1'] = ['accent', 'staccato']
    palette.toggleAccent()
    expect(arts['n1']).toEqual(['staccato'])
    expect(state.selectedArticulationNoteId).toBe('n1')
  })

  it('toggling off the LAST articulation clears the selection (nothing to keep selected)', () => {
    palette.toggleAccent() // n1 had only 'accent' → now empty
    expect(arts['n1']).toEqual([])
    expect(state.selectedArticulationNoteId).toBeNull()
    expect(selectNote).toHaveBeenCalledWith(null)
  })

  it('does not arm the stamp while an articulation group is selected', () => {
    palette.toggleTenuto()
    expect(state.selectedArticulationTools).toEqual([])
    expect(state.selectedTool).toBe('selection')
  })
})

describe('PaletteController — enterSelectionMode (Keypad Select arrow)', () => {
  let state: EditorState
  let deselectAll: ReturnType<typeof vi.fn>
  let selectNote: ReturnType<typeof vi.fn>
  let palette: PaletteController

  beforeEach(() => {
    state = createEditorState()
    deselectAll = vi.fn()
    selectNote = vi.fn()
    palette = new PaletteController(
      () => null,
      state,
      vi.fn(),
      vi.fn(),
      () => null,
      selectNote as unknown as (id: string | null) => void,
      deselectAll as unknown as () => void,
    )
  })

  it('clears the whole selection even when already in selection mode', () => {
    state.selectedTool = 'selection'
    state.selectedNoteId = 'n1'
    palette.enterSelectionMode()
    expect(deselectAll).toHaveBeenCalled()
    expect(state.selectedTool).toBe('selection')
  })

  it('switches from entry mode to selection mode and clears', () => {
    state.selectedTool = 'entry'
    palette.enterSelectionMode()
    expect(deselectAll).toHaveBeenCalled()
    expect(state.selectedTool).toBe('selection')
  })

  it('falls back to selectNote(null) when no deselectAll callback is provided', () => {
    const p = new PaletteController(
      () => null, state, vi.fn(), vi.fn(), () => null,
      selectNote as unknown as (id: string | null) => void,
    )
    state.selectedTool = 'entry'
    p.enterSelectionMode()
    expect(selectNote).toHaveBeenCalledWith(null)
    expect(state.selectedTool).toBe('selection')
  })
})
