import { RequestChannel } from './requestChannel'

/**
 * ⭐ **The Properties window's "Cue size" checkbox** (cue-size-plan P5, his ask 2026-09-24). The window publishes;
 * `interactions/propertyControllers/CueSizeController` applies it through `engine.cue.set`. The window never
 * touches the engine.
 */
export interface CueSizeRequest {
  /** The note, rest, grace or bracketed grace the panel shows (any head of a chord names the chord). */
  noteId: string
  /** `true` = drawn at cue size; `false` = full size. */
  cue: boolean
}

export const createCueSizeSelection = () => new RequestChannel<CueSizeRequest>()
