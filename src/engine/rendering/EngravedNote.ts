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
 * | stem | VexFlow | ⏭️ P3 — ⚠️ it drags the stem SELECTION with it (the highlight resolves a stem by its own SVG element) |
 * | noteheads | VexFlow | ⏭️ P3 — and each head paints its own modifiers |
 * | **flag** | ⭐ **us** — `engrave/notes/flag` | P3b, 2026-09-01 |
 * | the pointer rect | VexFlow | ⏭️ P3 (it is `getBoundingBox`, and that is the ruler, not the ink) |
 *
 * ⚠️ **Not every `StaveNote` in the app is one of these.** `GhostRenderer` builds plain ones for the
 * cursor preview, and they keep VexFlow's ledger drawing — deliberately, because §7.2 says a ghost
 * is *"a scene with a style"* and most of those 1,217 lines are deletion rather than migration. The
 * two pictures are identical today (this commit moved no pixel), so there is nothing to drift yet;
 * ⏭️ the moment a ledger number changes, the ghost has to come with it.
 */
import { StaveNote, Stem } from 'vexflow'
import type { DrawContext } from '@/engine/paint/DrawContext'
import { ledgerLineRuns, drawLedgerLines } from '@/engine/engrave/notes/ledgerLines'
import { flagPlacement, drawFlag } from '@/engine/engrave/notes/flag'

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

  /**
   * How far this note's ledger lines run past its heads, in px. VexFlow's own default, kept exactly
   * ({@link StaveNote.LEDGER_LINE_OFFSET}, 3) — ⛔ **not** the font's `legerLineExtension` (0.4
   * spaces = 4 px), which is open taste call #5 and his to make (`docs/font-metrics-plan.md` §3.6).
   */
  private ledgerOverhang: number = StaveNote.LEDGER_LINE_OFFSET

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
    const runs = ledgerLineRuns(
      this.noteHeads.map(head => ({ line: head.getLine(), x: head.getAbsoluteX() })),
      this.getGlyphWidth(),
      this.ledgerOverhang,
    )
    drawLedgerLines(
      this.inkSurface ?? this.checkContext(),
      runs,
      line => stave.getYForNote(line),
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
  override drawFlag(): void {
    if (!this.shouldDrawFlag()) return
    const { yTop, yBottom } = this.getNoteHeadBounds()
    const up = this.getStemDirection() !== Stem.DOWN
    // ⚠️ `Stem.getHeight()` is SIGNED by the stem's direction, which is what lets one subtraction
    // answer both ways up — VexFlow spells it as two branches and this is the same arithmetic.
    const tipY = (up ? yBottom : yTop) - this.checkStem().getHeight()
    const metrics = this.flag.getTextMetrics()
    const reach = up ? metrics.actualBoundingBoxAscent : metrics.actualBoundingBoxDescent
    drawFlag(
      this.inkSurface ?? this.checkContext(),
      this.flag.getText(),
      flagPlacement({ x: this.getStemX(), tipY, up }, Stem.WIDTH, reach),
      // ⭐ The face VexFlow resolved for this note when it built the flag — handed over as a value,
      // which is what keeps `engrave/` free of `vexflow` (see that module's header).
      this.flag.fontInfo,
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
