/**
 * ⭐⭐ **THE RULER, MADE VISIBLE** — `__bbox.ink()`, the eye-check for P6
 * (`docs/own-engraving-engine.md` §5 P6).
 *
 * ## His point, 2026-09-14
 *
 * > *"remember we have `__bbox.show()` in the console… in any case this should show OUR bbox and not
 * > vexflow bbox"*
 *
 * ⭐ Right, and it is the end state rather than today's: `__bbox.show()` draws what
 * `ElementRegistry` holds, which is **what every click actually resolves against** — so while the
 * registry still stores VexFlow-derived boxes, that is the honest thing for it to draw. ⛔ Making it
 * lie about its source would hide exactly the disagreement P6 exists to close.
 *
 * ⇒ this module draws **ours** — computed from the SCENE (`engine/scene/sceneBox`), from the ink the
 * renderer actually put down — so the two can be looked at TOGETHER. When they agree everywhere,
 * the registry switches over (P6b) and `show()` and `ink()` become the same picture.
 *
 * | command | what it draws |
 * |---|---|
 * | `__bbox.show()` | the REGISTRY's boxes — VexFlow's arithmetic, what a click uses today |
 * | `__bbox.ink()` | **ours**, computed from the scene |
 * | `__bbox.ink('notehead')` | …only the groups with that class — also `accidental`, `dot`, `articulation` |
 * | `__bbox.hide()` | clears both |
 *
 * ⚠️ **It re-renders every bar** (`MusicEngine.recordFullScene`), because a scene is a record of one
 * render and the live page's was not kept. 🚨 And it must be the FULL form: a render that follows no
 * edit REUSES its measures, and a reused bar draws nothing — the plain `recordScene` hands back a
 * nearly empty scene (measured, one barline out of a page). Harmless but not free, unlike `show()`,
 * which only reads the registry.
 *
 * 🚨 **What it cannot measure is the most useful part of the picture.** A group it cannot measure
 * gets no box — so it is drawn DASHED and RED over whatever else it contains, labelled with WHY, and
 * a group with nothing measurable at all is counted in the console line. ⭐ Two reasons, and they are
 * different faults: a glyph we have no metrics for (named by codepoint), and ink drawn at a
 * coordinate that is **not a number** (named by kind — today only VexFlow's `setOrigin` in a
 * page-less test, but a NaN from anywhere must never look like a measurement). ⛔ *"The ruler declined"* and *"there was nothing there"* must never
 * look the same, which is the same rule `sceneInkBox` follows by answering null.
 */
import type { MusicEngine } from '@/engine/MusicEngine'
import type { SceneGroup, SceneNode } from '@/engine/scene/Scene'
import { walkScene } from '@/engine/scene/Scene'
import { drawnInkBoxDetail } from '@/engine/rendering/sceneInk'

const NS = 'http://www.w3.org/2000/svg'
const OVERLAY_ID = 'ink-box-overlay'

/** One colour per family, so a screenful of rectangles is readable. ⭐ Same palette as `__bbox`. */
const COLOR: Record<string, string> = {
  notehead: '#2563eb', stem: '#0891b2', beam: '#7c3aed', flag: '#be185d',
  stavebarline: '#64748b', tie: '#16a34a', slur: '#16a34a',
  clef: '#7c3aed', timesignature: '#be185d', keysignature: '#d97706',
}

/** ⛔ What nobody wants outlined: the containers, whose box is just the score again. */
const STRUCTURAL = new Set(['measure', 'stave', 'staffscale', 'page', 'ctx-scale'])

export interface InkBoxOverlay {
  /** Draw our computed box for every drawn group — or only those with this class. */
  ink(only?: string): void
  /** Remove the overlay. */
  hide(): void
}

export function createInkBoxOverlay(getEngine: () => MusicEngine | null): InkBoxOverlay {
  return {
    ink(only?: string) {
      const engine = getEngine()
      if (!engine) return
      const scene = engine.recordFullScene()
      const svg = document.querySelector('.score-container svg')
      if (!svg) { console.warn('[bbox] no score <svg> found'); return }

      svg.querySelector(`#${OVERLAY_ID}`)?.remove()
      const overlay = document.createElementNS(NS, 'g')
      overlay.setAttribute('id', OVERLAY_ID)

      let drawn = 0
      let refused = 0
      for (const node of walkScene(scene)) {
        if (node.kind !== 'group' || !node.cls) continue
        if (STRUCTURAL.has(node.cls)) continue
        if (only && node.cls !== only) continue
        const painted = outline(overlay, node)
        if (painted === 'box') drawn++
        else if (painted === 'refused') refused++
      }

      svg.appendChild(overlay)
      console.log(
        `[bbox] ${drawn} box${drawn === 1 ? '' : 'es'} computed from the scene` +
        (refused ? `, ⚠️ ${refused} REFUSED — dashed, labelled with the glyph we have not measured` : '') +
        `${only ? ` (class '${only}')` : ''}. __bbox.hide() to clear.`,
      )
    },

    hide() {
      document.querySelector(`#${OVERLAY_ID}`)?.remove()
    },
  }
}

