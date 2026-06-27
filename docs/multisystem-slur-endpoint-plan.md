# Multi-system slur — endpoint re-anchor plan

> **Terminology:** "endpoint" = *either terminus of the slur* — **both** the
> **beginning** point and the **end** point. The codebase uses `endpoint: 'start' |
> 'end'` and a `slurEndpoints` record with `p0` (= the beginning/start) and `p1`
> (= the end). This plan adds a draggable handle to **both**, so the beginning is
> just as re-anchorable as the end.

**Goal:** Let a selected **cross-system** slur expose its two *true* endpoints —
**the beginning point AND the end point** — as draggable square handles, so the user
can re-anchor the slur's start (on the BEGIN line) and end (on the END line) onto a
different note — exactly the re-anchor that same-line slurs already have. **Shape/angle (round control-point) handles stay OFF
for multi-system** (a split slur has no single `cps` to edit). No model/JSON changes.

Status: PLANNED. Builds on the multi-system *render* fix (`docs/multisystem-slur-plan.md`,
shipped 5c60b2a). Touches `SlurRenderer.ts` + `HighlightController.ts` only.

---

## 1. Why it doesn't work today (two small blockers)

The whole re-anchor machinery already exists and is **line-agnostic** — it's note-id
based, never position/system based:

`handleSlurHandleMouseDown` (endpoint branch, `MouseController.ts:533-548`) →
`handleSlurEndpointDrag` → `nearestNoteId(x,y, otherEnd)` (searches *all* notes) →
`engine.previewSlurEndpoint(slurId, 'start'|'end', candidate)` (live re-anchor, no
undo) → drop records one undo entry → `reanchorSlurs` handles the collapse case.

Cross-system slurs get no handles only because of two gaps:

1. **The cross-system render path never registers `slurEndpoints`.** Only the SINGLE
   (same-line) branch attaches `slurEndpoints` + `controlPoints` + `staffSpacePx`
   (`SlurRenderer.ts:301-305`). The per-system partials register without them — that
   was deliberate, to suppress handles on split slurs.
2. **The handle renderer is gated on `controlPoints`.** `HighlightController`
   `applySlurHandles` finds the slur element *by* `e.controlPoints` and early-returns
   if absent (`:555-558`). So even with `slurEndpoints` present, the square handles
   would never draw for a multi-system slur until that gate is split. (The square-handle
   draw block itself **already exists** and is already guarded by `if (slurEl.slurEndpoints)`
   at `:586-612` — it just never runs because the early return fires first.)

The control-point (round) handle pickup (`MouseController.ts:516-531`) requires BOTH
`slurEndpoints` **and** `controlPoints`, so it naturally stays off for multi-system
— we don't need to guard it.

## 2. The two true endpoints (and what stays unanchorable)

A cross-system slur is drawn as `BEGIN + N×MIDDLE + END` (see the render plan). Of all
those segment ends, only **two** are real, anchorable note positions:

| Handle | Position | Re-anchors |
|---|---|---|
| `start` (square) = **the beginning point** | BEGIN segment's `p0` = `{ firstX, fromY + LIFT·dir }` (the start note) | `slur.startNoteId` |
| `end` (square) = **the end point** | END segment's `p1` = `{ lastX, toY + LIFT·dir }` (the end note) | `slur.endNoteId` |

The **system-edge open ends** (where BEGIN meets the right margin, where END meets the
left margin, and both ends of every MIDDLE bow) are **not** handles — they're line-break
artifacts, not anchors. They get nothing, exactly as the user wants.

Both true-endpoint coordinates are already computable *before* the segment loop:
`firstX`/`lastX` and `fromY`/`toY` are all in scope, `LIFT`/`direction` are constants.

## 3. Implementation

### 3a. `SlurRenderer.ts` — register the true endpoints (no shape data)
In the cross-system branch, after computing `firstX`/`lastX`, build:

```ts
const trueStart = { x: firstX, y: fromY + LIFT * direction }
const trueEnd   = { x: lastX,  y: toY  + LIFT * direction }
```

Attach a `slurEndpoints: { p0: trueStart, p1: trueEnd, direction }` record to **one**
registered partial via the existing `registerPartial(..., extra)` arg. **Do NOT** attach
`controlPoints` or `staffSpacePx` — their absence is what keeps the round shape handles off.

> `HighlightController` does `getByType('slur').find(e => e.id === sel && …)` — the
> first match wins, so exactly one partial carrying `slurEndpoints` is enough.

**Carrier robustness — don't couple the endpoints to the BEGIN segment drawing.**
`planSlurSegments` only emits a `begin` segment when `lineRightEdgeX` resolves; it's
*defensively skipped* otherwise (`SlurRenderer.ts:99-100`). So "attach to the BEGIN
partial" silently loses all handles in the (rare) case that edge can't be resolved.
`trueStart`/`trueEnd` are computable purely from `firstX`/`lastX`/`fromY`/`toY`/`LIFT`/
`direction` — all in scope *before* the segment loop — so the carrier registration must
be made **independent of whether any particular segment draws** (e.g. tag the first
partial that actually gets registered, or register the endpoints unconditionally on the
slur regardless of segment-skip). Cheap insurance against a no-handles regression.

