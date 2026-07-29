import { STAFF_SPACE_PX } from '@/engine/models/staffSize'

/**
 * The **surface** the music is drawn on — the sheet, not the engraving.
 *
 * Two kinds, and the distinction is the whole point (docs/layout-plan.md §2):
 *
 *  - **canvas** — for sketching. A width to wrap at, and nothing else. ⭐ **A canvas has no
 *    physical size**: *"how many mm wide is it?"* must have NO answer, and it has none here
 *    because no field holds one. That invariant is what keeps a sketching surface from quietly
 *    becoming a page — which is exactly what `LAYOUT_CONFIG.CONTAINER_WIDTH` had already done.
 *  - **page** — for publication. A physical sheet in millimetres, cast off into pages.
 *
 * A `Surface` is a **value**, of the same species as `Clip` (`utils/clip.ts`): first-class, in the
 * core, naming nothing outside itself. ⛔ It is never `score.layout`, never `layout.scoreId`, never
 * a `Document { score, layout }`, and never *"the layout **of** the score"* — the possessive is the
 * bug. The render *receives* a surface; the pairing evaporates. `MusicEngine` HOLDS the one in use
 * exactly as it holds `viewMode`: a session convenience, not an ownership edge.
 *
 * ⭐ Per `DESIGN-PRINCIPLES.md` boundary case 1, this is the first member of the document-level
 * **engraving object** that entry has been holding open — "what the score should LOOK like", held
 * beside the content rather than inside it. `justifyLastLine` (ragged-last) is the other member and
 * folds in here the day either has to persist. Until then both stay session-only, and ⛔ a THIRD
 * document-wide look setting does not arrive by a fourth route.
 */

/** A physical sheet. Millimetres, because paper is millimetres — see {@link PX_PER_MM}. */
export interface PageLayout {
  page: { widthMm: number; heightMm: number }
  margins: { topMm: number; bottomMm: number; leftMm: number; rightMm: number }
}

/**
 * What you author and toggle. One union in — {@link SurfaceMetrics} is the one flat shape out, so
 * **no call site branches on the kind**.
 */
export type Surface =
  | { kind: 'canvas'; widthPx: number; marginPx: number }
  | { kind: 'page'; layout: PageLayout }

/**
 * What every consumer of a surface actually reads: pixels, flat, kind-free.
 *
 * ⚠️ Margins are named **per edge** rather than collapsed into one number. A `PageLayout` has four,
 * and one number is only ever right by coincidence — `A4_NORMAL` is 15 mm all round, so the
 * coincidence would hold right through the first version and break on the first asymmetric page.
 * The four are resolved once here so no call site does the arithmetic twice.
 */
export interface SurfaceMetrics {
  /** The surface's own size — what the SVG is sized to, and (when it is paper) the sheet drawn. */
  widthPx: number
  /**
   * ⭐ `null` IS "no page": never break vertically, the surface grows with the music. THE question
   * the vertical cast-off asks, and the only one — "is this paper?" is `heightPx !== null`.
   */
  heightPx: number | null
  marginTopPx: number
  marginBottomPx: number
  marginLeftPx: number
  marginRightPx: number
  /** `widthPx − left − right`: the room the music is cast off into. */
  contentWidthPx: number
  /**
   * `heightPx − top − bottom`, or `null` on a canvas — the room *before a break*, which is what the
   * page cast-off works in. Deliberately NOT the page height: publish only that and every caller
   * subtracts the margins itself, i.e. reaches back into `PageLayout` and branches on the kind.
   */
  contentHeightPx: number | null
}

/** Millimetres to a staff space — MuseScore's `sp`, and the industry's working figure for an
 *  ordinary printed staff (a 7 mm rastral). The other half of {@link PX_PER_MM}. */
const MM_PER_STAFF_SPACE = 1.75

/**
 * The one conversion, done once.
 *
 * The whole industry measures layout in staff spaces and converts at the boundary: MusicXML carries
 * every distance in *tenths* (1/10 staff space) plus a `<scaling>` element mapping them to mm,
 * MuseScore's unit is `sp` at **1.75 mm**, Verovio takes pages in 1/10 mm. So the mapping is the
 * score's staff size over MuseScore's millimetres-per-space, and this is the whole of it.
 *
 * ⭐ It **reads** {@link STAFF_SPACE_PX} rather than spelling the 10 out, and that is the point:
 * the two are the same fact — how big a staff space is — and a page's millimetres are derived from
 * the score's staff size, not the other way round (docs/staff-size-plan.md §9, the collision this
 * settles). ⛔ A *staff's own* size does not belong here: a page is a page whether the violin part
 * on it is engraved small or not.
 *
 * Sanity, and the reason a first version is cheap: A4 at 15 mm margins lands at 1029 px of content
 * against today's 960 — 7.1%, so turning a layout on does not re-flow the score into something
 * unrecognisable. It also prints a staff at 7 mm, which is what an engraver expects; the canvas at
 * 72/96 prints one at ~10.6 mm.
 */
export const PX_PER_MM = STAFF_SPACE_PX / MM_PER_STAFF_SPACE


/**
 * Today's surface, verbatim: the 1000 px column with a 20 px margin the editor has always drawn.
 *
 * `satisfies` rather than `: Surface`, so the members stay readable without narrowing the union —
 * the DOM element that hosts a render has to be given a size before anything is engraved, and it
 * should take it from here rather than from a fourth hand-written 1000.
 */
export const SKETCH_CANVAS = { kind: 'canvas', widthPx: 1000, marginPx: 20 } as const satisfies Surface

/** A4 portrait at "normal" margins — the first page there is. */
export const A4_NORMAL = {
  kind: 'page',
  layout: {
    page: { widthMm: 210, heightMm: 297 },
    margins: { topMm: 15, bottomMm: 15, leftMm: 15, rightMm: 15 },
  },
} as const satisfies Surface

/** Resolve a surface to the pixels its consumers read. Pure, and the only place the union opens. */
export function resolveSurface(surface: Surface): SurfaceMetrics {
  if (surface.kind === 'canvas') {
    const m = surface.marginPx
    return {
      widthPx: surface.widthPx,
      heightPx: null,
      marginTopPx: m,
      marginBottomPx: m,
      marginLeftPx: m,
      marginRightPx: m,
      contentWidthPx: surface.widthPx - m * 2,
      contentHeightPx: null,
    }
  }

  const { page, margins } = surface.layout
  const widthPx = page.widthMm * PX_PER_MM
  const heightPx = page.heightMm * PX_PER_MM
  const marginTopPx = margins.topMm * PX_PER_MM
  const marginBottomPx = margins.bottomMm * PX_PER_MM
  const marginLeftPx = margins.leftMm * PX_PER_MM
  const marginRightPx = margins.rightMm * PX_PER_MM
  return {
    widthPx,
    heightPx,
    marginTopPx,
    marginBottomPx,
    marginLeftPx,
    marginRightPx,
    contentWidthPx: widthPx - marginLeftPx - marginRightPx,
    contentHeightPx: heightPx - marginTopPx - marginBottomPx,
  }
}
