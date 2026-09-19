#!/usr/bin/env node
/**
 * `npm run lint:vexflow` — ⭐⭐ **HOW MUCH OF VexFlow IS LEFT, COUNTED, AS A RATCHET**
 * (`docs/vexflow-removal-map.md` step S0).
 *
 * ## THE FACT it protects
 *
 * The priority is removing the VexFlow dependency (`docs/own-engraving-engine.md` §0.2), and the
 * removal map counted it: every use of VexFlow outside the tests, resolved by the TypeScript checker
 * to the declaration it really lands on, and sorted into seven ROLES. Each removal step lowers one
 * or more of those numbers, and ⛔ none of them may ever rise.
 *
 * ## 🚨 Why the COMPILER, and not a grep
 *
 * Our own classes reuse VexFlow's method names on purpose — `ElementRegistry` has geometry readers,
 * the `Engraved*` subclasses override `draw()` — so a text search for `getYForLine` or
 * `getBoundingBox` counts ours with theirs. Here a use counts only when its symbol's declaration
 * lives under `node_modules/vexflow`. A call that resolves to OUR override is not a VexFlow use,
 * and is not counted.
 *
 * ## 🚨 And why a ratchet at all — `lint:paint` is the lesson
 *
 * `lint:paint` fell 24 → 9 while every accidental, dot and articulation on the page was still
 * VexFlow ink it could not see. *A ceiling nobody re-measured reads as coverage.* It measures
 * coupling to VexFlow's CONTEXT, which is 7% of the dependency; this measures all of it.
 *
 * ## THE RULE
 *
 * 1. ⛔ **No role's count may rise above its ceiling.** A new feature does not reach for VexFlow
 *    (`docs/own-engraving-engine.md` rule 1).
 * 2. ⛔ **Every use must fall in a role.** An UNCLASSIFIED use is a new kind of dependency, and the
 *    classifier below gets a line for it — with a reason — before it can land.
 * 3. ⭐ **When a step lands, lower the ceilings to what it prints.** ⛔ Never raise one —
 *    ⚠️ **with one authorised exception, and it has a shape you can check.** A PORT that takes a
 *    VexFlow method makes our file read the state that method used to read PRIVATELY, so the number
 *    goes up while the dependency does not: the same reads, now countable. That is the opposite of a
 *    new feature reaching for VexFlow, and §9's own accounting predicts it — a step's assigned uses
 *    come off when the object stops being VexFlow's, ⛔ not step by step. ⇒ a rise may be recorded
 *    ONLY when it is (a) a port of a named VexFlow method, (b) proved exact against the original, and
 *    (c) his call, written down beside the number with the step that spent it. ⛔ Never for new code,
 *    ⛔ never to get a commit green, and ⛔ never without the line below saying who raised it and why.
 *
 * `node scripts/check-vexflow-census.mjs --detail` prints the busiest members and files per role.
 *
 * ## ⭐⭐ …and the NAMES (his rule, 2026-09-14 — `docs/vexflow-removal-map.md` §9.3)
 *
 * Removing the package is not enough: a file called `VexFlowRenderer.ts` or a variable called
 * `vexContext` compiles without VexFlow and names something that no longer exists. So beside the
 * uses this counts the NAMES — file names, identifiers, and VexFlow's `vf-` SVG prefix — each a
 * ceiling that may only fall. ⚠️ Case-SENSITIVE (`vex|Vex|VEX`): `/vex/i` would count `staveX`.
 * ⛔ Comments are never counted: a port's licence attribution is the one place the word stays.
 */
import ts from 'typescript'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, relative, sep } from 'node:path'

const ROOT = resolve('.')
const MAP = 'docs/vexflow-removal-map.md'
const VF = `${sep}node_modules${sep}vexflow${sep}`

