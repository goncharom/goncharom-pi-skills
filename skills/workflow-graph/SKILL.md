---
name: workflow-graph
description: Answers a workflow question by tracing only the relevant code path and generating a compact HTML workflow graph plus full-file viewer in ./.miru/. Use when the user wants to understand how a specific request, event, job, route, or UI action flows through the codebase without editing project files.
compatibility: Writes are limited to ./.miru/ under the current working directory. Requires node to build the HTML artifact. Syntax highlighting uses highlight.js loaded from cdnjs at page runtime.
---

# Workflow Graph

Generate a workflow-only HTML artifact. Inspect freely. Do not implement code changes while using this skill.

## Hard rules

- Allowed writes: only new files under `./.miru/` in the current working directory.
- Forbidden writes: any other file or directory, including source files, tests, docs, configs, temp files, caches, or supporting files outside `./.miru/`.
- Never edit existing project files while using this skill.
- Every workflow revision must be a new HTML file. Do not overwrite an older artifact unless the user explicitly asks.
- Use the template at `templates/workflow-template.html`.
- Prefer the helper at `tools/build-workflow-html.js`.
- Default output location is the current working directory, not the repo root, unless the user explicitly asks otherwise.
- Understand and trace the workflow before building the graph.
- If the question is too broad, narrow it or ask one clarifying question.
- Scope the graph to the question, not the whole repo.
- Bias toward fewer, higher-signal nodes. Prefer a missing minor helper over unreadable spaghetti.

## When to use

Use this skill when the user wants any of the following without code edits:

- a workflow trace for a route, command, event, job, or UI action
- a question-scoped data-flow or control-flow graph
- a compact browser artifact that explains how a feature works
- a handoff graph with evidence and linked source files
- a file viewer that opens the exact files behind the traced workflow

## Output requirements

- Create `./.miru/` if it does not exist.
- Filename format: `YYYY-MM-DD_HHMMSS_question-slug.html`
- The slug must derive from the workflow question and stay short, specific, and kebab-case.
- The HTML must remain self-contained.
- The layout must stay two-pane only: graph pane plus file viewer pane.
- Do not add a left navigation pane for the MVP.
- The graph must stay question-scoped, not repo-wide.
- By default, target roughly 8 to 16 nodes.
- Include entrypoints, major handoffs, data boundaries, and side effects.
- Omit generic utils, barrels, trivial wrappers, and low-signal shared code.
- Dedupe repeated files when multiple nodes point into the same file.
- Embed only the full contents of files that correspond to selected nodes.
- Prefer symbol-level nodes when possible.
- Every node must map back to one concrete file path.
- Every useful node should include `lineStart` and `lineEnd` when the initial focus should land on a specific symbol.
- Use semantic edge labels like `calls`, `handles`, `reads`, `writes`, `renders`, `validates`, or `transforms`.
- Every edge should carry a short evidence string.
- Clicking a node should open the mapped file. First open should focus the preferred lines when present. A repeat click on the same node should toggle focused lines vs. top-of-file.
- Clicking an edge should highlight its source and target and show the edge evidence in the compact header area.
- Support zoom, pan, and fit-to-graph.
- Syntax highlighting should remain optional and graceful if the CDN fails.

## Workflow

1. Understand the user question.
2. If the question is too broad, narrow it or ask one clarifying question.
3. Inspect only the files needed to locate the entrypoint and trace the relevant path forward.
4. Curate the main nodes involved. Keep the graph compact.
5. Capture the full contents of every selected file.
6. Decide a clear artifact title and a question-based slug.
7. Generate a timestamp for the filename.
8. Create `./.miru/` if needed.
9. Build a JSON payload with:
   - `question`
   - `title`
   - `generatedAt`
   - `sourcePath`
   - `nodes[]` with `id`, `label`, `kind`, `filePath`, `symbol`, `lineStart`, `lineEnd`, `group`, and optional `omittedCount`
   - `edges[]` with `from`, `to`, `kind`, and `evidence`
   - `files[]` with `path`, `language`, and `content`
   - `initialSelection` with `nodeId` or `filePath`
10. Build the HTML from `templates/workflow-template.html` using `tools/build-workflow-html.js`.
11. Write the new HTML file to `./.miru/`.
12. Reply with:
    - the created file path
    - a short summary of the traced workflow
    - a reminder that nodes open embedded files, repeat-click toggles line focus, and the graph supports zoom/pan/fit

## Recommended build command

From the current working directory, prefer this pattern:

```bash
skill_dir="<absolute path to this skill directory>"
mkdir -p .miru

timestamp="$(date +%Y-%m-%d_%H%M%S)"
slug="question-slug"
title="Workflow graph"
out=".miru/${timestamp}_${slug}.html"

node "$skill_dir/tools/build-workflow-html.js" \
  --template "$skill_dir/templates/workflow-template.html" \
  --out "$out" \
  --title "$title" \
  --question "How does this workflow work?" \
  --generated-at "$timestamp" \
  --source-path "$out" <<'EOF'
{
  "question": "How does this workflow work?",
  "title": "Workflow graph",
  "nodes": [],
  "edges": [],
  "files": [],
  "initialSelection": {}
}
EOF
```

## Notes

- The builder accepts JSON from stdin or `--input <path>`.
- The builder computes a simple deterministic left-to-right layout before writing the HTML.
- The artifact embeds only the selected files, not the whole repo.
- Use omitted helper counts sparingly when a node intentionally hides noisy internals.

## Final check

Before finishing, verify:

- no files outside `./.miru/` were written while using this skill
- the HTML file exists
- the HTML file is new, not an overwrite of an older revision
- the graph is readable and scoped to the question
- every selected node maps to an embedded file
- the user has enough context to open the file and inspect the trace
