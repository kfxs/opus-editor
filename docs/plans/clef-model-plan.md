# Clef Model — remove `score.clef`, make clef fully per-staff

Status: **PLANNED — not started.** Self-contained: written to survive a context
reset. A fresh session should be able to execute this end-to-end without the
originating conversation. Fixes the cross-staff clef bleed (changing the top staff's
opening clef changes every staff that hasn't set its own) by removing the vestigial
`score.clef` field — **not** by patching around it.

Related already-shipped fix (same bug family, do not redo): `fd661b8` — "mid-measure
clef on staff 1+ couldn't be removed" (registered the clef element with its `staff`).

---

## 0. Reported symptom

Two-staff score. Set the **top** staff's opening clef (measure 1, beat 0) to e.g.
`alto`. **Every** staff that has not set its own clef changes to `alto` too — a fresh
staff added below follows the top staff's clef instead of staying independent.

Repro from the user's log:
```
PaletteController ✓ Added staff below staff 0
MouseController   ✓ Clef set | alto at measure 1 beat 0.000 staff 0
→ lower staff also renders alto
```

## 1. The cause (conceptual, not cosmetic)

`score.clef` **conflates two concepts that only coincide when there is one staff**:

1. a **global document default** clef, and
2. **staff 0's opening clef** — which is per-staff *content*.

At N=1 these are the same value, so a single field worked. At N>1 they diverge:

- It is **written** from staff 0's m1 b0 opening clef (`clefOps.setClefAt` mirrors it
  into `score.clef`, *always* alongside an identical explicit clef change).
- It is **read** as the fallback default for **every** staff (`clefUtils`:
  `inheritedClef(...) ?? score.clef ?? 'treble'`).

So a staff with no clef change of its own (e.g. a freshly added staff) falls through to
`score.clef`. Change the top staff's opening clef → `score.clef` changes → every staff
without its own clef follows. That is the bug. It is the same class as `fd661b8`: **a
per-staff fact resolved as if it were global.**

### Evidence it is a pure vestige (verified against current code)

- The `ScoreModel` constructor never sets `clef` → a fresh score has
  `score.clef === undefined` (resolves to `'treble'`).
- The only functional **write** is `clefOps.ts:52-53`, inside `setClefAt`, for the
  first-staff m1 b0 case — and `clefOps.ts:54` writes an identical explicit clef change
  at the same spot. So `score.clef` never holds information not already present in
  staff 0's own m1 b0 clef change.
- The only functional **reads** are the two `clefUtils` fallback lines below.

### Audit — every `score.clef` reference in `src` (non-test), as of this plan

```
READ  (functional):  src/utils/clefUtils.ts:80   effectiveClefAt fallback
READ  (functional):  src/utils/clefUtils.ts:95   effectiveClefBefore fallback
WRITE (functional):  src/engine/models/clefOps.ts:52-53   setClefAt first-staff branch
comment:             src/engine/models/clefOps.ts:36, :49
comment:             src/engine/models/ScoreModel.ts:194, :424
```
(`clefDragStartTime`, `clefAtX`, `c.clef`, `existing.clef` etc. are unrelated — they
match the `clef` substring but are not `score.clef`.) **Re-run this audit first** (§7)
to confirm nothing new reads the field before editing.

## 2. The clean model (target)

**Clef is per-staff content. There is no document clef.**

- A staff's clef at (measure, beat) = the latest clef change with beat ≤ target **on
  that staff** (its m1 b0 change is the "opening clef"), else inherited from the nearest
  earlier measure on that staff.
- Absent any change ≤ that point → a **universal constant default `'treble'`** —
  identical for every staff, so it cannot bleed.
- `score.clef` is deleted from the model, type, and new JSON.

The per-staff resolution machinery already exists in `clefUtils.ts` (`clefOnStaff`,
`measureClefChanges`, `inheritedClef`); we are only removing the one global shortcut
that undermined it. Aligns with `docs/DESIGN-PRINCIPLES.md`: content ≠ presentation
(clef is content), instruments 1..N (no privileged staff 0).

## 3. Why NOT the hot fix (rejected)

The hot fix (call it **A**) = scope the `score.clef` fallback to the first staff only
(first staff → `score.clef`, others → `'treble'`). It stops the bleed in ~3 lines but
**keeps the conflation**: staff 0's opening clef still lives in a score-level field
while every other staff's lives in `measure.clefs[]`. That asymmetry is exactly what
produced this bug and `fd661b8`, and is a standing trap for the next one. **We remove
the field instead.** (User explicitly rejected the hot fix.)

