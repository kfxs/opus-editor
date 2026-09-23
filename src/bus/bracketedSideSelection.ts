import { RequestChannel } from './requestChannel'

/**
 * ⭐ **The Properties window's before/after switch for a selected BRACKETED grace** (bracketed-grace-plan
 * P6). The window publishes; `interactions/propertyControllers/BracketedSideController` applies it through
 * `engine.bracketed.setSide`. The window never touches the engine.
 */
export interface BracketedSideRequest {
  /** A pitch id of the selected bracketed grace. */
  pitchId: string
  side: 'before' | 'after'
}

export const createBracketedSideSelection = () => new RequestChannel<BracketedSideRequest>()
