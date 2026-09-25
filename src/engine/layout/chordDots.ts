/**
 * ⭐⭐ **A CHORD WHOSE DOTS COLLIDE — a cluster of seconds: a TABLE OF RULES** (docs/plans/multiple-dots-plan.md
 * R5, P4e).
 *
 * ## What we drew until 2026-09-25 — the `vexflow` row
 *
 * VexFlow's `Dot.format` (`engrave/notes/dotStack`) walks the chord top-down and never checks a SPACE note's
 * dot against the one before it: in a cluster C5 D5 E5 F5, D5's dot drops into C5's space and TWO DOTS ARE
 * DRAWN ON TOP OF EACH OTHER (measured, `e2e/dots.e2e.ts` P3) — which reads as one.
 *
 * ## Gould pp. 55–56 — the `gould` row, read off her figures (2026-09-25)
 *
 * - p. 55: *"Each dot should always have a stave-space to itself."*
 * - p. 56: *"Centre the dots on the chord, rather than placing them in one direction, away from the chord"* —
 *   her four-note cluster puts one dot BELOW it (spaces 3.5 / 2.5 / 1.5 / 0.5), ⛔ not all four upward.
 * - p. 56: *"When a dot is forced to be two or more stave-spaces from the chord … use only as many dots as
 *   cover the number of stave-spaces taken up by the chord"* — her eight-head cluster from the bottom line to
 *   above the top one carries FIVE dots, exactly the spaces it covers, ⛔ not eight running off both ends.
 *
 * ⇒ **Only a chord whose natural dots COLLIDE is touched** — her ordinary chords (p. 55) keep a dot beside
 * each head. Such a chord's dots take a contiguous run of spaces centred on it; if that run would need a
 * second space beyond the chord on either side, only the spaces the chord covers are used and the surplus
 * dots are DROPPED.
 *
 * ⭐ **LilyPond and MuseScore rows — PORTED 2026-09-25** from their source (`docs/research/multiple-dots-research.md`
 * Part D, the pseudocode with file:line). ⚠️ Both run on EVERY chord, as the engines do — ⛔ not only a
 * colliding one, which is `gould`'s and `verovio`'s scope.
 *
 * Not a width — ⚠️ but a re-arm must re-engrave, so its generation is in `layout/widthRowGenerations` (the
 * SHAPE key), as `layout/dotVoice`'s is.
 */

/** What a chord does when two of its dots would share a space — or, for an ENGINE's rule, what it does
 *  with every chord's dots (`lilypond`, `musescore` run on every chord, as the engines do). */
export type ChordDotCollision = 'keep' | 'merge' | 'centre' | 'lilypond' | 'musescore'

export interface ChordDotRule {
  collisions: ChordDotCollision
  source: string
}

export const CHORD_DOT_RULES = {
  /** ✅ **ARMED — Gould** pp. 55–56: each dot its own space, centred on the chord, surplus dropped. */
  gould: { collisions: 'centre', source: 'Gould pp. 55–56 — a space each, centred; surplus dropped' },
  /**
   * **LilyPond** (`lily/dot-column.cc` + `lily/dot-configuration.cc` @ `beedbfa`, ported 2026-09-25): a chain
   * shift up or down chosen by a quadratic cost with an up-bias, and a tall chord trimmed first by
   * `chord-dots-limit` (3). Runs on EVERY chord. {@link lilypondChordSpaces}.
   */
  lilypond: { collisions: 'lilypond', source: 'LilyPond — dot-column.cc / dot-configuration.cc, chord-dots-limit 3' },
  /**
   * **MuseScore 4** (`rendering/score/chordlayout.cpp` @ `929d1e9`, ported 2026-09-25): a side per line note
   * from its seconds, space notes anchored first, one flip when the space is taken — ⚠️ never re-checked, so
   * two dots CAN share a space; never drops one. Runs on EVERY chord. {@link musescoreChordSpaces}.
   */
  musescore: { collisions: 'musescore', source: 'MuseScore 4 — chordlayout.cpp placeDots, one flip' },
  /** **Verovio** — two dots landing in one space MERGE into one (`chord.cpp`, a set of locs). */
  verovio: { collisions: 'merge', source: 'Verovio — chord.cpp, coincident dots merge' },
  /** ⛔ **What we drew until 2026-09-25** — both dots drawn, one on top of the other. */
  vexflow: { collisions: 'keep', source: 'VexFlow — Dot.format, no collision check for a space note' },
} as const satisfies Record<string, ChordDotRule>

export type ChordDotRuleName = keyof typeof CHORD_DOT_RULES

/** ✅ What is armed — `gould` (his rule, 2026-09-25). */
export const ACTIVE_CHORD_DOT_RULE: ChordDotRuleName = 'gould'

const state: { rule: ChordDotRuleName; generation: number } = { rule: ACTIVE_CHORD_DOT_RULE, generation: 0 }

