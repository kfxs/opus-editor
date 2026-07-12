/**
 * The single source of *meaning* for tempo (docs/tempo-marks-plan.md §2).
 *
 * A {@link TempoMark} is a point change; the score's speed is therefore a **step
 * function** over the absolute beat axis — a *tempo map*, the same structure every DAW
 * and notation app uses. Playback converts beats→seconds through this map instead of
 * multiplying by one scalar, and (crucially) converts seconds→beats back through its
 * INVERSE for the playhead.
 *
 * Two design rules this module exists to hold:
 *
 * 1. **There is no global tempo.** `Score.tempo` was deleted: it was a "default" that
 *    was also, implicitly, "the value at bar 1 beat 0" — the exact conflation that made
 *    `score.clef` bleed across staves. The fallback is a constant, {@link DEFAULT_TEMPO},
 *    which lives in the engine and never in the model or JSON.
 * 2. **The number of clocks is a PARAMETER, not 1.** Every function here takes a
 *    `scope`, with `undefined` = the whole system (v1 always passes `undefined` — the
 *    identical convention to an absent `staffId` meaning staff 0). This is what keeps
 *    polytempo (research §7) reachable without a rewrite. `buildTempoMap(score, scopeA)`
 *    and `buildTempoMap(score, scopeB)` are already two independent clocks.
 *
 * Pure: no Vue, no VexFlow, no engine imports.
 */
import type { Score, TempoMark } from '@/types/music'
import { fracLte, fracToNumber } from './fraction'
import { durationToBeats } from './durations'
import { measureCapacityQuarters } from './musicUtils'

/**
 * Quarter-notes per minute assumed when no tempo mark governs a position — i.e. the
 * speed of a score with no marks at all. The ONLY fallback, and deliberately NOT a
 * model field: a score that has never been given a tempo *has no tempo statement*,
 * it does not have a hidden one.
 */
export const DEFAULT_TEMPO = 120

/** Valid BPM range for a mark (the old `ScoreModel.setTempo` clamp, now per-mark). */
export const MIN_BPM = 20
export const MAX_BPM = 300

/**
 * The mark's sounding speed in **quarter-notes per minute**, or undefined when it makes
 * no speed statement (a word with no number — it prints, and inherits the prevailing
 * tempo).
 *
 * `qpm = bpm × durationToBeats(unit, dots)` — because bpm counts the UNIT, not quarters:
 * `♩. = 60` is 60 dotted-quarters/min = **90** qpm, and `𝅗𝅥 = 60` is **120** qpm.
 * The unit defaults to a quarter, so a bare `{bpm: 120}` means what it looks like.
 */
export function markToQpm(mark: TempoMark): number | undefined {
  if (mark.bpm === undefined || !Number.isFinite(mark.bpm) || mark.bpm <= 0) return undefined
  return mark.bpm * durationToBeats(mark.unit ?? 'q', mark.dots ?? 0)
}

/**
 * One constant-tempo stretch of the score, starting at an absolute quarter-beat offset
 * (`startBeats`) which is also an absolute time (`startSeconds`). A map is a list of
 * these, sorted, cumulative, and covering the whole score — the first always starts at
 * beat 0 / second 0.
 */
export interface TempoSegment {
  /** Absolute quarter-beats from the start of the score. */
  startBeats: number
  /** Quarter-notes per minute in effect from `startBeats` until the next segment. */
  qpm: number
  /** Absolute seconds from the start of playback (cumulative through earlier segments). */
  startSeconds: number
}

/** Does this mark govern `scope`? A system-wide mark (no scopeId) governs every scope. */
function marksScope(mark: TempoMark, scope: string | undefined): boolean {
  return mark.scopeId === undefined || mark.scopeId === scope
}

/**
 * The score's speed as a sorted, cumulative step function over the absolute beat axis.
 *
 * Marks that make no speed statement (a word with no bpm) are skipped — they print, they
 * do not change the clock. At most one segment per absolute beat: two marks on one beat
 * is not a thing, so the LAST one wins (matching `restoreBeatAnchors`' clef rule).
 * The map always opens with a segment at beat 0 — {@link DEFAULT_TEMPO} unless the user
 * put a mark there.
 *
 * @param scope which clock to build. `undefined` = the whole system (v1). A scoped call
 *   sees system-wide marks PLUS the ones addressed to it, so a scope inherits the system
 *   clock until it states its own tempo.
 */
export function buildTempoMap(score: Score, scope?: string): TempoSegment[] {
  // 1. Collect every speed-stating mark at its absolute beat, in score order.
  const changes: Array<{ beats: number; qpm: number }> = []
  let base = 0
  for (const measure of score.measures) {
    const marks = [...(measure.tempos ?? [])].sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
    for (const mark of marks) {
      if (!marksScope(mark, scope)) continue
      const qpm = markToQpm(mark)
      if (qpm === undefined) continue
      changes.push({ beats: base + fracToNumber(mark.beat), qpm })
    }
    base += measureCapacityQuarters(measure)
  }
  // Stable sort by beat; a later mark at the same beat overwrites the earlier one below.
  changes.sort((a, b) => a.beats - b.beats)

  // 2. Walk them into cumulative segments, opening at beat 0.
  const map: TempoSegment[] = [{ startBeats: 0, qpm: DEFAULT_TEMPO, startSeconds: 0 }]
  for (const change of changes) {
    const last = map[map.length - 1]
    if (change.beats <= last.startBeats) {
      // Same beat (or a defensively out-of-range one): last wins, in place.
      last.qpm = change.qpm
      continue
    }
    map.push({
      startBeats: change.beats,
      qpm: change.qpm,
      startSeconds: last.startSeconds + ((change.beats - last.startBeats) * 60) / last.qpm,
    })
  }
  return map
}

