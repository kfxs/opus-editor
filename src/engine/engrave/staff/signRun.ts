/**
 * ⭐⭐ **THE SIGNS A BAR CARRIES ON ITS STAFF, AND WHERE THEY STAND** — the "sign run" of
 * `docs/history/vexflow-removal-map.md` S4.
 *
 * A bar opens with a run of signs — its opening barline, a clef, a meter — and ends with a barline.
 * The key signature, the tempo mark, the repeat sign and the renderer's own hit boxes all need to know
 * where those signs landed. They used to ask VexFlow's `Stave` for its modifiers; they ask this
 * instead, and ⏭️ S4b answers it from our own walk without any of those readers changing.
 *
 * ⚠️ **In the stave's OWN space**, like `./staffFrame`. ⚠️ A bar has two runs, as it has two frames
 * (S4e): where it was BUILT, for ink inside its group, and where it IS this render, for ink outside it
 * (`rendering/signRun.placedSignRun`) — `rendering/staveFrame`'s header says which a reader asks.
 *
 * ⛔ The key signature is not a sign in this run: it is drawn by `rendering/KeySignaturePass`, which
 * answers its own ink (`keySignatureInkRight`).
 */

/** What an opening sign is. `other` names a kind nothing in this editor adds today. */
export type SignKind = 'barline' | 'clef' | 'meter' | 'other'

/** One sign of the run. */
export interface HeaderSign {
  readonly kind: SignKind
  /**
   * 🚨🚨 **The sign's UNSHIFTED origin.** A hand offset is a separate number, {@link xShift}, and a
   * reader that takes one without the other puts everything after the sign in the wrong place — the
   * key signature once stayed behind a nudged clef exactly that way.
   */
  readonly x: number
  /** The hand offset added on top of {@link x} when the sign is drawn. */
  readonly xShift: number
  /**
   * The sign's layout width — ⚠️ a LAYOUT box, measured at run time and carrying its own padding, ⛔ not
   * its ink. Every space the header decides is decided in ink (`fonts/`); this is for the readers that
   * still ask the box.
   */
  readonly width: number
}

/** The run of signs on one bar of one staff. */
export interface SignRun {
  /** Every sign the bar OPENS with, its opening barline included, in the order they were added. */
  readonly opening: readonly HeaderSign[]
  /** The first opening clef, if the bar draws one. */
  readonly clef: HeaderSign | undefined
  /** The first opening meter, if the bar draws one. */
  readonly meter: HeaderSign | undefined
  /** Where the line that ENDS the bar stands, if the bar has one. */
  readonly endBarlineX: number | undefined
}
