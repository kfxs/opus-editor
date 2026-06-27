# Multi-system slur — per-segment shape (angle) editing plan

> **Terminology.** A cross-system slur is drawn as ordered **segments**:
> `BEGIN + k×MIDDLE + END` (see `docs/multisystem-slur-plan.md`). BEGIN runs from the
> start note to the system right margin; END from the left margin to the end note; each
> MIDDLE is a full-width bow across a system the slur merely passes over. A same-line
> slur is a single unified arc (the SINGLE branch) and is **not** in scope here — it
> already has shape editing via the existing `curveShape` override.

**Goal:** let a selected **cross-system** slur expose **per-segment round (control-point)
handles** so the user can set the **angle/shape of each segment independently** — BEGIN,
each MIDDLE, and END. The square *re-anchor* handles stay exactly where they are today
(only on the two true note ends). Builds on the endpoint-handle work (`8af644b`).

Status: PLANNED (not started). Touches `SlurRenderer.ts`, `HighlightController.ts`,
`MouseController.ts`, `MusicEngine.ts`, `ScoreModel.ts`, `types/music.ts`,
`engravingOverrides.ts`.

---

## 1. The governing rule (decided with the user)

Per-segment edits persist across ordinary editing and reset **only** when the number of
systems the slur spans changes — never on mere content/measure-number changes.

