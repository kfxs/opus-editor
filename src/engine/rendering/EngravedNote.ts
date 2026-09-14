/**
 * ⭐⭐ **THE SEAM WHERE THE NOTE'S INK COMES BACK TO US, ONE PIECE AT A TIME** —
 * `docs/own-engraving-engine.md` P3, `docs/note-engraving-plan.md`.
 *
 * `StaveNote.draw()` is five things in a fixed order: ledger lines, stem, noteheads, flag, pointer
 * rect. P3 is the work of moving those five to our own primitives, and it cannot be done in one
 * commit — `Stave`/`StaveNote` are also the RULER seven of our own renderers read
 * (`docs/own-engraving-engine.md` §2.3), so the object has to keep answering while its ink moves.
 *
 * ⭐ **This subclass is that seam, and it is the whole mechanism**: the note stays VexFlow's, and
 * each override empties one of the five. ⛔ It is not a monkeypatch — the audit names the live
 * `getModifierStartXY` patch as *"the shape of the whole problem"* (§2.4), and the difference is
 * that this is typed, one file, and reversible by deleting a method.
 *
 * ⭐⭐ **The override list below IS the progress bar**, the same one `npm run lint:paint` reports from
 * the other side and the same one the SCENE's coverage reports from the third:
 *
 * | part of the note | drawn by | since |
 * |---|---|---|
 * | **ledger lines** | ⭐ **us** — `engrave/notes/ledgerLines` | P3a, 2026-09-01 |
 * | **stem** (the INK; ⛔ not its LENGTH) | ⭐ **us** — `engrave/notes/stem`, via {@link EngravedStem} | P3c, 2026-09-01 |
 * | **noteheads** | ⭐ **us** — `engrave/glyph`'s stamp | P3d, 2026-09-01 |
 * | **flag** | ⭐ **us** — `engrave/notes/flag` | P3b, 2026-09-01 |
 * | the pointer rect | VexFlow | ⏭️ P3 (it is `getBoundingBox`, and that is the ruler, not the ink) |
 *
 * ## 🚨🚨 THE STANDING RULE THIS FAMILY LIVES OR DIES BY — **the object keeps ANSWERING**
 *
 * Emptying a `draw()` also removes whatever that draw WROTE, and VexFlow writes position as a side
 * effect of painting: `drawFlag` is `setX(...).setY(...).drawWithStyle()`, `NoteHead.draw` sets its
 * own `x`, `Accidental.draw` writes `this.x`/`this.y`. Every one of those fields is then read by
 * `getBoundingBox()` — the RULER this whole file exists to keep intact.
 *
 * ⇒ **an override that takes the ink must reproduce the write-back**, and {@link EngravedNote.drawFlag}
 * carries the cost of learning it: for thirteen days an unbeamed flagged note reported a bounding box
 * merged with the ORIGIN, and the symptom that surfaced it was a SLUR arching 361 px off the page
 * (his report, 2026-09-14). ⭐ A missing write-back is silent in the picture and loud everywhere the
 * geometry is read — which is the opposite of where you look.
 *
 * ⚠️ **Not every `StaveNote` in the app is one of these.** `GhostRenderer` builds plain ones for the
 * cursor preview, and they keep VexFlow's ledger drawing — deliberately, because §7.2 says a ghost
 * is *"a scene with a style"* and most of those 1,217 lines are deletion rather than migration. The
 * two pictures are identical today (this commit moved no pixel), so there is nothing to drift yet;
 * ⏭️ the moment a ledger number changes, the ghost has to come with it.
 */
import { StaveNote, Stem } from 'vexflow'
import { LEDGER_OVERHANG_PX, STEM_THICKNESS_PX } from '@/engine/engrave/inheritedDefaults'
import { NOTE_FONT } from '@/engine/engrave/inheritedFonts'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { ledgerLineRuns, drawLedgerLines } from '@/engine/engrave/notes/ledgerLines'
import { flagPlacement, drawFlag } from '@/engine/engrave/notes/flag'
import { drawStem } from '@/engine/engrave/notes/stem'
import { drawNoteHead } from '@/engine/engrave/notes/noteheads'
import { acceptsInkSurface } from './inkSurface'
import { staveFrame } from './staveFrame'
import { noteLineY } from '@/engine/engrave/staff/staffFrame'

