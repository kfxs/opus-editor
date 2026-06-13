import type { Score } from '@/types/music'

/**
 * Slur-related helpers for playback. Slurs are notational first-class spans on
 * {@link Score.slurs}; for audio they're interpreted as legato — the notes under a
 * slur connect to their successor without the tiny gap a detached note leaves.
 */

/**
 * The set of chord ids that should play **legato into their successor** because a
 * slur spans from them to a later event. For each slur we resolve its start/end
 * anchors (head ids → containing chord/rest) to positions in score order and mark
 * every chord from the start up to (but not including) the end: those are the
 * notes that connect *forward* to the next note. The end note is the slur's last
 * event — nothing after it to bind — so it is not marked.
 *
 * Rests in the span contribute no sound and are never marked. Pure and
 * order-stable; safe to call per playback pass.
 */
export function legatoChordIds(score: Score): Set<string> {
  const out = new Set<string>()
  if (!score.slurs?.length) return out

  // Score-order list of slot ids (chord.id / rest.id) + a head-id → slot-id map,
  // so a slur anchored to a chord head resolves to its event's position.
  const slotOrder: { id: string; isChord: boolean }[] = []
  const headToSlot = new Map<string, string>()
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      slotOrder.push({ id: slot.id, isChord: slot.type === 'chord' })
      if (slot.type === 'chord') {
        for (const np of slot.notes) headToSlot.set(np.id, slot.id)
      } else {
        headToSlot.set(slot.id, slot.id) // a rest anchors to itself
      }
    }
  }

  const indexOf = (slotId: string) => slotOrder.findIndex(s => s.id === slotId)

  for (const slur of score.slurs) {
    const startSlot = headToSlot.get(slur.startNoteId)
    const endSlot = headToSlot.get(slur.endNoteId)
    if (!startSlot || !endSlot) continue
    const startIdx = indexOf(startSlot)
    const endIdx = indexOf(endSlot)
    if (startIdx < 0 || endIdx < 0 || startIdx >= endIdx) continue

    for (let i = startIdx; i < endIdx; i++) {
      if (slotOrder[i].isChord) out.add(slotOrder[i].id)
    }
  }

  return out
}
