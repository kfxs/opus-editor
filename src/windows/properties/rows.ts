/**
 * ⭐ **THE ROWS EVERY PANEL IS BUILT FROM** — the offset family's dress (a caption, number boxes, a
 * `reset`), the two commit rules the page limit forced on this window, and the readout's colours.
 * A kind's panel (`./panels/<kind>.ts`) says WHICH rows it shows and where each publishes; this says
 * what a row is. ⛔ No `bus` here: a row is handed its `publish`.
 */
/**
 * Phosphor green — a terminal's, not the chrome's. Local literals and NOT tokens in
 * {@link ../../utils/chromeColors}: that palette is the shared neutrals every window and menu is
 * drawn in, and this colour MEANS something instead — "this is a readout, not UI". It must be free
 * to differ from the chrome, which a shared token would quietly prevent (the same reason the
 * Keypad's voice and mode colours stay out of CHROME).
 *
 * TWO colours, and only two. The kind headings are AMBER — dimming green to separate it from green
 * lost them against the glass, whereas hue separates for free and keeps both bright. Everything
 * else is the phosphor, "Nothing selected" included: it is what the panel is READING OUT, not a
 * label on something, so it belongs in the readout's own colour.
 *
 * All three are TEMPORARY, like the dump they colour — when Properties grows real controls it is
 * drawn in the chrome like every other panel, and these go with the JSON.
 */
export const PHOSPHOR = '#22ff88'
export const AMBER = '#ffc93c'
// Bishop purple — the note-offset control's own colour, so the one thing on the panel you can EDIT
// reads as distinct from the green readout and the amber section labels. A third local literal (not
// a chrome token, like the two above) for the same reason: it MEANS "this is a live control", which
// a shared neutral would quietly flatten. A deep, saturated obispo violet (a lighter tint washed out
// on the glass) — full-strength so it still carries against the dark panel.
export const BISHOP = '#7c3aed'

/**
 * ⭐⭐ **ONE CLICK OF A SPINNER IS ONE COMMIT — the auto-repeat does nothing, and so does the
 * release.** His rule, 2026-08-17: *"committing on mouse down, and release makes no action."*
 *
 * A native number input steps on mouse-down and then **auto-repeats while held**, firing `change`
 * each time. Left alone that ramps the value and fires a write — and a render — per step; past the
 * page limit every one of those is refused, so the number runs away from the score while the ink
 * stands still. The same dead-zone shape as the offsets themselves, arriving through the widget.
 *
 * ⛔ **Committing on RELEASE instead was the first attempt and is worse**, which is why it is
 * written down: holding then ramps the number silently, with no render to judge it by, and lands
 * the whole jump at once. What he asked for is a press that MOVES it one step, renders, and stops —
 * so you see each step and can correct it.
 *
 * ⭐ Typing is untouched: no pointer is down, so Enter and blur commit exactly as they always did.
 *
 * ⚠️ The release is watched on the DOCUMENT (dragging off the arrow releases elsewhere) and only to
 * clear the flag — it never commits. `once`, so nothing survives the row being rebuilt on the next
 * repaint.
 */
export function commitOnFirstStep(input: HTMLInputElement, commit: () => void): void {
  let held = false
  let committedThisPress = false
  input.addEventListener('pointerdown', () => {
    held = true
    committedThisPress = false
    document.addEventListener('pointerup', () => { held = false }, { once: true })
  })
  input.addEventListener('change', () => {
    if (!held) { commit(); return }        // typing, Enter, blur
    if (committedThisPress) return          // the auto-repeat ramp — ignored
    committedThisPress = true
    commit()
  })
}

/**
 * A MARK's absolute offset — **two** number inputs in staff-spaces, +right and +down.
 *
 * ⭐ **One row, two kinds** (2026-08-19): the dynamic publishes to `bus.dynamicOffset` and the
 * tempo mark to `bus.tempoOffset`, and `publish` is the whole of the difference. ⛔ Not a copy per
 * kind — the stale-value discipline below is the hard-won part, and two copies of it is one copy
 * that will quietly stop matching.
 *
 * ⭐ **Both axes commit TOGETHER**, on either input's change, and that is not tidiness: the
 * controller turns the pair into one nudge, so one commit is one undo entry — and the page limit
 * judges the whole move rather than letting a refused diagonal through on its x.
 *
 * ⚠️ It reports the DESIRED absolute and nothing more; the controller reads the current value and
 * applies the delta, and the panel repaints from `onModelChange`. So a value the page limit refuses
 * simply comes back on the repaint, which is the honest report that nothing moved.
 */
