/**
 * ⭐⭐ **A WEDGE BROKEN FOR AN INTERIM DYNAMIC** — Gould, *Behind Bars* printed p. 107 (*Qualifying
 * dynamic change → Interim dynamics*), the rule this module exists to draw:
 *
 * > "A hairpin may be broken for an interim dynamic. **Maintain the same angle for the hairpin
 * > either side of the interim dynamic**, so that the hairpin is clearly one gradual dynamic
 * > change. It is unnecessary in this case to enclose the interim dynamic in brackets since it is
 * > clear that the dynamic change continues:"
 *
 * ⭐⭐ **MEASURED off her own drawing** (450 dpi, 1 sp = 19.9 px — `reference/README.md`, the
 * dynamic-vs-hairpin table): extrapolating the first wedge's two edges straight across the `mf`
 * lands within **0.14 sp** of where the second wedge's edges actually begin. So the correct picture
 * is **ONE wedge with a slice cut out of it**, not two wedges that happen to be adjacent — and her
 * `not` drawing is exactly the failure where the aperture restarts and the two angles differ.
 *
 * ## ⭐ Why this is a module and not a branch in the renderer
 *
 * It is closed-form arithmetic on x ranges, and it is the part that can be WRONG in a way a picture
 * hides: the openings have to keep the two arms collinear across the gap. `HairpinRenderer` can only
 * be tested in a browser (a dynamic's ink exists solely in the SVG — jsdom measures every glyph
 * 0×0), so the arithmetic lives here where a unit test can feed it boxes and read the numbers.
 *
 * ## ⭐⭐ `t0`/`t1` — the whole trick
 *
 * Each returned segment carries WHERE IT SITS inside the piece it was cut from, as a fraction. The
 * renderer then interpolates BOTH the mouth opening and the slant across that fraction, instead of
 * giving every piece its role's full range. Two consequences, and they are the reason it is a
 * fraction rather than a flag:
 *
 * - an uncut piece comes back as `t0 = 0, t1 = 1`, which interpolates to exactly the numbers the
 *   renderer used before this module existed — ⭐ **so a wedge with nothing in its way is drawn by
 *   the same arithmetic it always was**, and the system-break thirds (`fragmentOpening`) survive
 *   untouched;
 * - an interior cut SUBDIVIDES its piece's range proportionally, which is Gould's collinearity.
 *
 * ⛔ **The gap is NOT removed from the ramp.** The aperture is still sized from the whole drawn
 * width, and the fractions are measured against the piece's full x extent *including* the slice —
 * that is what makes the two halves lie on one pair of straight lines. Closing the ramp over the
 * remaining ink instead would draw two wedges whose angles differ, which is her `incorrect`.
 *
 * ## ⛔ What NO engine does
 *
 * All three were read on 2026-08-18 (`reference/README.md` §"THE THREE ENGINE SOURCES"). **LilyPond**
 * makes the case unrepresentable — an absolute dynamic terminates an open hairpin
 * (`lily/dynamic-engraver.cc:102`). **MuseScore** lets them overlap and forbids the collision test
 * outright (`autoplace.cpp:406`). **Verovio** pushes the wedge to a second line at full length,
 * which is the picture Gould labels *incorrect*. Our `{beat, length}` model can ask the containment
 * question all three structurally cannot, which is why this is ours to get right.
 */
import type { WedgeRole } from './hairpinShape'

/** An x range of drawn wedge on one system, before anything is cut out of it — a system fragment as
 *  `cutIntoPieces` hands it over. */
export interface WedgePiece {
  x0: number
  x1: number
  /** The system this piece landed on. ⚠️ Every system restarts at the left margin, so x's are only
   *  comparable WITHIN one line — which is why a gap carries a line too. */
  line: number
  role: WedgeRole
}

/** A slice to leave empty: a drawn mark's ink, already padded, on one system. */
export interface WedgeGap {
  line: number
  left: number
  right: number
}

/** A piece of wedge that will actually be drawn, plus where it sits inside the piece it was cut
 *  from — see the header. `t0`/`t1` run 0→1 across that piece's own x extent. */
