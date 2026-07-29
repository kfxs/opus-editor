/**
 * ⭐⭐ **COLLAPSING A TYPED PASSAGE INTO ONE FANNED GESTURE** — the other way to make a fan.
 *
 * The first way (`markOps.setFan`) marks a note you already typed: one blanca, played as six.
 * This is his: *type the seven notes you want, select them, press `accel.`* — and the seven slots
 * become ONE fanned slot spanning exactly the time they spanned, with seven attacks, at the pitches
 * you typed. Entering a fan by ear, rather than by describing one.
 *
 * ⭐ **The total is a length in TIME, and it need not be one notehead.** Seven sixteenths span 7/16
 * — a dotted quarter tied to a sixteenth — and there is no single symbol for it. That is not an
 * obstacle here, because a fanned slot's written symbol is never seen: `NoteBuilder` already draws a
 * fanned slot as a plain quarter head whatever the slot says, and hands VexFlow the slot's REAL
 * length as a tick multiplier. So the span goes on the mark ({@link FanMark.length}) and the written
 * duration becomes a carrier — the longest value that fits, which is what the slot reverts to when
 * the fan comes off (the leftover sixteenth closes up as a rest).
 *
 * ⭐ **The pitches keep their ids.** The tail slots are deleted, so their ids are free, and a slur
 * anchored on one of those notes still resolves — to the MEMBER it became, which the fan supports
 * (docs/fanned-beam-pitches-plan.md, the slur reversal). Ties are the opposite case and are cut:
 * a tie is a pitch-to-pitch CONTINUATION and a member has no length of its own to continue into.
 *
 * ⛔ **Not on `MusicEngine`**: this reads and writes the score and nothing else — a score operation
 * belongs in the core (CLAUDE.md, docs/DESIGN-PRINCIPLES.md §5). `ScoreModel` keeps a thin
 * delegator, as it does for every other operation extracted here.
 */
import type {
  Score, Note, Chord, ChordRest, Measure, NotePitch, FanMark, FanMemberChord, Fraction,
} from '@/types/music'
import { findSlot } from './slotLookup'
import { setFan } from './markOps'
import { laneOfSlot } from '@/utils/tremoloPair'
import { clampFanBeams } from '@/utils/fannedBeam'
import { durationFlags, slotLength, splitBeatsIntoLengths, writtenLength } from '@/utils/durations'
import { fracAdd, fracCreate, fracEq, fracToNumber } from '@/utils/fraction'
import { dbg } from '@/utils/debug'

/**
 * The fewest beam lines a collapsed fan is drawn with. A fan needs two levels to read as one at all
 * — the narrow end is always a single line — so a passage of quarters (no flags of its own) still
 * feathers 1 → 2 rather than 1 → 1.
 */
const MIN_COLLAPSED_FAN_BEAMS = 2

/**
 * Turn the selected notes into ONE fanned slot: same total length, one attack per selected slot,
 * their pitches as its members. Returns the surviving note (the group's first), or `null` when the
 * selection is not a passage — see the refusals below.
 *
 * ⭐ **The refusals are the notation talking, not guards.** Each says "this is not one gesture":
 * - fewer than two slots — there is no passage to collapse, and one note is what `setFan` is for;
 * - a REST inside or a gap — silence is not an attack, and a fan is unbroken by construction;
 * - two MEASURES, two voices or two staves — a fan is one event, and an event is in one of each;
 * - a TUPLET member — a ramp inside a ratio is a second normalization of the same span (the refusal
 *   {@link setFan} already makes);
 * - a slot that is ALREADY fanned — collapsing a fan into a fan would silently throw away the
 *   members it has; take the fan off first.
 *
 * ⚠️ It refuses rather than doing something smaller, and the caller does NOTHING when it does. The
 * press means one thing on a multi-note selection, and a selection that is not a passage has no
 * second reading worth guessing at.
 */
export function collapseIntoFan(score: Score, noteIds: string[], direction: 'accel' | 'rit'): Note | null {
  const run = resolveRun(score, noteIds)
  if (!run) return null
  const { measure, chords } = run

  const total = chords.reduce<Fraction>((sum, c) => fracAdd(sum, slotLength(c)), fracCreate(0, 1))
  // The longest single value that fits — `splitBeatsIntoLengths` is greedy longest-first, so its
  // first piece is exactly that. It is the CARRIER: what the slot is written as while the mark does
  // the talking, and what is left standing when the mark comes off.
  const carrier = splitBeatsIntoLengths(fracToNumber(total))[0]
  if (!carrier) return null

  // ⭐ How many lines the feathering opens to, from what was typed: sixteenths feather to two, a
  // passage of thirty-seconds to three. ⚠️ Read HERE, before the owner is rewritten as the carrier —
  // it is one of the slots, and the fastest note of an accelerando is often the one you typed first.
  const beams = clampFanBeams(Math.max(
    MIN_COLLAPSED_FAN_BEAMS,
    ...chords.map(c => durationFlags(c.duration)),
  ))

  const owner = chords[0]
  const tail = chords.slice(1)
  // Built BEFORE anything is unlinked, so a member carries the marks the note wore. The pitches keep
  // their ids (see the header) but never their ties.
  const members: FanMemberChord[] = tail.map(memberOf)

  cutTies(score, tail)
  const going = new Set<ChordRest>(tail)
  measure.slots = measure.slots.filter(s => !going.has(s))

  owner.duration = carrier.duration
  if (carrier.dots) owner.dots = carrier.dots
  else delete owner.dots

  const fan: FanMark = { direction, count: chords.length, beams, members }
  // ⚠️ **Absent is the only spelling of "the slot's own duration"** — the rule `rampFrom` and
  // `spread` already follow, and for the same hard reason: `laneFingerprint` stringifies the whole
  // slot for the width-cache key, so a length that merely restates the written value would mint a
  // second key for one piece of music. Six sixteenths ARE a dotted quarter, and collapsing six is
  // then indistinguishable from marking one — which is exactly right.
  if (!fracEq(total, writtenLength(owner))) fan.length = total
  dbg(`[fanCollapse] m${measure.number} ${chords.length} slots → fan ${direction} `
    + `len=${total.num}/${total.den} written=${carrier.duration}${'.'.repeat(carrier.dots)} beams=${beams}`)
  return setFan(score, owner.notes[0].id, fan)
}

