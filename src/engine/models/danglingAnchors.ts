/**
 * ⭐ **WHAT A REMOVED HEAD LEAVES POINTING AT NOTHING** — the sweeps every note-anchored mark runs after
 * notes disappear wholesale (a measure removed): a tie severed, a slur pruned, a trill degraded or
 * dropped, a glissando dropped. ONE call, so an op that removes notes cannot remember three of the four.
 *
 * ⚠️ Not a re-bar's repair: a re-bar RE-FINDS what it can first (`rebarOps`' capture/restore) and runs
 * these only as the belt behind it. This is for removals, where there is nothing to re-find.
 */
import type { Score } from '@/types/music'
import { repairDanglingTies } from './tieOps'
import { repairDanglingSlurs } from './slurOps'
import { repairDanglingTrills } from './trillOps'
import { pruneGlissandi } from './glissandoOps'

export function repairDanglingAnchors(score: Score): void {
  repairDanglingTies(score)
  repairDanglingSlurs(score)
  repairDanglingTrills(score)
  pruneGlissandi(score)
}
