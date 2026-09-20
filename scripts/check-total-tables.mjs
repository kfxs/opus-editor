#!/usr/bin/env node
/**
 * `npm run lint:tables` — the guard on a DECLARATION, not on a count.
 *
 * THE INVARIANT (`docs/plans/span-mark-family-plan-2026-08-24.md` Phase 3 `[A4]`): a registry answering
 * *"what does kind K do?"* is worth having **only when the compiler refuses to build a kind that
 * forgot its row.** `tsc` enforces that — but only GIVEN the declaration. Nothing stops a future
 * edit from quietly weakening `Record<SpanMarkKind, Spec>` to `Partial<Record<…>>` to make one
 * awkward kind fit, and the moment it does, the whole abstraction silently stops paying: a kind can
 * be forgotten again, and the miss is invisible until it ships.
 *
 * ⭐ So this checks the one thing `tsc` cannot check about itself — that the tables still SAY they
 * are total. Three shapes are refused, because each accepts a missing kind without complaint:
 *
 *   Partial<…>           every member optional
 *   [k: string]: …       an index signature answers for keys that do not exist
 *   Spec[]  /  Array<…>  a list has no keys at all
 *
 * ⚠️ **A table answering "in what ORDER?" is legitimately a list** and is not checked here —
 * `ELEMENT_HIT_ORDER` is partial by design, because the order IS its content. The distinction is the
 * rule, and it is why this script names its tables rather than scanning for them: which question a
 * table answers is a judgement, not a pattern.
 *
 * ⛔ What this deliberately does NOT do is police FILENAMES — the plan drafted a sibling check that
 * would fail when a `<kind>Stamp.ts` exists for a kind with no row. Run today it would fail on
 * `hairpinStamp.ts` and `slurStamp.ts`, both of them correct (D1 answered no for the hairpin; the
 * slur was never in this family), so its first act would be to need an allowlist of the two most
 * carefully-made decisions in the plan. A check that starts life with hand-maintained exceptions is
 * the rot `check-test-names.mjs`'s own comment warns about.
 */
import { readFileSync } from 'node:fs'

/** Each entry: the table, the union it must be total over, and where it lives. */
const TABLES = [
  { name: 'SPAN_MARK_MODEL', union: 'SpanMarkKind', file: 'src/engine/models/spanMarkModel.ts' },
  { name: 'SPAN_MARK_TOOLS', union: 'SpanMarkKind', file: 'src/interactions/spanMarkTools.ts' },
  { name: 'ELEMENT_SPECS', union: "SelectedElement['kind']", file: 'src/interactions/elements/chain.ts' },
  { name: 'MARKING_TOOL_USES_ARMED_LENGTH', union: "MarkingTool['kind']", file: 'src/interactions/EditorState.ts' },
  { name: 'BARLINE_SIGNS', union: 'BarlineSign', file: 'src/interactions/barlineStamp.ts' },
]

const failures = []

for (const { name, union, file } of TABLES) {
  let src
  try {
    src = readFileSync(file, 'utf8')
  } catch {
    failures.push(`${name}: ${file} is gone — the table moved, or was deleted. Update this script.`)
    continue
  }

  // The declaration: everything between `const NAME` and the `= {` that opens the table.
  const decl = new RegExp(`(?:export )?const ${name}\\s*:([^=]*)=`).exec(src)
  if (!decl) {
    failures.push(`${name}: no explicit type annotation in ${file}.\n`
      + `    An inferred type is total over whatever rows happen to be there, which is not a check.`)
    continue
  }

  const type = decl[1].replace(/\s+/g, ' ').trim()

  // ⭐ Total: a Record over the union, or a mapped type over it. Both make `tsc` name the missing kind.
  const total = new RegExp(`Record<\\s*${escape(union)}\\s*,`).test(type)
    || new RegExp(`\\[\\s*\\w+\\s+in\\s+${escape(union)}\\s*\\]`).test(type)

  if (/Partial\s*</.test(type)) {
    failures.push(`${name}: declared \`Partial<…>\` — every member optional, so a kind can be forgotten.\n    ${file}: ${type}`)
  } else if (/\[\s*\w+\s*:\s*(string|number)\s*\]/.test(type)) {
    failures.push(`${name}: declared with an INDEX SIGNATURE — it answers for keys that do not exist.\n    ${file}: ${type}`)
  } else if (/(\[\]\s*$|^Array\s*<|ReadonlyArray\s*<)/.test(type)) {
    failures.push(`${name}: declared as an ARRAY — a list has no keys, so nothing is required.\n    ${file}: ${type}`)
  } else if (!total) {
    failures.push(`${name}: not total over \`${union}\`.\n    ${file}: ${type}\n`
      + `    Expected \`Record<${union}, …>\` or a mapped type \`{ [K in ${union}]: … }\`.`)
  }
}

function escape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

if (failures.length) {
  console.error(`\n✗ ${failures.length} registry no longer refuses a kind that forgot its row:\n`)
  for (const f of failures) console.error(`  ${f}\n`)
  console.error(`  These tables answer "what does kind K do?", and such a table is worth having ONLY
  when the compiler refuses a kind with no row. If a kind genuinely cannot state one, that is
  evidence the abstraction is wrong — the fix is an OPTIONAL MEMBER on the spec, never a hole in
  the table. See docs/plans/span-mark-family-plan-2026-08-24.md Phase 3 [A4].
`)
  process.exit(1)
}

console.log(`✓ ${TABLES.length} kind-tables still declared total.`)
