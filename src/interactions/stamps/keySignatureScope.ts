/**
 * ⭐⭐ **HOW MANY STAVES ONE SELECTED KEY SIGNATURE SPEAKS FOR** — the one answer, read by the
 * highlight and by Delete so they cannot disagree.
 *
 * 🚨 **HIS REPORT, 2026-08-28, in two halves an hour apart.** With a key placed on all staves of a
 * grand staff: *"the key is for all the staves in this case however when i selected it only select the
 * first stave"* — and then *"and if i remove i remove the first stave only."* Both were right, and
 * they are one bug: the selection was scoped to the staff whose ink was clicked.
 *
 * ## ⭐ The scope is a fact about the MODEL, not a policy either way
 *
 * A key change is STORED per staff (`Measure.keys`, `staffId`) — that is what lets Bartók write four
 * sharps in one hand against four flats in the other. But a plain drop writes every staff
 * (`./keySignatureStamp`, MuseScore's polarity), so what normally stands at a bar is **ONE statement
 * drawn N times**. So neither "all staves" nor "the clicked staff" is the answer; the question is
 * *which staves are saying the thing you clicked on?* — and the score already knows.
 *
 * ⛔ **Not `keysEqual` against what the bar STORES** — against what is IN FORCE there (`getKeyAt`).
 * A bar at a system head reprints the signature it inherited and stores nothing, and clicking those
 * signs must still light every staff that is in that key.
 *
 * ⭐ Two staves in different keys therefore select separately (they are two statements) and two staves
 * in the same key select together (they are one) — with no flag, no field and nothing to keep in sync.
 *
 * ⚠️ **The same function on both sides is the point** (docs/plans/key-signature-plan.md §8.5c): the highlight
 * PROMISES what Delete does, and the moment those two are computed apart the promise is a matter of
 * luck. `interactions/passageSelectionMarks`' rule, one kind over.
 */
import type { MusicEngine } from '../../engine/MusicEngine'
import { keysEqual } from '@/utils/keySignature'

/**
 * The staff indices whose signature at `measure` is the same statement as `staff`'s — always
 * including `staff` itself.
 *
 * ⚠️ Indices and not ids, because that is what both callers hold: the highlight looks a drawn group up
 * by `keysig-<measure>-<staffIndex>`, and `MusicEngine`'s key API takes an index.
 */
export function keySignatureStavesAt(engine: MusicEngine, measure: number, staff: number): number[] {
  const count = engine.getScore().staves?.length ?? 1
  const selected = engine.getKeyAt(measure, staff)
  const staves: number[] = []
  for (let index = 0; index < count; index++) {
    if (keysEqual(engine.getKeyAt(measure, index), selected)) staves.push(index)
  }
  // A degenerate score (no staves at all) still has the one that was clicked.
  return staves.length > 0 ? staves : [staff]
}