/**
 * 🚨 **The RAISES** — every one a step that ported a named VexFlow method (rule 3's exception).
 *
 * | | | why |
 * |---|---|---|
 * | R2 | 159 → **169** | `calculateKeyProps` + `buildNoteHeads` read the note's OWN state (`keys`, `clef`, `duration`, `noteType`, `octaveShift`, `displaced`, `keyProps`, the stem direction) |
 * | R5 | 125 → **127** | the heads are `addChild`ed and typed here now |
 * | R6 | 297 → **301** | `new NoteHead` — the head OBJECTS stay VexFlow's; only the RULE moved |
 * | R3 | 333 → **340** | S6e: `Stem.getExtents`/`getHeight` read the stem's own `yTop`, `yBottom`, direction, extension and both y-offsets |
 * | R1 | 19 → **20** · R2 169 → **174** · R3 340 → **343** (⭐ 342 after S8b) · R4 98 → **104** · R6 301 → **302** | S8a: `Tuplet.getYPosition` reads every note's stem extents, stem direction, rest-ness and modifier-context text lines. ⚠️ R4 is the FORMATTER role — the rule genuinely consults the modifier context's stacked-text state, which S5's correction says is VexFlow's until S9 |
 * | R2 173 → **175** · R3 339 → **347** · R6 302 → **303** | S7b: `Beam.applyStemExtensions` reads each note's stem, its direction and its duration's beam count (`GlyphProps.beamCount`, a new kind — classified R3 beside `KeyProps`), and each stem's extension; writes it back and sets `adjustHeightForBeam`; and reads the beam's own slope, lift, first y and beam width. All were `beam.js`'s private body. Proved exact on 1,867 stems |
 * | R2 175 → **177** | S7c: `Beam.getBeamYToDraw` reads the first note's stem extents (`getStemExtents().topY`). Paid for in R3, 347 → 344: the beam's own `getBeamYToDraw` / `getSlopeY` calls now land on ours |
 * | R2 177 → **178** · R4 104 → **107** | S7d: `Beam.getBeamLines` reads every note's stem x and its sounding and written TICKS (`getTicks().value()`, `getIntrinsicTicks` — a new kind, classified R4, the formatter's unit). R3 fell 344 → 342: the break and side setters no longer call the base class |
 * | R4 107 → **108** | S7e: the beam's constructor reads the first note's written ticks (`getIntrinsicTicks`) for VexFlow's *shorter than a quarter* refusal — `beam.js`'s own read, made visible. The step removed 45 uses overall |
 * | R2 172 → **173** · R3 302 → **308** · R4 108 → **124** · R5 127 → **129** · R6 303 → **304** · specs 255 → **273** | S9b: `Formatter.createModifierContexts` and `ModifierContext.preFormat` transcribed (`rendering/modifierColumns`) — the column walk's resolution, `Fraction`, ticks and stave key, the context's own `state`/`members`/`width`, and the five `format` rules it dispatches, all read inside `formatter.js` / `modifiercontext.js` before. The spec builds VexFlow `Voice`s because that is still the module's input. These clear as S9c–i take the rules and the voice |
 * | R2 173 → **175** · R3 308 → **313** · R4 124 → **127** · R6 304 → **306** | S9c: `Dot.format` reads each dot's note, index, key line, the note's id, rest-ness and right displaced-head room, the dot's width, and writes its x shift and the column's right shift — `dot.js`'s own reads, made visible |
 * | R2 175 → **177** · R3 313 → **317** · R4 127 → **132** · R6 306 → **307** | S9d: `Accidental.format` reads each sign's note, index, key line, type and width, the note's stave (for the y-rounded line), left displaced-head room and x shift, and writes each sign's x shift and the column's left shift — `accidental.js`'s own reads, made visible |
 * | R2 177 → **182** · R3 317 → **326** · R4 132 → **135** · R5 129 → **131** · R6 307 → **308** | S9e: `Articulation.format` reads each mark's note, side, height, width and `betweenLines` (`ArticulationStruct`, a new kind — R3), the note's glyph width, stem, stem direction, stave line count and top/bottom lines, and writes each mark's text line and origin and the column's four counters — `articulation.js`'s own reads, made visible |
 * | R2 182 → **188** · R3 326 → **330** · R4 135 → **138** · R5 131 → **144** · R6 308 → **309** · R7 2 → **4** | S9f: `Annotation.format` reads each text's note, justification (`AnnotationVerticalJustify`, a new kind — R5 beside its horizontal twin), width and FONT SIZE, and the note's glyph width, stem, note type, stave line count and top/bottom lines, and writes each text line and the column's counters — `annotation.js`'s own reads, made visible. ⚠️ R7's two are `fontInfo.size`, a READ the rule always made (⛔ not a new write like S6d's); the conversion it fed (`Font.convertSizeToPixelValue`) is ported (`rendering/drawnFontSize.fontSizeToPx`) rather than called · specs 273 → **282**: `EngravedAnnotation`'s spec drives VexFlow's own setters on the subclass |
 * | R2 188 → **195** · R3 330 → **335** · R4 138 → **141** · R5 144 → **147** · R6 309 → **310** | S9g: `StaveNote.format` (the multi-voice pass) reads each note's sorted keys, rest-ness, stem direction, stem LENGTH, voice-shift width, `draw` flag, stem, beam, duration, style, voice and its first key's dots (their category and index), a rest head's text metrics — and writes through `setKeyLine`, `setXShift`, `setStemDirection` and the column's right shift — `stavenote.js`'s own reads, made visible. `Tables.UNISON` became a row (`inheritedDefaults.UNISON_SHARES_HEAD`) instead of a read · specs 282 → **281**: `NoteBuilder.multiVoiceStem`'s spec builds OUR contexts instead of calling `joinVoices` |
 * | R2 195 → **201** · R3 335 → **337** · R4 141 → **174** · R6 310 → **311** | S9h-a: `Formatter.format`'s last three steps are ours (`rendering/columnFormat`) — `TickContext.preFormat` transcribed reads each tickable's metrics and writes the column's nine measures (R4, most of the rise), `createTickContexts` transcribed builds them, and `AlignRestsToNotes` reads each tickable's kind, rest-ness, ticks, tuplet, beam and rest line and writes `setKeyLine` — `formatter.js`/`tickcontext.js`'s own reads, made visible (four of them — `Tickable.getMetrics`, `shouldIgnoreTicks`, `getTuplet` and the `Tickable` type — a new line in `role()`); the renderer (23 → 16) and `spacingPass` (8 → 4) no longer hold a `Formatter`. ⚠️ Two of the new R4 uses are the one-step BRIDGE to VexFlow's softmax (`Formatter.preFormat` on our columns), gone in S9h-b · specs 281 → **297**: `columnFormat`'s spec builds VexFlow voices, beams and clef notes to drive it |
 * | R2 201 → **202** · R4 174 → **199** | S9h-b: `Formatter.preFormat`'s walk and softmax are ours (`layout/softmaxSpacing`, pure) — the adapter in `rendering/columnFormat` reads each tickable's voice, ticks, x shift, metrics (`NoteMetrics`, a new kind), width and centre alignment, each column's metrics (`TickContextMetrics`, new), longest tickable, ticks and voices, and each voice's ticks — `formatter.js`/`voice.js`'s own reads, made visible (two new lines in `role()`); the S9h-a bridge (a `Formatter` instance, its options, its `preFormat`) is gone. ⏸️ Kept ONLY for a clef change after a bar's last onset, his call — ⏭️ it all goes with the clef review (map §9.4 #5) |
 * | R4 199 → **167** · R5 147 → **148** · R6 311 → **315** | S9i: VexFlow's `Voice` is gone from the render path (`rendering/barVoice`; its tick arithmetic `layout/tickCount`, pure) — R4 falls with every `Voice`, `Formatter.getResolutionMultiplier` and `Fraction` in the bar's walk; `Voice.draw` transcribed (`drawBarVoice`) makes its own three writes on each tickable visible — `setStave` (a new line in `role()`), `setContext`, `drawWithStyle` — plus the `Stave` and `RenderContext` types it takes (R5 +1, R6 +4) · specs 297 → **291** · identifiers 124 → **118** (`vexVoices`) |
 * | R2 202 → **207** · R5 148 → **154** · R6 315 → **311** · R7 4 → **5** | S10: the fan paints on OUR surface — `NoteHead.draw` transcribed for a member head (`FanPass.drawFanHead` → `engrave/notes/noteheads`) reads the head's absolute x, x/y shifts, y and `fontInfo` (R2 +5, R7 +1), and `Element.drawWithStyle` transcribed for a prefix stem (`EngravedStem.drawWithStyleOn`) reads its STYLE (`ElementStyle`, a new line in `role()` — R5 +6); R6 falls with the `setContext`/`draw`/`drawWithStyle` calls it replaces · identifiers 118 → **116** |
 * | R7 | 0 → **2** | ⚠️ `head.fontInfo = this.fontInfo`, the note handing its own font to its own head. A no-op today (both category defaults are Bravura 30, measured) — ⛔ KEPT anyway, because dropping a write-back that is a no-op *now* is `EngravedNote`'s most expensive lesson. ⚠️ **R7 was a finished role**; this is the one entry that is a real regression rather than a visibility change, and it clears when the heads stop being `NoteHead`s. |
 *
 * ⭐ **Every one of these is the SAME read, moved out of `stavenote.js`'s private body into ours** —
 * the dependency became visible, not bigger: VexFlow's note table and its displacement walk stopped
 * running for our notes entirely. ⚠️ And two of the reads the port needs are PRIVATE fields
 * (`sortedKeyProps`, `_noteHeads`), so they are casts this census can never count at all.
 *
 * ⚠️ The CEILINGS, measured 2026-09-14 (the map's §0.1), lowered by S1b (R7 50 → 29) S1c (R7 29 → 0), S2a (R1 174 → 85) and S2b (R1 85 → 57); then
 * re-measured, not grown, when `STAVE_RECV` was anchored: R1 57 → 35, R2 198 → 203, R3 438 → 455, total unchanged; S2c (R1 35 → 19, R6 336 → 325); S3a (R2 203 → 161, R6 325 → 324); S4a (R3 455 → 444, R5 136 → 133); S4b0 (R3 444 → 427, R5 133 → 129); S4b1 (R3 427 → 400, R5 129 → 127, R6 324 → 320); S4c (R3 400 → 343, R5 127 → 125, R6 320 → 305); S4d (R3 343 → 336, R6 305 → 300); S4e (R6 300 → 297); S5a (R2 161 → 159, R3 336 → 333); S6d (R2 159 → 169, R5 125 → 127, R6 297 → 301, R7 0 → 2) S6e (R3 333 → 340) and S8a (R1 19 → 20, R2 169 → 174, R3 340 → 343, R4 98 → 104, R6 301 → 302) — the RAISES above; ⭐ S8b LOWERED R3 343 → 342, the first fall since S5a; S7a (R2 174 → 173, R3 342 → 339); S7b RAISED (above); S7c R2 175 → 177 (above), R3 347 → 344; S7d R2 177 → 178, R4 104 → 107 (above), R3 344 → 342; S7e (EngravedBeam no longer extends Beam) R2 178 → 172, R3 342 → 302, R4 107 → 108 (above); S9b RAISED (above); S9c RAISED (above); S9d RAISED (above); S9e RAISED (above); S9f RAISED (above); S9g RAISED (above); S9h-a RAISED (above); S9h-b RAISED (above); S9i LOWERED R4 199 → 167 and raised R5 + R6 (above); S10 LOWERED R6 315 → 311 and raised R2, R5, R7 (above); S11a (the clef + meter ghosts) R3 337 → 323, R5 154 → 152, R6 311 → 305; S11b (the mark ghosts) R3 323 → 294, R4 167 → 143, R5 152 → 140, R6 305 → 282; S11c (the dynamic + tempo ghosts) R3 294 → 288, R4 143 → 136, R5 140 → 136, R6 282 → 277; S11d (the rest + fan ghosts) R2 207 → 205, R3 288 → 274, R4 136 → 120, R5 136 → 130, R6 277 → 267; S11e (the note ghost — no ghost imports VexFlow) R2 205 → 197, R3 274 → 260, R4 120 → 112, R5 130 → 123, R6 267 → 260; S12a (`ScoreTuplet` no longer extends `Tuplet`) R2 197 → 193, R3 260 → 231, R5 123 → 113, and RAISED R4 112 → 114 — `Tuplet.attach`'s `setTuplet` and the nesting count's `getTupletStack`, called inside the library until now, made visible; S12b (the modifier contract, `CenteredTremolo` its first member) R3 231 → 223, R5 113 → 109, specs 291 → 286, and RAISED R6 260 → 261 — `EngravedModifier`'s `Note` type and its ONE `Modifier` cast (`attachModifier`), type-only: the seam every modifier now crosses, until the note is ours; S12c (the dot) R3 223 → 198, R6 261 → 259, specs 286 → 279; S12e (the accidental) R2 193 → 189, R3 198 → 167, R5 109 → 107, R6 259 → 250, specs 279 → 247; S12f (the articulation, its placement transcribed) R3 167 → 152, R5 107 → 105, R6 250 → 245, and RAISED R2 189 → 190 — the head's key line `Articulation.draw` read inside the library, made visible; S12f2 (the fan's stand-in on our note, marks and column) R2 190 → 185, R3 152 → 135, R4 114 → 113, R5 105 → 104, R6 245 → 241, specs 247 → 243; S12g (the annotation, its placement transcribed) R3 135 → 131, R5 104 → 84, R6 241 → 229, R7 5 → 3, specs 243 → 234, and RAISED R2 185 → 187 — `getModifierStartXY` and `getYForTopText`, read inside the library until now; S12h (the stave is ours) R1 20 → 2, R2 187 → 184, R3 131 → 125, R4 113 → 112, R5 84 → 83, R6 229 → 172, specs 234 → 227. Lower them as
 * the steps land; ⛔ never raise.
 * The removal is done when every one reads 0 and `vexflow` leaves `package.json` (map §9.2).
 */