/**
 * ⭐⭐ **THE STEM'S HALF OF THE SEAM — P3c.** A `Stem` that strokes its line through OUR primitives
 * (`engrave/notes/stem`) instead of VexFlow's context.
 *
 * ⭐ **A subclass, because every number `Stem.draw` reads is `protected`** — `xBegin`/`xEnd`,
 * `yTop`/`yBottom`, the two y-offsets, the two base offsets, `renderHeightAdjustment`, the stemlet
 * pair. Reaching them from outside would be a cast per field; from inside it is ordinary access,
 * and the expression below is VexFlow's own, moved rather than rewritten.
 *
 * 🚨🚨 **The group is load-bearing and its ID is the whole seam.** The editor finds a stem's ink with
 * `note.getStem().getSVGElement()`, which is `document.getElementById(prefix(attrs.id))`, and then
 * recolours `querySelectorAll('path, line')` inside it (`HighlightController.applyStemHighlight`).
 * ⛔ So this override must open `openGroup('stem', this.getAttribute('id'))` exactly as VexFlow did:
 * drop the id and stem selection silently stops painting, with nothing failing.
 *
 * ⛔ **The LENGTH is still VexFlow's** — see `engrave/notes/stem`'s header. P3c is the ink.
 */
export class EngravedStem extends Stem {
  /** @see EngravedNote.inkSurface — set by {@link drawNoteInkThrough}, via the note that owns it. */
  private inkSurface: DrawContext | null = null

  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  override draw(): void {
    this.setRendered()
    if (this.hide) return
    const ctx = this.inkSurface ?? this.checkContext()

    // ⚠️ VexFlow's own arithmetic, transcribed with its branches intact — ⛔ not a rule of ours, and
    // deliberately not tidied into one: which x and which y a stem starts from is exactly the part
    // `docs/stem-length-research.md` is being written to replace.
    const down = this.stemDirection === Stem.DOWN
    const x = down ? this.xBegin : this.xEnd
    const from = down ? this.yTop + this.stemDownYOffset : this.yBottom - this.stemUpYOffset
    const baseOffset = down ? this.stemDownYBaseOffset : this.stemUpYBaseOffset
    const height = this.getHeight()
    // A STEMLET is the stub a beamed rest hangs off — it starts short of the noteheads.
    const stemletOffset = this.isStemlet ? height - this.stemletHeight * this.stemDirection : 0

    ctx.openGroup('stem', this.getAttribute('id'))
    try {
      drawStem(ctx, {
        x,
        fromY: from - stemletOffset + baseOffset,
        toY: from - height - this.renderHeightAdjustment * this.stemDirection,
      }, STEM_THICKNESS_PX)
    } finally {
      ctx.closeGroup()
    }
  }
}

export class EngravedNote extends StaveNote {
  /**
   * The surface this note's OWN ink draws on — `RenderPass.context`, which is the recorder during a
   * `recordScene` render and the real painter otherwise. Read by every override above.
   *
   * ⭐ It is a field rather than a parameter because `draw()` is VexFlow's and takes none. Null until
   * {@link drawNoteInkThrough} sets it, and then the note falls back to `checkContext()` — the same
   * object the rest of `draw()` uses, so an unset surface is a lost SCENE entry and ⛔ never a lost
   * pixel.
   */
  private inkSurface: DrawContext | null = null

  /** The centre x of each head's stamped glyph, filled by {@link EngravedNote.drawNoteHeads} and
   *  read by {@link EngravedNote.headCentreX}. ⚠️ Indexed as `keys` are, and only valid after a draw. */
  private drawnHeadCentreX: number[] = []

  /**
   * How far this note's ledger lines run past its heads, in px — the inherited default
   * ({@link LEDGER_OVERHANG_PX}, 3), ⛔ **not** the font's `legerLineExtension` (0.4 spaces = 4 px);
   * the alternatives are `docs/ledger-line-length-research.md`'s preset rows.
   */
  private ledgerOverhang: number = LEDGER_OVERHANG_PX

  /**
   * ⭐ P3c — the note's stem is one of ours, so its ink comes back with the rest.
   *
   * ⚠️ Called from `StaveNote`'s CONSTRUCTOR, before this subclass's own field initialisers have
   * run — so it may touch nothing but `this.isRest()`, which is the base's. That is also why
   * {@link EngravedStem.setInkSurface} is a later call rather than a constructor argument.
   */
  override buildStem(): this {
    this.setStem(new EngravedStem({ hide: this.isRest() }))
    return this
  }

