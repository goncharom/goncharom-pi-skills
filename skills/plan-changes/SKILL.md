---
name: plan-changes
description: Plans and sketches code or codebase changes without editing project files. Use when the user asks to plan, sketch, propose, or review changes before implementation. Creates a new commentable HTML plan in ./.miru/ and writes nowhere else.
compatibility: Writes are limited to ./.miru/ under the current working directory. The generated HTML uses browser localStorage and the Clipboard API.
---

# Plan Changes

This is a planning-only skill. Inspect freely. Do not implement.

## Hard rules

- Allowed writes: only new files under `./.miru/` in the current working directory.
- Forbidden writes: any other file or directory, including source files, tests, docs, configs, temp files, caches, or supporting files outside `./.miru/`.
- Never edit existing project files while using this skill.
- Every plan revision must be a new HTML file. Do not overwrite an older plan unless the user explicitly asks.
- Use the template at `templates/plan-template.html`.
- Prefer the helper at `tools/build-plan-html.js` to inject plan data safely.
- Default output location is the current working directory, not the repo root, unless the user explicitly asks otherwise.

## When to use

Use this skill when the user wants any of the following without code edits:

- a plan
- a sketch of changes
- a proposal for how code would look
- a pre-implementation review
- diff-like or pseudocode-style guidance
- a revision artifact they can comment on before implementation

## Output requirements

- Create `./.miru/` if it does not exist.
- Filename format: `YYYY-MM-DD_HHMMSS_meaningful-slug.html`
- The slug should be short, task-specific, and kebab-case.
- The HTML must remain self-contained.
- The rendered plan should be line-oriented so the user can attach inline comments at line level.
- The template already handles local comment persistence and clipboard export. Do not remove that behavior.
- The clipboard export must contain the full plan plus any inline comments with line metadata.
- Subsequent revisions are separate new HTML files.

## Workflow

1. Read and inspect only the files needed to understand the request.
2. Decide a clear plan title and slug.
3. Generate a timestamp for the filename.
4. Create `./.miru/` if needed.
5. Write the plan as plain text lines. Use blank lines where helpful. No fixed section structure is required.
6. Build the HTML from `templates/plan-template.html`.
7. Write the new HTML file to `./.miru/`.
8. Reply with:
   - the created file path
   - a short summary of the plan
   - a reminder that the page's `Done: Save comments + Copy` button persists comments locally and copies the plan+comments to the clipboard

## Recommended build command

From the current working directory, prefer this pattern:

```bash
mkdir -p .miru

timestamp="$(date +%Y-%m-%d_%H%M%S)"
slug="meaningful-task-slug"
title="Meaningful task title"
out=".miru/${timestamp}_${slug}.html"

node /home/kyototech/.pi/agent/skills/plan-changes/tools/build-plan-html.js \
  --template /home/kyototech/.pi/agent/skills/plan-changes/templates/plan-template.html \
  --out "$out" \
  --title "$title" \
  --generated-at "$timestamp" \
  --source-path "$out" <<'EOF'
<plan text here>
EOF
```

## Fallback

If `node` is unavailable, read `templates/plan-template.html` and replace `__PLAN_DATA_JSON__` with a JSON object containing:

- `title`
- `generatedAt`
- `sourcePath`
- `planLines`

When embedding JSON in the HTML, escape `<`, `>`, and `&` as unicode escapes so the JSON remains safe inside the script tag.

## Plan writing guidance

- Be concrete about affected files, APIs, data flow, and risks.
- Sketch code when useful, but do not apply edits.
- Keep the plan readable as plain text when copied to the clipboard.
- Since comments are line-level, prefer one idea per line when practical.
- If you include code examples, keep them short and explanatory.

## Final check

Before finishing, verify:

- no files outside `./.miru/` were written
- the HTML file exists
- the HTML file is new, not an overwrite of an older revision
- the user has enough context to open the file and comment on it
