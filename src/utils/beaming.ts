/**
 * Pure beam-grouping logic.
 *
 * Decides which consecutive notes are beamed together, driven by the meter's
 * metric hierarchy ({@link MeterInfo}) plus any explicit per-note {@link BeamMode}
 * overrides. The renderer (`VexFlowRenderer`) maps the returned slot-index groups
 * onto its VexFlow `StaveNote`s; nothing here depends on VexFlow or the DOM, so
 * the grouping is unit-testable in isolation.
 *
 * A beam may also cross a barline ({@link computeCrossBarBeamGroups}), so the grouping is really
 * over a RUN of bars; one bar is a run of one, and that is how the per-bar entry point is defined.
 *
 * Default grouping follows the meter's primary beat groups ("show each beat"):
 * 4/4 beams per quarter, 6/8 → 3+3 eighths, 9/8 → 3+3+3, 7/8 → 2+2+3, etc.
 * Beaming never depends on clef — a beam group may span a mid-measure clef
 * change (see docs/note-selection-hit-detection.md companion decision).
 *
 * Pure: depends only on `fraction.ts`, the metric structure, and the types.
 */

import type { BeamMode, ChordRest, NoteDuration } from '@/types/music'
import { type Fraction, fracCreate, fracAdd, fracLt, fracSub, fracToNumber } from '@/utils/fraction'
import type { MeterInfo } from '@/utils/meter'
import { pairDrawing, pairIsJoined, pairRoleAt } from '@/utils/tremoloPair'

/** A duration is beamable iff it is an eighth note or shorter. */
export function isBeamableDuration(duration: NoteDuration): boolean {
  return duration === '8' || duration === '16' || duration === '32'
}

/**
 * Return which primary beat-group a note at `beat` (quarter-note units) falls
 * into, per the meter's metric hierarchy. Beams break between groups.
 *
 * The bar is partitioned by the cumulative starts of `meter.groups`; a beat is
 * in group `i` when `groupStart[i] ≤ beat < groupStart[i+1]`. Notes past the bar
 * end (over-full bars rendered crowded under SOFT) get a distinct index per
 * overflow quarter so they aren't merged into the final in-bar group.
 */
export function getBeatGroup(beat: Fraction, meter: MeterInfo): number {
  let start = fracCreate(0, 1)
  for (let i = 0; i < meter.groups.length; i++) {
    const next = fracAdd(start, meter.groups[i])
    if (fracLt(beat, next)) return i
    start = next
  }
  // beat ≥ barQuarters (start now equals the bar end): one index per overflow quarter.
  return meter.groups.length + Math.floor(fracToNumber(fracSub(beat, start)))
}

/**
 * One bar's lane in a beaming run: its slots (sorted by beat) and its own meter.
 *
 * The meter is PER BAR, not per run — a run may contain a time-signature change, and each bar's
 * beat groups are its own.
 */
export interface BeamBar {
  slots: ChordRest[]
  meter: MeterInfo
}

/** A slot inside a run of bars: which bar of the run, which slot of that bar. */
export interface BeamSlotRef {
  bar: number
  slot: number
}

/**
 * Partition `slots` (sorted by beat) into beam groups, returning the slot
 * indices in each group. Only groups of ≥ 2 beamable notes are returned;
 * everything else (rests, quarters-and-longer, lone eighths) is left unbeamed.
 *
 * Rules:
 *   - A non-beamable duration breaks the current group. A rest breaks it too — unless it is marked
 *     `beamOver` and sits interior to a group, when the beam runs over it (the "beamed rest").
 *   - Explicit {@link BeamMode} on a slot overrides the default grouping:
 *     `'single'` forces no beam; `'begin'`/`'continue'`/`'end'` build a manual
 *     group that ignores beat boundaries (lets a beam bridge across them).
 *   - Otherwise notes beam together while they share a {@link getBeatGroup}.
 *
 * One bar is a run of one — see {@link computeCrossBarBeamGroups}, which this delegates to.
 */
export function computeBeamGroups(slots: ChordRest[], meter: MeterInfo): number[][] {
  return computeCrossBarBeamGroups([{ slots, meter }]).map(group => group.map(ref => ref.slot))
}