  /** @see EngravedNote.ledgerOverhang — the accidental clearance's one lever. */
  setLedgerOverhang(px: number): void {
    this.ledgerOverhang = px
  }

  /** @see EngravedNote.inkSurface */
  setInkSurface(ctx: DrawContext): void {
    this.inkSurface = ctx
  }

  /**
   * ⭐ **OURS as of P3a.** The rule and the ink both live in `engrave/notes/ledgerLines`; everything
   * this override does is hand that module what only a `StaveNote` can answer — where its heads
   * landed, how wide its glyph is, and which y a staff line is at.
   *
   * ⚠️ Called from inside VexFlow's `draw()`, **after** it has opened the note's own `vf-stavenote`
   * group and set every head's x. Both matter: the group is what the selection highlight recolours,
   * so ink drawn here is highlighted with the note for free, and the head x's are only settled at
   * that moment (`reference: vexflow geometry is only real after draw`).
   */
  override drawLedgerLines(): void {
    if (this.isRest()) return
    const stave = this.checkStave()
    const frame = staveFrame(stave)
    const runs = ledgerLineRuns(
      this.noteHeads.map(head => ({ line: head.getLine(), x: head.getAbsoluteX() })),
      this.getGlyphWidth(),
      this.ledgerOverhang,
    )
    drawLedgerLines(
      this.inkSurface ?? this.checkContext(),
      runs,
      line => noteLineY(frame, line),
      // The stave's ledger style with this note's own on top — VexFlow's own merge, kept because
      // `hiddenElements` recolours a note by that second half.
      { ...stave.getDefaultLedgerLineStyle(), ...this.getLedgerLineStyle() },
    )
  }

  /**
   * ⭐ **OURS as of P3b.** The rule is `engrave/notes/flag`: *the flag's outer edge meets the stem
   * tip, on the stem's own x.* Everything here is the adapter's half — the four numbers only a
   * `StaveNote` can answer.
   *
   * ⚠️ `shouldDrawFlag()` stays VexFlow's and is not second-guessed: it is `hasStem && hasFlagGlyph
   * && !beam && !isRest`, and the `!beam` half is load-bearing in this editor — a fanned slot wears
   * a PLACEHOLDER beam precisely so its flag is suppressed, and `applyTremoloStemStretch` keys off
   * the same predicate.
   *
   * 🚨 **`getTextMetrics()` is a runtime `measureText`** — §3's bug class — and P3b's whole
   * contribution is that it now leaves this file as a NAMED ARGUMENT instead of hiding inside a draw
   * method. ⛔ Not re-sourced: swapping it for `fonts/flagDropFromTip` is a measurement to make
   * first (`docs/note-engraving-plan.md` §3.3), and P3b moved no pixel.
   */
  /**
   * ⭐ **OURS as of P3d — and it is the last of the five drawing calls.**
   *
   * ⚠️ **An override of `drawNoteHeads`, ⛔ not a `NoteHead` subclass**, which is the shape the stem
   * got. `buildNoteHeads()` is overridable, but the `new NoteHead(…)` inside it sits at the bottom of
   * forty lines of VexFlow's own second-interval displacement walk — and *"port the ALGORITHM, not
   * the FILE"* (§6.7) cuts both ways: copying that loop to change one constructor would re-import
   * the dependency under another name. So the head objects stay VexFlow's and only their INK moves.
   *
   * ⭐ The body is `NoteHead.draw()` (`notehead.js`) wrapped in `Element.drawWithStyle()`, both
   * transcribed rather than rewritten:
   *
   * 1. 🚨 **`setX(getAbsoluteX())` is a WRITE-BACK, and it is load-bearing.** `FanPass` already
   *    carries the warning — *"`NoteHead.draw` writes its own absolute x back into `x`, so a
   *    displaced head asked twice displaces twice"*. It must happen exactly once, here.
   * 2. ⚠️ **`drawModifiers` stays INSIDE the head's group.** That is where a chord's accidentals,
   *    dots and articulations land, and the selection highlight recolours by walking that group.
   * 3. ⚠️ **The style wrapper stays on the VexFlow context.** `drawWithStyle` is `save` → `applyStyle`
   *    → `draw` → `restore`, and `applyStyle` can reach for shadow primitives that {@link DrawContext}
   *    deliberately does not declare. Nothing in this editor styles a notehead (`setStyle` is unused
   *    here — every recolour goes through the DOM afterwards), so this is fidelity rather than need.
   * 4. 🚨 **The group's id is the seam**, exactly as it was for the stem: `g.vf-notehead` is read by
   *    the highlight and by a dozen browser specs (`glyphs('g.vf-notehead text')`).
   *
   * ⛔ **What is NOT taken**: which glyph a duration gets. `fonts/noteheadGlyph()` has answered that
   * from Bravura since P2, so it is a fourth *"the room reserved and the ink drawn come from two
   * sources"* candidate — ⛔ and, like the other three, his call rather than a tidy-up.
   */
  override drawNoteHeads(): void {
    const vex = this.checkContext()
    const surface = this.inkSurface ?? vex
    this.drawnHeadCentreX = []
    for (const [index, head] of this.noteHeads.entries()) {
      head.setContext(vex)
      vex.save()
      head.applyStyle(vex)
      head.setRendered()
      try {
        // 🚨 ONCE, and once only — see (1) above. ⚠️ And the value is KEPT rather than read back
        // with `getX()`: a `NoteHead` is a `Tickable`, whose `getX()` throws `NoTickContext` — which
        // is exactly why `NoteHead.draw` reads the raw `x` field instead. (It threw here first.)
        const x = head.getAbsoluteX()
        head.setX(x)
        const originX = x + head.getXShift()
        // ⭐ WHERE THIS HEAD ACTUALLY LANDED — see {@link EngravedNote.headCentreX}.
        this.drawnHeadCentreX[index] = originX + head.getWidth() / 2
        // ⭐ The ink itself is `engrave/notes/noteheads`, shared with `FanPass` — see that module's
        // header for why a second owner was what earned it a module.
        drawNoteHead(surface, {
          id: head.getAttribute('id'),
          glyph: head.getText(),
          x: originX,
          y: head.getY() + head.getYShift(),
          font: NOTE_FONT,
        }, () => this.drawModifiers(head))
      } finally {
        vex.restore()
      }
    }
  }

