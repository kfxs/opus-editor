import { RequestChannel } from './requestChannel'

/**
 * ⭐ **The Properties window's one-pair switch for a chord in brackets** (parenthesised-note-plan P5). The
 * window publishes; `interactions/propertyControllers/EnclosureSpanController` applies it through
 * `engine.enclosure.setSpan`. The window never touches the engine.
 */
export interface EnclosureSpanRequest {
  /** A head of the chord. */
  pitchId: string
  /** `'chord'` = one pair round the whole chord; `null` = a pair per head. */
  span: 'chord' | null
}

export const createEnclosureSpanSelection = () => new RequestChannel<EnclosureSpanRequest>()