/** The segment governing `beats` (the last one starting at-or-before it). */
function segmentAtBeats(map: TempoSegment[], beats: number): TempoSegment {
  let seg = map[0]
  for (const s of map) {
    if (s.startBeats > beats) break
    seg = s
  }
  return seg
}

/** The segment governing `seconds` (the last one starting at-or-before it). */
function segmentAtSeconds(map: TempoSegment[], seconds: number): TempoSegment {
  let seg = map[0]
  for (const s of map) {
    if (s.startSeconds > seconds) break
    seg = s
  }
  return seg
}

/**
 * Absolute quarter-beats → absolute seconds. Used to schedule an onset.
 *
 * A note may STRADDLE a tempo change, so its sounding length is NOT
 * `durationBeats × k` — it is `beatsToSeconds(start + duration) − beatsToSeconds(start)`.
 */
export function beatsToSeconds(map: TempoSegment[], beats: number): number {
  const seg = segmentAtBeats(map, beats)
  return seg.startSeconds + ((beats - seg.startBeats) * 60) / seg.qpm
}

/**
 * Absolute seconds → absolute quarter-beats: the INVERSE of {@link beatsToSeconds}.
 *
 * The playhead needs this. Converting elapsed seconds back with a scalar makes the
 * cursor drift away from the sound the moment a single tempo change exists.
 */
export function secondsToBeats(map: TempoSegment[], seconds: number): number {
  const seg = segmentAtSeconds(map, seconds)
  return seg.startBeats + ((seconds - seg.startSeconds) * seg.qpm) / 60
}

/** Seconds the whole score lasts, given its total length in quarter-beats. */
export function totalSeconds(map: TempoSegment[], totalBeats: number): number {
  return beatsToSeconds(map, totalBeats)
}

/**
 * The tempo (qpm) sounding at (measureNumber, beat) — the walk-back resolver, twin of
 * `dynamics.resolveActiveLevel` / `clefUtils.inheritedClef`. For the UI's "what's the
 * tempo here?"; playback uses the map (one pass) rather than walking back per note.
 */
export function effectiveTempoAt(
  score: Score,
  measureNumber: number,
  beat: TempoMark['beat'],
  scope?: string,
): number {
  // This measure: the last speed-stating mark at-or-before the target beat.
  const here = tempoMarks(score, measureNumber)
  for (let i = here.length - 1; i >= 0; i--) {
    const mark = here[i]
    if (!marksScope(mark, scope) || !fracLte(mark.beat, beat)) continue
    const qpm = markToQpm(mark)
    if (qpm !== undefined) return qpm
  }
  // Earlier measures: the last speed-stating mark, at any beat.
  for (let n = measureNumber - 1; n >= 1; n--) {
    const earlier = tempoMarks(score, n)
    for (let i = earlier.length - 1; i >= 0; i--) {
      const mark = earlier[i]
      if (!marksScope(mark, scope)) continue
      const qpm = markToQpm(mark)
      if (qpm !== undefined) return qpm
    }
  }
  return DEFAULT_TEMPO
}

/**
 * A short human label for a mark ('Allegro', '♩ = 120', 'Allegro (♩ = 120)') — for undo
 * descriptions and any semantic UI. This is the MEANING axis; how the glyph is actually
 * engraved is the render layer's job (VexFlow's StaveTempo), exactly as `dynamicLabel`
 * is separate from the dynamics glyph.
 */
export function tempoLabel(mark: TempoMark): string {
  const met = mark.bpm !== undefined && mark.showMetronome !== false
    ? `${UNIT_GLYPH[mark.unit ?? 'q']}${'.'.repeat(mark.dots ?? 0)} = ${mark.bpm}`
    : ''
  if (mark.text && met) return `${mark.text} (${met})`
  return mark.text || met || '(tempo)'
}

/** Note-value glyphs for {@link tempoLabel}. Display-only. */
const UNIT_GLYPH: Record<string, string> = {
  w: '𝅝', h: '𝅗𝅥', q: '♩', '8': '♪', '16': '𝅘𝅥𝅯', '32': '𝅘𝅥𝅰',
}

/** Tempo marks of a measure, sorted ascending by beat (empty if none). */
export function tempoMarks(score: Score, measureNumber: number): TempoMark[] {
  const measure = score.measures.find(m => m.number === measureNumber)
  if (!measure?.tempos?.length) return []
  return [...measure.tempos].sort((a, b) => fracToNumber(a.beat) - fracToNumber(b.beat))
}