export function buildMarkOffsetRow(
  current: { x: number; y: number },
  publish: (x: number, y: number) => void,
  /** What the `y` box MEANS, because the two marks disagree: a dynamic's is screen-down, a tempo
   *  mark's is OUTWARD (+up) — see `TempoOffsetOverride`, his report of 2026-08-19. A tooltip that
   *  lies about the sign is worse than none. */
  yTitle = 'Vertical offset, + is DOWN',
): HTMLElement {
  const row = document.createElement('div')
  const rs = row.style
  rs.display = 'flex'
  rs.alignItems = 'center'
  rs.gap = '6px'
  rs.color = BISHOP
  rs.margin = '2px 0 4px'

  const label = document.createElement('span')
  label.textContent = 'offset (sp)'
  row.appendChild(label)

  const field = (value: number, title: string): HTMLInputElement => {
    const input = document.createElement('input')
    input.type = 'number'
    input.step = '0.25'
    input.title = title
    input.value = String(value)
    const is = input.style
    is.width = '4em'
    is.font = 'inherit'
    is.color = BISHOP
    is.background = 'transparent'
    is.border = `1px solid ${BISHOP}`
    is.borderRadius = '2px'
    is.padding = '1px 4px'
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
    })
    return input
  }

  const xInput = field(current.x, 'Horizontal offset, + is right')
  const yInput = field(current.y, yTitle)
  const commit = () => {
    const x = parseFloat(xInput.value)
    const y = parseFloat(yInput.value)
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      xInput.value = String(current.x)
      yInput.value = String(current.y)
      return
    }
    publish(x, y)
    // Both boxes back to the last known values — see `buildOffsetInput`'s note: a write the page
    // limit refuses repaints nothing, so the panel must not keep showing what was typed.
    xInput.value = String(current.x)
    yInput.value = String(current.y)
  }
  commitOnFirstStep(xInput, commit)
  commitOnFirstStep(yInput, commit)
  row.appendChild(xInput)
  row.appendChild(yInput)

  // The same one-click "put it back" the note offset has, through the same seam.
  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'reset'
  reset.title = 'Reset offset to 0'
  const bs = reset.style
  bs.font = 'inherit'
  bs.color = BISHOP
  bs.background = 'transparent'
  bs.border = `1px solid ${BISHOP}`
  bs.borderRadius = '2px'
  bs.padding = '1px 6px'
  bs.cursor = 'pointer'
  reset.addEventListener('click', () => {
    // Zeroed immediately, the note offset's rule: a reset only reduces, so it is never refused.
    xInput.value = '0'
    yInput.value = '0'
    publish(0, 0)
  })
  row.appendChild(reset)
  return row
}

/**
 * One caption + one number box + a `reset`, in the offset family's dress — the row BOTH span
 * panels are built from (the bracket's three and the pedal's three).
 *
 * ⚠️ Shared because the two are the same control, ⛔ not because the two MARKS are the same: what
 * each row means, and which way its `+` points, is decided by the caller. The bracket's vertical
 * is stored as a distance from the staff and the pedal's as a screen y; both arrive here as a
 * number with a caption.
 *
 * ⚠️ Every box commits through {@link commitOnFirstStep} and puts itself back on commit — the two
 * rules the page limit forced on this panel (docs/plans/engraving-overrides-plan.md §8.6).
 */
