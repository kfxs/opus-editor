/**
 * The two "absent means zero" lane rules, in one place.
 *
 * A note, rest, dynamic, slur or tuplet addresses a **lane** — a (staff, voice) pair — and both
 * halves are optional in the model, because absent means the first one: `voice` absent = voice 0
 * (`types/music.ts`), `staff` absent = staff 0 (the flat projection of the same `staffId` rule
 * `engine/models/staffContent.ts` states for slots). That is a deliberate choice and the reason a
 * single-staff, single-voice score serializes with neither field.
 *
 * The cost is that every read has to re-derive it, and `x.voice ?? 0` was written out at 150 sites
 * and `x.staff ?? 0` at 69. Forgetting one does not fail loudly — the note simply belongs to the
 * wrong lane, which is the "next-note search unscoped by (voice, staff)" bug family
 * (docs/multi-staff-plan.md) that has already been fixed once. Naming the rule makes it greppable
 * and gives it one home to change.
 *
 * ⚠️ These resolve an absent FIELD, not an absent OBJECT. They take a value, deliberately not
 * `T | undefined`: `maybeNote?.voice ?? 0` is answering a different question (there is nothing
 * there) and must stay visible at its call site.
 *
 * Pure and dependency-free — it depends on no other module at all, so it can be imported from
 * anywhere in the core without adding an edge to the graph.
 */

/**
 * The voice a note/rest/dynamic/slur belongs to — **absent = voice 0**.
 *
 * Takes the field's own union so the result stays `0 | 1 | 2 | 3` and can be passed straight back
 * into a `NoteParams` or a voice-keyed map.
 */
export function voiceOf(x: { voice?: 0 | 1 | 2 | 3 }): 0 | 1 | 2 | 3 {
  return x.voice ?? 0
}

/**
 * The 0-based staff index a flat note or element sits on — **absent = staff 0**.
 *
 * The ordinal twin of `staffContent`'s `staffId` rule: the slot model stores an absent `staffId`
 * for the first staff, and the flat public view projects that back to an absent `staff`.
 */
export function staffOf(x: { staff?: number }): number {
  return x.staff ?? 0
}