const CEILINGS = {
  'R1 staff coords': 2,
  'R2 note ruler': 184,
  'R3 placement rules': 125,
  'R4 formatter': 112,
  'R5 paint+leftovers': 83,
  'R6 object graph': 172,
  'R7 numbers+fonts': 3,
}
/** The specs' uses, one number: a spec that imports VexFlow has to move with its subject too. */
const TEST_CEILING = 227

/** ⚠️ The NAME ceilings, measured 2026-09-14 (map §9.3); S11e 'identifiers' 113 → 110; S12e 'identifiers in tests' 150 → 147; S12h 'identifiers' 110 → 104. Same rule: lower them as renames land;
 *  ⛔ never raise. 'identifiers in tests' and 'vf- in tests' include `e2e/`, scanned as text. */
const NAME_CEILINGS = {
  'files': 8,
  'identifiers': 104,
  'identifiers in tests': 147,
  'vf- in code': 39,
  'vf- in tests': 418,
}
const NAME = /vex|Vex|VEX/

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1. THE SCAN — every VexFlow use in src/, resolved to its declaration
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const config = ts.readConfigFile(resolve(ROOT, 'tsconfig.json'), ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, ROOT)
const program = ts.createProgram(parsed.fileNames, { ...parsed.options, noEmit: true })
const checker = program.getTypeChecker()
const SRC = resolve(ROOT, 'src') + sep

