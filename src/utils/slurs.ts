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

/**
 * Nesting level of each slur (by id) for concentric rendering: how many levels of
 * **enclosed** slurs sit inside it, in the same voice. The innermost slur is level 0
 * (drawn at the base bow height); a slur that contains nested slurs is one level higher
 * than the deepest chain it encloses, so the renderer can lift it clear of the inner
 * arc(s) — outer slurs arch over inner ones (Gould).
 *
 * Computed at **render time** from the spans (score-order containment), so it is
 * order-independent and always correct after edits/deletes — unlike a create-time
 * counter. (The reserved {@link Slur.number} stays for MusicXML start/stop matching.)
 *
 * Only true **containment** is stacked; partial overlaps (neither span contains the
 * other) are left at their own level. Pure and order-stable.
 */
export function slurNestDepths(score: Score): Map<string, number> {
  const depths = new Map<string, number>()
  if (!score.slurs?.length) return depths

  // Score-order index of every slot + head-id → slot-id map (as in legatoChordIds).
  const slotIndex = new Map<string, number>()
  const headToSlot = new Map<string, string>()
  let i = 0
  for (const measure of score.measures) {
    for (const slot of measure.slots) {
      slotIndex.set(slot.id, i++)
      if (slot.type === 'chord') for (const np of slot.notes) headToSlot.set(np.id, slot.id)
      else headToSlot.set(slot.id, slot.id)
    }
  }

  // Resolve each slur to a [start, end] index span (and seed every depth at 0).
  type Span = { id: string; voice: number; start: number; end: number }
  const spans: Span[] = []
  for (const slur of score.slurs) {
    const s = headToSlot.get(slur.startNoteId)
    const e = headToSlot.get(slur.endNoteId)
    if (!s || !e) continue
    const a = slotIndex.get(s)
    const b = slotIndex.get(e)
    if (a === undefined || b === undefined) continue
    spans.push({ id: slur.id, voice: slur.voice ?? 0, start: Math.min(a, b), end: Math.max(a, b) })
    depths.set(slur.id, 0)
  }

  // Process narrowest spans first so an enclosed slur's level is known before its
  // container's: level(S) = 1 + max(level of slurs strictly contained in S), else 0.
  spans.sort((x, y) => (x.end - x.start) - (y.end - y.start))
  for (const a of spans) {
    let level = 0
    for (const b of spans) {
      if (b.id === a.id || b.voice !== a.voice) continue
      const contained = a.start <= b.start && b.end <= a.end && (a.start !== b.start || a.end !== b.end)
      if (contained) level = Math.max(level, (depths.get(b.id) ?? 0) + 1)
    }
    depths.set(a.id, level)
  }

  return depths
}
