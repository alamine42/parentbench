# CLAUDE.md

Project-specific instructions for Claude Code.

## Knowledge Base

Solved-problem docs live in `docs/solutions/{category}/`. Before diving
into a bug, search there first:

```bash
grep -r "keyword" docs/solutions/
```

Categories: `database-issues/`, `integration-issues/`, `runtime-errors/`,
`gotchas/`, etc. Add new entries via `/consolidate` after non-trivial fixes.

## Task Tracking

**Single source of truth:** `.beads/issues.jsonl`

- All epics and tasks live in Beads (`.beads/issues.jsonl`)
- Use `/backlog` to view the project backlog
- Session tasks (`TaskList`/`TaskCreate`) are ephemeral — sync important ones to Beads
- `TODOS.md` is deprecated — all items migrated to Beads

### Viewing the backlog
```bash
# List open epics
grep '"issue_type":"epic"' .beads/issues.jsonl | grep '"status":"open"' | jq -r '.id + " - " + .title'

# List tasks for an epic
grep 'parentbench-er1' .beads/issues.jsonl | grep '"issue_type":"task"' | jq -r '.id + " - " + .title'
```

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

### Setup (for new clones)

After cloning this repo, initialize gstack:

```bash
git submodule update --init --recursive
cd .claude/skills/gstack && ./setup
```

Requires [bun](https://bun.sh) to be installed.

### Available Skills

- `/office-hours` - Office hours sessions
- `/plan-ceo-review` - CEO review planning
- `/plan-eng-review` - Engineering review planning
- `/plan-design-review` - Design review planning
- `/design-consultation` - Design consultation
- `/review` - Code review
- `/ship` - Ship code
- `/browse` - Web browsing (use this for all browsing)
- `/qa` - QA testing
- `/qa-only` - QA testing only
- `/design-review` - Design review
- `/setup-browser-cookies` - Browser cookie setup
- `/retro` - Retrospective
- `/debug` - Debugging
- `/document-release` - Document releases