export function armedChordDots(): ChordDotRule {
  return CHORD_DOT_RULES[state.rule]
}
export function chordDotSettings(): { rule: ChordDotRuleName; generation: number } {
  return { ...state }
}
export function chordDotGeneration(): number {
  return state.generation
}
export function setChordDotRule(rule: ChordDotRuleName): boolean {
  if (!(rule in CHORD_DOT_RULES)) return false
  state.rule = rule
  state.generation++
  return true
}
export function resetChordDotRule(): void {
  state.rule = ACTIVE_CHORD_DOT_RULE
  state.generation++
}

/**
 * ⭐ **Gould's placement** — the SPACES a colliding chord's dots take, top first, in staff-line units (a space
 * is a half: 3.5 is the space below the top line's neighbour). `heads` are the chord's dotted heads' lines.
 * Pure: `engrave/notes/dotStack` hands a colliding chord to it.
 */
export function centredChordSpaces(heads: readonly number[]): number[] {
  const low = Math.min(...heads)
  const high = Math.max(...heads)
  // The spaces the chord COVERS — every half-line between its outer heads, inclusive.
  const covered: number[] = []
  for (let s = Math.ceil(low - 0.5) + 0.5; s <= high; s += 1) covered.push(s)
  const n = heads.length
  const centre = (low + high) / 2
  // A contiguous run of n spaces, its centre nearest the chord's; a tie goes UP — a line note's own way.
  let best: number[] = []
  let bestDistance = Infinity
  for (let bottom = Math.floor(low - n) + 0.5; bottom <= high + 0.5; bottom += 1) {
    const run = Array.from({ length: n }, (_, i) => bottom + i)
    const distance = Math.abs((run[0] + run[n - 1]) / 2 - centre)
    if (distance < bestDistance - 1e-9 || (Math.abs(distance - bestDistance) < 1e-9 && bottom > best[0])) {
      best = run
      bestDistance = distance
    }
  }
  // ⭐ p. 56: a dot TWO spaces beyond the chord ⇒ only the spaces the chord covers.
  const firstOut = covered.length ? covered[0] - 1 : low - 0.5
  const lastOut = covered.length ? covered[covered.length - 1] + 1 : high + 0.5
  const tooFar = best.some(s => s < firstOut || s > lastOut)
  return (tooFar ? covered : best).slice().sort((a, b) => b - a)
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────────
// ⭐ THE TWO ENGINES' RULES, ported (docs/research/multiple-dots-research.md Part D). Units at the edge:
//    a head's staff LINE as `dotStack` has it — bottom line 1, top line 5, a space x.5. Each returns, per
//    head IN THE ORDER GIVEN, the space its dots take — or `null` when the engine drops them.
// ─────────────────────────────────────────────────────────────────────────────────────────────────────

/** LilyPond's staff position: half-spaces, middle line 0 — `u = 3 + p/2`. */
const toPos = (line: number): number => Math.round((line - 3) * 2)
const fromPos = (pos: number): number => 3 + pos / 2
/** A line (or a ledger line) is an EVEN position (`Staff_symbol::on_line`). */
const onLine = (pos: number): boolean => pos % 2 === 0

interface LyDot { wanted: number; head: number }

/** `Dot_configuration::badness` (dot-configuration.cc:26–44) — every dot CENTER in a single voice. */
function lyBadness(cfg: Map<number, LyDot>): number {
  let total = 0
  for (const [pos, dot] of cfg) {
    const delta = pos - dot.wanted
    let cost = 2 * delta * delta
    const moved = Math.sign(delta)
    if (moved !== 1) cost += 1 // CENTER: an unmoved or down-moved dot costs 1 — the up-bias
    total += cost
  }
  return total
}

/** `Dot_configuration::shifted` (dot-configuration.cc:62–102): move the dot at `k` by `d`, pushing a chain. */
function lyShifted(cfg: Map<number, LyDot>, k: number, d: 1 | -1): Map<number, LyDot> {
  const out = new Map<number, LyDot>()
  const keys = [...cfg.keys()].sort((a, b) => (d === 1 ? a - b : b - a))
  let offset = 0
  for (const p of keys) {
    const entry = cfg.get(p)!
    if (p === k) {
      out.set(onLine(p) ? p + d : p + 2 * d, entry)
      offset = 2 * d
    } else {
      if (!out.has(p)) offset = 0 // the chain broke: nothing was pushed onto p
      out.set(p + offset, entry)
    }
  }
  return out
}

/** `Dot_configuration::remove_collision` (dot-configuration.cc:108–122) — a TIE goes DOWN. */
function lyRemoveCollision(cfg: Map<number, LyDot>, p: number): Map<number, LyDot> {
  if (!cfg.has(p)) return cfg
  const up = lyShifted(cfg, p, 1)
  const down = lyShifted(cfg, p, -1)
  return lyBadness(up) < lyBadness(down) ? up : down
}

/**
 * ⭐ **LilyPond's chord dots** — `Dot_column::calc_positioning_done` (dot-column.cc:42–234), one voice, one
 * staff. The tall-chord trim (:152–180) first, then each surviving dot inserted bottom-up, shoving the dots
 * already there. ⚠️ The chain SCRAMBLES which dot belongs to which head (only the SET of positions is drawn —
 * the research's own note); the set is handed back top-down onto the surviving heads, top-down.
 */
export function lilypondChordSpaces(heads: readonly number[], limit = 3): (number | null)[] {
  const order = heads.map((line, i) => ({ pos: toPos(line), i })).sort((a, b) => a.pos - b.pos)
  const alive = new Set(order.map(o => o.i))
  // The trim: room = floor((span + 2 + limit) / 2), removing alternately from the ends — the LAST removal
  // (an excess of 1) always takes the TOP.
  const span = order[order.length - 1].pos - order[0].pos
  const room = Math.floor((span + 2 + limit) / 2)
  let total = order.length
  let first = 0
  while (total > room) {
    if ((total - room) % 2 === 0) { alive.delete(order[first].i); first++ } else alive.delete(order[first + total - 1].i)
    total--
  }
  let cfg = new Map<number, LyDot>()
  for (const { pos, i } of order) {
    if (!alive.has(i)) continue
    cfg = lyRemoveCollision(cfg, pos)
    cfg.set(pos, { wanted: pos, head: i })
    if (onLine(pos)) cfg = lyRemoveCollision(cfg, pos)
  }
  const spaces = [...cfg.keys()].sort((a, b) => b - a).map(fromPos)
  const survivors = order.filter(o => alive.has(o.i)).map(o => o.i).sort((a, b) => heads[b] - heads[a])
  const out: (number | null)[] = heads.map(() => null)
  survivors.forEach((i, k) => { out[i] = spaces[k] ?? null })
  return out
}

/**
 * ⭐ **MuseScore 4's chord dots** — `layoutChords3` (chordlayout.cpp:2680–2752) + `getNoteListForDots`
 * (:2845–2941) + `placeDots` (:2462–2558), one voice (voice 1: AUTO is UP). MuseScore's line: 0 = top line,
 * increasing DOWNWARD, even = on a line — `L = 2·(5 − u)`. ⚠️ Transcribed with its property intact: a flipped
 * dot's new space is NOT re-checked, so two dots can share one; nothing is dropped.
 */
export function musescoreChordSpaces(heads: readonly number[]): (number | null)[] {
  const L = heads.map(u => Math.round(2 * (5 - u)))
  // `Chord::notes()` is pitch-ascending — the BOTTOM note first (the largest L).
  const notes = heads.map((_, i) => i).sort((a, b) => L[b] - L[a])
  const isLine = (i: number) => L[i] % 2 === 0
  // Step A (:2696–2749): each LINE note's side from its seconds, visited top → bottom.
  const side = new Map<number, 1 | -1>() // +1 = DOWN, −1 = UP
  for (let k = notes.length - 1; k >= 0; k--) {
    const i = notes[k]
    let dp: 1 | -1 = -1 // AUTO → voice 1 → UP
    if (notes.length > 1 && isLine(i)) {
      const above = k + 1 < notes.length ? L[i] - L[notes[k + 1]] : 1000
      const below = k - 1 >= 0 ? L[notes[k - 1]] - L[i] : 1000
      if (above === 1 && below !== 1) dp = 1
      else if (below === 1 && above !== 1) dp = -1
    }
    side.set(i, dp)
  }
  // Step B (:2887–2903): SPACE notes anchor their own dot first; line notes are replayed top-down.
  const anchored: number[] = notes.filter(i => !isLine(i)).map(i => L[i])
  const topDown = notes.filter(isLine).sort((a, b) => L[a] - L[b])
  // Step C (:2484–2557), each note in `notes` order (bottom → top).
  const move = new Map<number, number>()
  for (const i of notes) {
    if (!isLine(i)) { move.set(i, 0); continue }
    const alreadyAdded = new Map<number, number>()
    for (const other of topDown) {
      let dotMove: number = side.get(other)!
      const loc = L[other] + dotMove
      const added = alreadyAdded.has(loc)
      if (!added && anchored.includes(loc)) dotMove = -dotMove
      else if (added && alreadyAdded.get(loc) !== other) dotMove = -dotMove
      if (other === i) {
        move.set(i, dotMove)
        anchored.push(L[i] + dotMove)
        break
      }
      if (!added) alreadyAdded.set(L[other] + dotMove, other)
    }
  }
  return heads.map((_, i) => 5 - (L[i] + (move.get(i) ?? 0)) / 2)
}