## 4. DECISION — opening-clef removal protection: **(b) DECIDED**

**Protect the m1 b0 opening clef on EVERY staff, for symmetry** (user's choice). Today
only staff 0's opening clef is protected; after this, a lower staff's opening clef is
equally undeletable — selecting the bass clef at the very start of the second staff and
pressing Delete refuses, exactly as the top staff's opening clef does today.

Implementation (folded into Phase 2): in `removeClefAt` (`clefOps.ts:73`) drop the
`staffId === undefined` condition from the guard:
```ts
// before
if (measureNumber === 1 && fracIsZero(beat) && staffId === undefined) return false
// after (b) — protects m1 b0 on every staff
if (measureNumber === 1 && fracIsZero(beat)) return false
```
`moveClef` (`clefOps.ts:91`) already refuses landing on m1 b0 regardless of staff, so it
needs no change. The Delete path (`useShortcuts` → `MusicEngine.removeClefAt` →
`clefOps.removeClefAt`) already routes through this guard, so its "opening clef can only
be changed" message will now apply to every staff's opening clef. Note the redundancy
path in `setClefAt` calls `removeClefChangeAt` directly (bypassing this guard), so
setting an opening clef to a redundant value still normalizes it away for all staves —
same as today's staff-0 behavior; that is intended.

## 5. Change surface (phased; each phase independently green)

### Phase 1 — resolution (this is the actual bug fix)
`src/utils/clefUtils.ts`, two sites — `effectiveClefAt` (line 80) and
`effectiveClefBefore` (line 95). Current:
```ts
return inheritedClef(score, measureNumber, staffId) ?? score.clef ?? 'treble'
```
New:
```ts
return inheritedClef(score, measureNumber, staffId) ?? 'treble'
```
After this, each staff resolves independently — nothing reads a shared clef value, so
the bleed is gone. Phases 2–4 remove the now-dead field and keep the model honest.

### Phase 2 — stop writing the vestige
`src/engine/models/clefOps.ts` `setClefAt` (current lines 43–65). Delete the special
first-staff branch (lines 47–56, the `isOpening`/`score.clef` block) so the body
becomes uniform for all staves:
```ts
export function setClefAt(score, measureNumber, beat, clef, staffId?): boolean {
  const measure = getMeasure(score, measureNumber)
  if (!measure) return false
  // Redundant change (equals THIS staff's inherited clef) → remove any change here.
  const inherited = effectiveClefBefore(score, measureNumber, beat, staffId)
  if (clef === inherited) return removeClefChangeAt(measure, beat, staffId)
  return upsertClefChange(measure, beat, clef, staffId)
}
```
Consequences (all correct):
- set `treble` at m1 b0 when inherited-before is `treble` (the default) → redundant →
  no explicit change stored; opening still renders `treble` via the default.
- set `bass` at m1 b0 → differs from inherited `treble` → explicit change stored.
- setting staff 0 back to `treble` after `bass` → redundant → removes the `bass`
  change → opening reverts to `treble`. Correct.

Apply the §4 **(b)** guard change here: `removeClefAt` (`clefOps.ts:73`) drops the
`staffId === undefined` condition so m1 b0 is protected on every staff. `moveClef`
(`clefOps.ts:91`) already protects all staves — leave it.

**Verify the opening clef still always renders** even with no explicit change: it does —
`measureOpeningClef → effectiveClefAt` returns the `'treble'` default and the renderer
draws a stave clef from that. No stave renders clef-less.

### Phase 3 — JSON + type (NO migration)
Per [[project_no_json_migration]] there are **no users and no legacy JSON to support** —
the next saved file is already the current format (user confirmed). So there is **no
backfill and no `fromJSON` change**. Just delete the field and let it fall off:
- `src/types/music.ts:706-707`: remove
  ```ts
  /** Clef for the score (default: 'treble') */
  clef?: Clef
  ```
  from the `Score` interface.
- **No `fromJSON` work.** An unknown top-level `clef` key in a hand-written/old file is
  simply ignored by structural typing (no error); the score falls back to the `'treble'`
  default from Phase 1. `toJSON` (line 3335) is `JSON.stringify(this.score)`, so once we
  stop setting `score.clef` (Phase 2), new saves omit it automatically.
- Update the stale comments at `ScoreModel.ts:194` and `:424`, and `clefOps.ts:36, :49`
  (all still describe the `score.clef` mirror).

### Phase 4 — tests
`src/engine/models/ScoreModel.test.ts`. **Removing `clef?` from the `Score` type breaks
FOUR existing tests** — all touch `getScore().clef`, which no longer typechecks. (Grep
`getScore()\.clef|score\.clef` under `src/**/*.test.ts` first to confirm none slip past.)

Fix the four:
- **~line 560** `'falls back to the score opening clef'` — premise (`getScore().clef =
  'bass'`) is deleted. **Rewrite** to set an explicit opening clef instead:
  `model.setClef(1, 'bass'); expect(model.getEffectiveClef(3)).toBe('bass')` (opening clef
  inherited forward), or fold into the adjacent "inherits the most recent explicit clef
  change" test.
- **~line 588** `'stores an explicit clef on measure 1 and mirrors it to score.clef'` —
  drop the mirror assertion `expect(getScore().clef).toBe('bass')` (line ~591) and rename
  the test (no more mirror). The `clefAt(1, 0) === 'bass'` assertion still holds: setting
  `bass` at m1 b0 differs from the inherited `treble` default, so an explicit change is
  stored.
- **~line 780** `'a score with no measure clefs inherits via score.clef'` — this only
  exercises the legacy `{clef:'bass'}` JSON path we are deleting (no backfill). **Delete
  the test.**
- **~line 2131/2136** `'stamps the staffId on a clef change placed on a later staff'` —
  remove the `scoreClefBefore = getScore().clef` / `expect(getScore().clef).toBe(...)`
  guard lines; that "must not hijack the document opening clef" intent is now moot (there
  is no document clef). Keep the rest (staffId is stamped, clef is `treble`).

New tests:
- **New regression test (encodes THIS bug):** two staves (`addStaff`); set staff 0
  opening clef to `alto` (`setClefAt(1, 0, 'alto', staff0Id)` / the index-0 path);
  assert the second staff's opening clef is unchanged (`treble`) via
  `effectiveClefAt(score, 1, 0, staff1Id)` / `measureOpeningClef`.
- **New test (§4 decision b):** `removeClefAt(1, 0, staff1Id)` returns `false` (a lower
  staff's opening clef is protected), matching `removeClefAt(1, 0)` for staff 0.

(No backfill test — Phase 3 does no migration.)

## 6. Related latent issue (OUT OF SCOPE — record, do not fix here)

`ScoreModel.getEffectiveClef`/`getEffectiveClefAt` (lines 410–417) call the resolver
**without a staffId**, i.e. always staff 0. One caller is stem-direction / chord clef at
`ScoreModel.ts:2559` (`getEffectiveClefAt(chord.measure, chord.beat)`), which therefore
uses **staff 0's clef for a chord on any staff**. That is a separate multi-staff
correctness gap (a bass-clef staff 2 chord may get stem/spelling as if treble). Not
caused by and not fixed by this plan — flagged so it isn't lost. Consider a follow-up:
thread the chord's `staffId` into these calls.

## 7. Verification
```bash
# Pre-flight: confirm the audit still holds (only clefUtils reads score.clef)
grep -rn "score\.clef\|getScore()\.clef" src --include=*.ts --include=*.vue | grep -v test

npx vue-tsc --noEmit          # typecheck
npm run lint:boundary         # engine/interactions stay framework-agnostic
npm run test                  # unit (expect green incl. new cross-staff bleed test)
npm run build                 # production build
```
Manual (user does UI testing): two-staff score → change one staff's opening clef →
only that staff changes; add a staff → it opens treble regardless of the other staff.
(No legacy-JSON check — no migration path; see Phase 3.)

## 8. Definition of done
Changing any one staff's opening clef affects **only** that staff. `score.clef` no
longer exists in the model, `Score` type, or JSON (no migration — an old file's stray
`clef` key is harmlessly ignored). All tests green (four `score.clef` tests fixed/deleted
per Phase 4, plus the new cross-staff bleed + decision-(b) regressions), boundary lint
clean, build passes. Commit the plan-doc deletion or leave it as a record per house
style (other `docs/*-plan.md` are kept).
