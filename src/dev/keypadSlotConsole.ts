/**
 * DEV CONSOLE — the Keypad's SIGN SLOTS (docs/plans/alteration-signs-plan.md §4, K1): proof that a key
 * is a slot holding a sign, ⛔ not a palette. Session-only; nothing saves it.
 *
 *   __keypad.slots()              // every slot and the sign it holds
 *   __keypad.slot('/', 'flat')    // `/` now shows, presses and lights a FLAT — no code changed
 *   __keypad.reset()              // back to Sibelius's layout
 */
import type { DrawnSignId } from '@/types/music'
import { keypadSignSlots } from '@/windows/keypad/keypadSignSlots'
import { ALTERATION_SIGNS, NATURAL_SIGN } from '@/utils/alterationSigns'

export interface KeypadSlotConsole {
  slots(): Readonly<Record<string, DrawnSignId>>
  slot(key: string, sign: DrawnSignId): Readonly<Record<string, DrawnSignId>>
  reset(): Readonly<Record<string, DrawnSignId>>
}

const SIGNS: readonly DrawnSignId[] = [...ALTERATION_SIGNS.map(s => s.id), NATURAL_SIGN.id]

export function keypadSlotConsole(): KeypadSlotConsole {
  return {
    slots: () => keypadSignSlots.all(),
    slot(key, sign) {
      if (!SIGNS.includes(sign)) throw new Error(`[keypad] "${sign}" is not a sign — signs: ${SIGNS.join(' ')}`)
      keypadSignSlots.set(key, sign)
      console.log(`[keypad] slot ${key} → ${sign}`)
      return keypadSignSlots.all()
    },
    reset() {
      keypadSignSlots.reset()
      return keypadSignSlots.all()
    },
  }
}
