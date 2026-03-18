# CLAUDE.md

Project-specific instructions for Claude Code.

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