| Transition | Behaviour |
|---|---|
| Edit measure content / add-remove notes / renumber — **system count unchanged** | **All** segment edits kept (begin, middles, end) |
| System count changes, still multi (e.g. 4→3 systems) | **Begin + end kept; all MIDDLE edits reset** to default |
| Multi → single (e.g. 2→1 system) | **Everything defaults** (one arc reads its own empty `curveShape`) |
| Single → multi (1→2+) | Defaults (a single shape can't map onto half-arcs) |
| Slur deleted / endpoint re-anchored onto a different note | Existing auto-reset clears it (already handled — §3.3 machinery) |

**Why this is the right model — the anchoring distinction.** BEGIN/END are tied to real
notes (`firstX`/`lastX` come from the start/end chord). MIDDLE segments are tied to
**nothing but system margins** (`lineLeftEdgeX`/`lineRightEdgeX`) — pure layout
artifacts. So begin/end edits are durable; a middle bow's shape is meaningful only while
that middle exists, i.e. while the span count is unchanged.

**Key correction over the first sketch:** the reset trigger is the **system *count*
(`toLine − toFromLine + 1`)**, NOT each segment's `lineNumber`. If content is added
*above* the slur and everything is pushed down a line, the count is unchanged (edits must
be kept) but every `lineNumber` shifts — a line-keyed store would wrongly reset. Count is
robust to that; position is not.

**The single↔multi boundary needs no special logic.** A same-line slur uses the existing
`curveShape` kind (keyed by `slur.id`); per-segment shapes use a **separate kind**. So a
2→1 collapse takes the SINGLE branch, finds no single-arc `curveShape`, and draws the
default arch — begin/end segment edits simply don't apply to a one-arc slur because they
are a different kind of data. The "everything defaults on collapse" row is automatic.

---

## 2. Storage model — a new, deliberately layout-ephemeral override kind

This is a **new override category** and a conscious departure from the rest of the
engraving-overrides compartment, which is content-anchored and survives edits (see
`docs/engraving-overrides-plan.md` §3, DESIGN-PRINCIPLES). The departure is *justified*:
MIDDLE segments have no note anchor to be relative to, so their geometry is inherently
layout-bound. Label it as such so a future reader doesn't "fix" it back.

New kind on the same `score.engravingOverrides[slur.id]` list (one entry per slur):

```ts
interface SegmentCurveShapeOverride extends EngravingOverride {
  kind: 'segmentCurveShape'
  /** System count this was authored against = toLine − fromLine + 1. The reset signature:
   *  if the live span count differs, the MIDDLE entries are stale. */
  spanCount: number
  /** cps (staff-spaces, anchor-relative) per addressable segment. */
  begin?: CurveControlPointDeltas
  end?: CurveControlPointDeltas
  /** MIDDLE segments keyed by ORDINAL among middles (0-based), NOT lineNumber. */
  middles?: Record<number, CurveControlPointDeltas>
}
```

- `cps` stay in **staff-spaces** (resolution-independent), exactly like `curveShape`.
- BEGIN/END keyed by **role** → durable.
- MIDDLE keyed by **ordinal** → survives a same-count reflow (a pushed-down 2-middle slur
  is still middles #0,#1 between the same begin/end), resets on a count change via the
  `spanCount` signature.

> **Persistence decision (open, lean = don't persist middles).** Because middle shapes
> are layout-bound, a JSON reload at a different viewport width invalidates them anyway.
> Lean: keep the whole `segmentCurveShape` override in undo for the session, but consider
> **omitting `middles` from exported JSON** (begin/end may stay — they're note-anchored).
> Confirm before implementing; simplest first cut is "persist all, accept it may reset on
> reload at a different width."

---

## 3. The reset mechanism (count-signature, not a layout sweep)

The existing auto-reset is **operation-driven**, not layout-driven (plan §3.3/§3.6) — and
that must not change. So the middle-reset is a **read-time reconcile**, not a new sweep.

**The apply decision needs no mutation and is correct every frame.** At render of a
cross-system slur, read the `segmentCurveShape` override and compare its `spanCount` to the
live `toLine − fromLine + 1`:
- **equal** → apply `begin`/`end`/`middles[ordinal]` as the segment cps.
- **different** → apply `begin`/`end` only; **ignore `middles`**.

That read-only rule is the whole of what correctness requires. No write happens during
render, which keeps the renderer holding a `Score` (not a `ScoreModel`) and never mutating.

**The lazy clear is optional — do not build it in the first cut.** Persisting the clear
(drop `middles`, bump `spanCount`) buys only two things: (1) *permanent* middle reset
semantics, i.e. middles don't resurrect if the layout later returns to the old count; and
(2) clean JSON/undo. Neither is correctness. The lean decision is to **skip the mutator
entirely** and accept resurrect-on-return (which is arguably nice UX — the user's middle
edits come back if the old layout does). Revisit only if JSON cleanliness later demands it.

> If a clear is ever added: note that `spanCount` is only known **after layout** (lines are
> assigned *during* the render pass via `measureLayoutInfo`), so a pre-`renderScore()`
> reconcile in the engine can only use **last frame's** layout. That's fine for housekeeping
> (it only drops stale data) but means the write is inherently a frame late — another reason
> to prefer omitting it. It would be a `reconcileSegmentShape(slurId, liveSpanCount)`
> ScoreModel mutator recording **no undo**, mirroring how the rebar stream drops id-keyed
> overrides (§3.6) — but again, not part of P3 unless explicitly chosen.

---

## 4. Rendering — per-segment handles (round only)

The cross-system branch already draws each segment via `drawCurveArc(...)` with its own
`p0`/`p1`/`cps` and gets back `c0`/`c1`. Changes:

1. **Apply the override per segment.** For each segment, if the reconciled override has a
   cps for that role/ordinal, convert staff-spaces→pixels against that segment's stave
   and use it instead of `slurArchCps(...)`. (BEGIN/END use the start/end note's stave;
   MIDDLE uses `representativeStaveOnLine`.)
2. **Register round handles per segment.** Each segment registers `controlPoints` (its
   `c0`/`c1`) **and** the drag context it needs: `slurEndpoints: { p0, p1, direction }`
   (the *segment's* own ends — the drag math inverts `renderCurve` against these),
   `staffSpacePx`, plus a new **segment key** so the drag writes back to the right slot:
   `segmentRole: 'begin' | 'middle' | 'end'` and `segmentOrdinal?` (for middles).
3. **Squares unchanged.** Keep the existing true-endpoint square handles on BEGIN's p0 and
   END's p1 only (the `slurTrueEndpoints` record from `8af644b`). **No** square on a
   segment's artificial margin end. So a cross-system slur shows: 2 blue squares (true
   ends) + 2 round handles per segment.

> Visual caution to verify: a slur crossing many systems shows a lot of handles. Confirm
> they're legible; if noisy, a later refinement could show one segment's handles at a time.

### 4a. The real work: handle disambiguation across segments (don't under-budget this)

Two existing lookups assume **exactly one shape-bearing element per slur id**. That holds
today (a single-arc slur has `controlPoints` on its one partial; a split slur has none). The
moment every segment carries `controlPoints`, both break and must be reworked:

- **`HighlightController.applySlurHandles`** (today ~`SlurRenderer.test`-adjacent, file
  `HighlightController.ts:558`) does a single `.find(e => e.id === selectedSlurId &&
  (e.controlPoints || e.slurEndpoints))` and draws **one** `controlPoints` pair. It must
  become a `.filter(...)` and **loop, drawing a round-handle pair per segment partial**.
- **`MouseController.handleSlurHandleMouseDown`** (`MouseController.ts:517`) grabs a
  `slur-handle` by bbox, then re-looks-up the slur element via
  `registry.getByType('slur').find(e => e.id === handle.slurId && e.slurEndpoints &&
  e.controlPoints)`. With N segments sharing `slur.id`, this `.find()` returns the **first**
  (BEGIN), so dragging the END handle would read BEGIN's endpoints + baseline cps → wrong
  segment, wrong math.

**Fix — carry the per-segment drag context on the `slur-handle` registry entry itself.**
Today a `slur-handle` entry is only `{ slurId, cpIndex, bbox }` (`HighlightController.ts:580`).
Extend it to also carry that segment's own `slurEndpoints` (p0/p1/direction), its baseline
cps (or enough to recompute via `cpsFromControlPoints`), `staffSpacePx`, and the segment
address `segmentRole`/`segmentOrdinal`. Then `handleSlurHandleMouseDown` reads everything
**straight off the picked handle** and never re-looks-up a single 'slur' element. This also
disambiguates `cpIndex` (0|1), which is otherwise meaningless across multiple segments.

The single-arc path is unchanged: it still produces one handle pair whose context happens to
be the whole arc. So this is a *generalization* of the handle entry, not a fork.

## 5. Handle-drag wiring

`handleSlurHandleMouseDown` / `handleSlurHandleDrag` already invert `renderCurve` to a cps
delta using `slurEndpoints` + baseline cps + `staffSpacePx`. With the drag context now read
off the handle entry itself (§4a), generalise the write path:

- Carry the picked handle's `segmentRole`/`segmentOrdinal` through the drag state (alongside
  the per-segment endpoints/baseline already pulled from the handle).
- `previewSlurShape` / `setSlurShape` gain a segment address. For a single-arc slur the
  address is "the whole arc" → existing `curveShape` (unchanged). For a cross-system slur
  the address routes into `segmentCurveShape.begin|end|middles[ord]` with the current live
  `spanCount`.
- `commitSlurShape` undo entry unchanged ("Reshape slur").

No change to endpoint (square) re-anchor drag, `previewSlurEndpoint`, or `reanchorSlurs`.

## 6. Edge cases / decisions

- **Many middles, count drops** (4→3): all middles reset, begin/end persist — by §3. The
  surviving middle is NOT salvaged from the old set (all-or-nothing for middles, by user
  decision — clean and matches "the structure isn't there anymore").
- **Endpoint re-anchor must also clear the new kind** — `setSlurEndpoint`
  (`ScoreModel.ts:474`) today calls `clearEngravingOverride(id, 'curveShape')`, which clears
  **only** the `curveShape` kind. It will leave a stale `segmentCurveShape` whose `begin`/`end`
  were anchored to the *old* note. **Add a `segmentCurveShape` clear there** (or clear both
  kinds). NOTE the asymmetry with the delete/rebar sites: `ScoreModel.ts:424`/`1249`/`1275`
  call `clearEngravingOverride(id)` with **no kind** → clear-all, so those already cover
  `segmentCurveShape`. Only the re-anchor site is kind-specific and needs the fix.
- **Endpoint re-anchor that changes the span count** mid-drag: it's a count change → middles
  reset on the next render via §3's apply rule (or are dropped if you add the clear); the
  begin/end are cleared by the re-anchor fix above only when re-pointed onto a different
  element. Confirm the two resets compose sanely.
- **Nested slurs / `nestLift`**: a per-segment manual shape opts that segment out of the
  auto arch (same as single-slur today). Decide whether `nestLift` still adds on top of a
  manual middle (lean: no — a manual shape is fully authored).
- **Flip side (`x`) on a multi-system slur**: flipping `direction` changes every segment's
  geometry; manual cps are stored anchor-relative with `direction` folded in by the drag
  math. Verify a flip after a per-segment edit still looks right (may warrant resetting
  segment shapes on flip — confirm).

## 7. Tests

- **Pure storage/reset logic** — a small pure helper `reconcileSegmentShape(override,
  liveSpanCount)` returning the cps to apply per segment: same count → begin/end/middles
  all applied; different count → begin/end applied, middles dropped. Unit-test in
  isolation (no VexFlow), mirroring `planSlurSegments`/`slurTrueEndpoints`.
- **Handle registration** — a fabricated cross-system slur registers round handles per
  segment carrying the right `segmentRole`/`segmentOrdinal`, and exactly two squares on
  the true ends (extend `HighlightController.test.ts` style with a fabricated registry).
- **Drag routing** — a drag on the begin/middle/end handle writes to the matching slot of
  `segmentCurveShape` with the live `spanCount` (engine/model-level test).
- **Single↔multi boundary** — collapsing to same-line reads `curveShape` (empty) → default
  arch; per-segment data is ignored. Guards the "free defaults" claim.
- Re-run existing slur/handle/endpoint tests unchanged (single path + square re-anchor
  must not regress).
- `npm run test` + `npm run build:check` + `npm run lint:boundary` green.

## 8. Manual test (user)

1. Make a 3-system slur, select it → 2 blue squares (true ends) + round handles on every
   segment (begin, the middle, end).
2. Drag the begin handle to a steeper angle; drag the middle to a different bow; drag end.
   All three hold.
3. Edit content elsewhere on the same lines (add a note) so measures reflow but the slur
   still crosses 3 systems → **all three edits persist**.
4. Add enough above so the slur now crosses **2** systems → **begin + end keep their
   angles; the middle is gone/default**.
5. Shrink further to a single line → **default arch** (everything resets).
6. Same-line slur unchanged: still one round-handle pair + squares via `curveShape`.

## 9. Suggested phasing

- **P0** — types + storage: `SegmentCurveShapeOverride`, `engravingOverrides.ts` reader,
  `ScoreModel` upsert mutator + segment-addressed `setSlurShape`, pure
  `reconcileSegmentShape(override, liveSpanCount)` returning the cps-to-apply per segment
  (the read-only apply rule, §3) + its test. Add the `segmentCurveShape` clear to
  `setSlurEndpoint` here (§6).
- **P1** — render apply: per-segment override read in the cross-system branch (no handles
  yet), gated by the live-`spanCount` apply rule — verify a hand-injected override draws the
  right per-segment angle, and that a count mismatch ignores `middles` while keeping
  begin/end.
- **P2 (the heavy one — see §4a)** — handles + drag: per-segment round handles via a
  `.filter()`+loop in `applySlurHandles`, the per-segment drag context moved **onto** the
  `slur-handle` registry entry, `handleSlurHandleMouseDown` reading off the handle (no single
  `.find` of the slur element), segment-addressed preview/commit/`setSlurShape`. Gate
  decoupling already in place from `8af644b`. Budget this as the bulk of the work.
- **P3** — manual-test §8 sequence + the single↔multi/flip edge cases (§6).
- **NOT in scope** — the lazy `reconcileSegmentShape` *write* (§3) is optional-for-correctness
  and omitted; resurrect-on-return is accepted. Persistence-to-JSON of middles (§2) is a
  separate opt-in decision. STOP after P3.
