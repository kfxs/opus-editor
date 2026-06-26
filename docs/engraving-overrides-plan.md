# Engraving Overrides — Infrastructure Plan

Status: **Phase 0 DONE (2026-06-26); Phases 1–2 next, one at a time.** This started as a
*design* document, settled in conversation (2026-06-26) before any code.

> **Phase 0 — done.** Compartment + staff-space helper shipped, no clients (as scoped):
> `Score.engravingOverrides?: EngravingOverrides` (`Record<elementId, EngravingOverride[]>`,
> a plain object so it JSON-round-trips / undoes with the score), open-ended
> `EngravingOverride { kind: string }` (concrete kinds deferred to Phase 1), ScoreModel
> accessors `getEngravingOverrides / getEngravingOverride / setEngravingOverride (upsert by
> kind) / clearEngravingOverride (one kind or all; prunes empties so absent = none)`, and a
> render-boundary helper `pixelsToStaffSpaces / staffSpacesToPixels(px|ss, stave)` in
> `src/engine/rendering/staffSpace.ts` (no callers yet). Tests:
> `engravingOverrides.test.ts` + `staffSpace.test.ts`. Type-check + boundary lint + full
> suite (788) green. NOT committed. It generalizes today's one-off `Slur.cps` into a reusable
**engraving-overrides layer** so that future hand-positioning of score elements (nudges,
curve reshapes, re-angling, breaks, spacing — including on auto-generated rests/beams) has a
single, principled home instead of pixels metastasizing across every model interface.

This plan is the authoritative cross-session checklist. It is deliberately **infrastructure-first**:
build the compartment, migrate `cps` into it as client #1, and leave the lid open for adjustment
kinds we haven't named yet.

> Read alongside `DESIGN-PRINCIPLES.md` (principle 3: *content and presentation are separate; the
> model holds neither pixels nor layout* — and its "Known boundary cases" entry on `Slur.cps`, which
> this plan resolves) and `ARCHITECTURE.md` (the `ScoreModel` ↔ renderer/viewport split this rides on).

---

## 1. Motivation

Today exactly one place stores geometry in the data model: `Slur.cps` — two cubic Bézier
control-point **deltas in pixel space**, on `Score.slurs[]`, round-tripping in JSON. The design doc
already flags it as a *deliberate exception, not a leak* — but warns:

> Before adding more drag-shaped/hand-positioned objects, decide whether such geometry overrides
> belong in the model or in a separate "engraving overrides" side-layer — don't let `cps` become an
> unexamined precedent.

We **are** going to add more: offsetting ties and slurs, nudging dynamics/text, and — per the
graphic-score vision — hand-arranging even auto-generated rests and beams. So we make the decision
now: a dedicated **engraving-overrides compartment**, with `cps` as its first client.

The long-term driver is the project's non-linear vision (a moodboard of sketches assembled into an
engraved score): the **same musical material** may appear in multiple contexts, and in contemporary /
graphic notation **spatial placement is composer intent**, not mere convenience. So authored geometry
must (a) **travel with the material** (never be silently lost on a port/assemble) yet (b) stay **out of
the pure musical content** so transposition, playback, and re-barring never trip over pixels.

---

## 2. The conceptual split (why this is clean)

"Presentation" is not one bucket. It is three, and they belong in three different places:

| Category | What it is | Examples | Home |
|---|---|---|---|
| **Derived** | Recomputable from content | auto slur arch, default stem, rest-fill, beam slope, spacing | **nowhere** — render time only |
| **Semantic choice** | Discrete, resolution-free notational decision | stem up/down, slur/tie/tuplet/articulation/dynamic **side** (above/below), `tieDirection` ±1 | **on the content model** (where they already are) |
| **Authored geometry** | Continuous, measured, drag-it-anywhere | `Slur.cps`; future nudges, re-angles, breaks, custom spacing | **the new engraving compartment** |

This is exactly where **MusicXML** (the standard the design doc points at) draws the line:
`<stem>`, `placement="above"` are stored **inline on the element** (notational content — they change how
the music is *read*); `bezier-x/y`, `default-x/y`, `relative-y` are a separate **"formatting" layer** an
app may even ignore (authored geometry).

