---
name: code-review
description: Generates a minimal commentable HTML code review for the current git repo by rendering either the current uncommitted changes or a user-specified commit delta into ./.miru/. Use when the user wants to review code changes, inspect a diff in HTML, or leave line comments before applying feedback.
compatibility: Requires git and node. Writes are limited to ./.miru/ under the current working directory. Syntax highlighting uses highlight.js loaded from cdnjs at page runtime.
---

# Code Review

Generate a review-only HTML artifact. Inspect freely. Do not implement code changes while using this skill.

## Hard rules

- Allowed writes: only new files under `./.miru/` in the current working directory.
- Forbidden writes: any other file or directory, including source files, tests, docs, configs, temp files, caches, or supporting files outside `./.miru/`.
- Never edit existing project files while using this skill.
- Every review revision must be a new HTML file. Do not overwrite an older review unless the user explicitly asks.
- Use the template at `templates/review-template.html`.
- Prefer the helper at `tools/build-review-html.js`.
- Default output location is the current working directory, not the repo root, unless the user explicitly asks otherwise.

## When to use

Use this skill when the user wants any of the following without code edits:

- a code review artifact
- a browser-friendly view of current git changes
- a diff page with inline comments
- feedback collection before implementation or revision
- a review page they can comment on and copy back into another tool or LLM

## Output requirements

- Create `./.miru/` if it does not exist.
- Filename format: `YYYY-MM-DD_HHMMSS_meaningful-slug.html`
- The slug should be short, task-specific, and kebab-case.
- By default, the HTML should render all current repo changes, including untracked files.
- If the user specifies a commit delta, render that explicit `git diff` range instead.
- The page should keep comments locally and copy review comments to the clipboard.
- The page should include a left file-nav and inline unified diff rows.
- Individual file diffs should be collapsible in the generated page.
- The generated file should still be readable if CDN syntax-highlighting assets fail to load.
- Subsequent revisions are separate new HTML files.

## Workflow

1. Verify the current working directory is inside a git repo.
2. Decide the review target:
   - Default: current uncommitted changes plus untracked files.
   - Optional explicit commit delta: if the user specifies commits or refs, use `--base <older-ref>` and `--head <newer-ref>`.
3. Decide a clear review title and slug.
4. Generate a timestamp for the filename.
5. Create `./.miru/` if needed.
6. Build the HTML from `templates/review-template.html` using `tools/build-review-html.js`.
7. Write the new HTML file to `./.miru/`.
8. Reply with:
   - the created file path
   - a short summary of the reviewed changes
   - a reminder that the page's `Done: Save comments + Copy` button persists comments locally and copies the review comments to the clipboard

## Recommended build command

From the current working directory, prefer this pattern:

```bash
repo="$(git rev-parse --show-toplevel)"
mkdir -p .miru

timestamp="$(date +%Y-%m-%d_%H%M%S)"
slug="meaningful-review-slug"
title="Code review"
out=".miru/${timestamp}_${slug}.html"

extra_args=()
# For an explicit commit delta, for example:
# extra_args=(--base "HEAD^" --head "HEAD")

node /home/kyototech/.pi/agent/skills/code-review/tools/build-review-html.js \
  --template /home/kyototech/.pi/agent/skills/code-review/templates/review-template.html \
  --out "$out" \
  --title "$title" \
  --generated-at "$timestamp" \
  --source-path "$out" \
  --repo "$repo" \
  "${extra_args[@]}"
```

## Notes

- The builder auto-detects the repo root and review mode metadata from the repo state unless explicit `--base` and `--head` refs are provided.
- By default, tracked changes are collected from `git diff HEAD`.
- In explicit commit-delta mode, tracked changes are collected from `git diff <base> <head>`.
- Untracked files are added as synthetic all-add sections only in the default working-tree mode.
- `.miru/` paths are ignored so the review does not include prior review artifacts.
- Syntax highlighting is runtime-only via CDN `<link>` and `<script>` tags in the template.
- If highlighting fails to load, the review page should still work as plain code.

## Final check

Before finishing, verify:

- no files outside `./.miru/` were written while using this skill
- the HTML file exists
- the HTML file is new, not an overwrite of an older revision
- the user has enough context to open the file and comment on it