/**
 * The selected ids as ONE contiguous run of chords in one lane, earliest first — or `null` when they
 * are not that.
 *
 * ⚠️ **Contiguity is checked against the LANE, not against the selection.** The question is not
 * "are these next to each other" but "is there anything between them" — an unselected note, a rest,
 * a hole. Walking the lane's own slots between the first and the last answers both at once, and a
 * slot in another voice or on another staff is simply not in the lane and so fails the same test.
 */
function resolveRun(score: Score, noteIds: string[], ): { measure: Measure; chords: Chord[] } | null {
  const picked = new Set<Chord>()
  for (const id of noteIds) {
    // ⛔ Deliberately WITHOUT `fanMembers`: an id inside a fan resolves to nothing here, so a
    // selection that includes one is refused rather than quietly collapsing its owner.
    const found = findSlot(score, id)
    if (!found || found.type !== 'chord') return null
    if (found.chord.tupletId || found.chord.fan) return null
    picked.add(found.chord)
  }
  if (picked.size < 2) return null

  const first = [...picked][0]
  const measure = score.measures.find(m => m.number === first.measure)
  if (!measure) return null
  if ([...picked].some(c => c.measure !== first.measure)) return null

  const lane = laneOfSlot(measure.slots, first)
  const indices = [...picked].map(c => lane.indexOf(c))
  if (indices.some(i => i === -1)) return null
  const from = Math.min(...indices)
  const to = Math.max(...indices)
  const run: Chord[] = []
  for (let i = from; i <= to; i++) {
    const slot = lane[i]
    if (!picked.has(slot as Chord)) return null // a hole: an unselected note or a rest between them
    run.push(slot as Chord)
  }
  if (run.length !== picked.size) return null
  return { measure, chords: run }
}

/**
 * One member from one slot: its pitches, and the marks it was struck with ({@link Attack}).
 *
 * ⚠️ Marks only — a member IS an attack, and nothing more. A swallowed slot's own beam settings and
 * its tremolo go with the slot: both are statements about an EVENT (how it joins its neighbours, how
 * it is subdivided), and inside the group there are no neighbours and one subdivision, the ramp.
 */
function memberOf(chord: Chord): FanMemberChord {
  const member: FanMemberChord = { pitches: chord.notes.map(clonePitch) }
  if (chord.articulations?.length) member.articulations = [...chord.articulations]
  if (chord.articulationPlacement) member.articulationPlacement = chord.articulationPlacement
  return member
}

/** The same pitch, same id, minus its ties — {@link collapseIntoFan}'s header says why both halves. */
function clonePitch(pitch: NotePitch): NotePitch {
  const copy = { ...pitch }
  delete copy.tiedTo
  delete copy.tiedFrom
  return copy
}

/**
 * Cut every tie that touches a slot about to become a member — from BOTH ends, because only one end
 * of a tie is being deleted and the other would be left pointing at a pitch that is now inside a fan.
 * The same clean-up `deleteNote` does, over a run of slots.
 */
function cutTies(score: Score, going: Chord[]): void {
  const goingIds = new Set(going.flatMap(c => c.notes.map(n => n.id)))
  for (const chord of going) {
    for (const pitch of chord.notes) {
      if (!pitch.tiedTo) continue
      const partner = findSlot(score, pitch.tiedTo)
      if (partner?.type === 'chord') partner.pitch.tiedFrom = undefined
      else if (partner?.type === 'rest') partner.rest.tiedFrom = undefined
    }
  }
  // …and anyone still tied INTO the run — the note before it, or the group's own first note, which
  // was tied to the second one it is now fanned with.
  for (const measure of score.measures) {
    for (const slot of measure.slots as ChordRest[]) {
      if (slot.type !== 'chord') continue
      for (const pitch of slot.notes) {
        if (pitch.tiedTo && goingIds.has(pitch.tiedTo)) pitch.tiedTo = undefined
      }
    }
  }
}
