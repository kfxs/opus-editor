/**
 * VexFlow's `midLine` (`util.js`, MIT, transcribed): the line halfway between two lines, snapped to a
 * half line when it lands off one. Shared by the rules that centre something between two heights —
 * `./voiceStack` (a middle rest between two voices) and `./restAlign` (a beamed rest between notes).
 *
 * ⚠️ Transcribed exactly: the snap only runs when `mid % 2 > 0`, so a NEGATIVE mid is never snapped,
 * and `roundN` truncates toward zero before it rounds.
 */

/** VexFlow's `roundN`: `x` to a multiple of `n`, half up — truncating toward zero first. */
function roundN(x: number, n: number): number {
  return x % n >= n / 2 ? parseInt(`${x / n}`, 10) * n + n : parseInt(`${x / n}`, 10) * n
}

/** Halfway from `b` to `a`, snapped to a half line when it lands off one. */
export function midLine(a: number, b: number): number {
  let mid = b + (a - b) / 2
  if (mid % 2 > 0) mid = roundN(mid * 10, 5) / 10
  return mid
}
