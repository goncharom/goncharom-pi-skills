---
name: llm-wiki-init
description: Initializes a new LLM-maintained personal wiki with a standard folder layout, strict AGENTS.md workflows, and starter files. Use when creating a new knowledge base or Obsidian-style wiki that the agent will maintain over time.
---

# LLM Wiki Init

Initialize a new wiki with **fixed infrastructure** and **flexible ontology**.

The initialized wiki must always include:

- `raw/` for immutable source material
- `wiki/` for agent-maintained markdown
- `AGENTS.md` generated from the standard template in `templates/AGENTS.md`
- `wiki/index.md`
- `wiki/log.md`
- `wiki/overview.md`
- `README.md`

Do **not** invent a new AGENTS.md structure. Always use the template in `templates/AGENTS.md` and only fill in the configuration placeholders.

## Required questions

Before creating files, ask the user for any missing required inputs:

1. Wiki name
2. Target directory/path
3. Wiki purpose/domain
4. Expected source types
5. Expected query/output types
6. Desired structure level: `low`, `medium`, or `high`

Optional questions if relevant:

- Preferred tooling (`Obsidian`, plain markdown, Dataview, Marp, etc.)
- Provenance mode: `light` or `strict`
- Save durable query outputs by default: `yes` or `no`
- Any initial page families the user already expects

If the target directory exists and is non-empty, ask for confirmation before writing.

## Initialization workflow

Follow this workflow strictly:

1. Gather missing inputs.
2. Read these template files:
   - `templates/AGENTS.md`
   - `templates/README.md`
   - `templates/index.md`
   - `templates/log.md`
   - `templates/overview.md`
3. Derive a **wiki-specific configuration** from the user inputs:
   - concise domain summary
   - source types
   - output types
   - structure preference
   - tooling preferences
   - provenance mode
   - save-query-output default
   - suggested page families
   - naming guidance
4. Create directories:
   - `<target>/raw/`
   - `<target>/wiki/`
5. Write files:
   - `<target>/AGENTS.md`
   - `<target>/README.md`
   - `<target>/wiki/index.md`
   - `<target>/wiki/log.md`
   - `<target>/wiki/overview.md`
6. In `wiki/log.md`, create an initial initialization entry.
7. In `wiki/index.md`, register the initial core pages.
8. Report what was created and suggest the first ingest action.

## Rules for generated output

- Keep `raw/` and `wiki/` separate.
- Never pre-create detailed ontology folders unless strongly justified by the user's domain.
- If structure preference is `low`, keep `wiki/` flat except for optional future subfolders.
- If structure preference is `medium` or `high`, you may suggest page families in `AGENTS.md`, but do not force many directories at initialization time.
- The ontology is flexible. The workflow is not.
- `AGENTS.md` must always preserve the same operational sections and rules from the template.

## Placeholder filling rules

When filling templates:

- Replace every `{{PLACEHOLDER}}`.
- Use short, concrete values.
- For list placeholders, render markdown bullet lists.
- For empty optional values, write a sensible default rather than leaving placeholders behind.

## Completion checklist

Before finishing, verify:

- `AGENTS.md` exists and uses the standard template structure
- `raw/` exists
- `wiki/` exists
- `wiki/index.md` exists
- `wiki/log.md` exists
- `wiki/overview.md` exists
- `README.md` exists
- no unresolved `{{...}}` placeholders remain

## Notes

- This skill initializes the wiki only; it does not ingest sources unless the user asks.
- After initialization, suggest: “Drop a first source into `raw/` and ask me to ingest it.”
