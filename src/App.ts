import { dbg } from '@/utils/debug'
import './app.css'
import { MusicEngine } from './engine/MusicEngine'
import { ScoreModel } from './engine/models/ScoreModel'
import { VIEWPORT_HEIGHT } from './engine/rendering/VexFlowRenderer'
import { DEFAULT_ZOOM } from './engine/ViewportModel'
import { createObservableEditorState, scoreCursorClass } from './interactions/EditorState'
import { HighlightController } from './interactions/HighlightController'
import { RenderController } from './interactions/RenderController'
import { SelectionController } from './interactions/SelectionController'
import { PaletteController } from './interactions/PaletteController'
import { KeyboardController } from './interactions/KeyboardController'
import { MouseController } from './interactions/MouseController'
import { TextEditController } from './interactions/TextEditController'
import { DomTextEdit } from './interactions/DomTextEdit'
import { GutterController } from './interactions/GutterController'
import { ClipboardController } from './interactions/ClipboardController'
import { NoteOffsetController } from './interactions/NoteOffsetController'
import { FanEditController } from './interactions/FanEditController'
import { ArticulationStemAlignController } from './interactions/ArticulationStemAlignController'
import { createViewportHost } from './interactions/ViewportHost'
import { wireShortcuts } from './interactions/shortcutWiring'
import { wireKeypadSync } from './interactions/keypadSync'
import { wireSelectionInspection } from './interactions/selectionInspectionSync'
import { renderCensus, buildSyntheticScore } from './dev/renderCensus' // P0 instrument — temporary
import { dumpSpacingCensus, spacingBars } from './dev/spacingCensus' // P0 instrument — temporary
import { setRenderProbe } from './engine/RenderProbe'
import { mountDevToolbar } from './dev/devToolbar'
import { mountScoreJsonPanel } from './dev/scoreJsonPanel'
import { windows } from './windows'
import { menus, menuActions, openMenuAtViewport } from './menus'
import { A4_NORMAL } from './engine/layout/surface'

/**
 * The editor application. No framework: it builds its own DOM, wires the controllers, and owns the
 * lifecycle. Everything below it was already framework-agnostic (`lint:boundary` has enforced that
 * for months), so this file is the last piece — the successor to `App.vue`. See
 * docs/remove-vue-plan.md.
 *
 * The layout is two things with different lifespans. The **viewport** — the score and everything
 * that draws into it — is the application. The **dev shell** around it (toolbar, Score-JSON dump,
 * both in `src/dev/`) is scaffolding, kept because it is useful while building. The shell reads
 * state and calls controllers; nothing inside the viewport knows it exists, so removing it one day
 * is a deletion rather than an excavation.
 *
 * Reactivity is `EditorState`'s own emitting Proxy and nothing else. Four things on screen follow
 * state rather than being pushed: the toolbar (its own subscriber), the score's mouse cursor, the
 * linear-view gutter's presence, and the Keypad/Properties windows (already wired this way while
 * Vue was still here). Each is one `onStateChange` subscriber.
 */

/** scoreContent's own padding (`p-4` = 1rem), applied in app.css. Measure bounds are in the SVG's
 *  space, which starts inside this padding, so anything positioned against them shifts by it. */
const CONTENT_PADDING = 16

/** Ctrl+wheel (and trackpad pinch) zoom sensitivity: factor = exp(-deltaY · k), so zoom is
 *  continuous and multiplicative. Tuned so one mouse notch (~100px deltaY) ≈ a ~15% step while a
 *  trackpad pinch stays smooth. See docs/zoom-plan.md §7 Phase 3. */
const ZOOM_WHEEL_K = 0.0015

/** The score box's fixed classes; `scoreCursorClass` appends the one that varies. */
const SCORE_CANVAS_CLASS = 'score-container bg-slate-200 rounded-lg overflow-auto'

export interface EditorApp {
  destroy(): void
}

function div(className: string): HTMLDivElement {
  const el = document.createElement('div')
  el.className = className
  return el
}