export interface WedgeSegment extends WedgePiece {
  t0: number
  t1: number
  /**
   * ⭐⭐ **WHICH of the caller's pieces this was cut from**, by index.
   *
   * 🚨 Because "is this the wedge's first/last piece?" is a question about the PIECES, and after a
   * cut it can no longer be answered by looking at the segments: a wedge broken for an interim
   * dynamic has two segments and ONE piece, so both `segments[0]` and `segments[1]` belong to a
   * piece that is both the first and the last. Reading it off the segment array instead gave the
   * end nudge to the second half only and none to the first half's right edge, and the wedge
   * zigzagged (his report, 2026-08-18: *"if I offset the hairpin the drawing is completely crazy"*).
   */
  piece: number
}

/**
 * Cut `pieces` around `gaps`, dropping anything narrower than `minWidth`.
 *
 * ⚠️ **A remnant under `minWidth` is DROPPED, never drawn as a stub — and ⛔ never drawn through the
 * mark.** Verovio takes the other road (`view_control.cpp:688` abandons the whole shortening when
 * the result would be under 1 sp) and the measured consequence is a wedge drawn straight through the
 * letter's ink — reproducible in the ordinary `p < mf > p` figure. A sliver of wedge says nothing; a
 * wedge through a glyph says something false.
 *
 * ⚠️ Gaps are matched by `line` as well as by x: two systems' coordinates are not one ruler.
 *
 * @param minWidth in the same pixels as the x's — the caller converts from staff spaces, since a
 *   small staff's floor is smaller.
 */
export function breakWedgeAtGaps(
  pieces: readonly WedgePiece[],
  gaps: readonly WedgeGap[],
  minWidth: number,
): WedgeSegment[] {
  const out: WedgeSegment[] = []
  for (const [index, piece] of pieces.entries()) {
    const width = piece.x1 - piece.x0
    if (!(width > 0)) continue

    // Only the gaps that actually bite into this piece, merged so two co-located marks (`p dolce`,
    // or a level and an expression word on one beat) cut one slice rather than leaving a sliver
    // between them that the floor below would then delete anyway.
    const here = mergeGaps(gaps
      .filter(g => g.line === piece.line && g.right > piece.x0 && g.left < piece.x1))

    let cursor = piece.x0
    for (const gap of here) {
      push(out, piece, index, cursor, Math.min(gap.left, piece.x1), width, minWidth)
      cursor = Math.max(cursor, gap.right)
    }
    push(out, piece, index, cursor, piece.x1, width, minWidth)
  }
  return out
}

/** One sub-range, if it is wide enough to be worth drawing. */
function push(
  out: WedgeSegment[],
  piece: WedgePiece,
  index: number,
  x0: number,
  x1: number,
  width: number,
  minWidth: number,
): void {
  if (x1 - x0 < minWidth) return
  out.push({
    ...piece,
    piece: index,
    x0,
    x1,
    // ⭐ Against the piece's FULL extent, gap included — the collinearity. See the header.
    t0: (x0 - piece.x0) / width,
    t1: (x1 - piece.x0) / width,
  })
}

/** Overlapping or touching gaps merged into one, sorted left to right. */
function mergeGaps(gaps: readonly WedgeGap[]): WedgeGap[] {
  const sorted = [...gaps].sort((a, b) => a.left - b.left)
  const merged: WedgeGap[] = []
  for (const gap of sorted) {
    const last = merged[merged.length - 1]
    if (last && gap.left <= last.right) last.right = Math.max(last.right, gap.right)
    else merged.push({ ...gap })
  }
  return merged
}

/**
 * Interpolate one of the wedge's two ramps at `t` — the mouth's opening fraction, or the slant's
 * vertical delta. ⭐ Both are linear in x by construction (`resolveHairpinShape` gives one number
 * per END and the wedge is straight between them), which is the whole reason one helper does both
 * and the reason Gould's "same angle" needs no special case: interpolating a straight line at the
 * cut IS the line continuing.
 */
export function rampAt(start: number, end: number, t: number): number {
  return start + (end - start) * t
}