  /**
   * ⭐⭐ **WHERE EACH HEAD'S INK ACTUALLY LANDED**, indexed as `keys` are — the centre of the glyph
   * this note stamped, ⛔ not a position re-derived from the note afterwards.
   *
   * 🚨 **His report, 2026-09-14**: in a chord C♯4+E4+G4+A♭4+C♯5 the **A♭4 is a SECOND above the
   * G4**, so VexFlow displaces its head to the other side of the stem — and clicking that head
   * selected the whole MEASURE instead of the note. The registry was filing ONE head centre
   * (`getNoteHeadBeginX()`…`getNoteHeadEndX()`, which is the note's undisplaced column) against
   * EVERY pitch of the chord, so the displaced head's hit box sat a notehead-width away from its
   * own ink. ⭐ Exactly *"a hit box written from a constant drifts off its glyph — ask the DRAWN
   * element, in ink"*.
   *
   * ⚠️ **⛔ And it may NOT be re-derived by asking the head again**: `NoteHead.getAbsoluteX()` folds
   * the displacement in every time it is called, so a second call displaces twice — the same trap
   * the `setX` write-back above carries. ⇒ the drawn value is recorded once, here, as it is drawn.
   *
   * @returns undefined before this note has been drawn, so a caller falls back rather than reads a
   *   position nothing painted.
   */
  headCentreX(index: number): number | undefined {
    return this.drawnHeadCentreX[index]
  }

