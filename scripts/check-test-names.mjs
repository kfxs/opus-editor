#!/usr/bin/env node
/**
 * `npm run lint:testnames` — the naming ratchet (docs/test-layout-plan.md, phase 3b).
 *
 * THE RULE: a `*.test.ts` outside a `__tests__/` folder must have a sibling module matching its
 * name up to the first dot. `ScoreModel.fan.test.ts` is chapter "fan" of `ScoreModel.ts`, sitting
 * beside it. A spec whose subject is not in its name reads as homeless in the directory listing —
 * which is the drift this ratchet exists to stop recurring.
 *
 * Bill it honestly: it catches only the DELETE-shaped split, where a module is dissolved or renamed
 * and its specs are left pointing nowhere. This repo's splits so far all extract-and-keep, so the
 * rule would have been green through every one of them. Cheap insurance, not the payoff — the check
 * with signal points the other way (`npm run audit:tests`).
 *
 * The allowlist below is Phase 4's move set, computed rather than guessed: whatever still failed
 * after the Phase 1–2 renames. These are genuine feature tests, not specs — they drive a
 * `MusicEngine` plus controllers and name no single module, so no rename can satisfy the rule. The
 * answer is `__tests__/`, which Phase 4 does on demand. Until then they are listed here, and the
 * list only shrinks.
 */
import { readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, basename, relative } from 'node:path'

const SRC = 'src'

/**
 * Tests with no sibling subject, awaiting Phase 4's move to `__tests__/`. SHRINK THIS, never grow
 * it — a new entry means a new homeless spec, which is the thing the rule is for.
 *
 *  - `rendering/` ×3: import nothing but `../MusicEngine`. Their subject lives one directory up, so
 *    they can never satisfy the rule by renaming (a consequence the plan accepts deliberately).
 *    `ghostContextLeak` left this list on 2026-07-28: it drives a `MusicEngine`, but everything it
 *    asserts is the ghost draw path, whose module `GhostRenderer.ts` sits right beside it — so it
 *    renamed to `GhostRenderer.contextLeak.test.ts` instead (modularity plan Phase 0).
 *  - `interactions/` ×3: scenario tests that build a MusicEngine and drive controllers/clipboard.
 *    The five `*Travel` specs left this list on 2026-07-30 — a beam / a tremolo / a fan / an offset
 *    / a spacing "travels with the music" is one question asked of the whole relay, naming no single
 *    module, which is exactly what `__tests__/` is for. `beamTravel` had never been listed at all
 *    (it arrived in `b2b02ae` and the row was never added), so the check had been red ever since;
 *    moving the family is the fix the rule actually asks for, and it SHRINKS this list.
 *  - `staveGeometry`: imports `vexflow` and nothing else — a probe of VexFlow's own behaviour, with
 *    no subject in this repo at all. Unresolved; see the plan's decision 6.
 */
const ALLOWLIST = [
  'src/engine/rendering/dotRegistration.test.ts',
  'src/engine/rendering/ledgerLineStyle.test.ts',
  'src/engine/rendering/noteSpacingRender.test.ts',
  'src/engine/rendering/staveGeometry.test.ts',
  'src/interactions/fanPress.test.ts',
  'src/interactions/tremoloDelete.test.ts',
  'src/interactions/tremoloEntry.test.ts',
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (entry.endsWith('.test.ts')) out.push(relative('.', p).replace(/\\/g, '/'))
  }
  return out
}

const tests = walk(SRC).filter(t => !t.split('/').includes('__tests__'))

const allowed = new Set(ALLOWLIST)
const homeless = []
const staleAllowlist = []

for (const t of tests) {
  const subject = basename(t, '.test.ts').split('.')[0]
  const hasSibling = existsSync(join(dirname(t), subject + '.ts'))
  if (hasSibling) {
    if (allowed.has(t)) staleAllowlist.push(`${t} — now has a sibling ${subject}.ts`)
  } else if (!allowed.has(t)) {
    homeless.push({ t, subject })
  }
}

const present = new Set(tests)
for (const a of ALLOWLIST) {
  if (!present.has(a)) staleAllowlist.push(`${a} — no longer exists (moved or deleted?)`)
}

if (homeless.length) {
  console.error(`\n✗ ${homeless.length} test file${homeless.length === 1 ? '' : 's'} with no sibling module of that name:\n`)
  for (const h of homeless) {
    console.error(`  ${h.t}`)
    console.error(`      expected a sibling ${join(dirname(h.t), h.subject + '.ts')}`)
  }
  console.error(`
  A spec is named after its subject, sitting beside it: Subject.topic.test.ts.
  Fix by ONE of:
    · rename it after the module its assertions are actually on — the identifier inside
      expect(...), not the dominant import (docs/test-layout-plan.md decision 4);
    · if it drives several modules and names none, it is a feature test — put it in a
      __tests__/ folder beside them;
    · if it genuinely cannot be either, add it to ALLOWLIST in this file, with a reason.
`)
}

if (staleAllowlist.length) {
  console.error(`✗ ${staleAllowlist.length} stale ALLOWLIST entr${staleAllowlist.length === 1 ? 'y' : 'ies'} in scripts/check-test-names.mjs — delete:\n`)
  for (const s of staleAllowlist) console.error(`  ${s}`)
  console.error('')
}

if (homeless.length || staleAllowlist.length) process.exit(1)

console.log(`✓ ${tests.length} test files, each named after a sibling module` +
            ` (${ALLOWLIST.length} allowlisted for Phase 4).`)
