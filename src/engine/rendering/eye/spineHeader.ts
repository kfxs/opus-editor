/**
 * ⭐⭐ **WHAT A BAR DRAWS BEFORE ITS FIRST NOTE, ON A SPINE** — the clef, the key signature and the
 * meter, at the head of the staff and wherever one of them CHANGES (`docs/plans/bent-staff-plan.md`
 * §5 row 6).
 *
 * ⭐ **WHICH signs a bar draws is the PAGE's answer, asked of the same owners**: the clef walk
 * (`utils/clefUtils.resolveStaffClefs` — a change is this bar's opening clef against the last bar's
 * ending one), `layout/keySignatureLayout.headerKeyAt` (restated at a system's head, mid-line only
 * where it changes — cancelling naturals included) and `layout/headerInk.drawsTimeSignature`.
 * The spine is ONE system, so bar 1 is its only head: there the clef is full size, everywhere else a
 * change draws the SMALL clef, after the barline, as the page does.
 *
 * ⭐ **Each sign is a rigid BLOCK** (§2): the clef and the meter are the score's own sign classes,
 * the key signature is the page's own row (`staff/KeySignaturePass.drawKeySignatureRow`) drawn in a
 * block of its own.
 *
 * ⭐ **ONE list answers the ROOM and the DRAWING** ({@link spineHeaderParts}): `./spineSpacing` sums
 * it into the bar's lead-in and {@link drawSpineBarHeader} walks it, so the two cannot disagree.
 *
 * ## ⚠️ What is NOT here
 *
 * - The gaps are each sign's inherited walk padding, and the key signature's own two sourced gaps —
 *   ⛔ not the header PLACEMENT's researched distances (`staff/headerPlacementPass`), which are plan
 *   B's to bring here.
 * - ⛔ No CAUTIONARY signs: they exist for a system break, and one spine has none.
 * - ⛔ A clef change in the MIDDLE of a bar (`EngravedClefChange`) — its notes are still built on the
 *   bar's opening clef.
 */
import type { DrawContext } from '@/engine/paint/DrawContext'
import { compose, translation } from '@/engine/paint/Affine'
import type { Spine } from '@/engine/engrave/staff/staffSpine'
import { placementAt } from '@/engine/engrave/staff/staffSpine'
import { drawsTimeSignature, type Header } from '@/engine/layout/headerInk'
import {
  BARLINE_TO_KEY_INK, CLEF_TO_KEY_INK, headerKeyAt, keySignatureExtent,
} from '@/engine/layout/keySignatureLayout'
import { STAFF_SPACE_PX } from '@/engine/models/staffSize'
import type { Clef, Score } from '@/types/music'
import type { StaffClefs } from '@/utils/clefUtils'
import type { StaffKeys } from '@/utils/keySignature'
import { EngravedClef } from '../engraved/EngravedClef'
import { EngravedTimeSignature } from '../engraved/EngravedTimeSignature'
import { drawGroupOf } from '../painter/svgDrawGroup'
import { drawKeySignatureRow } from '../staff/KeySignaturePass'
import { SPINE_BLOCK_CLASS, blockFrame, drawSpineSign } from './spineStaff'

/** A bar's header on a spine: the layout's own {@link Header}, plus the clef its key signature is read on. */
export interface SpineHeader extends Header {
  /** The bar's opening clef — which lines a key signature's signs stand on. */
  readingClef: Clef
}

/**
 * The header bar `index` draws, or undefined when it draws none. `clefs` / `keys` are the staff's
 * walks, resolved once by the caller.
 */
export function spineBarHeader(
  score: Score, clefs: StaffClefs, keys: StaffKeys, index: number,
): SpineHeader | undefined {
  const measure = score.measures[index]
  if (!measure) return undefined
  const isHead = index === 0
  const clef = clefs.opening.get(measure.number) ?? 'treble'
  const previous = score.measures[index - 1]
  const clefChanged = previous !== undefined && clefs.ending.get(previous.number) !== clef

  const header: SpineHeader = { readingClef: clef }
  if (isHead || clefChanged) header.clef = { clef, small: !isHead }
  // 🚨 Absent, never empty — a signature with no ink is not a part (`headerInk.Header.key`).
  const key = headerKeyAt(keys, measure.number, isHead, clef)
  if (key && keySignatureExtent(key) > 0) header.key = key
  if (drawsTimeSignature(measure)) header.meter = measure.timeSignature
  return header.clef || header.key || header.meter ? header : undefined
}

/** One sign of a header: the clear spine before it, how much spine it takes, and how it is drawn at `s`. */
interface SpineHeaderPart {
  gap: number
  width: number
  draw(ctx: DrawContext, spine: Spine, s: number): void
}

/** The header's signs in printed order — clef, key signature, meter — each with the gap BEFORE it, in px. */
export function spineHeaderParts(header: SpineHeader): SpineHeaderPart[] {
  const parts: SpineHeaderPart[] = []
  const signPart = (sign: EngravedClef | EngravedTimeSignature): SpineHeaderPart => {
    const { padding, width } = sign.walkInput()
    return { gap: padding, width, draw: (ctx, spine, s) => { drawSpineSign(ctx, spine, sign, s) } }
  }
  if (header.clef) parts.push(signPart(new EngravedClef(header.clef.clef, header.clef.small ? 'small' : 'default')))
  if (header.key) {
    const key = header.key
    const width = keySignatureExtent(key) * STAFF_SPACE_PX
    parts.push({
      // After a clef, or — a change with no clef before it — after the barline: the row's own two gaps.
      gap: (header.clef ? CLEF_TO_KEY_INK : BARLINE_TO_KEY_INK) * STAFF_SPACE_PX,
      width,
      draw: (ctx, spine, s) => {
        const group = drawGroupOf(ctx.openGroup(SPINE_BLOCK_CLASS))
        try {
          drawKeySignatureRow(ctx, key, header.readingClef, blockFrame(), 0)
        } finally {
          ctx.closeGroup()
        }
        // Placed by its MIDDLE, as every wide block is (`./spineStaff.drawSpineSign`).
        group?.setPlacement(compose(translation(-width / 2, 0), placementAt(spine, s + width / 2)))
      },
    })
  }
  if (header.meter) parts.push(signPart(new EngravedTimeSignature(header.meter)))
  return parts
}

/** How much spine the header takes from the bar's start, in px — what `./spineSpacing` reserves. */
export function spineHeaderWidth(header: SpineHeader): number {
  return spineHeaderParts(header).reduce((total, part) => total + part.gap + part.width, 0)
}

/** Draw the header from `s` on, and answer where along the spine it ends. */
export function drawSpineBarHeader(ctx: DrawContext, spine: Spine, s: number, header: SpineHeader): number {
  let at = s
  for (const part of spineHeaderParts(header)) {
    part.draw(ctx, spine, at + part.gap)
    at += part.gap + part.width
  }
  return at
}

/**
 * Where along the spine the header's METER begins, when it draws one — the edge a downbeat tempo mark
 * aligns with (Gould p. 183, `marks/tempo/TempoLayout.anchorX` rule 1). Undefined without a meter.
 */
export function spineHeaderMeterAt(s: number, header: SpineHeader): number | undefined {
  if (!header.meter) return undefined
  let at = s
  const parts = spineHeaderParts(header)
  parts.forEach((part, i) => { if (i < parts.length - 1) at += part.gap + part.width })
  return at + parts[parts.length - 1].gap
}