const isVF = d => !!d && d.getSourceFile().fileName.split('/').join(sep).includes(VF)
const inSrc = fileName => fileName.split('/').join(sep).startsWith(SRC)

function ownerName(decl) {
  for (let n = decl.parent; n; n = n.parent) {
    if ((ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n)
      || ts.isEnumDeclaration(n) || ts.isModuleDeclaration(n)) && n.name) return n.name.text
    if (ts.isSourceFile(n)) return '(module)'
  }
  return '?'
}

function resolveAlias(sym) {
  if (sym && (sym.flags & ts.SymbolFlags.Alias)) {
    try { return checker.getAliasedSymbol(sym) } catch { return sym }
  }
  return sym
}

/** Is this node written where only a TYPE can stand? (`import type` specifiers are handled apart.) */
function inTypePosition(node) {
  for (let n = node; n.parent; n = n.parent) {
    const p = n.parent
    if (ts.isTypeNode(p) && !ts.isExpressionWithTypeArguments(p)) return true
    if (ts.isTypeReferenceNode(p) || ts.isTypeQueryNode(p)) return true
    if (ts.isExpressionWithTypeArguments(p)) {
      const h = p.parent
      if (h && ts.isHeritageClause(h) && h.token === ts.SyntaxKind.ImplementsKeyword) return true
      if (h && ts.isHeritageClause(h) && ts.isInterfaceDeclaration(h.parent)) return true
      return false
    }
    if (ts.isStatement(p) || ts.isClassElement(p) || ts.isExpression(p)) return false
  }
  return false
}

