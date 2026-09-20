/**
 * ⭐ **THE SQUARE** — the editor's one look for "this is a handle you can grab": the same blue, the
 * same size, the same white ring, whichever family drew it (a span's two ends, a barline's join
 * squares, a grouping sign's two resizers). A family owns WHERE its squares sit and what a press on
 * one means; this owns what one looks like.
 *
 * ⭐ `armed` reads as PICKED — larger, a darker blue, a thicker ring — for the families whose squares
 * can be (a span's end is a selectable thing; a join square is not, and never passes it). Cosmetic
 * only: {@link handleHitBox} does not take it, so what you can grab does not move when you grab it.
 */
import type { HighlightContext } from './highlightContext'

/** The ROUND slur handle's radius; a square's half-side is one more, so the two read as one size. */
export const HANDLE_R = 5
/** Half-side of the hit-box every handle registers — wider than its ink, a pointer's worth. */
export const HANDLE_HIT = 9

export function paintHandleSquare(
  ctx: HighlightContext,
  at: { x: number; y: number },
  look: { className: string; cursor: string; armed?: boolean },
): void {
  const half = look.armed ? HANDLE_R + 3 : HANDLE_R + 1
  const sq = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  sq.setAttribute('x', String(at.x - half))
  sq.setAttribute('y', String(at.y - half))
  sq.setAttribute('width', String(half * 2))
  sq.setAttribute('height', String(half * 2))
  sq.setAttribute('fill', look.armed ? '#1D4ED8' : '#2563EB')
  sq.setAttribute('stroke', '#ffffff')
  sq.setAttribute('stroke-width', look.armed ? '2.5' : '1.5')
  sq.setAttribute('class', look.className)
  sq.style.cursor = look.cursor
  ctx.addNode(ctx.svg, sq)
}

/** The box a square's registry entry carries — the same for every square, armed or not. */
export function handleHitBox(at: { x: number; y: number }) {
  return { x: at.x - HANDLE_HIT, y: at.y - HANDLE_HIT, width: HANDLE_HIT * 2, height: HANDLE_HIT * 2 }
}