/**
 * Draw one group's box, or its refusal. ⚠️ The group's own placement is NOT applied: the overlay
 * is appended to the score's root `<svg>`, where a scene's top-level coordinates already live.
 *
 * ⭐⭐ **A group's box is its OWN ink — a nested group is drawn on its own line, ⛔ not folded into
 * its parent's.** His report, 2026-09-14: *"the `__bbox.ink()` of the notehead becomes bigger with
 * articulation, is this correct?"* — it was a truthful UNION and a useless ruler, and it is the same
 * complaint that made `rendering/noteInkBox` exist on VexFlow's side (*"`StaveNote.getBoundingBox()`
 * unions every attached modifier"*). ⭐ `sceneInkBox` was built to answer it: **the CALLER chooses
 * which children count**. This is that choice, made for the picture — every mark now has a box, and
 * the head's box is the head.
 *
 * ⚠️ The filter must let the ROOT through, which is what the identity test is for: a filter that
 * simply said *"no groups"* would reject the very node being measured.
 */
function outline(overlay: SVGGElement, group: SceneGroup): 'box' | 'refused' | 'empty' {
  // ⚠️ The identity test names the SPREAD COPY, ⛔ not `group`: the copy is what the walk starts
  // from, and comparing against the original would reject the root and answer null every time.
  const root: SceneGroup = { ...group, placement: IDENTITY_PLACEMENT }
  const ownInk = (node: SceneNode) => node === root || node.kind !== 'group'
  const { box, unmeasured, nonFinite } = drawnInkBoxDetail(root, ownInk)
  // ⭐ TWO reasons the ruler declines, and they read differently on the page: *"I have no
  // measurement for this glyph"* and *"this was drawn at a coordinate that is not a number"*.
  const why = [
    ...unmeasured.map(u => `unmeasured ${codepoint(u)}`),
    ...nonFinite.map(kind => `${kind} at NaN`),
  ]
  if (!box || box.width <= 0 || box.height <= 0) return why.length ? refuse(overlay, group, why) : 'empty'
  if (why.length) return refuse(overlay, group, why, box)

  const color = COLOR[group.cls ?? ''] ?? '#94a3b8'
  overlay.appendChild(rect(box, color, false))
  overlay.appendChild(label(box, `${group.cls} ${box.width.toFixed(1)}×${box.height.toFixed(1)}`, color))
  return 'box'
}

/** ⚠️ A box we DECLINED to compute — dashed, and named with WHY. ⛔ Never silently absent. */
function refuse(
  overlay: SVGGElement,
  group: SceneGroup,
  why: string[],
  partial?: { x: number; y: number; width: number; height: number },
): 'refused' {
  if (partial) {
    overlay.appendChild(rect(partial, '#dc2626', true))
    overlay.appendChild(label(partial, `${group.cls} ⚠️ ${why.join(' · ')}`, '#dc2626'))
  }
  return 'refused'
}

const codepoint = (s: string) => [...s].map(c => `U+${c.codePointAt(0)!.toString(16).toUpperCase()}`).join('')

const IDENTITY_PLACEMENT = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }

function rect(box: { x: number; y: number; width: number; height: number }, color: string, dashed: boolean): SVGRectElement {
  const el = document.createElementNS(NS, 'rect')
  el.setAttribute('x', String(box.x))
  el.setAttribute('y', String(box.y))
  el.setAttribute('width', String(box.width))
  el.setAttribute('height', String(box.height))
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', color)
  el.setAttribute('stroke-width', '0.7')
  if (dashed) el.setAttribute('stroke-dasharray', '3 2')
  return el
}

function label(box: { x: number; y: number }, text: string, color: string): SVGTextElement {
  const el = document.createElementNS(NS, 'text')
  el.setAttribute('x', String(box.x))
  el.setAttribute('y', String(box.y - 1.5))
  el.setAttribute('fill', color)
  el.setAttribute('font-size', '6')
  el.setAttribute('font-family', 'monospace')
  el.textContent = text
  return el
}