/**
 * The same grouping over a RUN of bars, so a beam can cross a barline
 * (docs/cross-barline-beaming-plan.md).
 *
 * `bars` must be one LANE — one voice of one staff, each bar's slots sorted by beat — the same
 * slice {@link beamRoleAt} insists on, or a voice-2 note is scored against voice 1's grouping.
 *
 * ## The barline
 *
 * A bar boundary is an **unconditional break**, and it has to be stated as one: `slot.beat` is
 * bar-relative, so beat 0 of bar N+1 has the same beat-group index as beat 0 of bar N and the
 * metric rule alone would silently join every bar to the next.
 *
 * It opens only when a `continue` sits at it — on the **last** slot of bar N (a beam going out) or
 * on the **first** slot of bar N+1 (a beam coming in; across a barline there is nowhere else it
 * could come from). `continue` means the same thing wherever it sits, which is the whole reason it
 * is the mark that crosses.
 *
 * Both cases fall out of the in-bar rules once the boundary stops flushing: a trailing `continue`
 * has already armed `bridgeNext`, and a leading `continue` joins the run behind it. A `begin` does
 * NOT cross — it is a break, and the boundary flushes its group like any other.
 */
export function computeCrossBarBeamGroups(bars: BeamBar[]): BeamSlotRef[][] {
  const groups: BeamSlotRef[][] = []
  let current: BeamSlotRef[] = []
  let currentBeatGroup: number | null = null
  /**
   * The NEXT note joins this group whatever beat it falls in — armed by `'continue'` and by
   * `'begin'`, and it remembers WHICH, because only one of them may open a barline.
   *
   * `continue`: a note marked so has a beam coming in and a beam going out — that is what the word
   * means, and what MusicXML means by it. Without this flag `continue` only removed the break BEHIND
   * the note, so it appeared to work on the first note of a group (whose boundary is behind it) and
   * did nothing at all on the last note of a group (whose boundary is in front). Same mark, same
   * bar, two different outcomes decided by where the note happened to sit.
   *
   * `begin`: a beam of one note is not a beam. `begin` … has to be followed by a `continue` or an
   * `end` — MusicXML's own grammar — so the mark takes the next beamable note with it, and the
   * meter closes the group after that. Without it, `begin` on an off-beat eighth would start a
   * group that its own beat immediately ends, and the mark would engrave nothing at all.
   */
  let bridgeNext: 'begin' | 'continue' | null = null
  /**
   * The group currently ends on a FAN, and **only another fan may extend it**
   * (docs/fan-beam-join-plan.md P2).
   *
   * A fan has to be able to OPEN a group, or a fan-to-fan join could never form: the mark that joins
   * lives on the RIGHT fan, and it needs something already open on its left to be pushed onto. But
   * what it opens is open to fans alone — an ordinary note joined to a fan's right end would be
   * addressing its last MEMBER, which is a pitch inside the event and not a slot anybody can name
   * (§4). So this stands between the two: a fan leaves the group open, and anything that is not a
   * fan closes it on arrival.
   */
  let fanTail = false

  const isRestRef = (ref: BeamSlotRef): boolean => bars[ref.bar].slots[ref.slot].type === 'rest'

  const flush = () => {
    // A beam ends on a note, never a rest — drop any `beamOver` rests left trailing (a leading one
    // was never added). What survives therefore starts and ends on a note, so the `>= 2` check still
    // means "at least two notes". No effect unless a rest was swept in: an ordinary rest flushes.
    while (current.length && isRestRef(current[current.length - 1])) current.pop()
    if (current.length >= 2) groups.push(current)
    current = []
    currentBeatGroup = null
    bridgeNext = null
    fanTail = false
  }

  for (let b = 0; b < bars.length; b++) {
    const { slots, meter } = bars[b]

    if (b > 0) {
      // THE BARLINE. `bridgeNext` still standing means the previous bar's LAST slot was a
      // `continue`; a leading `continue` speaks for the boundary from the other side. Anything else
      // — including a `begin` nobody closed — is flushed here.
      // An empty bar opens nothing: there is no note at the boundary to carry the beam, so the
      // group ends here rather than reaching over the bar to the one after it.
      //
      // ⭐ A FANNED first slot opens it on exactly the same terms as any other (P3 of
      // docs/fan-beam-join-plan.md): a joined fan carries a leading `continue`, and that satisfies
      // "across a barline there is nowhere else it could come from" word for word. P0 and P2 kept a
      // `!first.fan` here while the drawing could not span two bars; `planCrossBarBeams` now routes
      // such a group to a `CrossBarFanJoin`, which builds no `Beam` and leaves the fan its stem.
      const first = slots[0]
      const opened = first !== undefined
        && (bridgeNext === 'continue' || (first.type === 'chord' && first.beam === 'continue'))
      if (!opened) flush()
    }

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const ref: BeamSlotRef = { bar: b, slot: i }

      // ⚠️ A TWO-NOTE TREMOLO PAIR is never a member of an automatic group — it owns its own beam or
      // none (docs/two-note-tremolo-plan.md §2). The exclusion belongs HERE, in the pure grouper, and
      // not in `VexFlowRenderer.buildBeams`: the cross-barline planner feeds the renderer its own
      // `inBarGroups`, so a pair excluded only at the renderer would still be dragged into a group
      // ACROSS A BARLINE by the plan. Both members break, exactly as a plain rest does.
      //
      // An AUTHORED beam role on either slot is a second answer to the same question, so the pair
      // refuses it rather than silently winning (`pairIsValid`) — which is also what keeps this from
      // being circular: the predicate reads the stored `beam` field, never a computed role.
      if (pairRoleAt(slots, i) !== null) { flush(); continue }

      // ⚠️ A FANNED slot owns its own beam too — the feathered one it is the whole point of — so it
      // is no more a member of an automatic group than a pair is, and for the same reason: two
      // beams would argue over one stem. Here rather than in the renderer, again because the
      // cross-barline planner reads these groups and would otherwise drag a fanned corchea across a
      // barline into someone else's beam. See docs/fanned-beams-plan.md §3 (P0).
      //
      // ⭐ …but it MAY be JOINED to the group on its LEFT (docs/fan-beam-join-plan.md). `continue`
      // authored on the owner is the exact word and not a spare key: a beam comes in AND a beam
      // goes out, and the outgoing one is the ramp. So the fan is pushed onto a group already open —
      // joined behind, never bridging in front, because the fan's last member is a pitch inside the
      // event and no slot can address it. With nothing open the mark is inert: a fan is not a group
      // of one.
      //
      // ⭐ P2 — AND THE GROUP ON ITS LEFT MAY BE ANOTHER FAN. So a fan no longer closes the group
      // behind it; it leaves one open, marked {@link fanTail} so that only a fan may take it up.
      // Chains fall out of that: each fan in the run joins the one before it, and the run ends the
      // moment anything else arrives.
      if (slot.type === 'chord' && slot.fan) {
        if (slot.beam === 'continue' && current.length > 0) {
          current.push(ref)
        } else {
          flush()
          current = [ref]
        }
        currentBeatGroup = getBeatGroup(slot.beat, meter)
        // A fan bridges nothing forward: the only thing that may follow it is a fan carrying its own
        // `continue`, and that mark speaks for itself.
        bridgeNext = null
        fanTail = true
        continue
      }

      // …and here is where anything that is NOT a fan closes it. A lone unjoined fan therefore still
      // ends up in no group at all — `flush` drops a group of one, exactly as it did before P2.
      if (fanTail) flush()

      // A rest breaks the beam — UNLESS it is marked `beamOver`, when it becomes a SILENT `continue`:
      // swept into the group before it AND bridging the boundary at it, so the note after joins across
      // with no mark on the neighbours. That is what "beam over this rest" means, and it is why the one
      // click does the whole job (`♪ 𝄾 ♪ ♪` → one beam, even when the rest sits on a beat boundary). Like
      // `continue` it cannot START a group — a leading rest is nothing to beam — and, being silent, it is
      // trimmed if nothing follows it (trailing, see `flush`).
      if (slot.type === 'rest') {
        if (slot.beamOver && current.length > 0) {
          current.push(ref)
          currentBeatGroup = getBeatGroup(slot.beat, meter)
          bridgeNext = 'continue'
        } else {
          flush()
        }
        continue
      }

      // Non-beamable durations (quarter and above) always break beams.
      if (!isBeamableDuration(slot.duration)) { flush(); continue }

      const beam = slot.beam // BeamMode | undefined

      if (beam === 'single') {
        // Force no beam — flush current group, skip this note.
        flush()
        continue
      }

      if (beam === 'begin') {
        // A break in front, and the next beamable note comes with it — then the meter closes the
        // group. `begin` is a statement about where a beam STARTS, so it must engrave a beam: a
        // group of one is not one, and MusicXML's grammar says the same (a `begin` is followed by
        // `continue`s and an `end`).
        //
        // It used to open a FORCED group that ignored every beat boundary until an `end`, a rest or
        // the end of the bar — the group never terminated. Eight eighths in 4/4 with `begin` on the
        // second engraved ONE seven-note beam and left the first note with a flag (user-reported,
        // with a screenshot). The bug was the missing end, not the taking of the next note.
        flush()
        current = [ref]
        currentBeatGroup = getBeatGroup(slot.beat, meter)
        bridgeNext = 'begin'
        continue
      }

      if (beam === 'continue') {
        // Bridge across a beat boundary — override normal grouping rules. BOTH sides: joining the run
        // behind is the `current.push` below, and the break in front is removed by `bridgeNext`.
        if (current.length > 0) {
          current.push(ref)
        } else {
          // Orphaned continue (no preceding group) — start one.
          current = [ref]
        }
        currentBeatGroup = getBeatGroup(slot.beat, meter)
        bridgeNext = 'continue'
        continue
      }

      if (beam === 'end') {
        // Close the current group after adding this note.
        if (current.length > 0) {
          current.push(ref)
        } else {
          // Orphaned end — emit a single-note group (dropped by flush's min-2 check).
          current = [ref]
        }
        flush()
        continue
      }

      // beam === undefined/'auto' — use standard beat-boundary logic.
      //
      // `bridgeNext` spends itself HERE, on the first note that follows the `continue`, whichever
      // branch takes it — a barline stands between the two often enough that leaving it armed in the
      // forced branch would arm the NEXT barline as well, and a `begin`…`continue` would run to the
      // end of the run instead of to the end of the bar it crossed into.
      const bridged = bridgeNext !== null
      bridgeNext = null

      const beatGroup = getBeatGroup(slot.beat, meter)
      // The note right after a `continue` joins across the boundary, and then normal grouping
      // resumes from ITS beat group — so marking one note continue bridges exactly one boundary,
      // not every boundary to the end of the bar. A barline is one of those boundaries: the first
      // note of the next bar spends the bridge exactly as the next note in the bar would.
      if (currentBeatGroup === null || beatGroup === currentBeatGroup || bridged) {
        current.push(ref)
        currentBeatGroup = beatGroup
      } else {
        flush()
        current = [ref]
        currentBeatGroup = beatGroup
      }
    }
  }

  flush()
  return groups
}