/** The VexFlow base class a class of ours transitively extends, or null. */
function vexflowBaseOf(classDecl) {
  let d = classDecl
  for (let guard = 0; d && guard < 20; guard++) {
    const h = (d.heritageClauses || []).find(c => c.token === ts.SyntaxKind.ExtendsKeyword)
    if (!h) return null
    const s = checker.getTypeAtLocation(h.types[0]).getSymbol()
    const base = s && s.declarations && s.declarations[0]
    if (!base) return null
    if (isVF(base)) return s.getName()
    d = base
  }
  return null
}

function receiverName(expr) {
  try {
    const t = checker.getTypeAtLocation(expr)
    const s = (t.getSymbol && t.getSymbol()) || t.aliasSymbol
    return s ? s.getName() : checker.typeToString(t).slice(0, 60)
  } catch {
    return '?'
  }
}

const uses = []
/** One entry per NAME occurrence: { bucket, file, line, text }. */
const names = []

for (const sf of program.getSourceFiles()) {
  if (!inSrc(sf.fileName)) continue
  const file = relative(ROOT, sf.fileName).split(sep).join('/')
  const test = /\.test\.ts$/.test(file) || file.includes('__tests__')
  const record = (node, fields) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    uses.push({ file, line: line + 1, test, ...fields })
  }

  const recordName = (node, bucket, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf))
    names.push({ bucket, file, line: line + 1, text })
  }

  const visit = node => {
    // NAMES — an identifier called vex-anything, or a string carrying VexFlow's `vf-` prefix.
    if ((ts.isIdentifier(node) || ts.isPrivateIdentifier(node)) && NAME.test(node.text)) {
      recordName(node, test ? 'identifiers in tests' : 'identifiers', node.text)
    }
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (let i = 0; i < (node.text.match(/vf-/g) || []).length; i++) recordName(node, test ? 'vf- in tests' : 'vf- in code', 'vf-')
    }
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && /^vexflow/.test(node.moduleSpecifier.text)) {
      // An import specifier is not a use: what it brings in is counted where it is used.
      if (!node.importClause) record(node, { kind: 'import-side-effect', cls: node.moduleSpecifier.text, member: '' })
      return
    }
    if (ts.isPropertyAccessExpression(node)) {
      const sym = resolveAlias(checker.getSymbolAtLocation(node.name))
      const decls = (sym && sym.declarations) || []
      const vd = decls.find(isVF)
      if (vd) {
        const isCall = ts.isCallExpression(node.parent) && node.parent.expression === node
        const exprSym = resolveAlias(checker.getSymbolAtLocation(node.expression))
        const isThis = node.expression.kind === ts.SyntaxKind.ThisKeyword || node.expression.kind === ts.SyntaxKind.SuperKeyword
        const isStatic = !isThis && !!(exprSym && (exprSym.flags & (ts.SymbolFlags.Class | ts.SymbolFlags.Enum)))
        record(node.name, {
          kind: isStatic ? 'static' : isCall ? 'call' : 'prop',
          cls: ownerName(vd), member: node.name.text,
          typeOnly: inTypePosition(node), recv: receiverName(node.expression),
        })
      }
    } else if (ts.isNewExpression(node)) {
      const sym = resolveAlias(checker.getSymbolAtLocation(node.expression))
      const d = sym && sym.declarations && sym.declarations[0]
      if (d && isVF(d)) record(node, { kind: 'new', cls: sym.getName(), member: 'constructor' })
    } else if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node) || ts.isTypeQueryNode(node)) {
      const nameNode = ts.isTypeReferenceNode(node) ? node.typeName : ts.isTypeQueryNode(node) ? node.exprName : node.expression
      const target = ts.isQualifiedName(nameNode) ? nameNode.right : ts.isPropertyAccessExpression(nameNode) ? nameNode.name : nameNode
      const sym = resolveAlias(checker.getSymbolAtLocation(target))
      const d = sym && sym.declarations && sym.declarations[0]
      if (d && isVF(d)) {
        let kind = 'type'
        if (ts.isExpressionWithTypeArguments(node) && node.parent && ts.isHeritageClause(node.parent)) {
          kind = node.parent.token === ts.SyntaxKind.ExtendsKeyword && ts.isClassLike(node.parent.parent) ? 'extends' : 'implements'
        }
        if (ts.isTypeQueryNode(node)) kind = 'typeof'
        record(node, { kind, cls: sym.getName(), member: '', typeOnly: kind !== 'extends' })
      }
    } else if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
      const pname = node.propertyName || node.name
      if (ts.isIdentifier(pname)) {
        const p = checker.getTypeAtLocation(node.parent).getProperty(pname.text)
        const vd = p && p.declarations && p.declarations.find(isVF)
        if (vd) record(node, { kind: 'destructure', cls: ownerName(vd), member: pname.text })
      }
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword) {
      const sym = resolveAlias(checker.getSymbolAtLocation(node.right))
      const d = sym && sym.declarations && sym.declarations[0]
      if (d && isVF(d)) record(node, { kind: 'instanceof', cls: sym.getName(), member: '' })
    } else if (ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node.parent) && !ts.isNewExpression(node.parent)
      && !ts.isTypeReferenceNode(node.parent) && !ts.isImportSpecifier(node.parent) && !ts.isExpressionWithTypeArguments(node.parent)
      && !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword)
      && !ts.isQualifiedName(node.parent) && !ts.isTypeQueryNode(node.parent)
      && !ts.isImportClause(node.parent) && !ts.isNamespaceImport(node.parent)) {
      // A bare reference to a VexFlow class or function — passed as an argument, say.
      const alias = checker.getSymbolAtLocation(node)
      if (alias && (alias.flags & ts.SymbolFlags.Alias)) {
        const sym = resolveAlias(alias)
        const d = sym && sym.declarations && sym.declarations[0]
        if (d && isVF(d)) record(node, { kind: 'value-ref', cls: sym.getName(), member: '', typeOnly: inTypePosition(node) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
}

// Keep `vexflowBaseOf` honest: a class of ours that extends VexFlow is itself an R6 use (`extends`),
// and calls resolving to its OWN overrides are ours — which is why they are never recorded above.
void vexflowBaseOf

// The NAMES the compiler cannot see: file names in src/ and e2e/, and the browser suite, which is
// outside tsconfig.json — scanned as text, comment lines skipped.
function walkFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walkFiles(full))
    else out.push(full)
  }
  return out
}
for (const full of [...walkFiles(resolve(ROOT, 'src')), ...walkFiles(resolve(ROOT, 'e2e'))]) {
  const file = relative(ROOT, full).split(sep).join('/')
  const base = file.split('/').pop()
  if (/vex/i.test(base)) names.push({ bucket: 'files', file, line: 0, text: base })
  if (!file.startsWith('e2e/') || !file.endsWith('.ts')) continue
  readFileSync(full, 'utf8').split('\n').forEach((text, i) => {
    const t = text.trim()
    if (t.startsWith('*') || t.startsWith('//') || t.startsWith('/*')) return
    for (const id of text.match(/[A-Za-z_$][\w$]*/g) || []) {
      if (NAME.test(id)) names.push({ bucket: 'identifiers in tests', file, line: i + 1, text: id })
    }
    for (let k = 0; k < (text.match(/vf-/g) || []).length; k++) names.push({ bucket: 'vf- in tests', file, line: i + 1, text: 'vf-' })
  })
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2. THE ROLES — the map's R1–R7 (§1), so the counts can be argued with
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const NOTE_RECV = /^(StaveNote|Note|StemmableNote|EngravedNote|NoteHead|Tickable|GhostNote|ClefNote)/
// ⚠️ ANCHORED (2026-09-14): a prefix test also matched `StaveNote` and `StaveModifier`, and filed 22 note and
// header-modifier uses under R1 — every R1 figure before that date includes them.
const STAVE_RECV = /^(Stave|EngravedStave)( \| undefined)?$/

function role(u) {
  const c = u.cls, m = u.member, recv = u.recv || ''
  // R7 — numbers and fonts
  if (c === 'Metrics' || c === 'MetricsDefaults' || c === 'FontInfo' || (c === 'Stem' && m === 'WIDTH')
    || m === 'LEDGER_LINE_OFFSET' || m === 'fontInfo' || m === 'getFontScale' || c === 'TextMeasure') return 'R7 numbers+fonts'
  // R4 — the formatter
  if (/^(Voice|VoiceMode|Formatter|TickContext|ModifierContext|AlignmentContexts|Fraction)$/.test(c)) return 'R4 formatter'
  if (c === 'Tickable' && /addToModifierContext|applyTickMultiplier|isCenterAligned|setCenterXShift|getCenterXShift/.test(m)) return 'R4 formatter'
  // ⭐ The MODIFIER CONTEXT'S STATE — how many rows of text a note already has stacked over or under
  // it. It arrived with S8a: `Tuplet.getYPosition` genuinely consults it, because a tuplet mark has to
  // stand clear of an articulation that is already there. ⚠️ It is FORMATTER state, ⛔ not a placement
  // rule of the tuplet's: the rows are counted while the modifier context pre-formats, which S5's own
  // correction says stays VexFlow's until S9. ⇒ it clears with the formatter, not with the mark.
  if (c === 'ModifierContextState' || (c === 'Tickable' && m === 'getModifierContext')) return 'R4 formatter'
  // `getTicks` / `getIntrinsicTicks` (S7d): a note's length in VexFlow's TICKS, the formatter's unit —
  // the beam's line walk reads them, and they go when `Voice`/`TickContext` do (S9).
  if (/^(preFormat|setTickContext|postFormat|postFormatted|setNoteStartX|getTickables|getTicks|getIntrinsicTicks)$/.test(m) && c !== 'Beam') return 'R4 formatter'
  // `Tickable.getStave` (S9b): the key the formatter's column walk groups by — ours since S9b.
  if (c === 'Tickable' && m === 'getStave') return 'R4 formatter'
  // S9h-a: the formatter's own walks, ported — the column metrics read each tickable's `getMetrics`, the
  // rest walk its `shouldIgnoreTicks` and `getTuplet`, both typed over `Tickable`. They go with `Voice` (S9i).
  if (c === 'Tickable' && /^(getMetrics|shouldIgnoreTicks|getTuplet|)$/.test(m)) return 'R4 formatter'
  // `setTuplet` / `getTupletStack` (S12a): `ScoreTuplet` puts itself on each note's tuplet stack, which
  // scales the note's TICKS, and reads the stack back for the nesting count — calls VexFlow's
  // `Tuplet.attach` / `getNestedTupletCount` made inside the library, until the note's ticks are ours.
  if (c === 'Tickable' && /^(setTuplet|getTupletStack)$/.test(m)) return 'R4 formatter'
  // S9h-b: the softmax, ported (`layout/softmaxSpacing`, kept for a bar-end clef until the clef review) —
  // its adapter reads each tickable's voice and width and the columns' metrics.
  if (c === 'Tickable' && /^(getVoice|getWidth)$/.test(m)) return 'R4 formatter'
  if (c === 'NoteMetrics' || c === 'TickContextMetrics') return 'R4 formatter'
  // R5 — the painting surface and the leftovers
  if (/^(Renderer|RendererBackends|SVGContext|RenderContext)$/.test(c)) return 'R5 paint+leftovers'
  // S10: `Element.applyStyle` transcribed onto our surface (`EngravedStem.drawWithStyleOn`) reads the
  // element's STYLE — paint state, not a rule. It goes with the painter.
  if (c === 'ElementStyle') return 'R5 paint+leftovers'
  if (/^(draw|drawWithStyle|setContext|checkContext|getSVGElement|renderText|setRendered|applyStyle|drawModifiers|setAttribute|getAttribute)$/.test(m)) return 'R6 object graph'
  if (c === 'Annotation' || c === 'AnnotationHorizontalJustify' || c === 'AnnotationVerticalJustify') return 'R5 paint+leftovers'
  if (c === 'Element' && /^(getText|setText|text|setFont|setFontSize|textMetrics|getTextMetrics|getCategory|constructor)$/.test(m)) return 'R5 paint+leftovers'
  if (c === 'Element' && u.kind === 'type') return 'R5 paint+leftovers'
  if (c === 'NoteHead' && /constructor|setStave/.test(m)) return 'R5 paint+leftovers'
  // R3 — the placement rules. `GlyphProps` (S7b) is VexFlow's per-DURATION table — a quaver's beam count —
  // the same kind of row as `KeyProps`, and it goes when the note's duration table is ours. `ArticulationStruct`
  // (S9e) is VexFlow's per-CODE articulation row — its `betweenLines` flag — the same kind again.
  if (/^(Beam|Stem|Tuplet|TupletOptions|Tremolo|Articulation|Accidental|Dot|Modifier|ModifierPosition|Clef|TimeSignature|Barline|BarlineType|StaveModifier|StaveModifierPosition|KeyProps|GlyphProps|ArticulationStruct)$/.test(c)) return 'R3 placement rules'
  if (/^(setStemDirection|setKeyLine|getLineForRest|setStemLength|setStem|buildStem|setBeam|getModifierStartXY|addModifier|getModifiers|isDisplaced|shouldDrawFlag|getLedgerLineStyle|getKeyLine|getKeyProps|getKeys|getBeamCount|hasBeam|getStem|getStemLength|checkStem)$/.test(m) && NOTE_RECV.test(recv + c)) {
    return /^(getModifiers|addModifier|getKeys|getKeyProps|hasBeam|getStem)$/.test(m) ? 'R6 object graph' : 'R3 placement rules'
  }
  if (STAVE_RECV.test(c) && /^(addClef|addTimeSignature|addEndClef|addEndTimeSignature|setBegBarType|setEndBarType|addModifier|format|formatted|clef|endClef|modifiers|getModifiers|setDefaultLedgerLineStyle|getDefaultLedgerLineStyle)$/.test(m)) return 'R3 placement rules'
  // R1 — the staff as a coordinate system
  if (/^(Stave|EngravedStave|StaveOptions|StaveLineConfig)$/.test(c)) {
    return u.kind === 'type' || u.kind === 'new' || u.kind === 'extends' || m === 'constructor' ? 'R6 object graph' : 'R1 staff coords'
  }
  if (c === 'Note' && (m === 'getStave' || m === 'checkStave')) return 'R1 staff coords'
  // S9i: `Voice.draw` transcribed (`rendering/barVoice.drawBarVoice`) puts each TICKABLE on its stave —
  // the same object-graph write as a note's own, typed over `Tickable`. It goes with the graph (S12).
  if ((c === 'StaveNote' || c === 'Tickable') && m === 'setStave') return 'R6 object graph'
  if (c === 'Element' && STAVE_RECV.test(recv)) return 'R1 staff coords'
  // R2 — the note's ruler
  if (/^(StaveNote|Note|StemmableNote|NoteHead|StaveNoteHeadBounds|ClefNote)$/.test(c)) {
    return u.kind === 'type' || u.kind === 'new' || u.kind === 'extends' || m === 'constructor' ? 'R6 object graph' : 'R2 note ruler'
  }
  if (c === 'BoundingBox') return 'R2 note ruler'
  if (c === 'Element' && /^(getX|getY|x|y|width|getWidth|getHeight|setX|setY|setWidth|getXShift|getYShift|setXShift|getBoundingBox|children)$/.test(m)) {
    // A modifier's or sign's own x/y/width is its placement; a note's is the ruler.
    return NOTE_RECV.test(recv) ? 'R2 note ruler' : 'R3 placement rules'
  }
  if (c === 'Element') return 'R5 paint+leftovers'
  if (c === 'isTabNote') return 'R3 placement rules'
  return 'UNCLASSIFIED'
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 3. THE VERDICT
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const counts = Object.fromEntries(Object.keys(CEILINGS).map(r => [r, 0]))
const byRole = new Map()
const unclassified = []
let testUses = 0

for (const u of uses) {
  if (u.test) { testUses++; continue }
  const r = role(u)
  if (r === 'UNCLASSIFIED') { unclassified.push(u); continue }
  counts[r]++
  if (!byRole.has(r)) byRole.set(r, [])
  byRole.get(r).push(u)
}

const total = Object.values(counts).reduce((a, b) => a + b, 0)
let failed = false

if (unclassified.length) {
  failed = true
  console.error(`\n✗ ${unclassified.length} VexFlow use(s) fall in no role — a new kind of dependency.\n`)
  for (const u of unclassified.slice(0, 30)) console.error(`    ${u.file}:${u.line}  ${u.cls}.${u.member || `<${u.kind}>`}`)
  console.error(`
  A new feature does not reach for VexFlow (own-engraving-engine.md rule 1). If this use is
  unavoidable, give \`role()\` in this script a line for it — with the reason — so it is counted.
`)
}

const rose = Object.entries(counts).filter(([r, n]) => n > CEILINGS[r])
if (rose.length || testUses > TEST_CEILING) {
  failed = true
  console.error('\n✗ The VexFlow dependency GREW:\n')
  for (const [r, n] of rose) console.error(`    ${r}: ${n} uses, ceiling ${CEILINGS[r]}`)
  if (testUses > TEST_CEILING) console.error(`    specs: ${testUses} uses, ceiling ${TEST_CEILING}`)
  console.error(`
  Removing VexFlow is the priority (${MAP}). Draw and measure through our own modules instead;
  \`--detail\` shows where each role's uses are.
`)
}

const nameCounts = Object.fromEntries(Object.keys(NAME_CEILINGS).map(b => [b, 0]))
for (const n of names) nameCounts[n.bucket]++
const namesRose = Object.entries(nameCounts).filter(([b, n]) => n > NAME_CEILINGS[b])
if (namesRose.length) {
  failed = true
  console.error('\n✗ VexFlow NAMES grew:\n')
  for (const [b, n] of namesRose) console.error(`    ${b}: ${n}, ceiling ${NAME_CEILINGS[b]}`)
  console.error(`
  Nothing new is named after VexFlow (${MAP} §9.3): call it what it IS. \`--detail\` lists them.
`)
}

if (process.argv.includes('--detail')) {
  for (const b of Object.keys(NAME_CEILINGS)) {
    const m = new Map()
    for (const n of names.filter(x => x.bucket === b)) m.set(n.text, (m.get(n.text) || 0) + 1)
    console.log(`\n## names — ${b}: ${nameCounts[b]}`)
    console.log('  ' + [...m].sort((x, y) => y[1] - x[1]).slice(0, 20).map(([k, n]) => `${k} ${n}`).join(' · '))
  }
  for (const [r, list] of [...byRole].sort()) {
    const tally = key => {
      const m = new Map()
      for (const u of list) m.set(key(u), (m.get(key(u)) || 0) + 1)
      return [...m].sort((a, b) => b[1] - a[1])
    }
    console.log(`\n## ${r} — ${list.length} uses (${list.filter(u => u.typeOnly).length} type-only)`)
    console.log('  members: ' + tally(u => `${u.cls}.${u.member || `<${u.kind}>`}`).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(' · '))
    console.log('  files:   ' + tally(u => u.file.replace('src/engine/rendering/', '')).slice(0, 15).map(([k, n]) => `${k} ${n}`).join(' · '))
  }
  console.log('')
}

if (failed) process.exit(1)

const fell = Object.entries(counts).filter(([r, n]) => n < CEILINGS[r])
if (fell.length || testUses < TEST_CEILING) {
  console.log('⭐ The dependency FELL — lower the ceilings in scripts/check-vexflow-census.mjs to:')
  for (const [r, n] of fell) console.log(`    '${r}': ${n},   (was ${CEILINGS[r]})`)
  if (testUses < TEST_CEILING) console.log(`    TEST_CEILING = ${testUses}   (was ${TEST_CEILING})`)
}
const namesFell = Object.entries(nameCounts).filter(([b, n]) => n < NAME_CEILINGS[b])
if (namesFell.length) {
  console.log('⭐ VexFlow NAMES fell — lower NAME_CEILINGS to:')
  for (const [b, n] of namesFell) console.log(`    '${b}': ${n},   (was ${NAME_CEILINGS[b]})`)
}

console.log(
  `✓ VexFlow census: ${total} uses outside the specs (` +
  Object.entries(counts).map(([r, n]) => `${r.split(' ')[0]} ${n}`).join(' · ') +
  `), ${testUses} in specs; names: ` +
  Object.entries(nameCounts).map(([b, n]) => `${b} ${n}`).join(' · ') +
  `. None may rise — ${MAP}.`,
)
