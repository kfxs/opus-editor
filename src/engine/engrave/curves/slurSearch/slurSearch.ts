/**
 * ⭐⭐ **A SLUR BY SEARCH — LilyPond's solver, whole** (docs/plans/slur-search-plan.md §2, P2).
 *
 * It does not solve ONE curve: it enumerates every pair of ends in half-space steps
 * (`./searchState`), draws LilyPond's arch between each pair (`./searchCurve`), scores every candidate with
 * demerits (`./searchScore`) and keeps the cheapest — LAZILY, the way `Slur_score_state::get_best_curve`
 * does (`lily/slur-scoring.cc`, LilyPond 2.27.3, GPL-3.0-or-later — see `NOTICE`): a priority queue on the
 * score so far, each candidate running its scorers one at a time, cheapest first, and the search stops the
 * moment the best FINISHED candidate is cheaper than every partial one. Demerits only grow, so a partial
 * score is a lower bound and nothing skipped could have won.
 *
 * ⭐ So an accidental near an end is not answered by blowing up the arch (`house`'s one factor): a
 * candidate whose end is half a space further out simply costs less, and wins.
 *
 * ⛔ PURE: numbers in, numbers out, in LilyPond's space (staff spaces, y UP — `./searchState`). The
 * renderer's adapter is P3.
 */
import type { Bezier, Offset } from './bezier'
import { buildSearchState, type SlurSearchInput, type SlurSearchState } from './searchState'
import { generateCurve } from './searchCurve'
import { SCORERS, type SlurCandidate } from './searchScore'
import { LILYPOND_SLUR_DETAILS, LILYPOND_SLUR_RULES, type SlurSearchDetails, type SlurSearchRules } from './searchDetails'

export interface SlurSearchResult {
  /** The winning pair of ends. */
  ends: readonly [Offset, Offset]
  curve: Bezier
  /** Its total demerit, and what made it up (`name=value`). */
  score: number
  card: string[]
  /** Its place in the enumeration, and how many candidates there were. */
  index: number
  candidates: number
  /** How many scorer runs the lazy queue needed — at most `candidates × 4`. */
  scorerRuns: number
}

/** A binary min-heap on (score, index) — ⚠️ the index breaks ties, so the answer never depends on the
 *  heap's own order (LilyPond's `std::priority_queue` leaves equal scores in an unspecified order). */
class CandidateQueue {
  private heap: SlurCandidate[] = []
  private static less(a: SlurCandidate, b: SlurCandidate): boolean {
    return a.score < b.score || (a.score === b.score && a.index < b.index)
  }
  push(c: SlurCandidate): void {
    const h = this.heap
    h.push(c)
    let i = h.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!CandidateQueue.less(h[i], h[parent])) break
      ;[h[i], h[parent]] = [h[parent], h[i]]
      i = parent
    }
  }
  top(): SlurCandidate { return this.heap[0] }
  pop(): SlurCandidate {
    const h = this.heap
    const top = h[0]
    const last = h.pop()!
    if (h.length) {
      h[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let m = i
        if (l < h.length && CandidateQueue.less(h[l], h[m])) m = l
        if (r < h.length && CandidateQueue.less(h[r], h[m])) m = r
        if (m === i) break
        ;[h[i], h[m]] = [h[m], h[i]]
        i = m
      }
    }
    return top
  }
}

/** Every candidate with its curve drawn and nothing scored — `generate_curves`. */
export function searchCandidates(state: SlurSearchState): SlurCandidate[] {
  return state.attachments.map((ends, index) => {
    const { curve, height } = generateCurve(state, ends)
    return { index, ends, curve, height, score: 0, card: [], scored: 0 }
  })
}

/** Run a candidate's next scorer — `run_next_scorer`. */
function runNextScorer(state: SlurSearchState, c: SlurCandidate): void {
  SCORERS[c.scored](state, c)
  c.scored++
}

/** Score a candidate completely — for a spec, or to explain a picture. */
export function scoreFully(state: SlurSearchState, c: SlurCandidate): SlurCandidate {
  while (c.scored < SCORERS.length) runNextScorer(state, c)
  return c
}

/** ⭐ The search. `null` when there is nothing to choose from (no candidate pair of ends). */
export function searchSlur(
  input: SlurSearchInput, details: SlurSearchDetails = LILYPOND_SLUR_DETAILS,
  rules: SlurSearchRules = LILYPOND_SLUR_RULES,
): SlurSearchResult | null {
  if (input.columns.length === 0) return null
  const state = buildSearchState(input, details, rules)
  const candidates = searchCandidates(state)
  if (candidates.length === 0) return null
  const queue = new CandidateQueue()
  for (const c of candidates) queue.push(c)
  let runs = 0
  for (;;) {
    const best = queue.top()
    if (best.scored >= SCORERS.length) {
      return {
        ends: best.ends, curve: best.curve, score: best.score, card: best.card,
        index: best.index, candidates: candidates.length, scorerRuns: runs,
      }
    }
    queue.pop()
    runNextScorer(state, best)
    runs++
    queue.push(best)
  }
}