export function createEditorApp(host: HTMLElement): EditorApp {
  // ---------------------------------------------------------------------------------------------
  // DOM
  //
  // Built up-front and in one place, so every controller below can be handed a real element rather
  // than a maybe-null ref that populates a render pass later.
  // ---------------------------------------------------------------------------------------------
  const page = div('min-h-screen bg-gray-900 text-white p-8')
  const upper = div('mb-8')
  const card = div('bg-gray-800 p-4 rounded-lg')

  // The dev toolbar fills this itself (src/dev/devToolbar.ts).
  const toolbarHost = div('')

  /*
   * Score area = fixed-size viewport (owns scroll) + inner content surface (holds the SVG).
   *
   * `scoreViewport` is the positioning context for the linear-view gutter, which is pinned OUTSIDE
   * the scroll box — a child of it would scroll away with the music, the one thing it must not do.
   * overflow-hidden clips it, since the gutter tracks the score SVG's vertical bounds and hangs past
   * the top/bottom of the window when the music is scrolled.
   *
   * `scoreCanvas` owns scrolling and is what `querySelector('svg')` runs against. `scoreContent` is
   * the engine's render target — VexFlow wipes it with innerHTML='' on every render, so it must NOT
   * be the outer scroll box. Padding stays on the inner surface so bbox coords stay aligned with the
   * viewport scroll. See docs/navigation-viewport-plan.md §4.
   */
  const scoreViewport = div('relative overflow-hidden rounded-lg')
  const scoreCanvas = div(SCORE_CANVAS_CLASS)
  scoreCanvas.style.height = `${VIEWPORT_HEIGHT}px`

  /*
   * Zoom DOM (docs/zoom-plan.md §3): the `sizer` takes an explicit size = naturalSvgSize × zoom so
   * the scroll bars get their range; the `zoomLayer` carries transform: scale(zoom) so the visuals
   * scale without a re-render. The viewport host writes both from the same scalar.
   */
  const scoreSizer = div('score-sizer')
  const scoreZoomLayer = div('score-zoom-layer')
  const scoreContent = div('p-4')

  /*
   * Playback cursor — a green vertical bar at the start of the playing measure. Sibling of
   * scoreContent INSIDE the zoomLayer (NOT a child of scoreContent, which VexFlow wipes every
   * render). Living in the scaled layer, it scales and scrolls with the music for free, so its
   * translate stays pure layout coords.
   */
  const playCursor = div('play-cursor')
  playCursor.style.display = 'none'

  /*
   * The frozen left gutter (docs/linear-view-plan.md §P3) — the clef and meter in force at the
   * current scroll-x, so they stay readable at bar 400. A SEPARATE, DOM-pinned SVG: drawing it into
   * the score SVG at scrollX would re-render the whole score on every scroll event. It also sits
   * outside the zoom layer, so GutterController applies the zoom scalar (and the content padding) by
   * hand. Linear view only — it is built here, in its correct DOM position (before the window layer
   * mounts), and hidden rather than created on demand, which keeps the stacking order fixed.
   */
  const scoreGutter = div('score-gutter bg-slate-200')
  scoreGutter.style.display = 'none'

  // The Score-JSON dump fills this itself (src/dev/scoreJsonPanel.ts).
  const jsonHost = div('bg-gray-800 p-4 rounded-lg text-left')

  scoreZoomLayer.append(scoreContent, playCursor)
  scoreSizer.appendChild(scoreZoomLayer)
  scoreCanvas.appendChild(scoreSizer)
  scoreViewport.append(scoreCanvas, scoreGutter)
  card.append(toolbarHost, scoreViewport)
  upper.appendChild(card)
  page.append(upper, jsonHost)
  host.appendChild(page)

  // ---------------------------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------------------------
  // One plain object behind an emitting Proxy: writes notify, and that IS the reactivity. Nothing
  // wraps it any more — the `reactive(bareState)` line that used to sit here, and the one-write-path
  // rule it forced (a write through the bare object was invisible to Vue), are both gone.
  const { state, subscribe: onStateChange } = createObservableEditorState()

  let engine: MusicEngine | null = null
  const getEngine = () => engine

  // ---------------------------------------------------------------------------------------------
  // Controllers, in dependency order
  // ---------------------------------------------------------------------------------------------
  const highlight = new HighlightController(getEngine, () => scoreCanvas, state)

  // A render can move the music under a fixed scroll-x, so the gutter refreshes after each one.
  const renderer = new RenderController(getEngine, state, highlight, () => gutter.refresh())

  // ViewportModel ⇄ DOM scroll wiring — the only DOM-aware viewport piece.
  const viewport = createViewportHost(
    () => scoreCanvas, () => scoreContent, () => scoreSizer, () => scoreZoomLayer,
    () => onViewChange(),
  )

  /**
   * Scroll / zoom / resize settled. Two things hang off it.
   *
   * The gutter, because it is the one thing on screen that a scroll changes without the score
   * re-rendering — and, since P6, the **virtualization window**: the engine is told where the user
   * is looking, and re-engraves only if the viewport has escaped the strip of music it already drew
   * (`setVisibleRect` answers that; it is false for almost every scroll event, so this stays the
   * free CSS scroll it was). The render goes through `renderer.renderScore()` rather than the engine
   * directly, so a note scrolling back into view is repainted *with its highlight*.
   */
  function onViewChange(): void {
    if (engine) {
      const v = viewport.model.getVisibleRect()
      // The viewport rect is measured from the zoom layer's origin, which sits CONTENT_PADDING
      // inside the SVG's; measure boxes are in the SVG's own space. Shift to match.
      const needsRender = engine.setVisibleRect({
        x: v.x - CONTENT_PADDING,
        y: v.y - CONTENT_PADDING,
        width: v.width,
        height: v.height,
      })
      if (needsRender) renderer.renderScore()
    }
    gutter.refresh()
  }

  // Linear view's frozen left gutter. The element always exists; it is only *shown* in linear view,
  // and the getter reports null otherwise — so the controller sees exactly what the old `v-if` gave
  // it, without the element's position in the DOM ever changing.
  const gutter = new GutterController(
    getEngine,
    () => (state.viewMode === 'linear' ? scoreGutter : null),
    () => scoreContent,
    viewport.model,
  )

  const selection = new SelectionController(
    getEngine,
    state,
    rect => viewport.ensureVisible(rect),
    () => renderer.renderScore(),
  )

  const clipboard = new ClipboardController(getEngine, state, selection, renderer)

  // PaletteController needs mouse.getLastMousePosition; mouse is constructed below, and the closure
  // resolves it lazily at call time — long after the temporal dead zone has closed.
  const palette = new PaletteController(
    getEngine,
    state,
    () => renderer.renderScore(),
    // Draw the preview for whatever is armed — renderToolGhost, the SAME function the mouse calls on
    // every move. Not `renderPreview`, which only ever draws a ghost NOTE and so cannot preview a
    // marking tool.
    (c) => renderer.renderToolGhost(c),
    () => mouse?.getLastMousePosition() ?? null,
    (id) => selection.selectNote(id),
    () => selection.deselectAll(),
  )

  const keyboard = new KeyboardController(
    getEngine,
    state,
    () => palette.getPendingArticulations(),
    () => renderer.renderScore(),
    (id) => selection.moveCaretTo(id),
    () => selection.getContextPitch(),
    () => selection.scrollSelectedNoteIntoView(),
  )

  // The in-canvas text editor: the framework-agnostic controller paired with the real-DOM overlay.
  // The menu opener is INJECTED rather than imported by the overlay itself, so DomTextEdit depends
  // on nothing but the DOM (and interactions/ -> menus/ never becomes a cycle). `isOpen` rides along
  // because the overlay must stand down from Enter/Escape/arrows while a menu is up — its keydown
  // listener runs before the menu's, so it would otherwise eat them.
  const textEdit = new TextEditController(state, new DomTextEdit(openMenuAtViewport, () => menus.isOpen))

  const mouse: MouseController = new MouseController(
    getEngine,
    () => scoreCanvas,
    state,
    selection,
    renderer,
    () => palette.getPendingArticulations(),
    () => textEdit,
    clipboard,
    () => palette.armDynamicEntry(),
    () => palette.armTempoEntry(),
    (dx, dy) => viewport.scrollBy(dx, dy),
    () => viewport.model.getZoom(),
  )

  // Hand the Insert menu its command callbacks. The menu lives in plain TS (src/menus); this is the
  // one glue line that lends it a controller — Insert ▸ Text ▸ Expression runs the same action as
  // Ctrl+E.
  menuActions.insertExpression = () => mouse.insertExpression()
  menuActions.insertTempo = () => mouse.insertTempo()

  const shortcuts = wireShortcuts(
    state, getEngine,
    selection, palette, keyboard, renderer, clipboard,
    viewport,
    () => mouse.getLastMousePosition(),
    () => mouse.insertExpression(),
    () => mouse.insertTempo(),
    () => mouse.editSelectedDynamic(),
    // `p` — the same toggle the ▶ button runs; the shortcut is a second way to press it, never a
    // second implementation of it.
    () => { void togglePlayback() },
  )

  // ---------------------------------------------------------------------------------------------
  // State-driven view updates — the whole of it
  // ---------------------------------------------------------------------------------------------
  let lastCursorClass = ''
  let lastGutterShown: boolean | null = null

  function syncFromState(): void {
    // The score box's cursor: hidden while panning, a text caret under the expression/tempo tools.
    const cursor = scoreCursorClass(state)
    if (cursor !== lastCursorClass) {
      lastCursorClass = cursor
      scoreCanvas.className = `${SCORE_CANVAS_CLASS} ${cursor}`
    }
    // The gutter exists only in linear view. Painting it and dropping it are both the controller's
    // job; this just decides whether it is on screen.
    const showGutter = state.viewMode === 'linear'
    if (showGutter !== lastGutterShown) {
      lastGutterShown = showGutter
      scoreGutter.style.display = showGutter ? '' : 'none'
      if (showGutter) gutter.refresh()
      else gutter.detach()
    }
    // While a hand/grab pan is active, hide the OS pointer everywhere — not just over the score —
    // so it stays hidden when the drag crosses the viewport edge. (The score element also carries
    // `cursor-none` for the common in-bounds case; this covers off-bounds.)
    document.body.style.cursor = state.isPanning ? 'none' : ''
  }

  const stopStateSync = onStateChange(syncFromState)

  // The Keypad's wired controls (duration, accidental, articulation, dot, tie) and the Properties
  // window's selection feed. Both were cut over to the state's own change-notification while Vue was
  // still here, which is why neither needed touching to lose it.
  const stopKeypadSync = wireKeypadSync(state, palette, onStateChange, getEngine)
  const stopSelectionInspection = wireSelectionInspection(state, getEngine, onStateChange)

  // The Properties note-offset input publishes to `noteOffsetSelection`; this controller owns the
  // engine apply (client #12, docs/note-offset-plan.md §B) so the window stays a dumb publisher.
  const noteOffset = new NoteOffsetController(getEngine, () => renderer.renderScore())
  // The Properties "align to stem" checkbox publishes to `articulationStemAlignSelection`; this
  // controller owns the engine apply, same boundary as the note-offset input above.
  const articulationStemAlign = new ArticulationStemAlignController(getEngine, () => renderer.renderScore())
  // The Properties fan inputs publish to `fanEditSelection`; this controller owns the engine apply
  // (docs/fanned-beams-plan.md §3, P4), the same boundary as the two above.
  const fanEdit = new FanEditController(getEngine, () => renderer.renderScore())

  // ---------------------------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------------------------
  /** Ctrl+wheel zoom toward the cursor. A window-level listener registered `{ passive: false }` so
   *  preventDefault() actually kills the browser's page-zoom — done whenever Ctrl is held, whether
   *  or not the pointer is over the score ("zoom is always score zoom", docs/zoom-plan.md §7). */
  function handleZoomWheel(e: WheelEvent): void {
    if (!e.ctrlKey) return
    e.preventDefault()
    const rect = scoreCanvas.getBoundingClientRect()
    // Focal = cursor relative to the viewport, clamped inside it so an out-of-bounds pointer still
    // zooms toward the nearest edge rather than off-screen.
    const focal = {
      x: Math.min(Math.max(e.clientX - rect.left, 0), scoreCanvas.clientWidth),
      y: Math.min(Math.max(e.clientY - rect.top, 0), scoreCanvas.clientHeight),
    }
    viewport.zoomAt(Math.exp(-e.deltaY * ZOOM_WHEEL_K), focal)
  }

  // Order matches what the Vue hooks produced: the viewport and the mouse attach before the engine
  // exists. Both cope — the viewport's MutationObserver binds to the SVG the moment VexFlow inserts
  // it, and the mouse reads the engine through a getter.
  viewport.attach()
  // MouseController.setup() attaches only the DOCUMENT-level listeners (click-outside). The five
  // element-level handlers are the host's to bind — they were `@click`/`@mousemove`/… on the score
  // div in the template, and they are these lines now. Without them nothing on the score responds:
  // no ghost under the pointer, no click-to-place, no selection, no drag.
  const onCanvasClick = (e: MouseEvent) => mouse.handleClick(e)
  const onCanvasMouseDown = (e: MouseEvent) => mouse.handleMouseDown(e)
  const onCanvasMouseMove = (e: MouseEvent) => mouse.handleMouseMove(e)
  const onCanvasMouseUp = (e: MouseEvent) => mouse.handleMouseUp(e)
  const onCanvasMouseLeave = () => mouse.handleMouseLeave()
  scoreCanvas.addEventListener('click', onCanvasClick)
  scoreCanvas.addEventListener('mousedown', onCanvasMouseDown)
  scoreCanvas.addEventListener('mousemove', onCanvasMouseMove)
  scoreCanvas.addEventListener('mouseup', onCanvasMouseUp)
  scoreCanvas.addEventListener('mouseleave', onCanvasMouseLeave)
  mouse.setup()
  window.addEventListener('wheel', handleZoomWheel, { passive: false })

  const devShell = [
    mountDevToolbar(toolbarHost, {
      state, palette, getEngine, onStateChange, togglePlayback,
      renderScore: () => renderer.renderScore(),
    }),
    mountScoreJsonPanel(jsonHost, {
      getEngine,
      onBeforeLoad: () => selection.deselectAll(),
      onAfterLoad: () => renderer.renderScore(),
    }),
  ]

  // Mounted INSIDE the viewport wrapper but OUTSIDE the scroll box (a sibling of it), so a window
  // lives in the score area — clipped to it, and clamped to it when dragged — while sitting outside
  // the transform: scale(zoom) layer: it neither scrolls away with the music nor zooms with it.
  windows.mount(scoreViewport)

  // ⭐ The editor opens **on a page**: you are writing music for paper, and `Use layout` off is the
  // deliberate step away from it rather than the way back. Stated here rather than defaulted in the
  // engine — see `MusicEngineConfig.surface`. No `width`: the surface answers that, and the first
  // render resizes the SVG to whatever it cast off onto.
  engine = new MusicEngine({ container: scoreContent, height: 400, surface: A4_NORMAL })

  // Playback-follow: keep the playing measure inside the viewport. We react only when the measure
  // number changes (not every position tick), and viewport.ensureVisible self-gates — it scrolls
  // only when the measure nears the window edge — so this pages along by ~a line without continuous
  // jitter. Reset on (re)start so playback re-follows from the top.
  let lastFollowedMeasure = -1
  engine.setPlaybackCallbacks({
    onStateChange: s => {
      state.playbackState = s
      if (s === 'playing') lastFollowedMeasure = -1
      // Hide the cursor whenever we're not actively playing (stop/pause).
      else hidePlayCursor()
    },
    onPositionChange: pos => {
      if (pos.measure === lastFollowedMeasure) return
      lastFollowedMeasure = pos.measure
      const rect = engine?.getMeasureRect(pos.measure)
      if (rect) {
        viewport.ensureVisible(rect)
        // Pin the green bar to the measure's left edge (start). Per-measure granularity for now;
        // beat-level gliding would interpolate within rect using pos.beat.
        playCursor.style.transform =
          `translate(${rect.x + CONTENT_PADDING}px, ${rect.y + CONTENT_PADDING}px)`
        playCursor.style.height = `${rect.height}px`
        playCursor.style.display = ''
      }
    },
    onPlaybackComplete: () => { state.playbackState = 'stopped'; hidePlayCursor() },
  })

  function hidePlayCursor(): void {
    playCursor.style.display = 'none'
  }

  shortcuts.enable()
  initializeEmptyScore()
  // Open zoomed OUT (DEFAULT_ZOOM), before the first render rather than after: the model's own
  // identity is 100%, and where the EDITOR opens is this file's call, not the model's.
  viewport.model.setZoom(DEFAULT_ZOOM)
  syncFromState()
  renderer.renderScore()
  // Now that the engine exists, hand it the window (P6). The first render above drew the whole
  // score, because until this moment nothing had told the engine where the viewport is. Doing it
  // explicitly rather than waiting for the next scroll/resize observer to fire keeps the moment
  // culling switches on deterministic.
  onViewChange()
  installPerfInstruments()

  function initializeEmptyScore(): void {
    if (!engine) return
    engine.clearAllNotes()
    // TOP UP to the default length rather than adding a fixed number — the model mints a measure of
    // its own, and "add 63" would quietly mean something else the day that changes.
    while (engine.getScore().measures.length < ScoreModel.DEFAULT_SCORE_MEASURES) {
      engine.addMeasure()
    }
  }

  async function togglePlayback(): Promise<void> {
    if (!engine) return
    if (state.playbackState === 'playing') {
      engine.stop()
    } else {
      try {
        await engine.play()
      } catch (error) {
        console.error('Playback error:', error)
      }
    }
  }

  /**
   * TEMPORARY — the P0 render-performance instrument (docs/render-performance-plan.md §8).
   * Dev builds only; delete when P0 closes. From the DevTools console:
   *
   *   __perf.load(200)      // a synthetic 200-bar score (4 quarters/bar), same density as the bench
   *   __census.enable()     // start recording renders, tagged by what caused them
   *   …edit, click, hover…
   *   __census.dump()       // a table: renders per cause, and the layout:draw split per render
   */
  function installPerfInstruments(): void {
    // Cast: this project has no vite/client types, and a temporary instrument shouldn't add one.
    if (!(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) return
    const w = window as unknown as Record<string, unknown>
    // The engine only knows the `RenderProbe` seam and defaults it to a no-op, so it compiles with
    // `dev/` deleted (docs/refactor-plan-2026-07-27.md 3a). App.ts is the one place allowed to know
    // both, so it is the one place that plugs the real instrument in — and only in a dev build.
    setRenderProbe(renderCensus)
    w.__census = renderCensus
    // Hit-box VISUALIZER (dev tool). Draws every registered hit-box as a coloured SVG rectangle
    // right on the score, so you can SEE which click-boxes are inflated or mis-placed — reads the
    // registry, which always holds the CURRENT boxes (no re-render needed). Born from
    // docs/tight-bbox-plan.md §7 (it made the fat rest-carrying-a-dynamic box visible) and kept as a
    // general debugging aid. __bbox.show() draws all (labelled `type W×H`); __bbox.show('rest')
    // filters to one type; __bbox.hide() clears.
    w.__bbox = {
      show: (only?: string) => {
        if (!engine) return
        const svg = document.querySelector('.score-container svg') as SVGSVGElement | null
        if (!svg) { console.warn('[bbox] no score <svg> found'); return }
        const NS = 'http://www.w3.org/2000/svg'
        svg.querySelector('#bbox-overlay')?.remove()
        const overlay = document.createElementNS(NS, 'g')
        overlay.setAttribute('id', 'bbox-overlay')
        const color: Record<string, string> = {
          rest: '#e11d48', note: '#2563eb', dynamic: '#16a34a', accidental: '#d97706',
          articulation: '#9333ea', dot: '#0891b2', clef: '#7c3aed', timeSignature: '#be185d',
        }
        let n = 0
        for (const el of engine.getElementRegistry().getAll()) {
          if (only && el.type !== only) continue
          const b = el.bbox
          if (!b || b.width <= 0 || b.height <= 0) continue
          const c = color[el.type] ?? '#64748b'
          const rect = document.createElementNS(NS, 'rect')
          rect.setAttribute('x', String(b.x)); rect.setAttribute('y', String(b.y))
          rect.setAttribute('width', String(b.width)); rect.setAttribute('height', String(b.height))
          rect.setAttribute('fill', c); rect.setAttribute('fill-opacity', '0.1')
          rect.setAttribute('stroke', c); rect.setAttribute('stroke-width', el.type === 'rest' ? '1.5' : '0.75')
          overlay.appendChild(rect)
          const label = document.createElementNS(NS, 'text')
          label.setAttribute('x', String(b.x)); label.setAttribute('y', String(b.y - 1))
          label.setAttribute('fill', c); label.setAttribute('font-size', '6')
          label.textContent = `${el.type} ${Math.round(b.width)}×${Math.round(b.height)}`
          overlay.appendChild(label)
          n++
        }
        svg.appendChild(overlay)
        console.log(`[bbox] drew ${n} hit-box(es)${only ? ` type=${only}` : ''}. Rest boxes are red. __bbox.hide() to clear.`)
      },
      hide: () => {
        document.querySelector('#bbox-overlay')?.remove()
        console.log('[bbox] overlay cleared')
      },
    }
    w.__perf = {
      load: (bars: number, staves = 1) => {
        if (!engine) return
        selection.selectNote(null)
        engine.loadJSON(buildSyntheticScore(bars, staves))
        renderer.renderScore()
        dbg(`[perf] loaded ${bars} bars × ${staves} staves`)
      },
    }
    // The spacing model's own P0 instrument (docs/spacing-model-plan.md P0) — the census of the
    // DRAWN gaps, in staff spaces, for the score actually on screen. Scoped to the score container
    // so it measures the music and not a window's preview.
    w.__spacing = {
      dump: () => dumpSpacingCensus(document.querySelector('.score-container') ?? document),
      bars: () => spacingBars(document.querySelector('.score-container') ?? document),
    }
    dbg('[perf] P0 instruments: __perf.load(200), __census.enable(), __census.dump()')
    dbg('[bbox] hit-box visualizer: __bbox.show() / __bbox.show(\'rest\') / __bbox.hide()')
    dbg('[spacing] column census: __spacing.dump() — drawn gaps in staff spaces')
  }

  return {
    destroy(): void {
      window.removeEventListener('wheel', handleZoomWheel)
      scoreCanvas.removeEventListener('click', onCanvasClick)
      scoreCanvas.removeEventListener('mousedown', onCanvasMouseDown)
      scoreCanvas.removeEventListener('mousemove', onCanvasMouseMove)
      scoreCanvas.removeEventListener('mouseup', onCanvasMouseUp)
      scoreCanvas.removeEventListener('mouseleave', onCanvasMouseLeave)
      shortcuts.disable()
      stopStateSync()
      stopKeypadSync()
      stopSelectionInspection()
      noteOffset.destroy()
      articulationStemAlign.destroy()
      fanEdit.destroy()
      for (const part of devShell) part.destroy()
      viewport.detach()
      gutter.detach()
      mouse.teardown()
      windows.destroy()
      engine?.dispose()
      engine = null
      page.remove()
    },
  }
}
