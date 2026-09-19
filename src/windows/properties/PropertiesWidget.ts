import type { Widget } from '../content/Widget'
import { bus } from '@/bus'
import type { InspectedElement } from '../../interactions/selectionSnapshot'
import { MAX_FAN_BEAMS, MAX_FAN_COUNT, MAX_FAN_SPREAD, fanRampRange, fanSpread } from '../../utils/fannedBeam'
import type { TrillContinuationLabel } from '../../types/music'
import type { ArticulationType, FanMark, FractionalBeamSide, Hairpin } from '../../types/music'
import { wingsAllowed, type BarlineSignKind } from '@/engine/models/boundarySign'

/**
 * What is selected, as the model holds it.
 *
 * A SKETCH, deliberately: it stringifies, it does not edit. Properties will eventually offer the
 * controls for each kind of element, and the way to find out what those controls should be is to
 * look at the objects for a while — which is precisely what this does. It is also the honest state
 * of the seam: the selection reaches this window and repaints when it moves; only the widgets are
 * missing.
 *
 * The panel reads {@link bus.inspection} and nothing else. It never touches EditorState, never
 * holds the engine, and cannot write — so no edit can escape from a window that is not yet an
 * editor.
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
const PHOSPHOR = '#22ff88'
const AMBER = '#ffc93c'
// Bishop purple — the note-offset control's own colour, so the one thing on the panel you can EDIT
// reads as distinct from the green readout and the amber section labels. A third local literal (not
// a chrome token, like the two above) for the same reason: it MEANS "this is a live control", which
// a shared neutral would quietly flatten. A deep, saturated obispo violet (a lighter tint washed out
// on the glass) — full-strength so it still carries against the dark panel.
const BISHOP = '#7c3aed'

export class PropertiesWidget implements Widget {
  private body: HTMLElement | null = null
  private unsubscribe: (() => void) | null = null

  mount(host: HTMLElement): void {
    host.style.overflow = 'hidden'

    const body = document.createElement('div')
    const s = body.style
    s.flex = '1'
    s.minHeight = '0'
    s.overflow = 'auto'
    // Monospace, because this is DATA: aligned braces and columns are how you read a dump. The rest
    // of the toolkit is prose and uses the inherited face.
    s.font = "12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
    s.lineHeight = '1.45'
    s.whiteSpace = 'pre-wrap'
    // Long ids and pitch keys have no spaces to break at, and a panel that scrolls SIDEWAYS to show
    // the end of an id is a panel you cannot read at a glance.
    s.overflowWrap = 'anywhere'
    s.color = PHOSPHOR

    host.appendChild(body)
    this.body = body

    this.paint(bus.inspection.get())
    this.unsubscribe = bus.inspection.onChange((elements) => this.paint(elements))
  }

  /** The selection lives outside this widget, so the subscription MUST go when the window does. */
  destroy(): void {
    this.unsubscribe?.()
    this.unsubscribe = null
  }

  private paint(elements: InspectedElement[]): void {
    const body = this.body
    if (!body) return
    body.textContent = ''

    if (!elements.length) {
      const empty = document.createElement('div')
      empty.textContent = 'Nothing selected'
      body.appendChild(empty)
      return
    }

    for (const element of elements) {
      // The kind is the one thing that is NOT in the JSON — `data` is the element's own object, and
      // an object does not say what it is. Without this a rest and a note are told apart only by
      // spotting `isRest` in the dump.
      const heading = document.createElement('div')
      heading.textContent = element.kind
      heading.style.color = AMBER
      heading.style.margin = '8px 0 2px'
      heading.style.textTransform = 'uppercase'
      heading.style.letterSpacing = '0.06em'
      body.appendChild(heading)

      // The panel's FIRST real control (client #12 — docs/note-offset-plan.md §B): a note/rest's
      // horizontal offset, an absolute value in staff-spaces. Publishes to `bus.noteOffset`; the
      // widget never touches the engine (that is NoteOffsetController's job) — it stays a dumb
      // publisher, and the second editable property will cost almost nothing.
      if ((element.kind === 'note' || element.kind === 'rest')) {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildOffsetInput(id, currentNoteOffset(element)))
          // Only meaningful when the note carries an articulation (the flag moves stem-side marks).
          const artics = (element.data as { articulations?: ArticulationType[] }).articulations
          if (element.kind === 'note' && artics?.length) {
            body.appendChild(this.buildStemAlignCheckbox(id, currentStemAlign(element)))
          }
          // The fanned group's numbers, shown only on a note that HAS one: this row changes the
          // shape of a fan, it never makes one (docs/fanned-beams-plan.md §3, P4). Creating and
          // removing them is the accel./rit. press, which is also where the direction lives.
          const fan = (element.data as { fan?: FanMark }).fan
          if (element.kind === 'note' && fan) {
            body.appendChild(this.buildFanInputs(id, fan))
          }
          // ⭐ …and which way its FRACTIONAL BEAM points (his ask, 2026-09-01).
          //
          // ⚠️ **The gate is the note's DURATION, which is looser than the truth**: only a note
          // shorter than its beam group's common level actually carries a stub, and that is a fact
          // about the GROUP, which this snapshot does not hold. So the row can appear on a semiquaver
          // in a run of semiquavers, where it has nothing to move. ⛔ Deliberately not faked tighter
          // by guessing — the honest fix is the one `offsettable` uses below: ask the engine what was
          // DRAWN. See docs/beam-hook-research.md §8.
          if (element.kind === 'note' && canCarryFractionalBeam(element)) {
            body.appendChild(
              this.buildFractionalBeamSideSelect(id, currentFractionalBeamSide(element)),
            )
          }
        }
      }

      // ⭐⭐ A selected INLINE CLEF gets ONE number — its horizontal offset (his ask, 2026-08-28:
      // *"when the clef is not in the beguining of a line (i mean a header clef) i want to be able to
      // offset it horizontally either by keys in the keyboard or be the property"*).
      //
      // ⚠️ **The row appears only when the clef can actually carry one** — `offsettable`, which the
      // snapshot takes from the engine's reading of the DRAWN ink, because a clef standing in a
      // system's header is laid out by the header and is exactly the one he excluded. ⛔ A row whose
      // write is always refused would be a control that lies.
      if (element.kind === 'clef') {
        const clef = element.data as {
          measure?: number; beat?: number; staff?: number; offset?: number; offsettable?: boolean
        }
        if (clef.offsettable && clef.measure !== undefined && clef.beat !== undefined) {
          const staff = clef.staff ?? 0
          body.appendChild(this.scalarOffsetRow(
            'offset x', clef.offset ?? 0,
            'Horizontal nudge in staff-spaces, + right. The keyboard does the same: '
            + 'Ctrl+Shift+←/→ (wide) or Shift+Alt+←/→ (fine).',
            (x) => bus.clefOffset.set(clef.measure!, clef.beat!, staff, x),
          ))
        }
      }

      // ⭐ A selected DYNAMIC or expression gets its offset as two numbers (his ask, 2026-08-17:
      // *"we also should be able to control the offset of expression (dynamics) on the properties"*).
      // Two axes where the note above has one — a note's vertical is its PITCH, while a dynamic rides
      // the dynamics line and may be lifted off it. Publishes to `bus.dynamicOffset`; the widget
      // never touches the engine.
      if (element.kind === 'dynamic') {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildMarkOffsetRow(
            currentDynamicOffset(element), (x, y) => bus.dynamicOffset.set(id, x, y)))
        }
      }

      // ⭐ …and a selected TEMPO MARK the same two (his ask, 2026-08-19), through `bus.tempoOffset`.
      // The mark rides the row the ladder gives it and may be moved off it in either direction, so
      // it takes the dynamic's row rather than the note's single horizontal.
      if (element.kind === 'tempo') {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildMarkOffsetRow(
            currentTempoOffset(element), (x, y) => bus.tempoOffset.set(id, x, y),
            'Vertical offset, + is UP (away from the staff)'))
        }
      }

      // ⭐ A selected OTTAVA gets its ink offsets as numbers (his ask, 2026-08-17) — the typed twin
      // of the arrows on its two endpoint squares. ⭐⭐ THREE rows, not two points: an octave bracket
      // is a straight rule, so the two ends have a horizontal each and the HEIGHT is one number for
      // the whole line. See `buildOttavaOffsetRows`.
      // ⭐ …and a selected TRILL the same three (his ask, 2026-08-18) — with the BRACKET's vertical
      // rather than the pedal's, since `x` flips a trill's side.
      if (element.kind === 'trill') {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildTrillOffsetRows(id, element))
        }
      }

      // ⭐ …and a selected PEDAL the same three (his ask, 2026-08-18). Its vertical is one number for
      // the same reason the bracket's is — a pedal and its own release share a baseline — reached by
      // a different road: an engraving convention rather than the geometry of a straight line.
      if (element.kind === 'pedal') {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildPedalOffsetRows(id, element))
        }
      }

      if (element.kind === 'ottava') {
        const id = (element.data as { id?: string; missing?: boolean }).id
        if (id && !(element.data as { missing?: boolean }).missing) {
          body.appendChild(this.buildOttavaOffsetRows(id, element))
        }
      }

      // ⭐ A selected SLUR gets its four handles as numbers — the two ends' offsets and the two arc
      // control points, the same points the mouse drags and the arrows nudge (his ask, 2026-08-17).
      // Same boundary as every row here: it publishes to `bus.slurGeometry` and never touches the
      // engine. See `buildSlurGeometryRows` for what the numbers mean.
      if (element.kind === 'slur') {
        const slur = element.data as { id?: string; missing?: boolean }
        if (slur.id && !slur.missing) body.appendChild(this.buildSlurGeometryRows(slur.id, element))
      }

      // ⭐ A selected HAIRPIN gets its two ENDS as numbers — the wedge's reshape, and only that: the
      // extent is musical and has its own gestures (`bus/hairpinGeometrySelection` says why a
      // staff-space box is the wrong instrument for it).
      if (element.kind === 'hairpin') {
        const hairpin = element.data as { id?: string; missing?: boolean; type?: Hairpin['type'] }
        if (hairpin.id && !hairpin.missing) {
          // ⭐ WHICH WAY IT OPENS first — it is the wedge's MUSIC, and the rows under it are its
          //   drawing. (His ask, 2026-08-22.)
          body.appendChild(this.buildHairpinTypeSelect(hairpin.id, hairpin.type ?? 'cresc'))
          body.appendChild(this.buildHairpinEndRows(hairpin.id, element))
        }
      }

      // ⭐⭐ A selected KEY SIGNATURE gets the trailing gap of its CAUTIONARY — his ask, 2026-08-28:
      // *"lets make what we have now default but give the user the freedom to change the number in
      // properties."* The number is where the sources disagree most (Gould's measured 1.9 sp against
      // all three engines' 0.5, ours 0.75 between them), which is exactly when a default should not
      // be the last word.
      //
      // ⚠️ It is offered whether or not the change currently lands on a system break: the decision
      // belongs to the CHANGE, and which bar ends a system moves on every reflow.
      if (element.kind === 'keySignature') {
        const where = element.data as { measure?: number; staff?: number }
        const gap = element.derived?.cautionaryGap as
          { value: number; authored: boolean } | null | undefined
        if (gap && where.measure !== undefined) {
          const staff = where.staff ?? 0
          body.appendChild(this.buildNumberRow(
            // ⭐ A quarter-space step: the whole interesting range is 0.5–2 sp (the two sources'
            //   answers and a little either side), so a finer step would offer stops nobody can see.
            'courtesy tail (sp)', gap.value, 0.25, 0, 4,
            (value) => bus.cautionaryKeyGap.set({ measure: where.measure!, staff, gap: value }),
            gap.authored
              ? 'bare staff after a courtesy key signature at a system break — yours; reset returns it to 0.75'
              : 'bare staff after a courtesy key signature at a system break — the default 0.75 (Gould measures 1.9, the three engines 0.5)',
          ))
        }
      }

      // ⭐⭐ A selected BARLINE or OPEN REPEAT gets the sign at its LINE — his ask, 2026-08-26:
      // *"I was expecting to change the type there"*, then *"since we can just select one barline
      // there should be an option for close+open case"*. Both selections name the same kind of thing
      // (a line), so both get the same control; `boundaryOf` is what turns each into its boundary.
      if (element.kind === 'barline' || element.kind === 'repeatStart') {
        const boundary = boundaryOf(element)
        if (boundary !== undefined) {
          const sign = currentBarlineSign(element)
          body.appendChild(this.buildBarlineSignSelect(boundary, sign))
          body.appendChild(this.buildBarlineWingsCheckbox(boundary, sign, currentBarlineWinged(element)))
        }
      }

      // A selected TRILL gets its one stored choice. Same boundary as the fan row above.
      if (element.kind === 'trill') {
        const trill = element.data as { id?: string; missing?: boolean; continuationLabel?: TrillContinuationLabel }
        if (trill.id && !trill.missing) {
          body.appendChild(this.buildTrillLabelSelect(trill.id, trill.continuationLabel ?? 'parenthesised'))
        }
      }

      const dump = document.createElement('div')
      dump.textContent = stringify(element.data)
      body.appendChild(dump)

      // Its own section, under its own label, because the overrides are their own COMPARTMENT — the
      // authored geometry the model deliberately keeps out of the content (staff-spaces, never
      // pixels). Printing them inside the element's object would show a shape the score does not
      // have. Nothing is drawn when the element has none, which is most of the time.
      if (element.overrides) {
        const label = document.createElement('div')
        label.textContent = 'engraving overrides'
        label.style.color = AMBER
        label.style.margin = '6px 0 2px'
        label.style.letterSpacing = '0.06em'
        body.appendChild(label)

        const overrides = document.createElement('div')
        overrides.textContent = stringify(element.overrides)
        body.appendChild(overrides)
      }
    }
    (body.firstElementChild as HTMLElement).style.marginTop = '0'
  }

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
  private commitOnFirstStep(input: HTMLInputElement, commit: () => void): void {
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
   * The absolute horizontal-offset control for one note/rest. A labelled number input in
   * staff-spaces; committing (Enter or blur) publishes `{id, x}` to {@link bus.noteOffset}.
   * The window holds no engine — the controller reads the current value and applies the delta — so
   * this only reports the desired absolute, and the panel repaints from `onModelChange` afterward.
   */
  private buildOffsetInput(noteId: string, current: number): HTMLElement {
    const row = document.createElement('label')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    rs.color = BISHOP
    rs.margin = '2px 0 4px'

    const label = document.createElement('span')
    label.textContent = 'offset (sp)'
    row.appendChild(label)

    const input = document.createElement('input')
    input.type = 'number'
    input.step = '0.25'
    input.value = String(current)
    const is = input.style
    is.width = '5em'
    is.font = 'inherit'
    is.color = BISHOP
    is.background = 'transparent'
    is.border = `1px solid ${BISHOP}`
    is.borderRadius = '2px'
    is.padding = '1px 4px'

    const commit = () => {
      const x = parseFloat(input.value)
      if (!Number.isFinite(x)) { input.value = String(current); return }
      bus.noteOffset.set(noteId, x)
      // ⭐⭐ THE BOX NEVER KEEPS A NUMBER THE MODEL REFUSED — his report, 2026-08-17: *"the number
      // doesn't stop but keeps on changing after the limit, so to go back we have to do the whole
      // path."* The page limit can decline the write, and a declined write changes nothing, so
      // `bus.inspection` never fires and this row is never rebuilt — leaving a value on screen the
      // score does not have, and a spinner you must wind all the way back down through. So the box
      // is put back to the last KNOWN value on every commit; a write that landed repaints the row
      // over the top of it with the new one. ⛔ The alternative — a success flag back through the
      // seam — would make the window read the engine's answer, which is the boundary it defends.
      input.value = String(current)
    }
    // Enter commits (and blurs, which would otherwise commit a second time — so guard on the blur).
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur() }
    })
    this.commitOnFirstStep(input, commit)
    row.appendChild(input)

    // A little reset: publish offset 0 through the same seam (the controller turns it into the nudge
    // back to centre). Kept next to the input so "put this note back" is one click, not a retype.
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
      // Zeroed immediately — a reset only reduces an offset, so the limit cannot refuse it.
      input.value = '0'
      bus.noteOffset.set(noteId, 0)
    })
    row.appendChild(reset)
    return row
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
  private buildMarkOffsetRow(
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
    this.commitOnFirstStep(xInput, commit)
    this.commitOnFirstStep(yInput, commit)
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
   * rules the page limit forced on this panel (docs/engraving-overrides-plan.md §8.6).
   */
  private scalarOffsetRow(
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
    this.commitOnFirstStep(input, () => {
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
   * ⭐⭐ **AN OCTAVE BRACKET'S INK, AS THE MODEL SHAPES IT: two horizontals and ONE height.**
   * His ask, 2026-08-17 — the typed twin of the arrows on the bracket's two endpoint squares.
   *
   * ⛔ **Not two point rows.** The obvious layout — copy the hairpin's `start (x, y)` / `end (x, y)`
   * — would offer two heights for a mark that has one, and the two boxes could then disagree about
   * it. A bracket is a straight horizontal rule: `OttavaOffsetOverride` carries `startX`, `endX` and
   * a single `y`, and the panel showing exactly that is how a reader learns the rule. The keyboard
   * says the same thing in its own way — ↑ from EITHER square lifts the whole line.
   *
   * ⭐ **0 is the automatic position**, so the boxes show `0` rather than a blank "auto" — unlike the
   * wedge's mouth, whose automatic is a computed width that no number stands for. `reset` therefore
   * publishes 0 through the same seam, and the model's zero-pruning drops the entry.
   *
   * ⚠️ Every box commits through {@link commitOnFirstStep} and puts itself back on commit — the two
   * rules the page limit forced on this panel (docs/engraving-overrides-plan.md §8.6).
   */
  private buildOttavaOffsetRows(ottavaId: string, element: InspectedElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.margin = '2px 0 4px'
    const off = (element.overrides?.find((o) => o.kind === 'ottavaOffset') ?? {}) as {
      startX?: number
      endX?: number
      outward?: number
    }


    wrap.appendChild(this.scalarOffsetRow(
      'start x (sp)', off.startX ?? 0,
      'the numeral and the line leaving it — + reaches right; the far end stays put',
      (x) => bus.ottavaGeometry.set({ ottavaId, which: 'start', x })))
    wrap.appendChild(this.scalarOffsetRow(
      'end x (sp)', off.endX ?? 0,
      'the closing hook — + reaches right; the numeral stays put',
      (x) => bus.ottavaGeometry.set({ ottavaId, which: 'end', x })))
    // ⭐⭐ **THE BOX SPEAKS SCREEN: + IS UP, ALWAYS.** His rule, 2026-08-17, after trying both:
    // *"for me, increasing the number is go up and decreasing go down always… the arrow of the
    // properties should reflect the movement on screen — intuitive UX."*
    //
    // ⭐ The MODEL stores `outward` — a distance from the staff — for a reason that is not about the
    // UI at all: `x` flips an ottava's direction, and a screen-signed field would turn a nudge that
    // meant "clear of the music" into a shove toward it (see `OttavaOffsetOverride`). Both facts are
    // true at once, and this line is where they meet: the store keeps the intent, the box shows the
    // movement. ⚠️ So the displayed number FLIPS SIGN when the bracket is flipped — which is honest,
    // because the ink genuinely moved to the other side of the staff.
    const above = ((element.data as { shift?: number }).shift ?? 1) > 0
    const toScreen = (n: number) => (above ? n : -n)
    wrap.appendChild(this.scalarOffsetRow(
      // ⚠️ Named for the AXIS, not the direction — his call: *"instead of up, better something like
      // vertical position."* `up` read as a verb, and it sits beside two rows named for an axis.
      // Which way `+` goes is the tooltip's job, and the tooltip is unambiguous.
      'vertical (sp)', toScreen(off.outward ?? 0),
      'the WHOLE bracket — + moves it UP on screen and − moves it down, whichever side of the staff '
      + 'it is on. One number, because an octave line is a straight rule',
      // ⭐ `toScreen` is its own inverse (a negation), so one helper does both directions.
      (up) => bus.ottavaGeometry.set({ ottavaId, outward: toScreen(up) })))
    return wrap
  }

  /**
   * ⭐⭐ **A TRILL'S INK: two horizontals and ONE vertical.** His ask, 2026-08-18 — the typed twin of
   * the arrows on the ornament's two squares.
   *
   * ⛔ **Not two point rows**, the family's rule: the `tr` and its wavy line are drawn on one
   * baseline, so two height boxes would offer two answers to a question the notation has one of.
   *
   * ⭐⭐ **The store is `outward` and the box speaks SCREEN** — the BRACKET's arrangement, ⛔ not the
   * pedal's. A trill's side is stored and `x` flips it, so a screen-signed field would turn a nudge
   * that meant *clear of the music* into a shove toward it; the model therefore keeps the intent and
   * this line converts. ⚠️ So the displayed number FLIPS SIGN when the ornament is flipped, which is
   * honest — the ink genuinely moved to the other side of the staff.
   */
  private buildTrillOffsetRows(trillId: string, element: InspectedElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.margin = '2px 0 4px'
    const off = (element.overrides?.find((o) => o.kind === 'trillOffset') ?? {}) as {
      startX?: number
      endX?: number
      outward?: number
    }

    wrap.appendChild(this.scalarOffsetRow(
      'start x (sp)', off.startX ?? 0,
      'the tr sign, and the wavy line leaving it — + reaches right; the far end stays put',
      (x) => bus.trillGeometry.set({ trillId, which: 'start', x })))
    wrap.appendChild(this.scalarOffsetRow(
      'end x (sp)', off.endX ?? 0,
      'where the wavy line stops — + reaches right; the sign stays put',
      (x) => bus.trillGeometry.set({ trillId, which: 'end', x })))
    // ⭐ `+` is UP on screen whichever side the ornament is on — his standing rule for every offset
    // box. `toScreen` is its own inverse (a negation), so one helper does both directions.
    const above = ((element.data as { placement?: 'above' | 'below' }).placement ?? 'above') === 'above'
    const toScreen = (n: number) => (above ? n : -n)
    wrap.appendChild(this.scalarOffsetRow(
      'vertical (sp)', toScreen(off.outward ?? 0),
      'the WHOLE ornament — + moves it UP on screen and − moves it down, whichever side of the staff '
      + 'it is on. One number, because the sign and its line share a baseline',
      (up) => bus.trillGeometry.set({ trillId, outward: toScreen(up) })))
    return wrap
  }

  /**
   * ⭐⭐ **A SUSTAIN PEDAL'S INK: two horizontals and ONE vertical.** His ask, 2026-08-18 — the typed
   * twin of the arrows on its two squares, and the bracket's panel above verbatim in shape.
   *
   * ⛔ **Not two point rows**, for a reason that is this family's own rather than the bracket's
   * borrowed: a pedal and its own release share one baseline, so two height boxes could disagree
   * about a quantity the notation has one of (Gould p. 333, the copy in `reference/`). An octave
   * line's single height is geometry — a straight rule cannot tilt; this one is a CONVENTION about
   * how the pair reads, and it is the stronger of the two reasons.
   *
   * ⭐ **0 is the automatic position**, so the boxes show `0` rather than a blank "auto", and `reset`
   * publishes 0 through the same seam — the model's zero-pruning then drops the entry.
   *
   * ⚠️ **`+` is UP in the box and DOWN in the model**, so this is the one line that negates. The
   * bracket's row does the same flip from the other direction (its store is a distance from the
   * staff), which is the point: every offset box in this panel reads *+ is up on screen*, whatever
   * its model happens to store.
   */
  private buildPedalOffsetRows(pedalId: string, element: InspectedElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.margin = '2px 0 4px'
    const off = (element.overrides?.find((o) => o.kind === 'pedalOffset') ?? {}) as {
      startX?: number
      endX?: number
      y?: number
    }

    wrap.appendChild(this.scalarOffsetRow(
      'start x (sp)', off.startX ?? 0,
      'the Ped. sign — + reaches right; the release stays put',
      (x) => bus.pedalGeometry.set({ pedalId, which: 'start', x })))
    wrap.appendChild(this.scalarOffsetRow(
      'end x (sp)', off.endX ?? 0,
      'the release ✻ — + reaches right; the Ped. stays put',
      (x) => bus.pedalGeometry.set({ pedalId, which: 'end', x })))
    // ⭐ A negation is its own inverse, so ONE helper converts both ways. ⚠️ `0` is special-cased only
    // to keep `-0` out of the model and off the screen — it is the same number, and nobody wants to
    // read it.
    const flip = (n: number) => (n === 0 ? 0 : -n)
    wrap.appendChild(this.scalarOffsetRow(
      // ⚠️ Named for the AXIS, not the direction — the bracket's row's rule and his wording.
      'vertical (sp)', flip(off.y ?? 0),
      'BOTH signs — + moves them UP on screen and − moves them down. One number, because a pedal '
      + 'and its own release share a baseline',
      (up) => bus.pedalGeometry.set({ pedalId, y: flip(up) })))
    return wrap
  }

  /**
   * The fanned group's shape — how many notes it is played and drawn as, how many beam lines it
   * feathers out to, and which of its notes the feathering covers. One row, four number inputs,
   * publishing to {@link bus.fanEdit}.
   *
   * ⭐ **The numbers ARE the model** (`FanMark`), which is what makes this UI only: nothing here
   * computes a consequence, it just says what the assertion is. The direction is not offered — that
   * is the accel./rit. press, and showing it twice would give one fact two owners.
   *
   * ⭐ **`from`/`to` are shown 1-BASED and converted right here** (docs/fan-ramp-range-plan.md P2).
   * "Note 1" is the note he typed, which is how a musician counts a group; the model, the seam and
   * every reader past this line stay 0-based like the rest of the editor. The conversion belongs at
   * the one place a human reads the number, and nowhere deeper.
   *
   * Committing (Enter or blur) re-draws and re-plays at once, because both read the same field.
   */
  /**
   * ⭐ **How a trill labels itself on a CONTINUATION system** — the three real behaviours in the
   * field, offered as a choice because there is no single right one (see
   * {@link Trill.continuationLabel} for who does which, and docs/trill-plan.md §1 rule 6).
   *
   * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.trillEdit` and never touches the engine —
   * `TrillEditController` owns the apply, the same boundary the fan inputs keep.
   *
   * ⭐ It CHANGES a trill, never makes one. The row appears only on a selected trill; creating and
   * removing them is the Lines window and Delete.
   */
  private buildTrillLabelSelect(trillId: string, current: TrillContinuationLabel): HTMLElement {
    const wrap = document.createElement('label')
    const ws = wrap.style
    ws.display = 'flex'
    ws.alignItems = 'center'
    ws.gap = '6px'
    ws.color = BISHOP
    ws.margin = '2px 0 4px'
    wrap.title = 'What a new system shows when this trill carries over from the previous one.'

    const caption = document.createElement('span')
    caption.textContent = 'on a new system'
    wrap.appendChild(caption)

    const select = document.createElement('select')
    const ss = select.style
    ss.font = 'inherit'
    ss.color = BISHOP
    ss.background = 'transparent'
    ss.border = `1px solid ${BISHOP}`
    ss.borderRadius = '2px'
    ss.padding = '1px 4px'

    // ⚠️ The labels say what is DRAWN, not who does it — a user picking one is choosing a picture,
    // not siding with a publisher. The provenance belongs in the docs, and is in them.
    const options: Array<[TrillContinuationLabel, string]> = [
      ['parenthesised', '(tr)'],
      ['plain', 'tr'],
      ['none', 'line only'],
    ]
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      if (value === current) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      bus.trillEdit.set({ trillId, continuationLabel: select.value as TrillContinuationLabel })
    })

    wrap.appendChild(select)
    return wrap
  }

  /**
   * ⭐⭐ **WHICH WAY THE WEDGE OPENS** — his ask, 2026-08-22: *"be able in a dropdown in the property
   * to change the hairpin type"*. `crescendo` opens to the right, `diminuendo` closes to it.
   *
   * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.hairpinEdit` and never touches the engine —
   * `HairpinEditController` owns the apply, the same boundary the trill and fan rows keep.
   *
   * ⭐ **A CONTENT edit, unlike everything below it in this panel.** The end nudges and the mouth are
   * drawing, kept in the overrides compartment; which way a wedge opens is what the player is told to
   * do and playback reads it — so it goes through the model and takes an undo entry. Two questions,
   * two seams (`bus/hairpinEditSelection` states the split).
   *
   * ⭐ It CHANGES a wedge, never makes one — the Lines window and Delete own that, exactly as for the
   * trill's row. And `x` on a selected hairpin still flips it (`interactions/flipSelection`): one
   * fact, two instruments, which is this editor's ordinary shape.
   */
  private buildHairpinTypeSelect(hairpinId: string, current: Hairpin['type']): HTMLElement {
    const wrap = document.createElement('label')
    const ws = wrap.style
    ws.display = 'flex'
    ws.alignItems = 'center'
    ws.gap = '6px'
    ws.color = BISHOP
    ws.margin = '2px 0 4px'
    wrap.title = 'Which way the wedge opens — a content edit, so it is undoable and playback reads it.'

    const caption = document.createElement('span')
    caption.textContent = 'type'
    wrap.appendChild(caption)

    const select = document.createElement('select')
    const ss = select.style
    ss.font = 'inherit'
    ss.color = BISHOP
    ss.background = 'transparent'
    ss.border = `1px solid ${BISHOP}`
    ss.borderRadius = '2px'
    ss.padding = '1px 4px'

    // ⚠️ The word AND the shape: the name is what a musician says and the wedge is what is drawn, and
    //    a panel that offered only `cresc`/`dim` would make the reader translate its own model.
    const options: Array<[Hairpin['type'], string]> = [
      ['cresc', 'crescendo  <'],
      ['dim', 'diminuendo  >'],
    ]
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      if (value === current) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      bus.hairpinEdit.set({ hairpinId, type: select.value as Hairpin['type'] })
    })

    wrap.appendChild(select)
    return wrap
  }

  /**
   * ⭐⭐ **WHAT STANDS ON THIS LINE** — the barline chooser, and the only instrument that can reach the
   * back-to-back `:||:`.
   *
   * 🚨 **HIS ASK, 2026-08-26:** *"what about the properties when I selected a barline? I was expecting
   * to change the type there"*, then the shape of it: *"since we can just select one barline, there
   * should be an option for close+open case."* ⭐ That second sentence is the whole design. `:||:` is
   * two statements stored on two bars (ONE OWNER PER LINE, `barlineOps`), and a selection of one side
   * owns only its own half — so no per-bar control could ever offer it. This one names the **LINE**,
   * and `setBoundarySign` writes both owners as ONE undoable edit.
   *
   * ⚠️ The window is a DUMB PUBLISHER: it writes to `bus.barlineEdit` and never touches the engine —
   * `BarlineEditController` owns the apply, the same boundary every row in this panel keeps.
   *
   * ⭐ **A CONTENT edit**, like the hairpin's type and unlike the offsets below it: a repeat changes
   * what the player is told to do. The line's WIDTH and its gap are drawing, and keep their own
   * gestures (`Ctrl+←/→`, `Shift+←/→`).
   *
   * ⛔ **At the score's opening edge the list is TWO items**, not five greyed ones: nothing ends there,
   * so `|:` and "nothing" are the only statements sayable — a final bar at the start of a piece is not
   * a thing the model can hold, and offering it disabled would suggest it were merely unavailable.
   */
  private buildBarlineSignSelect(endsMeasure: number | null, current: BarlineSignKind): HTMLElement {
    const wrap = document.createElement('label')
    const ws = wrap.style
    ws.display = 'flex'
    ws.alignItems = 'center'
    ws.gap = '6px'
    ws.color = BISHOP
    ws.margin = '2px 0 4px'
    wrap.title = endsMeasure === null
      ? 'What stands at the start of the score — a content edit, so it is undoable.'
      : 'What stands on this line — a content edit, so it is undoable.'

    const caption = document.createElement('span')
    caption.textContent = 'sign'
    wrap.appendChild(caption)

    const select = document.createElement('select')
    const ss = select.style
    ss.font = 'inherit'
    ss.color = BISHOP
    ss.background = 'transparent'
    ss.border = `1px solid ${BISHOP}`
    ss.borderRadius = '2px'
    ss.padding = '1px 4px'

    // ⚠️ The NAME and the SHAPE, like the hairpin's rows: the words are what a musician says and the
    //    ASCII is what is drawn. ⛔ `plain` reads "none", not "plain barline" — a bar always ends in a
    //    line, and what this list picks is the STATEMENT made on it, of which there may be none.
    const all: Array<[BarlineSignKind, string]> = [
      ['plain', 'none  |'],
      // ⭐ Between `none` and the signs, because that is what it is: an ordinary line, not engraved.
      ['invisible', 'invisible  ¦'],
      ['final', 'final  ‖'],
      ['repeatEnd', 'end repeat  :|'],
      ['repeatStart', 'open repeat  |:'],
      ['repeatBoth', 'end + open  :||:'],
    ]
    const options = endsMeasure === null
      ? all.filter(([value]) => value === 'plain' || value === 'repeatStart')
      : all
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      if (value === current) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      bus.barlineEdit.set({ endsMeasure, sign: select.value as BarlineSignKind })
    })

    wrap.appendChild(select)
    return wrap
  }

  /**
   * ⭐⭐ **WINGS** — the flared tips at the top and bottom of the sign's thick line, as a checkbox.
   *
   * 🚨 **HIS ASK, 2026-08-26, and the second half of it is the whole design:** *"the wings on
   * properties should be a checkbox, but the important thing is it should only be checkable when
   * wings are allowed — this is for open repeat, for end repeat and for final; other barlines do not
   * allow wings."*
   *
   * ⭐ **DISABLED rather than hidden**, and that is the difference from the chooser next door, which
   * drops its two impossible rows at the score's opening edge. A row that vanishes says *"this is not
   * a thing"*; a row that greys says *"this is a thing, but not for what you have selected"* — and
   * wings ARE a thing on three of the five signs, so the control has to stay where the eye last found
   * it while you change the sign above it. The `title` says why it is grey.
   *
   * ⚠️ The rule itself is `barlineSign.wingsAllowed`, read off the sign's PARTS: a sign with a thick
   * line can be winged, and a plain or invisible line has nothing to flare. ⛔ Not a list of sign
   * names here — that would be the same rule written twice, in the layer that draws none of it.
   *
   * The window stays a DUMB PUBLISHER: it writes to `bus.barlineEdit` and never touches the engine.
   */
  private buildBarlineWingsCheckbox(
    endsMeasure: number | null, sign: BarlineSignKind, current: boolean,
  ): HTMLElement {
    const allowed = wingsAllowed(sign)
    const row = document.createElement('label')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    rs.color = BISHOP
    rs.margin = '2px 0 4px'
    rs.cursor = allowed ? 'pointer' : 'default'
    // ⭐ Greyed as well as disabled: `:disabled` styles the box, not the word beside it.
    rs.opacity = allowed ? '1' : '0.45'
    row.title = allowed
      ? 'Flared tips at the top and bottom of the thick line — a house style, drawn on every staff.'
      : 'Only a sign with a thick line can be winged: a plain or invisible line has nothing to flare.'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = current
    input.disabled = !allowed
    input.style.accentColor = BISHOP
    input.addEventListener('change', () => bus.barlineEdit.set({ endsMeasure, winged: input.checked }))
    row.appendChild(input)

    const label = document.createElement('span')
    label.textContent = 'wings'
    row.appendChild(label)
    return row
  }

  private buildFanInputs(noteId: string, fan: FanMark): HTMLElement {
    const row = document.createElement('div')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    // Five numbers and a label do not fit one line in a narrow window; they wrap rather than clip.
    rs.flexWrap = 'wrap'
    rs.color = BISHOP
    rs.margin = '2px 0 4px'

    const label = document.createElement('span')
    label.textContent = `fan (${fan.direction})`
    row.appendChild(label)

    const field = (
      title: string, value: number, max: number, publish: (n: number) => void, hint = title,
      step = 1,
    ): HTMLElement => {
      const wrap = document.createElement('label')
      wrap.style.display = 'flex'
      wrap.style.alignItems = 'center'
      wrap.style.gap = '3px'
      wrap.title = hint

      const caption = document.createElement('span')
      caption.textContent = title
      wrap.appendChild(caption)

      const input = document.createElement('input')
      input.type = 'number'
      input.min = '1'
      input.max = String(max)
      input.step = String(step)
      input.value = String(value)
      const is = input.style
      is.width = '3.5em'
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
      input.addEventListener('change', () => {
        // ⚠️ `parseFloat` for a fractional field (the spread), `parseInt` for the counts — a count
        // typed with a decimal point is a typo, not a request for two-thirds of a note.
        const n = step === 1 ? parseInt(input.value, 10) : parseFloat(input.value)
        // A number that is not one is not an edit: put the real value back rather than guessing at
        // what was meant. The controller clamps the rest.
        if (!Number.isFinite(n)) { input.value = String(value); return }
        publish(n)
      })
      wrap.appendChild(input)
      return wrap
    }

    row.appendChild(field('notes', fan.count, MAX_FAN_COUNT, (count) => bus.fanEdit.set({ noteId, count })))
    row.appendChild(field('beams', fan.beams, MAX_FAN_BEAMS, (beams) => bus.fanEdit.set({ noteId, beams })))

    // ⭐ WHERE THE WEDGE STARTS AND ENDS. Read through `fanRampRange`, so a fan that has never been
    // given one shows the whole group — the same answer the drawing and the playback are already
    // using, rather than a second reading of an absent field.
    const ramp = fanRampRange(fan)
    const last = Math.max(1, Math.round(fan.count))
    row.appendChild(field(
      'from', ramp.from + 1, last,
      (n) => bus.fanEdit.set({ noteId, rampFrom: n - 1 }),
      'the note the feathering starts on',
    ))
    row.appendChild(field(
      'to', ramp.to + 1, last,
      (n) => bus.fanEdit.set({ noteId, rampTo: n - 1 }),
      'the note it ends on — outside the mark the notes are even, on one beam',
    ))

    // ⭐ HOW FAR THE WEDGE OPENS — a multiple of the ordinary beam gap, so 1 is both the default and
    // the floor (below it the lines overlap). The only number in this row that does not change the
    // sound: what a reader counts is lines, and spreading them does not change how many there are.
    row.appendChild(field(
      'wide', fanSpread(fan), MAX_FAN_SPREAD,
      (spread) => bus.fanEdit.set({ noteId, spread }),
      'how far apart the beam lines spread — 1 is the normal beam gap; drawing only, the playback does not change',
      0.25,
    ))
    return row
  }

  /**
   * ⭐ **THE SLUR'S FOUR HANDLES, AS NUMBERS** — one row per grabbable point: the blue square at each
   * end, then the two amber arc dots. Each row is an x/y pair in **staff-spaces** and a reset,
   * publishing to {@link bus.slurGeometry}; `SlurGeometryController` applies.
   *
   * ⚠️ **These are the MODEL's numbers, not screen positions**, and the two differ in sign for the
   * arc: an endpoint offset is screen-down-positive, while an arc control point's `y` bows the curve
   * OUTWARD whichever side the slur sits on. That is deliberate — the override's own JSON is printed
   * a few lines below this control, and an input that disagreed with the dump under it would be
   * unreadable. The keyboard is the surface that speaks screen ("↑ lifts the dot"); this one speaks
   * model.
   *
   * ⭐ **Blank means AUTO, and blank is not zero.** An unedited handle has no entry in the overrides
   * compartment at all, so its input shows a placeholder rather than `0` — the arc especially, whose
   * automatic shape is a whole arch and nothing like a zero pair. Reset returns a row to blank.
   *
   * ⚠️ On a cross-system slur the ARC rows address the segment whose dot is armed (the caption says
   * which); with none armed there is no system to write to, so they are shown disabled rather than
   * offered as a guess. The END rows are always live — a true end belongs to the whole slur.
   */
  private buildSlurGeometryRows(slurId: string, element: InspectedElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.margin = '2px 0 4px'

    const ends = (element.overrides?.find((o) => o.kind === 'endpointOffset') ?? {}) as {
      start?: { x: number; y: number }
      end?: { x: number; y: number }
    }
    const arc = (element.derived?.arc ?? {}) as {
      cps?: [{ x: number; y: number }, { x: number; y: number }] | null
      segment?: string | null
      armed?: 0 | 1 | null
    }

    // ⭐ The WHOLE curve first, because it is the coarsest thing on the panel and the one that
    // answers "this slur sits in the wrong place" — the two ends below answer "this END does".
    const whole = (element.overrides?.find((o) => o.kind === 'slurOffset') ?? {}) as { x?: number; y?: number }
    wrap.appendChild(this.buildPointRow(
      'whole curve (sp)',
      whole.x === undefined && whole.y === undefined ? undefined : { x: whole.x ?? 0, y: whole.y ?? 0 },
      (value) => bus.slurGeometry.set({ slurId, target: { kind: 'whole' }, value }),
    ))
    wrap.appendChild(this.buildPointRow('start end (sp)', ends.start, (value) =>
      bus.slurGeometry.set({ slurId, target: { kind: 'endpoint', which: 'start' }, value })))
    wrap.appendChild(this.buildPointRow('end end (sp)', ends.end, (value) =>
      bus.slurGeometry.set({ slurId, target: { kind: 'endpoint', which: 'end' }, value })))

    // A cross-system slur with nothing armed: the caption says why the rows are dead rather than
    // leaving the user to wonder which system a number would have gone to.
    const segment = arc.segment ?? null
    const armedOnly = segment !== null && arc.armed === null
    for (const cpIndex of [0, 1] as const) {
      const label = `arc ${cpIndex + 1}${segment ? ` (${segment})` : ''} (sp)`
      wrap.appendChild(this.buildPointRow(
        label,
        arc.cps?.[cpIndex],
        (value) => bus.slurGeometry.set({ slurId, target: { kind: 'controlPoint', cpIndex }, value }),
        armedOnly ? 'select an arc handle first — a split slur shapes one system at a time' : undefined,
      ))
    }
    return wrap
  }

  /**
   * ⭐ **THE WEDGE'S TWO ENDS, AS NUMBERS** — one row each, x/y in staff-spaces plus a reset,
   * publishing to {@link bus.hairpinGeometry}; `HairpinGeometryController` applies.
   *
   * ⭐ **The RESHAPE, not the extent.** `+x` reaches that end further along the wedge and `+y` moves
   * it down, so a `y` on one end tilts the wedge and a `y` on both lifts it off the dynamics line —
   * all of it drawing, none of it music. How many notes the wedge covers is the model's, and this
   * panel deliberately offers no box for it: that quantity is measured in notes, and its instruments
   * are `Ctrl+Shift+←/→` and dragging the square.
   *
   * Blank means the engraver's own position (see {@link buildPointRow}) — not zero, which here would
   * be a hand-authored "exactly where it already was".
   */
  private buildHairpinEndRows(hairpinId: string, element: InspectedElement): HTMLElement {
    const wrap = document.createElement('div')
    wrap.style.margin = '2px 0 4px'
    const offsets = (element.overrides?.find((o) => o.kind === 'hairpinEndpointOffset') ?? {}) as {
      start?: { x: number; y: number }
      end?: { x: number; y: number }
    }
    for (const which of ['start', 'end'] as const) {
      wrap.appendChild(this.buildPointRow(`${which} (sp)`, offsets[which], (value) =>
        bus.hairpinGeometry.set({ hairpinId, which, value })))
    }
    // …and the MOUTH — one number for the whole wedge, so a row of its own rather than a third point.
    //
    // ⭐⭐ **It shows the EFFECTIVE aperture, authored or not** (his correction, 2026-08-17: *"if i'm
    // in auto and increase i don't start from 0, i start from current value and increase"*). A blank
    // box would have made the first press of a spinner jump to the minimum, which is the opposite of
    // a nudge. So the number on screen is what is on the page, and `reset` is what says "go back to
    // automatic" — the distinction the model keeps (absent vs authored) is reported in the row's
    // title and in the overrides dump below, not by an empty box.
    //
    // ⚠️ Its BOUNDS come from the snapshot, not from a constant here: the upper one depends on the
    // wedge's DRAWN length through the steepness cap (`authoredApertureRange`), so on a short wedge it
    // is well under the engine's nominal maximum. Offering a number the renderer would silently pull
    // back is a control that lies about what it did.
    const mouth = element.derived?.mouth as
      { value: number; authored: boolean; min: number; max: number } | null | undefined
    if (mouth) {
      wrap.appendChild(this.buildNumberRow(
        // ⭐ A 0.05-space step: the whole authorable range is half a space wide (1.5–2.0 at ordinary
        // lengths), so a quarter-space step would offer three stops in it.
        'mouth (sp)', mouth.value, 0.05, mouth.min, mouth.max,
        (aperture) => bus.hairpinGeometry.set({ hairpinId, aperture }),
        mouth.authored
          ? `how far the wedge opens — yours; reset returns it to the automatic width (${mouth.min}–${mouth.max})`
          : `how far the wedge opens — currently the automatic width for its length (${mouth.min}–${mouth.max})`,
      ))
    }
    return wrap
  }

  /**
   * ONE number plus a reset, in staff-spaces — the single-value sibling of {@link buildPointRow}.
   * A non-number puts the current value back rather than guessing, `reset` publishes `null` ("let the
   * engraver decide"), and a value outside `[min, max]` is CLAMPED before it is published: those
   * bounds are the caller's, and the caller knows why they are what they are.
   */
  private buildNumberRow(
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
  private buildPointRow(
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
      this.commitOnFirstStep(input, () => {
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
   * The "align to stem" toggle for a note's articulations. A checkbox: checked = stem-side marks
   * align to the stem (modern), unchecked = notehead (traditional default). Publishes `{id, align}`
   * to {@link bus.articulationStemAlign}; the controller holds the engine, the window does not.
   */
  /**
   * ⭐⭐ **WHICH WAY THIS NOTE'S FRACTIONAL BEAM POINTS** — his ask, 2026-09-01: *"on fractional beams
   * we should be able the user decide the direction… it is good the default like it is but it will
   * be good also have it on properties"*.
   *
   * ⭐ **`auto` is a real option and it is the FIRST**, because absent is what a score carries until
   * somebody overrides it: auto means the four treatises' metric rule
   * (`engine/engrave/beams/fractionalBeam`), ⛔ not "whatever it happens to look like now". Choosing
   * it back therefore *restores the engraved default* rather than freezing today's picture.
   *
   * ⚠️ The window is a DUMB PUBLISHER — it writes to `bus.fractionalBeamSide` and never touches the
   * engine, the boundary the trill, fan and hairpin rows all keep.
   */
  private buildFractionalBeamSideSelect(
    noteId: string,
    current: FractionalBeamSide | null,
  ): HTMLElement {
    const wrap = document.createElement('label')
    const ws = wrap.style
    ws.display = 'flex'
    ws.alignItems = 'center'
    ws.gap = '6px'
    ws.color = BISHOP
    ws.margin = '2px 0 4px'
    wrap.title =
      'Which side the short beam stub on this note points. Auto follows the beat it belongs to.'

    const caption = document.createElement('span')
    caption.textContent = 'fractional beam direction'
    wrap.appendChild(caption)

    const select = document.createElement('select')
    const ss = select.style
    ss.font = 'inherit'
    ss.color = BISHOP
    ss.background = 'transparent'
    ss.border = `1px solid ${BISHOP}`
    ss.borderRadius = '2px'
    ss.padding = '1px 4px'

    const options: Array<[string, string]> = [
      ['auto', 'auto'],
      ['left', 'left'],
      ['right', 'right'],
    ]
    for (const [value, text] of options) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = text
      if (value === (current ?? 'auto')) option.selected = true
      select.appendChild(option)
    }
    select.addEventListener('change', () => {
      const picked = select.value
      bus.fractionalBeamSide.set(noteId, picked === 'auto' ? null : (picked as FractionalBeamSide))
    })

    wrap.appendChild(select)
    return wrap
  }

  private buildStemAlignCheckbox(noteId: string, current: boolean): HTMLElement {
    const row = document.createElement('label')
    const rs = row.style
    rs.display = 'flex'
    rs.alignItems = 'center'
    rs.gap = '6px'
    rs.color = BISHOP
    rs.margin = '0 0 4px'
    rs.cursor = 'pointer'

    const input = document.createElement('input')
    input.type = 'checkbox'
    input.checked = current
    input.style.accentColor = BISHOP
    input.addEventListener('change', () => bus.articulationStemAlign.set(noteId, input.checked))
    row.appendChild(input)

    const label = document.createElement('span')
    label.textContent = 'align to stem'
    row.appendChild(label)
    return row
  }
}

/** The note/rest's current horizontal offset in staff-spaces (0 when none), read from the element's
 *  own overrides — the entry at whichever key the engine writes (the slot's, or a fanned MEMBER's
 *  own; `selectionSnapshot` resolves it through `offsetTargetOf`, so a member shows ITS number). */
/** A note's stored fractional-beam override, or null for auto (the metric rule). */
function currentFractionalBeamSide(element: InspectedElement): FractionalBeamSide | null {
  return (element.data as { fractionalBeamSide?: FractionalBeamSide }).fractionalBeamSide ?? null
}

/** ⚠️ Necessary, ⛔ not sufficient — see the call site: only a value that can BE a fraction of a
 *  coarser beam may carry a stub at all, but whether one is drawn depends on the beam group. */
function canCarryFractionalBeam(element: InspectedElement): boolean {
  const data = element.data as { duration?: string; isRest?: boolean }
  return !data.isRest && (data.duration === '16' || data.duration === '32')
}

function currentNoteOffset(element: InspectedElement): number {
  const entry = element.overrides?.find((o) => o.kind === 'noteOffset') as { x?: number } | undefined
  return entry?.x ?? 0
}

/** The dynamic's current offset in staff-spaces (0,0 when none), read from its own overrides — the
 *  same entry `nudgeDynamicOffset` accumulates into, so the panel and the arrow keys always agree
 *  about what is stored. */
function currentDynamicOffset(element: InspectedElement): { x: number; y: number } {
  const entry = element.overrides?.find((o) => o.kind === 'dynamicOffset') as
    { x?: number; y?: number } | undefined
  return { x: entry?.x ?? 0, y: entry?.y ?? 0 }
}

/** The tempo mark's current offset in staff-spaces (0,0 when none) — the reader above's twin, on the
 *  entry `nudgeTempoOffset` accumulates into. */
function currentTempoOffset(element: InspectedElement): { x: number; y: number } {
  const entry = element.overrides?.find((o) => o.kind === 'tempoOffset') as
    { x?: number; y?: number } | undefined
  return { x: entry?.x ?? 0, y: entry?.y ?? 0 }
}

/**
 * ⭐ **WHICH BOUNDARY a barline selection names** — the bar whose ENDING line it is, or `null` for the
 * score's opening edge.
 *
 * The two selections are the same line seen from either side: `barline` already IS that measure, and
 * a `repeatStart` opening bar *M* stands on the line ending bar *M−1*. ⛔ `undefined` — no control at
 * all — is impossible today and is kept as the total answer rather than a cast: every barline
 * selection resolves to a line.
 */
function boundaryOf(element: InspectedElement): number | null | undefined {
  const data = element.data as { endsMeasure?: number; opensMeasure?: number }
  if (data.endsMeasure !== undefined) return data.endsMeasure
  if (data.opensMeasure !== undefined) return data.opensMeasure > 1 ? data.opensMeasure - 1 : null
  return undefined
}

/**
 * The sign standing on the selected line, for the chooser to show as current.
 *
 * ⭐ Read from `derived.sign` — `selectionSnapshot` asks the DRAWING's own `signAtBoundary`, so the
 * panel and the page cannot disagree about what is there. ⛔ Not re-derived from `data`'s two stored
 * fields: that would be a third place computing the same precedence, and the one that would drift.
 *
 * ⚠️ A `repeatStart` selection has no `derived` — it is one stored statement and nothing is computed
 * from it — so the fallback is its own sign, which is what it is by definition.
 */
function currentBarlineSign(element: InspectedElement): BarlineSignKind {
  const derived = (element.derived as { sign?: BarlineSignKind } | undefined)?.sign
  if (derived) return derived
  return element.kind === 'repeatStart' ? 'repeatStart' : 'plain'
}

/** Whether the sign on the selected line is drawn with wings — `derived`, like the sign itself, and
 *  for the same reason: the flag rides whichever statements are standing there, so it is a fact about
 *  the LINE that no single stored field answers. */
function currentBarlineWinged(element: InspectedElement): boolean {
  return (element.derived as { winged?: boolean } | undefined)?.winged === true
}

/** The note's current articulation stem-align state (false when unset), read from its own object. */
function currentStemAlign(element: InspectedElement): boolean {
  return (element.data as { articulationStemAlign?: boolean }).articulationStemAlign === true
}

/**
 * JSON, or a plain description of why there isn't any. A `Fraction` beat, a Map, a cyclic reference
 * — anything the model holds that JSON cannot express must show as itself and not take the panel
 * down with it, because a debugging window that throws on the very object you were debugging is
 * worse than useless.
 */
function stringify(data: unknown): string {
  try {
    return JSON.stringify(data, null, 2) ?? String(data)
  } catch (err) {
    return `[unserializable: ${err instanceof Error ? err.message : String(err)}]`
  }
}
