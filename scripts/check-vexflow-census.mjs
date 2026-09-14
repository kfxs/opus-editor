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
 * 3. ⭐ **When a step lands, lower the ceilings to what it prints.** ⛔ Never raise one.
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
 * ⚠️ The CEILINGS, measured 2026-09-14 (the map's §0.1), lowered by S1b (R7 50 → 29). Lower them as
 * the steps land; ⛔ never raise.
 * The removal is done when every one reads 0 and `vexflow` leaves `package.json` (map §9.2).
 */
const CEILINGS = {
  'R1 staff coords': 175,
  'R2 note ruler': 199,
  'R3 placement rules': 438,
  'R4 formatter': 98,
  'R5 paint+leftovers': 147,
  'R6 object graph': 341,
  'R7 numbers+fonts': 29,
}
/** The specs' uses, one number: a spec that imports VexFlow has to move with its subject too. */
const TEST_CEILING = 261

/** ⚠️ The NAME ceilings, measured 2026-09-14 (map §9.3). Same rule: lower them as renames land;
 *  ⛔ never raise. 'identifiers in tests' and 'vf- in tests' include `e2e/`, scanned as text. */
const NAME_CEILINGS = {
  'files': 8,
  'identifiers': 132,
  'identifiers in tests': 150,
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
const STAVE_RECV = /^(Stave|EngravedStave)/

function role(u) {
  const c = u.cls, m = u.member, recv = u.recv || ''
  // R7 — numbers and fonts
  if (c === 'Metrics' || c === 'MetricsDefaults' || c === 'FontInfo' || (c === 'Stem' && m === 'WIDTH')
    || m === 'LEDGER_LINE_OFFSET' || m === 'fontInfo' || m === 'getFontScale' || c === 'TextMeasure') return 'R7 numbers+fonts'
  // R4 — the formatter
  if (/^(Voice|VoiceMode|Formatter|TickContext|ModifierContext|AlignmentContexts|Fraction)$/.test(c)) return 'R4 formatter'
  if (c === 'Tickable' && /addToModifierContext|applyTickMultiplier|isCenterAligned|setCenterXShift|getCenterXShift/.test(m)) return 'R4 formatter'
  if (/^(preFormat|setTickContext|postFormat|postFormatted|setNoteStartX|getTickables)$/.test(m) && c !== 'Beam') return 'R4 formatter'
  // R5 — the painting surface and the leftovers
  if (/^(Renderer|RendererBackends|SVGContext|RenderContext)$/.test(c)) return 'R5 paint+leftovers'
  if (/^(draw|drawWithStyle|setContext|checkContext|getSVGElement|renderText|setRendered|applyStyle|drawModifiers|setAttribute|getAttribute)$/.test(m)) return 'R6 object graph'
  if (c === 'Annotation' || c === 'AnnotationHorizontalJustify') return 'R5 paint+leftovers'
  if (c === 'Element' && /^(getText|setText|text|setFont|setFontSize|textMetrics|getTextMetrics|getCategory|constructor)$/.test(m)) return 'R5 paint+leftovers'
  if (c === 'Element' && u.kind === 'type') return 'R5 paint+leftovers'
  if (c === 'NoteHead' && /constructor|setStave/.test(m)) return 'R5 paint+leftovers'
  // R3 — the placement rules
  if (/^(Beam|Stem|Tuplet|TupletOptions|Tremolo|Articulation|Accidental|Dot|Modifier|ModifierPosition|Clef|TimeSignature|Barline|BarlineType|StaveModifier|StaveModifierPosition|KeyProps)$/.test(c)) return 'R3 placement rules'
  if (/^(setStemDirection|setKeyLine|getLineForRest|setStemLength|setStem|buildStem|setBeam|getModifierStartXY|addModifier|getModifiers|isDisplaced|shouldDrawFlag|getLedgerLineStyle|getKeyLine|getKeyProps|getKeys|getBeamCount|hasBeam|getStem|getStemLength|checkStem)$/.test(m) && NOTE_RECV.test(recv + c)) {
    return /^(getModifiers|addModifier|getKeys|getKeyProps|hasBeam|getStem)$/.test(m) ? 'R6 object graph' : 'R3 placement rules'
  }
  if (STAVE_RECV.test(c) && /^(addClef|addTimeSignature|addEndClef|addEndTimeSignature|setBegBarType|setEndBarType|addModifier|format|formatted|clef|endClef|modifiers|getModifiers|setDefaultLedgerLineStyle|getDefaultLedgerLineStyle)$/.test(m)) return 'R3 placement rules'
  // R1 — the staff as a coordinate system
  if (/^(Stave|EngravedStave|StaveOptions|StaveLineConfig)$/.test(c)) {
    return u.kind === 'type' || u.kind === 'new' || u.kind === 'extends' || m === 'constructor' ? 'R6 object graph' : 'R1 staff coords'
  }
  if (c === 'Note' && (m === 'getStave' || m === 'checkStave')) return 'R1 staff coords'
  if (c === 'StaveNote' && m === 'setStave') return 'R6 object graph'
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