export function scalarOffsetRow(
  caption: string,
  current: number,
  hint: string,
  publish: (n: number) => void,
): HTMLElement {
  const row = document.createElement('label')
  const rs = row.style
  rs.display = 'flex'
  rs.alignItems = 'center'
  rs.gap = '6px'
  rs.color = BISHOP
  rs.margin = '0 0 3px'
  row.title = hint

  const label = document.createElement('span')
  label.textContent = caption
  row.appendChild(label)

  const input = document.createElement('input')
  input.type = 'number'
  input.step = '0.25'
  input.value = String(current)
  const is = input.style
  is.width = '4.5em'
  is.font = 'inherit'
  is.color = BISHOP
  is.background = 'transparent'
  is.border = `1px solid ${BISHOP}`
  is.borderRadius = '2px'
  is.padding = '1px 4px'
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur() }
  })
  commitOnFirstStep(input, () => {
    const n = parseFloat(input.value)
    if (!Number.isFinite(n)) { input.value = String(current); return }
    publish(n)
    input.value = String(current) // a refused write repaints nothing — see `buildOffsetInput`
  })
  row.appendChild(input)

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'reset'
  reset.title = 'Back to the engraver\'s own position'
  const bs = reset.style
  bs.font = 'inherit'
  bs.color = BISHOP
  bs.background = 'transparent'
  bs.border = `1px solid ${BISHOP}`
  bs.borderRadius = '2px'
  bs.padding = '1px 6px'
  bs.cursor = 'pointer'
  reset.addEventListener('click', () => {
    // Zeroed at once: a reset only ever reduces an offset, so the page limit cannot refuse it.
    input.value = '0'
    publish(0)
  })
  row.appendChild(reset)
  return row
}

/**
 * ONE number plus a reset, in staff-spaces — the single-value sibling of {@link buildPointRow}.
 * A non-number puts the current value back rather than guessing, `reset` publishes `null` ("let the
 * engraver decide"), and a value outside `[min, max]` is CLAMPED before it is published: those
 * bounds are the caller's, and the caller knows why they are what they are.
 */
export function buildNumberRow(
  caption: string,
  current: number | undefined,
  step: number,
  min: number,
  max: number,
  publish: (value: number | null) => void,
  hint?: string,
): HTMLElement {
  const row = document.createElement('label')
  const rs = row.style
  rs.display = 'flex'
  rs.alignItems = 'center'
  rs.gap = '6px'
  rs.color = BISHOP
  rs.margin = '0 0 3px'
  if (hint) row.title = hint

  const label = document.createElement('span')
  label.textContent = caption
  row.appendChild(label)

  const input = document.createElement('input')
  input.type = 'number'
  input.step = String(step)
  input.min = String(min)
  input.max = String(max)
  input.value = current === undefined ? '' : String(current)
  input.placeholder = 'auto'
  const is = input.style
  is.width = '4.5em'
  is.font = 'inherit'
  is.color = BISHOP
  is.background = 'transparent'
  is.border = `1px solid ${BISHOP}`
  is.borderRadius = '2px'
  is.padding = '1px 4px'
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur() }
  })
  input.addEventListener('change', () => {
    const n = parseFloat(input.value)
    if (!Number.isFinite(n)) { input.value = current === undefined ? '' : String(current); return }
    // ⚠️ CLAMPED here, where the bounds are known. `min`/`max` on a number input only constrain its
    // spinner — a typed or pasted value still arrives — and publishing one the engine would cap
    // would store a shape the score never draws.
    const bounded = Math.min(max, Math.max(min, n))
    if (bounded !== n) input.value = String(bounded)
    publish(bounded)
  })
  row.appendChild(input)

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'reset'
  reset.title = 'Back to the automatic engraving'
  const bs = reset.style
  bs.font = 'inherit'
  bs.color = BISHOP
  bs.background = 'transparent'
  bs.border = `1px solid ${BISHOP}`
  bs.borderRadius = '2px'
  bs.padding = '1px 6px'
  bs.cursor = 'pointer'
  reset.addEventListener('click', () => { input.value = ''; publish(null) })
  row.appendChild(reset)
  return row
}

/**
 * One x/y pair plus a reset, in staff-spaces. `current` absent = the handle is automatic, which
 * shows as a blank input with an `auto` placeholder (see {@link buildSlurGeometryRows}).
 *
 * ⭐ **Each box publishes its OWN axis and says nothing about the other** — `{x}` or `{y}`, never a
 * synthesised pair. An automatic handle has no numbers at all, so a row that insisted on both would
 * be unusable from `auto`: the first box committed would have to invent the second, and for an ARC
 * that invention is destructive (a blank `y` is a whole arch, not zero). The controller fills the
 * unnamed axis from the model, which is the only place the real value lives.
 */