### 3b. `HighlightController.ts` — decouple square handles from round handles
In `applySlurHandles`, split the single `controlPoints` gate (`:555-558`) so endpoints
draw independently:

```ts
const slurEl = registry.getByType('slur').find(
  e => e.id === this.state.selectedSlurId && (e.controlPoints || e.slurEndpoints),
)
if (!slurEl) return
if (slurEl.controlPoints) { /* round shape handles — the existing :564-582 forEach */ }
if (slurEl.slurEndpoints) { /* square endpoint handles — already guarded at :586-612 */ }
```

Mechanical gotcha — **the round-handle `forEach` (`:564`) must move inside the new
`if (slurEl.controlPoints)` block.** Relaxing the early return from `if (!slurEl?.controlPoints)`
to `if (!slurEl) return` removes the non-null narrowing TypeScript relied on, so
`slurEl.controlPoints.forEach(...)` won't type-check unbracketed. The square block at
`:586-612` is *already* wrapped in `if (slurEl.slurEndpoints)`, so it needs no change
beyond the relaxed gate.

Same-line slurs (which carry both) are unaffected — they still get round + square.
Multi-system slurs (only `slurEndpoints`) now get **squares only**.

### 3c. Nothing else
`MouseController` endpoint drag, `previewSlurEndpoint`, `reanchorSlurs`, undo, and the
candidate-note tint all work unchanged — they never inspected the slur's segment
structure.

## 4. Edge cases — decisions

- **Re-anchor that crosses a system boundary mid-drag** (drag `start` several lines
  down): the slur re-segments every frame via the normal render path. *Decision:*
  accept the live re-flow; verify it doesn't flicker badly. No special handling.
- **Multi-system → same-line collapse** (both endpoints end up on one line): the next
  render takes the SINGLE branch, which re-attaches `controlPoints` → the **round
  shape handles reappear automatically**. *Decision:* rely on the render path; this is
  the desired behavior, just confirm it.
- **Span collapse** (`start === end`): already guarded — `reanchorSlurs` drops the slur
  and `clearEngravingOverride`s it (`MusicEngine.ts:865,888`). Same path here.
- **Square handle Y** sits at `note Y + LIFT·dir` — the arc tip right by the note,
  matching the same-line square look. *Decision:* keep; confirm visually.
- **Endpoint *tip* nudging** (move an open end's height without re-anchoring) — **OUT
  of scope** for v1. Note it so the data shape doesn't preclude it later.

## 5. Tests

> **Testability note — don't fight a StaveNote/ctx stub.** Endpoint registration happens
> inside `renderSlurs`, which needs a full `RenderPass` + `StaveNote` + canvas context —
> heavy and brittle to stub. The existing `SlurRenderer.test.ts` only covers the *pure*
> helpers (`planSlurSegments`, `lineLeftEdgeX`/`lineRightEdgeX`). Match that pattern:
> **extract the endpoint computation into a pure helper** — e.g.
> `slurTrueEndpoints(firstX, lastX, fromY, toY, LIFT, direction) → { p0, p1, direction }`
> — and unit-test *that* in isolation, then test the gate behavior at the
> `HighlightController` layer with a fabricated registry entry. This avoids a render
> harness entirely and keeps both new behaviors covered.

- **Endpoint geometry (pure)** — `slurTrueEndpoints(...)` returns `p0`/`p1` equal to the
  start/end tie-edge geometry (`firstX`/`lastX` at `fromY`/`toY` lifted by `LIFT·dir`).
  Pure, no VexFlow.
- **HighlightController gate** — with a fabricated slur element carrying **only**
  `slurEndpoints` (no `controlPoints`), `applySlurHandles` emits two `slur-endpoint`
  registry entries and **zero** `slur-handle` entries; with both fields present it emits
  both kinds (guards the decoupling). Light registry/SVG stub, no renderer.
- Re-run existing slur/handle tests unchanged (same-line path must not regress).
- `npm run test` + `npm run build:check` + `npm run lint:boundary` green.

## 6. Manual test (user)

1. Make a 2-system slur; select it → **two blue squares** appear, one at the start note,
   one at the end note (no round handles, no squares at the line break).
2. Drag the start square onto a different note on the BEGIN line → slur re-anchors;
   release → persists + undoable.
3. Drag the end square onto a note on a later line → still cross-system, re-segments.
4. Drag both onto the same line → becomes a same-line slur and the **round shape
   handles come back**.
5. Same-line slur unchanged: still round + square handles.
