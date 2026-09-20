/**
 * Core music types for the score editor — the BARREL.
 *
 * The types live in one file per domain beside this one; every reader imports them from HERE
 * (`@/types/music`), so a type moving between chapters touches no importer. ⛔ A new type goes in
 * its chapter, not in this file.
 */
export type * from './duration'
export type * from './pitch'
export type * from './tuplet'
export type * from './notes'
export type * from './signs'
export type * from './marks'
export type * from './engravingOverrides'
export type * from './score'
