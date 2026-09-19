#!/usr/bin/env node
/**
 * `npm run lint:paint` — ⭐⭐ **THE MIGRATION'S PROGRESS BAR, AS A RATCHET**
 * (`docs/own-engraving-engine.md` P1b, and rule 10's *"its LOC is the migration's progress bar"*).
 *
 * ## THE FACT it protects
 *
 * Since P1b the engine draws through **our own** `paint/DrawContext`, and what still requires
 * VexFlow's context specifically is spelled `vexContext` (`rendering/RenderPass`) or names
 * `SVGContext` / `RenderContext` outright. That residue is the work left in P3–P5, and it has
 * exactly one legitimate direction: **down**.
 *
 * ⚠️ **Why a script and not a promise.** The same document measured, on 2026-09-01, that in the 16
 * days after the plan was written `engine/rendering/` grew 39%, the files naming a VexFlow type went
 * 31 → 45, and `ctx: SVGContext` parameters 21 → 28 — while every *stated* rule was being kept. The
 * growth was invisible because there was no number anyone was scheduled to look at. A design claim
 * ("the engine draws through our own context") cannot rot, because the types enforce it; a repo
 * claim ("only these N files still need VexFlow's") can, so it gets a check.
 *
 * 🚨 And the sharper lesson from the same measurement: rule 9's stated trigger — *"or sooner, the
 * next time a coordinate field is added to `ElementInfo`"* — fired FOUR times and nobody noticed.
 * **A trigger nobody is scheduled to check is a trigger that does not fire.**
 *
 * ## THE RULE
 *
 * 1. ⛔ **A file not on the allowlist may not name `SVGContext` / `RenderContext`, or use
 *    `vexContext`.** A new drawn element draws through `DrawContext` (rule 1). Adding a file here
 *    is a decision, and it should be an uncomfortable one.
 * 2. ⛔ **The `vexContext` count may not rise.** Each is either a VexFlow object painting itself
 *    (P3/P4 territory) or a reach past the surface into the page.
 * 3. ⛔ **The `svgNode` count may not rise** (P1c). A group is now a {@link DrawGroup} — a placement,
 *    an ink box, a discard, two tags — and `svgNode` is the one way back to the DOM element. Every
 *    use is either the EDITOR being handed ink to highlight later, or a recolour/hide done through
 *    the page. ⭐ Both are real seams; ⛔ neither is a capability the SCENE will need.
 *
 * ## 🚨🚨 WHAT THIS NUMBER IS NOT — measured 2026-09-14, and it cost a whole migration step
 *
 * It counts the identifier `vexContext`. ⛔ **It is not a measure of how much VexFlow ink is left.**
 * A `StaveNote`'s MODIFIERS — every accidental, every augmentation dot, every articulation — take
 * their context from `StaveNote.drawModifiers`, which reads `checkContext()`; the word `vexContext`
 * appears nowhere near them. So they were VexFlow ink through P3, P4, P5 and U1, while this gauge
 * fell 24 → 9 without ever having seen them (`docs/note-engraving-plan.md` §1f, §1g) — and taking
 * all three back moved it by ZERO, which is the same statement from the other side.
 *
 * ⭐ The measure of INK is the SCENE: render, and diff the page's primitives against the recorded
 * ones. That census lives in `VexFlowRenderer.scene.test.ts` and it is the number to trust for
 * *"how much is left"*. ⇒ **this file measures COUPLING** — how many places still need VexFlow's own
 * context — which is what a ratchet can enforce, and it is the only claim it makes.
 *
 * ⭐ Both numbers are expected to fall to zero. When they do, `paint/` can be given an implementation
 * that is not VexFlow's, and `scene/` a recording one — which is the golden net P3 is gated on.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = 'src'
const DOC = 'docs/own-engraving-engine.md'

/**
 * The files still entitled to VexFlow's own context, and WHY each one is — because a list with no
 * reasons is a list nobody can shorten.
 *
 * ⛔ Adding a row is not a formality: it says a new piece of drawing could not be expressed through
 * `DrawContext`, which is a finding worth writing down in the plan doc, not a lint fix.
 */
/** ⭐ S13b (2026-09-19): EMPTY — our `rendering/SvgPainter` stands behind every surface, and no file names
 *  VexFlow's render context any more. The check stays so that none ever does again. */
const ALLOWED = new Map([])

