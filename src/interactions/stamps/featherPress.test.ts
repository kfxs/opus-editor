import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createEditorState, type EditorState } from '../state/EditorState'
import { armedFeatherDirection, fanStampForPress, pressWithNothingSelected } from './featherPress'
import { bus } from '@/bus'
import type { ArmedFanStamp } from '@/bus'
import { itemKey } from '../state/selection'
import { DEFAULT_FAN_COUNT, DEFAULT_FEATHER_UNIT } from '@/utils/fannedBeam'

/**
 * Subject: `./featherPress` — `accel.` / `rit.` with NOTHING selected arm the fan stamp (his rules, 2026-09-24):
 * the dialog's opening values, or the duration ARMED for note entry; in the pressed direction; a re-press
 * disarms, the other key turns it round; ⛔ a selection is `pressFan`'s own business.
 */
describe('featherPress', () => {
  let state: EditorState
  let pressed: ArmedFanStamp[]
  let off: () => void
  beforeEach(() => {
    state = createEditorState()
    pressed = []
    off = bus.fanStamp.onPress(a => pressed.push(a))
  })
  afterEach(() => off())

  it('⭐ nothing selected, not in entry: the dialog’s opening values, in the pressed direction', () => {
    expect(fanStampForPress(state, 'rit')).toEqual({ attacks: DEFAULT_FAN_COUNT, unit: DEFAULT_FEATHER_UNIT, dots: 0, direction: 'rit' })
  })

  it('⭐ in NOTE ENTRY: the armed duration and its dots', () => {
    state.selectedTool = 'entry'
    state.selectedDuration = 'q'
    state.selectedDots = 1
    expect(fanStampForPress(state, 'accel')).toEqual({ attacks: DEFAULT_FAN_COUNT, unit: 'q', dots: 1, direction: 'accel' })
  })

  it('⭐ armed already: the same key DISARMS (null), the other turns it round, keeping its values', () => {
    state.selectedMarkingTool = { kind: 'fan', attacks: 4, unit: '8', dots: 0, direction: 'accel' }
    expect(fanStampForPress(state, 'accel')).toBeNull()
    expect(fanStampForPress(state, 'rit')).toEqual({ attacks: 4, unit: '8', dots: 0, direction: 'rit' })
    expect(armedFeatherDirection(state)).toBe('accel')
  })

  it('⭐ the press arms by the DIALOG’s route (`bus.fanStamp`), and answers that it handled it', () => {
    let disarmed = 0
    expect(pressWithNothingSelected(state, 'accel', () => { disarmed++ })).toBe(true)
    expect(pressed.map(p => p.direction)).toEqual(['accel'])
    state.selectedMarkingTool = { kind: 'fan', ...pressed[0] }
    expect(pressWithNothingSelected(state, 'accel', () => { disarmed++ })).toBe(true)
    expect(disarmed).toBe(1)
  })

  it('⛔ a note SELECTED — entry mode or not — is not this module’s: nothing armed, `false`', () => {
    state.selectedTool = 'entry'
    state.selectedNoteId = 'n1'
    state.selectedItems = new Map([[itemKey({ kind: 'note', id: 'n1' }), { kind: 'note', id: 'n1' }]])
    expect(pressWithNothingSelected(state, 'rit', () => {})).toBe(false)
    expect(pressed).toEqual([])
  })
})