**Consequence — the `x`-flips stay put.** `stemDirection`, `Slur.placement`, `NotePitch.tieDirection`,
`Tuplet.placement`, `articulationPlacement`, `Dynamic.placement` are all **semantic side/direction
choices**, not pixels. They remain fields on the content model. Filing them under "engraving overrides"
would be miscategorizing a musical decision as layout. Only **continuous geometry** goes in the
compartment.

**They compose.** A discrete side-flag and a continuous nudge coexist on the same element:
`placement: 'above'` (which side — content) + `+1.5 staff-spaces` (fine position — compartment). When we
later let someone drag a dynamic to an arbitrary spot, that's *adding a nudge in the compartment*, not
ripping `placement` out of the model. `placement` sits closest to the border: as long as it stays a
two-way *side* choice it is content; the moment it means "place it at this exact height," that height is
a nudge and belongs in the compartment.

What the flips and `cps` **do** share is a *pattern*, not a storage location:
**auto default → user override → reset to auto.** Keep that UX uniform (`x` flips; there is always a
clean path back to auto) even though a side-flip is an enum on the note and a shape-drag is a compartment
entry. Same mental model for the user; different home because one is a *meaning* and one is a
*measurement*.

---

## 3. Settled design decisions

Six decisions, agreed in conversation. Each maps to a principle.

1. **A separate engraving-overrides layer.** Not pixel fields smeared onto notes/slurs — a compartment
   keyed by element id: *element id → adjustment(s)*. Restores principle 3 (content/JSON become
   pixel-free); adding a new adjustable element type later costs **zero** new fields on that element.