/**
 * Translate the slots of ONE beam group into the indices VexFlow's `Beam.breakSecondaryAt` wants.
 *
 * Two conventions meet here, which is the whole reason this is a named function and not an inline
 * `.map`. Ours: the `secondaryBreak` flag sits on the note that STARTS the new group — the break is
 * in front of it, the reading `begin` already has. VexFlow's: the index it is given is the note the
 * secondary beam ENDS AFTER. So a break in front of `i` is a break at `i - 1`.
 *
 * A flag on the group's first note has nothing in front of it to break, and is dropped.
 */
export function secondaryBreakIndices(groupSlots: ChordRest[]): number[] {
  const indices: number[] = []
  for (let i = 1; i < groupSlots.length; i++) {
    const slot = groupSlots[i]
    if (slot.type === 'chord' && slot.secondaryBreak) indices.push(i - 1)
  }
  return indices
}

/**
 * Where a note ACTUALLY sits in its beam, once {@link computeBeamGroups} has run.
 *
 * The four values are `BeamMode` minus `'auto'` — deliberately. `auto` is not a role a note can be
 * in; it is the absence of an authored choice, and every note, authored or not, ends up in exactly
 * one of these four.
 */
export type BeamRole = Exclude<BeamMode, 'auto'>

/**
 * The beam role of slot `index` — first of its group → `'begin'`, last → `'end'`, anywhere between
 * → `'continue'`, in no group at all → `'single'`.
 *
 * This is the OTHER half of what a beam palette has to say. The stored `beam` answers "did anyone
 * author this?" (`auto` = nobody did), which on four auto eighths beamed 2+2 tells you nothing about
 * the engraving — both notes report `auto` while one begins a beam and the other ends it. This
 * answers "what is it?", and the two can disagree: an orphaned `end` with nothing behind it is
 * authored `end` and engraved `single`, which is how you find out a mark did nothing.
 *
 * `slots` must be the run the renderer beams — ONE voice of ONE staff, sorted by beat — or the
 * indices refer to a grouping that was never engraved.
 */
