#!/usr/bin/env python3
"""
Move source files into a sub-folder and rewrite every import that names them — the tool behind
docs/plans/code-shape-plan-2026-09-19.md Phase 6 items 1–2.

    python3 scripts/move-source.py src/engine/rendering ghosts GhostRenderer ghostTypes …

Each NAME takes its specs with it (`Name.test.ts`, `Name.topic.test.ts`). Rewritten, repo-wide:
  · import / export … from '…' · import('…') · vi.mock / vi.doMock / vi.importActual('…')
    — relative specifiers are re-derived from where each file NOW is; `@/…` ones stay aliased;
  · prose mentions `<folder>/<Name>` in comments, docs, scripts and lint configs.
It proves nothing by itself: run tsc, eslint, the suite and lint:doclinks after it.
"""
import os, re, subprocess, sys

base, sub, names = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3:]
SRC = 'src'
moved = {}                                    # old path → new path (with extension)
for entry in sorted(os.listdir(base)):
    stem = entry.split('.')[0]
    if stem in names and os.path.isfile(f'{base}/{entry}'):
        moved[f'{base}/{entry}'] = f'{base}/{sub}/{entry}'
missing = [n for n in names if not any(os.path.basename(p).split('.')[0] == n for p in moved)]
assert not missing, f'no such file: {missing}'
moved_noext = {re.sub(r'\.(ts|css)$', '', o): re.sub(r'\.(ts|css)$', '', n) for o, n in moved.items()}

def code_files():
    for root in ('src', 'e2e', 'perf'):
        for d, dirs, files in os.walk(root):
            dirs[:] = [x for x in dirs if x != 'node_modules']
            for f in files:
                if f.endswith('.ts'): yield f'{d}/{f}'

SPEC = re.compile(r"""(\bfrom\s+|\bimport\s*\(\s*|\bimport\s+|vi\.(?:mock|doMock|unmock|importActual|importMock)\s*(?:<[^>]*>)?\(\s*)(['"])([^'"\n]+)\2""")

def resolve(spec, from_dir):
    if spec.startswith('@/'): return os.path.normpath(f'{SRC}/{spec[2:]}'), 'alias'
    if spec.startswith('.'): return os.path.normpath(f'{from_dir}/{spec}'), 'rel'
    return None, None

def respell(target, style, new_dir):
    if style == 'alias': return '@/' + os.path.relpath(target, SRC)
    rel = os.path.relpath(target, new_dir)
    return rel if rel.startswith('.') else './' + rel

os.makedirs(f'{base}/{sub}', exist_ok=True)
edits = 0
for path in list(code_files()):
    text = open(path, encoding='utf8').read()
    old_dir = os.path.dirname(path)
    new_dir = os.path.dirname(moved.get(path, path))
    def fix(m):
        target, style = resolve(m.group(3), old_dir)
        if target is None: return m.group(0)
        new_target = moved_noext.get(re.sub(r'\.(ts|css)$', '', target))
        ext = re.search(r'\.(ts|css)$', target)
        if new_target is None:
            if new_dir == old_dir or style == 'alias': return m.group(0)
            new_target, ext = target, None          # this file moved; its target did not
        elif ext: new_target += ext.group(0)
        return f'{m.group(1)}{m.group(2)}{respell(new_target, style, new_dir)}{m.group(2)}'
    out = SPEC.sub(fix, text)
    if out != text:
        open(path, 'w', encoding='utf8').write(out); edits += 1

for old, new in moved.items():
    subprocess.run(['git', 'mv', old, new], check=True)

# prose: `<folder>/<Name>` → `<folder>/<sub>/<Name>`, wherever a path is written down
folder = os.path.basename(base)
prose = re.compile(r'\b' + re.escape(folder) + r'/(' + '|'.join(sorted(map(re.escape, names), key=len, reverse=True)) + r')\b')
touched = 0
for root in ('src', 'e2e', 'perf', 'docs', 'scripts'):
    for d, dirs, files in os.walk(root):
        for f in files:
            if not re.search(r'\.(ts|md|mjs|json|css)$', f) or f == 'move-source.py': continue
            p = f'{d}/{f}'; t = open(p, encoding='utf8').read()
            u = prose.sub(lambda m: f'{folder}/{sub}/{m.group(1)}', t)
            if u != t: open(p, 'w', encoding='utf8').write(u); touched += 1
for p in ('CLAUDE.md', '.eslintrc.boundary.json', '.eslintrc.cjs', '.eslintrc.json'):
    if os.path.exists(p):
        t = open(p, encoding='utf8').read(); u = prose.sub(lambda m: f'{folder}/{sub}/{m.group(1)}', t)
        if u != t: open(p, 'w', encoding='utf8').write(u); touched += 1
print(f'moved {len(moved)} files → {base}/{sub}/ · imports rewritten in {edits} files · prose in {touched}')