  override drawFlag(): void {
    if (!this.shouldDrawFlag()) return
    const { yTop, yBottom } = this.getNoteHeadBounds()
    const up = this.getStemDirection() !== Stem.DOWN
    // ⚠️ `Stem.getHeight()` is SIGNED by the stem's direction, which is what lets one subtraction
    // answer both ways up — VexFlow spells it as two branches and this is the same arithmetic.
    const tipY = (up ? yBottom : yTop) - this.checkStem().getHeight()
    const metrics = this.flag.getTextMetrics()
    const reach = up ? metrics.actualBoundingBoxAscent : metrics.actualBoundingBoxDescent
    const at = flagPlacement({ x: this.getStemX(), tipY, up }, STEM_THICKNESS_PX, reach)

    // 🚨🚨 **THE WRITE-BACK, and it is the whole reason this class keeps the object.** VexFlow's own
    // `drawFlag` is `this.flag.setContext(ctx).setX(flagX).setY(flagY).drawWithStyle()` — the
    // position is written ONTO the `Flag` as a side effect of painting it, and
    // `StaveNote.getBoundingBox()` then merges `this.flag.getBoundingBox()` whenever `hasFlag()`
    // (⭐ which is false for a BEAMED note — `codeFlagUp !== undefined && !this.beam`, so only an
    // unbeamed flagged note ever consults it).
    //
    // ⛔ Taking the INK without the write-back left the flag at the ORIGIN, and an `Element`'s box
    // is `(x + xShift, y + yShift − ascent, …)` ⇒ every eighth, sixteenth and thirty-second that is
    // not beamed reported a box merged with (0, −ascent): measured on his score at
    // `{x: 0, y: −33, w: 258, h: 122}` — the whole system. HIS REPORT, 2026-09-14, was the SLUR:
    // the obstacle solver read that box as an intrusion spanning the bar and lifted the arch 361 px.
    // ⭐ *A `Modifier` drawn at explicit coordinates without its own x/y drags a note's bbox to
    // zero* was already a written rule here (`reference: vexflow modifier bbox needs x y`), and
    // `EngravedAccidental`, `EngravedDot` and the notehead's `setX` above all obey it; this was the
    // one member of the family that stopped painting without keeping its answer.
    //
    // ⚠️ The numbers are VexFlow's own, not a re-derivation: `flagPlacement` folds its two branches
    // into one subtraction, and `STEM_THICKNESS_PX` is `Tables.STEM_WIDTH`'s 1.5. ⇒ the box is what it was.
    this.flag.setX(at.x)
    this.flag.setY(at.baselineY)

    drawFlag(
      this.inkSurface ?? this.checkContext(),
      this.flag.getText(),
      at,
      // ⭐ The note's face, which its flag shares (`engrave/inheritedFonts`) — handed over as a value,
      // which is what keeps `engrave/` free of `vexflow` (see that module's header).
      NOTE_FONT,
    )
  }
}

/**
 * Point every note of a bar at the surface its own ink draws on, before the voices are drawn.
 *
 * ⭐ **Why the renderer has to say this at all**: `voice.draw(ctx, stave)` hands VexFlow the real
 * `SVGContext` — it has to, because VexFlow's objects still paint themselves through it — and a note
 * that took its ledger surface from there would be invisible to `recordScene`. This is the one line
 * that keeps the ink we have taken back inside the scene.
 *
 * Takes `StaveNote[]` because that is what every caller holds; a plain one (a ghost's) is skipped and
 * keeps drawing its own ledgers.
 */
export function drawNoteInkThrough(notes: readonly StaveNote[], ctx: DrawContext): void {
  for (const note of notes) {
    if (note instanceof EngravedNote) note.setInkSurface(ctx)
    const stem = note.getStem()
    if (stem instanceof EngravedStem) stem.setInkSurface(ctx)
    // ⭐ …and every MODIFIER that can take one — the accidental, the augmentation dot and the
    // ARTICULATION (all 2026-09-14). ⚠️ Asked as a MEMBERSHIP, ⛔ not as a third, fourth and fifth
    // `instanceof`: that is the family `./inkSurface` exists for, and joining it is what a new one
    // implements — the articulation joined it by adding a row and nothing else. A modifier that
    // does not (a `CenteredTremolo`, an `Annotation`) keeps painting itself on VexFlow's context,
    // which is the honest state of the migration.
    for (const modifier of note.getModifiers()) {
      if (acceptsInkSurface(modifier)) modifier.setInkSurface(ctx)
    }
  }
}

/**
 * Shorten a note's ledger lines — the one thing anybody adjusts about them
 * (`./ledgerAccidentalClearance`: *"an expert engraver will shorten a ledger line to allow closer
 * spacing with accidentals"*).
 *
 * ⚠️ It used to be a poke at `renderOptions.strokePx`, one of §2.4's *"renderOptions written as a
 * field, not an API"* repairs. A plain `StaveNote` (the ghost's) still needs that poke, because its
 * ledgers are still VexFlow's — ⛔ that branch is the honest state of the migration, not a fallback
 * for a value we could not compute.
 */
export function trimLedgers(note: StaveNote, overhang: number): void {
  if (note instanceof EngravedNote) note.setLedgerOverhang(overhang)
  else (note.renderOptions as { strokePx?: number }).strokePx = overhang
}