export function beamRoleAt(slots: ChordRest[], meter: MeterInfo, index: number): BeamRole {
  return beamRoleAtRef([{ slots, meter }], { bar: 0, slot: index })
}

/**
 * {@link beamRoleAt} over a RUN of bars, so a note beamed through a barline reads `continue` rather
 * than the `end` its own bar would call it (docs/cross-barline-beaming-plan.md).
 *
 * The run is a fact about the SCORE, not about the page: nothing here knows where the systems break,
 * so a join the layout could not engrave still reads as one. That is the palette working — the mark
 * is what was authored, and the break is what the page did with it.
 */
export function beamRoleAtRef(bars: BeamBar[], ref: BeamSlotRef): BeamRole {
  // ⭐ A TWO-NOTE TREMOLO PAIR answers for ITSELF. The grouper above cannot see the pair's beam —
  // the pair is excluded there on purpose, and the `Beam` is built by the renderer — so asking it
  // would report `single` for a note the reader can plainly see beamed, which is what the Keypad's
  // beam keys were showing.
  //
  // What it reports is the pair's own drawing, and on a pair those keys are what SETS that drawing
  // (`PaletteController.routeBeamToTremoloPairStyle`), so the pad reads back exactly what it writes:
  //  - a real beam over the pair, OR strokes JOINED to both stem tips — both are one line joining two
  //    notes, so the first BEGINS it and the second ENDS it;
  //  - anything else (drawn apart with flags, or open floating strokes) → `single`, which is the
  //    truth and also the key you press to get back.
  const slots = bars[ref.bar]?.slots ?? []

  // ⭐ A FANNED slot answers for ITSELF too, and the answer is `begin` (his call). Same situation as
  // the pair, one line above: the grouper flushes at a fan (it must, or the cross-barline planner
  // drags a fanned corchea into someone else's beam), so it would report `single` for a note the
  // reader plainly sees carrying a beam — a feathered one, drawn by `FannedBeam`.
  //
  // `begin` rather than `single` because the group STARTS there: everything the beam covers is
  // inside this one slot, and the note you typed is its first member. Read the other way round, on a
  // fan `begin` simply MEANS what `single` means everywhere else — one self-contained group — so
  // there is no second thing for `single` to say, and the row is not offering two names for one
  // fact.
  //
  // ⭐ …unless it is JOINED to the group on its LEFT, when the answer is `continue` — a beam coming
  // in and a beam going out, the word's own definition (docs/fan-beam-join-plan.md §0). ⚠️ Never
  // `end`, although the generic rule below would say exactly that for the last fan of a group: a fan
  // ALWAYS has an outgoing beam, and it is its own ramp.
  //
  // The index is what it turns on, not mere membership — P2 put fan CHAINS in one group, so the
  // first fan of a chain is in a group and still `begin`s it.
  //
  // It stays a READING and not a setting: `continue` is the ONE beam key a fanned slot takes
  // (`PaletteController.setBeam`), and where that mark is inert — authored on a fan with nothing
  // open behind it — this reports `begin` while the field says `continue`, which is how you find out
  // it did nothing.
  const own = slots[ref.slot]
  if (own?.type === 'chord' && own.fan) {
    for (const group of computeCrossBarBeamGroups(bars)) {
      const at = group.findIndex(member => member.bar === ref.bar && member.slot === ref.slot)
      if (at !== -1) return at === 0 ? 'begin' : 'continue'
    }
    return 'begin'
  }

  const pairRole = pairRoleAt(slots, ref.slot)
  if (pairRole !== null) {
    const firstIndex = pairRole === 'first' ? ref.slot : ref.slot - 1
    const joined = pairDrawing(slots, firstIndex).beamed || pairIsJoined(slots, firstIndex)
    if (!joined) return 'single'
    return pairRole === 'first' ? 'begin' : 'end'
  }

  for (const group of computeCrossBarBeamGroups(bars)) {
    const at = group.findIndex(member => member.bar === ref.bar && member.slot === ref.slot)
    if (at === -1) continue
    if (at === 0) return 'begin'
    return at === group.length - 1 ? 'end' : 'continue'
  }
  return 'single'
}