2. **Travels with the music.** The compartment is attached to the material so porting/assembling never
   silently loses an authored placement — critical for graphic scores where placement *is* intent. It is
   a *labeled side-compartment*, not fused into pitch/rhythm, so it can be carried along, reset, or
   (later) diverged per-view.

   > ⚠️ **This promise is load-bearing and is *not* free from the keying choice.** The compartment is
   > keyed by **element id**, but the codebase's canonical currency for portable musical material — the
   > `RebarEvent` stream that `DESIGN-PRINCIPLES.md` principle 2 designates (`flattenRegion` →
   > `relayEvents` / `pasteEvents`) — **carries no ids** (`rebar.ts`: just offset/duration/pitches), and
   > every flatten→relay/paste **re-mints** slot ids (`uuidv4`). So an id-keyed table survives a *static*
   > score but is **silently dropped** by copy/paste, transpose, rebar, and "assemble sketches into a
   > score" — exactly the non-linear graphic-score workflow this layer exists for. Honoring this promise
   > therefore requires a conscious decision in Phase 0 (see §3.6 and Phase 0): either `RebarEvent` carries
   > stable element ids through flatten→relay, **or** the override sub-table travels as part of the
   > portable-material payload (mapped/concatenated alongside the events). Resolving the principle-3 leak
   > (pixels out of the model) must not quietly open a principle-2 hole (overrides keyed on a coordinate
   > the portable representation doesn't preserve).

3. **Reset-to-default is first-class; auto-reset is conservative.** The system clears an override on its
   own **only when an edit provably breaks it** — the anchor is *deleted* or *re-pointed onto a different
   element*. Everything in the gray zone (anchors survive but the basis shifted, e.g. notes inserted
   under a slur) stays **sticky** until the user clears it. When unsure: **keep and show, never silently
   discard** — a wrong auto-reset destroys authored intent (worst case for graphic scores); a wrong keep
   just looks slightly off until fixed (visible, recoverable). This is *bookkeeping*, not taste: the
   system reacts to the edit operations it performs, against the anchors an override records — not to how
   the result "looks." (Today's `setSlurEndpoint` already does the right thing: dropping `cps` on
   re-anchor.)

4. **Units are staff-spaces; coordinates are anchor-relative.** Not raw pixels (today's latent `cps`
   flaw: a pixel offset is tied to the current font/zoom/spacing, so it is the wrong shape at another
   size). Staff-space + anchor-relative means the same tweak renders correctly at any size and *rides
   along* when the music reflows. Mirrors MusicXML *tenths*.

5. **Open-ended kinds.** The full taxonomy of adjustments is unknown (the user explicitly does not yet
   know which kinds matter). So an entry carries *what kind* of adjustment + *its data*; adding a new kind
   later is additive (introduce a new kind tag), never a teardown. Build the infrastructure now; fill in
   **exactly one** kind — the slur curve reshape — by migrating `cps`.

6. **Durable identity — broader than just auto-generated elements.** Composer-has-full-control (graphic
   scores) means auto-rests and beams must be adjustable too — so they need identity that **survives
   regeneration**. But the scope is wider than "auto-generated": *any* flatten→relay re-mint orphans an
   override, including for ordinary notes moved through paste/rebar/transpose (see the warning under §3.2).
   Two distinct identity problems fall out:
   - **Rests** *have* an id but it is re-minted on every `fillRests` materialize (`pushRestSlot` →
     `uuidv4`), so the id is not durable across regeneration. Fixable by reusing the slot id when a
     rest is regenerated in place.
   - **Beams have no stored object at all** — they are pure render-time `number[][]` from
     `computeBeamGroups` (`beaming.ts`), so there is nothing to hang an id on. The only option is a
     **derived position-based key** (e.g. first+last member slot ids), not "reuse an id."

   Notes, slurs, chord-pitches, dynamics already have stable ids *within a static score*. This identity
   work is the one real piece of *upfront* groundwork, and it is the hard gate for §3.3's auto-reset rule
   (the reset rule cannot be applied to rests until their ids stop churning, or it would fire on every
   routine rest-fill).

### The one deferred fork: one-engraving vs per-context

Where the compartment ultimately *attaches* has two long-term shapes:

- **Canonical (one engraving per score):** overrides hang off `Score`. Simpler; but bakes in "there is
  one layout" — exactly the assumption principle 4 warns against.
- **Per-context (engraving per rendered view/part/tile):** shared pure content + a per-context overrides
  table keyed against shared content ids. The MuseScore/Dorico model; the only shape that survives the
  multi-instrument, multi-context future.

**Resolution (2026-06-26):** design *toward* per-context, but **start with the N=1 case** — a single
overrides table — built as a *separate object addressed by id* (never fields welded onto content) so it
can later be cloned/swapped per context without a rewrite. We do not pay the full per-context cost now;
we only refuse to foreclose it. (Mirrors how the doc already says to treat single-staff as N=1, not a
special default.)

---

## 4. Shape of the data (sketch, not final)

A compartment keyed by element id, each entry an open-ended list of adjustments tagged by kind. Values
are in **staff-spaces**, **relative to the element's natural (auto) position**. Illustrative only — exact
schema lands in Phase 1:

```
EngravingOverrides = Map<elementId, Override[]>

Override =
  | { kind: 'curveShape'; cps: [{x,y},{x,y}] }   // ← client #1 (today's Slur.cps), in staff-spaces
  | { kind: 'offset';     dx, dy }               // future: nudge a dynamic/text/rest
  | { kind: 'angle';      deg }                  // future: tilt a beam/bracket
  | { kind: 'break';      ... }                  // future: force system/page break (not a position)
  | { kind: 'spacing';    factor }               // future: stretch a passage
  | …                                            // open-ended
```

- **Keyed by id, multiple per element** (an element can be nudged *and* reshaped).
- **Lives *on* the `Score` value, not beside it.** "Separate object addressed by id" means *not welded
  onto `Note`/`Slur`/etc.* — it does **not** mean held outside the score. The compartment is a sub-tree of
  `Score` (e.g. `score.engravingOverrides`), because today `Slur.cps` already round-trips in Score JSON
  *and* rides the whole-Score undo snapshot for free; a compartment held genuinely outside `Score` would
  silently break **principle 1** (the score stays a cloneable/serializable value) and undo. Read it as
  "separate compartment, *same* Score value."
- **`break` shows the kinds aren't all positions** — the compartment holds "authored engraving
  decisions," of which positions are the common case. So the staff-space / anchor-relative rules apply to
  *positional* kinds; a `break` (or future non-geometric decision) stores neither pixels nor staff-spaces.
- Each entry implicitly records the anchor it was measured against (via its element id, plus for spans
  the start/end ids) so the conservative reset rule (§3.3) is a lookup, not a heuristic.

---

## 5. Phases

Infrastructure-first. **Phases 0–2 are the whole near-term commitment: build the mechanism and migrate
slur `cps` — nothing else.** Everything past that is a *menu, not a roadmap* (see "Adding an element" below):
each element is an independent, opt-in slice done if/when it's wanted — "move the clef, just the clef" one
month; something else, or nothing, the next. There is **no obligation to do them in order, or at all.**

- **Phase 0 — Compartment + staff-space helper (the only groundwork slur needs).**
  - Introduce the `EngravingOverrides` compartment as a *separate object addressed by id* (N=1, single
    table), with `get/set/clear(elementId, kind)` and JSON round-trip. It is a **sub-tree of `Score`**
    (`score.engravingOverrides`), so it clones/serializes/undoes with the score value (see §4). No clients
    yet.
  - Establish the **staff-space ↔ pixel** conversion at the render boundary (one helper — the stave is
    already in hand at draw time, e.g. `getSpacingBetweenLines()`), so the compartment never stores pixels.
  - **That's all of Phase 0.** The identity audit and the id-vs-portable-material decision below are
    **deliberately NOT here** — slur doesn't need them (slurs have stable ids on `Score.slurs[]` and
    aren't re-minted by rebar/paste, so a slur override travels exactly as well as the slur does today).
    They are **gates on the *first non-slur client*** and are solved per-element, when that element's turn
    comes — not up front. See "Adding an element."

- **Phase 1 — Migrate `cps` into the compartment (client #1).**
  - Move slur shape from `Slur.cps` into `EngravingOverrides` as a `curveShape` entry, **converted to
    staff-spaces** (fixing the resolution-dependence flaw). `Slur` interface loses `cps`.
  - Re-point the write path: `setSlurShape` / `previewSlurShape` / `commitSlurShape` /
    `setSlurEndpoint`-drops-shape all operate on the compartment.
  - Renderer reads the override (converting staff-spaces→pixels at draw time) and falls back to the auto
    arch (`slurArchCps`) when absent — same `cps ?? auto` semantics as today, different source.
  - **JSON migration:** read old scores that still carry `Slur.cps` (interpret as pixels, convert
    forward); write the new shape. Round-trip test both directions.
  - Net result: identical behavior to today, but the content model + its JSON are **pixel-free** and the
    boundary case in `DESIGN-PRINCIPLES.md` is *resolved* (update that doc).

- **Phase 2 — Conservative auto-reset, generalized.**
  - Lift today's slur-specific "drop shape on re-anchor/delete" into a **general invalidation rule** over
    the compartment: on an edit that deletes or re-points an anchor, clear the affected overrides;
    otherwise leave them sticky. One explicit list tied to the edit operations — no heuristics.
  - Verify against slur (delete an endpoint note; re-anchor an endpoint) before any new client exists.
  - **Hard gate:** this rule is only correct on elements whose ids are durable (Phase 0). It must **not**
    be wired to rests/beams until their identity is fixed — otherwise routine rest-fill (which re-mints
    ids) would read as "anchor deleted" and fire the reset on every regeneration. Slurs/notes (stable
    within a static score) are safe to validate against first.

- **Phase 3+ — New adjustable elements (a MENU, not an ordered roadmap).**
  This is not a sequence to march through. It is a backlog of *independent* slices, each picked up
  **if and when wanted, in any order** — "move the clef, just the clef" this month; a dynamic nudge,
  or nothing, the next. None blocks any other; none is owed. Candidates, illustrative only:
  - `offset` on dynamics/text (the first *new* kind would prove the open-ended schema + the
    `placement` + nudge composition from §2).
  - `offset` on ties/slurs as whole-object nudges; `offset` on a clef or other glyph.
  - `offset` on auto-rests, `angle` on beams/brackets (these are the ones that first trip the identity
    gate — see "Adding an element").
  - `break` (system/page), `spacing` — as the need arises.

- **Phase N — Per-context split (deferred; only if/when multiple views exist).**
  - Promote the single overrides table to one-per-rendered-context, keyed against shared content ids.
    Possible *because* Phase 0 built it as a separate id-addressed object rather than fields on content.

### Adding an element (the per-slice recipe — run this when an element's turn comes)

Each new element is the **same small recipe**, done in isolation. This is where the work deferred out of
Phase 0 lives — paid per-element, only for the element you're actually adding:

1. **Identity check (the gate).** Does this element have an id that is *stable across the edits you care
   about*? Three cases seen so far:
   - **Already stable** (slur, note, chord-pitch, dynamic, clef): nothing to do.
   - **Has an id but it churns** (auto-rest: re-minted on every `fillRests`): reuse the slot id on
     in-place regeneration before hanging an override on it.
   - **No stored object at all** (beam: pure render-time `computeBeamGroups` → `number[][]`): mint a
     **derived position-based key** (e.g. first+last member slot ids).
2. **Portable-material check (only if the override must survive paste/rebar/transpose).** The `RebarEvent`
   stream carries no ids and relay re-mints slot ids, so an override on anything that flows through
   `flattenRegion` → `relayEvents` / `pasteEvents` is dropped unless you either thread its id through that
   stream **or** carry the entry in the payload. Slur never hit this (it isn't in the stream); the first
   in-stream element (e.g. a rest nudge you want to survive a paste) is where this gets decided — **scoped
   to that element**, not solved globally up front.
3. **Storage + UX + reset.** Add the `kind` entry, a drag/handle UX, and wire it into the Phase 2
   invalidation list (delete/re-point → clear). Confirm the auto-reset gate (Phase 2) is safe for this
   element's identity before wiring rests/beams.

No teardown of earlier work at any step; adding element K never touches element K−1.

---

## 6. Invariants to hold (check new code against these)

- **No pixels in the content model or its JSON.** *Positional* overrides store **staff-spaces**; the
  compartment is a *separate sub-tree of `Score`* (`score.engravingOverrides`), not fields on
  `Note`/`Slur`/etc. (After Phase 1, `Slur.cps` no longer exists.) Non-positional kinds (`break`, …) store
  neither pixels nor staff-spaces — the staff-space rule is scoped to geometry, not to every kind.
- **The compartment stays inside the Score value.** "Separate object" means *not on the element*, not
  *outside the score*: it clones/serializes/undoes with `Score` (principle 1), as `Slur.cps` does today.
- **Overrides survive the portable-material currency, not just static scores** — *checked per element,
  when it's added.* If an element's override must outlive paste/rebar/transpose, it has to ride through
  `flattenRegion` → `relayEvents` / `pasteEvents` (which carry no ids and re-mint slot ids) — by threading
  its id through that stream or carrying the entry in the payload. This is a **per-slice gate** (see
  "Adding an element"), not Phase 0 groundwork: slur never hits it; the first in-stream element decides it,
  scoped to that element. An id-keyed table alone does **not** automatically satisfy this.
- **Overrides are anchor-relative.** Never an absolute canvas coordinate — so a reflow/transpose/re-bar
  carries the tweak along instead of pointing at empty space.
- **Auto-reset only on provably-broken (anchor deleted or re-pointed).** Gray-zone tweaks stay sticky.
  When unsure: keep and show.
- **Semantic side/direction flips stay on the content model.** `stemDirection`, `*.placement`,
  `tieDirection` are notational meaning, not geometry — they do **not** move into the compartment. The
  compartment is continuous geometry only.
- **Absent override → auto.** Every kind degrades to a render-time default when no entry exists
  (`override ?? computeDefault()`), so old scores and fresh elements need no entry to look right.
- **Identity is durable *for the elements that have overrides*.** An override is only as stable as the id
  it hangs off. Checked per element at add-time (see "Adding an element"), not globally up front — slur is
  fine as-is; rest-fill/beaming must not orphan an override only once rests/beams actually become clients.

---

## 7. Open questions / not-yet-decided

- **Exact `Override` schema** (the §4 sketch) — pinned in Phase 1 against the one real client.
- **Adjustment taxonomy** beyond `curveShape` — intentionally left open (user does not yet know which
  kinds matter); driven by demand, not speculation.
- **Per-context attachment** (§3 fork) — designed *toward*, built as N=1; promoted only when a second
  view/part actually exists.
- **Auto-generated identity strategy** — reuse-object-id (rests) vs position-derived-key (beams, which
  have no stored object) — decided **per element when it's added** (see "Adding an element"), against real
  rest-fill/beam recompute behavior. Not needed until rests/beams become clients.
- **Travel mechanism through the portable-material currency** (§3.2 warning) — ids-through-`RebarEvent`
  vs entries-in-the-payload — decided by the **first in-stream client**, scoped to it; determines whether
  that element's overrides survive paste/rebar/transpose/assemble. Slur never hits it, so it is **not**
  on the near-term (Phase 0–2) path.
</content>
</invoke>
