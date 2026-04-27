---
title: "bd CLI silently fails after v1.0.0 upgrade — JSONL and Dolt DB drift"
category: "gotchas"
date: "2026-04-26"
tags: [beads, dolt, git-hooks, sync, tooling]
files: [.beads/issues.jsonl, .git/hooks/pre-commit, .git/hooks/post-merge]
---

# bd CLI silently fails after v1.0.0 upgrade — JSONL and Dolt DB drift

## Problem

`bd close <id>` returned `Error: no issue found matching "parentbench-rg3.3"` — even though the issue was clearly present in `.beads/issues.jsonl`. `bd list --status=open` returned `No issues found.` while the JSONL had ~190 issues.

Symptoms:
- `bd list` returns "No issues found" despite a populated JSONL
- `bd show <known-id>` returns "no issue found"
- Every `git commit` printed: `Warning: bd sync --flush-only failed, continuing anyway`
- Manually editing `.beads/issues.jsonl` to close issues "worked" (the file diff was small) but the bd CLI never reflected those changes

## Root Cause

Three bugs compounded:

1. **JSONL data shape regression.** Four comment IDs in `.beads/issues.jsonl` were stored as JSON ints (`"id": 4`) instead of strings (`"id": "4"`). `bd import` errored on the first one with: `failed to parse issue from JSONL: json: cannot unmarshal number into Go struct field Comment.comments.id of type string`. Result: the embedded Dolt DB could never catch up to the JSONL.

2. **Pre-commit hook broken in bd v1.0.0.** `.git/hooks/pre-commit` calls `bd sync --flush-only` (removed in v1.0.0). Its fallback heuristic — `bd help sync` — returns exit 0 even for unknown topics (cobra default), so the hook can't tell the command was removed. The hook prints the warning and returns 0 without ever flushing DB → JSONL.

3. **Post-merge hook broken in bd v1.0.0.** `.git/hooks/post-merge` calls `bd import -i <file>`. The `-i` flag was dropped in v1.0.0; the current syntax is positional. bd silently shows help and returns exit 0, so the hook reports success while never importing.

Net effect: writes to the DB were never exported to JSONL, and JSONL changes from `git pull` were never imported into the DB. The two diverged. Without working bidirectional sync, the bd CLI gradually became disconnected from the source of truth.

## Solution

Three fixes:

### 1. Stringify the bad comment IDs

```python
import json
with open('.beads/issues.jsonl') as f:
    lines = []
    for line in f:
        if not line.strip():
            lines.append(line.rstrip('\n')); continue
        obj = json.loads(line)
        for c in obj.get('comments') or []:
            if 'id' in c and not isinstance(c['id'], str):
                c['id'] = str(c['id'])
        lines.append(json.dumps(obj, ensure_ascii=False))
with open('.beads/issues.jsonl', 'w') as f:
    f.write('\n'.join(lines) + '\n')
```

Then `bd import .beads/issues.jsonl` succeeded.

### 2. Patch the pre-commit hook

Replace the broken sync block in `.git/hooks/pre-commit`:

```sh
# Flush pending changes to JSONL.
# bd v1.0.0 removed `sync`; the upstream fallback heuristic (`bd help sync`)
# returns 0 even for unknown topics, so the original detection never falls
# through. Use `bd export` directly via a temp file so a partial write never
# corrupts the JSONL.
if bd export > "$BEADS_DIR/issues.jsonl.tmp" 2>/dev/null; then
    mv "$BEADS_DIR/issues.jsonl.tmp" "$BEADS_DIR/issues.jsonl"
else
    rm -f "$BEADS_DIR/issues.jsonl.tmp"
    echo "Warning: bd export failed, continuing anyway" >&2
fi
```

The temp-file pattern matters: a half-written export from a SIGINT'd commit would otherwise corrupt the JSONL.

### 3. Patch the post-merge hook

Replace the `-i` flag with the positional form:

```sh
if ! bd import "$BEADS_DIR/issues.jsonl" >/dev/null 2>&1; then
    echo "Warning: Failed to import bd changes after merge" >&2
fi
```

### 4. Canonicalize the JSONL once

After the hook is patched, `bd export > .beads/issues.jsonl` produces canonical output (UTC timestamps, `dependency_count`/`dependent_count`/`comment_count` fields, sorted dependency arrays). The first export-to-canonical produces a noisy 192-line rewrite, but every subsequent commit's diff is then minimal and readable.

## Verification

After all three fixes:
- `bd list --status=open` returns the full issue tree
- `bd close <id>` works and the JSONL updates automatically on `git commit`
- The "Warning: bd sync --flush-only failed" message stops appearing

## Prevention

- [x] Local hook patches (committed to docs but not git-tracked since `.git/hooks/` is per-checkout)
- [ ] Watch for upstream bd v1.0.1 — likely fixes both heuristics
- [ ] If onboarding a new contributor: they need to apply the same hook patches manually, OR run a `tools/install-bd-hooks.sh` script we could add to the repo
- [ ] The JSONL data-shape regression suggests bd v1.0.0 tightened type checking on import; if `bd import` ever fails again with a "cannot unmarshal" error, it's almost certainly a single field type drift — grep for the field across the JSONL

## Diagnostic checklist when bd CLI seems broken

```bash
# Is the embedded DB present?
ls .beads/embeddeddolt/

# Does the DB see issues?
bd list --status=open | head -5

# Does the JSONL have issues?
grep -c '"issue_type"' .beads/issues.jsonl

# Can the JSONL round-trip through bd?
bd import .beads/issues.jsonl --dry-run

# Are the hooks broken?
grep -E "bd sync|bd import -i" .git/hooks/pre-commit .git/hooks/post-merge
```

If `bd list` is empty but the JSONL has rows, it's a sync drift. If `bd import` errors with a Go type error, fix the offending JSONL row(s) by hand.

## Related

- The fix landed in commit `eb5f790` (canonicalized JSONL + closed `parentbench-rg3` epic).
- `CLAUDE.md` documents `.beads/issues.jsonl` as the source of truth — that policy is what saved us, since the JSONL was always recoverable.
