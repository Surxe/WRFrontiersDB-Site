---
name: authoring-agent-docs
description: Decide where a new piece of agent guidance belongs (skill, rule, hook, or memory) and how to add it in this repo. Load when adding or changing a skill, rule, convention, or agent instruction, or when unsure whether something should be always-on or lazily loaded.
---

# Authoring agent docs

`.agents/` is the single source of truth for agent-facing docs. Tool-specific
directories (`.claude/`, `.windsurf/`, `.cursor/`) are gitignored symlinks into
it, created by `.agents/setup-symlinks.sh`. When adding guidance, decide the
*form* first (this skill), then drop it in the right place - the symlinks make it
visible to every tool with no extra step.

## The homes and how each loads

| Home | What loads, and when | Scope |
| --- | --- | --- |
| `.agents/skills/<name>/SKILL.md` | Frontmatter `name` + `description` is **always** preloaded as an index; the **body loads lazily** only when a tool judges it relevant. | Committed, all tools (via symlink) |
| `.agents/rules/<name>.md` | Loaded **always-on by Windsurf/Cursor**. **Claude Code does NOT auto-load rules** - Claude sees a rule only if a skill points at it (see "referenced-only"). | Committed, Windsurf/Cursor |
| Repo-root `CLAUDE.md` | Loaded **eagerly and in full** every turn by Claude (imports too). The only true always-on channel for Claude. | Committed, Claude |
| `.claude/settings.json` hook / permission | **Deterministic enforcement** at the tool boundary. Zero model context. | Committed, Claude |
| Per-user agent memory (outside the repo) | Index preloaded, body on recall - the memory model. But **per-user, uncommitted, and keyed to wherever the tool launches from** (often a parent of the repo), so it is NOT repo-scoped. | Personal, not the repo |

Key mechanic: **a skill's `description` is always loaded.** So converting a
one-line rule into a skill saves nothing - you just move that line from an
always-on rule into an always-on description and add an empty lazy body. Skills
pay off only when the **body is much larger than its trigger**.

## Decision guide

Work top to bottom; take the first match.

1. **Is it an enforceable prohibition or safety constraint** ("never run X",
   "never write to Y")? -> **Hook or permission** in `.claude/settings.json`
   (use the `update-config` skill). Deterministic, out of context, and it
   doesn't rely on the model remembering. Prohibitions make poor lazy skills:
   they have no positive trigger, so the model can't know to load them until
   after the mistake.

2. **Is it substantial knowledge or a procedure with a recognizable trigger**
   (body >> its one-line description)? -> **Skill**. Examples here:
   `core-components` (load when editing components), `support-new-object-type`
   (load when adding an object type), `run-dev-server` (load when running the
   app). Write a description that names the trigger.

3. **Is it reference knowledge only ever needed inside one procedure?** ->
   **Referenced-only.** Either keep it inline in that skill, or, if it is also
   useful standalone or bloats the parent, split it into its own skill and have
   the parent say "load the X skill" (e.g. `interface-data-map`, referenced by
   `interface-reviewer`). A plain `.agents/rules/*.md` that a skill points at is
   also referenced-only for Claude - that is exactly how `not_implemented.md`
   reaches Claude (via the test skills' descriptions).

4. **Must it apply on every turn, has no positive trigger, and can't be
   hooked?** -> **Eager `CLAUDE.md`**. Use sparingly; keep it thin and
   universal-only. This repo currently has none by choice - prefer skills/hooks
   first and reach for eager only when a rule genuinely can't be triggered.

5. **Is it always-on guidance for Windsurf/Cursor but not Claude?** ->
   `.agents/rules/<name>.md`. Remember Claude won't auto-load it.

6. **Is it a personal, cross-repo note for yourself, not project guidance?** ->
   your tool's per-user memory (outside the repo), not this repo. There is no
   committed, repo-scoped memory file that loads lazily - a skill is the
   repo-scoped equivalent of that behavior.

## How to add each

### A skill

1. Create `.agents/skills/<kebab-name>/SKILL.md`. The file MUST be named
   `SKILL.md` - Claude discovers skills only by that filename.
2. Add frontmatter:
   ```
   ---
   name: <kebab-name>            # match the directory name
   description: <what it does AND when to load it, with trigger keywords>
   ---
   ```
3. Write the body. Supporting files (scripts, examples) can live alongside
   `SKILL.md` in the same dir.
4. No symlink step needed - `.claude/skills` already points at the skills dir,
   so a new subdirectory appears immediately. (Run `.agents/setup-symlinks.sh`
   only on a fresh checkout where the symlinks don't exist yet.)

### A rule (Windsurf/Cursor)

Create `.agents/rules/<name>.md`. Plain markdown; keep it short. It will NOT
reach Claude unless a skill references it - if Claude needs it, prefer a skill.

### A hook or permission

Use the `update-config` skill to edit `.claude/settings.json` (PreToolUse hooks,
permission allow/deny). This is the right tool for automatic or enforced
behavior - memory and prose cannot enforce anything.

### Eager Claude context

Add or edit a repo-root `CLAUDE.md`. It can `@import` files to stay DRY, but
imports load eagerly too - only put universal, every-turn content here.

## Writing a good description (the index line)

The description is the entire always-loaded footprint, so make it earn its place:

- State **what it does** and **when to load it**, with concrete trigger words -
  don't just restate the skill name.
- Add distinguishing hints when skills overlap (e.g. `interface-reviewer` for
  design questions vs `interface-data-validator` for exact counts).
- Avoid an unquoted `: ` (colon-space) inside the value - it breaks YAML
  frontmatter parsing. Reword instead.
- Keep it one line.