export function buildPointRow(
  caption: string,
  current: { x: number; y: number } | undefined,
  publish: (value: { x?: number; y?: number } | null) => void,
  disabledReason?: string,
): HTMLElement {
  const row = document.createElement('div')
  const rs = row.style
  rs.display = 'flex'
  rs.alignItems = 'center'
  rs.gap = '6px'
  rs.flexWrap = 'wrap'
  rs.color = BISHOP
  rs.margin = '0 0 3px'
  if (disabledReason) {
    row.title = disabledReason
    rs.opacity = '0.5'
  }

  const label = document.createElement('span')
  label.textContent = caption
  row.appendChild(label)

  const boxes: HTMLInputElement[] = []

  for (const axis of ['x', 'y'] as const) {
    const cell = document.createElement('label')
    cell.style.display = 'flex'
    cell.style.alignItems = 'center'
    cell.style.gap = '3px'

    const tag = document.createElement('span')
    tag.textContent = axis
    cell.appendChild(tag)

    const input = document.createElement('input')
    input.type = 'number'
    input.step = '0.25'
    input.value = current ? String(axis === 'x' ? current.x : current.y) : ''
    input.placeholder = 'auto'
    input.disabled = !!disabledReason
    const is = input.style
    is.width = '4.5em'
    is.font = 'inherit'
    is.color = BISHOP
    is.background = 'transparent'
    is.border = `1px solid ${BISHOP}`
    is.borderRadius = '2px'
    is.padding = '1px 4px'
    // Enter commits (and blurs, which would otherwise commit twice — the offset input's rule).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
    })
    commitOnFirstStep(input, () => {
      const n = parseFloat(input.value)
      // Not a number is not an edit: put this box's own value back rather than guessing at what
      // was meant (the offset input's rule). Only this box — the other one was never in question.
      if (!Number.isFinite(n)) {
        input.value = current ? String(axis === 'x' ? current.x : current.y) : ''
        return
      }
      publish({ [axis]: n })
      // Back to the last known value — `buildOffsetInput`'s rule, and the same reason: a refused
      // write repaints nothing, and a box holding a number the model never took is a spinner you
      // have to wind back through before anything moves again.
      input.value = current ? String(axis === 'x' ? current.x : current.y) : ''
    })
    cell.appendChild(input)
    boxes.push(input)
    row.appendChild(cell)
  }

  const reset = document.createElement('button')
  reset.type = 'button'
  reset.textContent = 'reset'
  reset.title = 'Back to the automatic engraving'
  reset.disabled = !!disabledReason
  const bs = reset.style
  bs.font = 'inherit'
  bs.color = BISHOP
  bs.background = 'transparent'
  bs.border = `1px solid ${BISHOP}`
  bs.borderRadius = '2px'
  bs.padding = '1px 6px'
  bs.cursor = 'pointer'
  reset.addEventListener('click', () => {
    // ⭐ Blanked immediately, unlike the typed commit above: a reset only ever REDUCES an offset,
    // so the page limit cannot refuse it and there is no unwritten value to guard against.
    for (const b of boxes) b.value = ''
    publish(null)
  })
  row.appendChild(reset)
  return row
}

/**
 * A captioned DROPDOWN row — the value a musician picks from a short list, published on change. Shared by the
 * tuplet's format and the glissando's side / end / direction (it was the tuplet panel's own until a second
 * panel needed it).
 */
export function buildSelect<V extends string>(
  caption: string, choices: Array<[V, string]>, current: V, title: string, onChange: (value: V) => void,
): HTMLElement {
  const wrap = document.createElement('label')
  const ws = wrap.style
  ws.display = 'flex'
  ws.alignItems = 'center'
  ws.gap = '6px'
  ws.color = BISHOP
  ws.margin = '2px 0 4px'
  wrap.title = title

  const label = document.createElement('span')
  label.textContent = caption
  wrap.appendChild(label)

  const select = document.createElement('select')
  const ss = select.style
  ss.font = 'inherit'
  ss.color = BISHOP
  ss.background = 'transparent'
  ss.border = `1px solid ${BISHOP}`
  ss.borderRadius = '2px'
  ss.padding = '1px 4px'
  for (const [value, text] of choices) {
    const option = document.createElement('option')
    option.value = value
    option.textContent = text
    if (value === current) option.selected = true
    select.appendChild(option)
  }
  select.addEventListener('change', () => onChange(select.value as V))
  wrap.appendChild(select)
  return wrap
}