/** ⚠️ The ceilings, not targets. Lower one when a migration lands; ⛔ never raise either.
 *  ⭐ 24 → 18 when this check stopped counting comment lines (see {@link isComment}) — the residue
 *  did not shrink, the measurement got honest.
 *  ⭐⭐ 18 → 9 with **U1** (2026-09-14), the curve's ink: the first step to move this number at all,
 *  because P3, P4 and P5 took the ink of objects that go on painting through it. What is left is
 *  FIVE painting uses — the beam's and the stem's `.draw()` plumbing, and the fan's three (U2,
 *  blocked on U3's highlight) — plus FOUR `.svg` read-backs, which are measurement escapes and not
 *  a painter's problem at all. ⇒ ⭐ the only VexFlow object still painting its own INK is the fan's
 *  bare `NoteHead`s and `Accidental`s.
 *  ⭐ 9 → 7 with **S10** (2026-09-18, `docs/vexflow-removal-map.md`): the fan paints on `pass.context` —
 *  its member heads (`engrave/notes/noteheads`), signs and articulations (`glyphPainter`), prefix stems
 *  (`EngravedStem.drawWithStyleOn`) and ramp — and `FanPass` left the allowlist. ⇒ no VexFlow object
 *  paints its own INK on VexFlow's context any more.
 *  ⚠️ `svgNode` 10 → **11** in the same step, and it is not growth: the member group was ALREADY handed
 *  to the editor as a DOM node (`fanMemberGroupMap`), through an uncounted `as unknown as SVGGElement`
 *  cast of VexFlow's `openGroup`. Opening it on our surface makes that escape the counted one, like
 *  the hairpin's and the slur's — the map predicted exactly this (S10 row).
 *  ⭐ S11e (2026-09-19): the ghosts leave the allowlist — every one is built from our own classes and
 *  takes a `DrawContext`. ⚠️ `svgNode` 11 → **12** for the same reason as S10's: the tie ghost recolours
 *  its arc's two paths through the page, and used to reach them through an UNCOUNTED `as SVGGElement`
 *  cast of VexFlow's `openGroup`; on our surface that escape is the counted one.
 *  ⚠️ 12 → **13** with S12a: the selection highlight found the tuplet's group through VexFlow's
 *  `getSVGElement` (a document-wide `getElementById`); `ScoreTuplet` now keeps the group it opened, and
 *  handing that to the editor is this escape.
 *  ⚠️ 13 → **14** with S12g, the same case: the dynamics' annotation kept its `getSVGElement` for the
 *  seven layout passes and the highlight that read it, now answering the group it opened.
 *  ⚠️ 14 → **15** with S12i, the same case: the stem's `getSVGElement` (the highlight's stem).
 *  ⚠️ 15 → **16** with S12j-d3, the same case again: the NOTE's `getSVGElement` (the highlight's note —
 *  VexFlow's inherited `Element.getSVGElement` answered it by a `document.getElementById` no count saw). */
const VEX_CONTEXT_CEILING = 0
/*  ⭐⭐ 7 → **0** with **S13b** (2026-09-19): `RenderPass.vexContext` became `painter`, our own `SvgPainter`
 *  — the beam's and stem's draws, the four `.svg` read-backs and the ink rewinds all reach OUR painter. */
/** ⭐ P1c's number: the group handle's escape hatch to a real DOM node. */
const SVG_NODE_CEILING = 16

const NAMES = /\b(SVGContext|RenderContext|vexContext)\b/

/**
 * ⚠️ **COMMENTS DO NOT COUNT, and learning that was worth a paragraph.**
 *
 * The first version of this check matched any line, so the moment `engine/scene/` was written — a
 * module whose whole doc comment is *about* the VexFlow residue and quotes the number — the count
 * "rose" from 24 to 28 and two files that draw nothing at all were reported as offenders.
 *
 * 🚨 A ratchet that punishes writing down WHY is a ratchet people route around by not explaining
 * themselves, which costs far more than it protects. So the residue is measured in CODE, and prose
 * about the residue is free — which is what lets the argument live next to the thing it argues about.
 */
function isComment(line) {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')
}

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) out.push(full)
  }
  return out
}

const offenders = []
let vexContextUses = 0
let svgNodeUses = 0

for (const file of walk(SRC)) {
  const rel = relative(SRC, file).split('\\').join('/')
  const text = readFileSync(file, 'utf8')
  const lines = text.split('\n')
  // `vexContext` is counted everywhere it is USED, including in allowed files — the point of the
  // ceiling is the total amount of coupling, not how many files hold it.
  const code = lines.map(l => (isComment(l) ? '' : l))
  if (rel !== 'engine/rendering/RenderPass.ts') {
    vexContextUses += code.filter(l => /\bvexContext\b/.test(l)).length
  }
  // The escape's own definition does not count against its ceiling.
  if (rel !== 'engine/rendering/svgDrawGroup.ts') {
    svgNodeUses += code.filter(l => /\bsvgNode\(/.test(l)).length
  }
  if (ALLOWED.has(rel)) continue
  const hit = code.findIndex(l => NAMES.test(l))
  if (hit >= 0) offenders.push(`${rel}:${hit + 1}  ${lines[hit].trim().slice(0, 96)}`)
}

let failed = false

if (offenders.length) {
  failed = true
  console.error(`\n✗ ${offenders.length} file(s) name a VexFlow render context outside the allowlist.\n`)
  for (const o of offenders) console.error(`    ${o}`)
  console.error(`
  A new drawn element draws through OUR context: import \`DrawContext\` from
  '@/engine/paint/DrawContext' and take that. To stamp a glyph, use \`rendering/glyphPainter\`.

  If the drawing genuinely cannot be expressed that way, that is a FINDING — write it in
  ${DOC} and add a row (with its reason) to ALLOWED in this script.
`)
}

if (vexContextUses > VEX_CONTEXT_CEILING) {
  failed = true
  console.error(`
✗ \`vexContext\` is used ${vexContextUses} times; the ceiling is ${VEX_CONTEXT_CEILING}.

  Every use is a VexFlow object painting itself (P3/P4) or a reach past the drawing surface
  into the page. The number goes DOWN. See ${DOC} P1b.
`)
}

if (svgNodeUses > SVG_NODE_CEILING) {
  failed = true
  console.error(`
✗ \`svgNode\` is used ${svgNodeUses} times; the ceiling is ${SVG_NODE_CEILING}.

  A group is a DrawGroup: setPlacement / inkBox / discard / tag / tagLast. Reach for the DOM
  element only to hand drawn ink to the EDITOR, or to recolour it through the page — and if
  you are doing something else, it wants a capability on DrawGroup instead. See ${DOC} P1c.
`)
}

if (failed) process.exit(1)

console.log(
  `✓ ${ALLOWED.size} files still entitled to VexFlow's context, ` +
  `${vexContextUses}/${VEX_CONTEXT_CEILING} \`vexContext\` uses, ` +
  `${svgNodeUses}/${SVG_NODE_CEILING} \`svgNode\` escapes. ` +
  `Everything else draws through DrawContext and DrawGroup.`,
)
