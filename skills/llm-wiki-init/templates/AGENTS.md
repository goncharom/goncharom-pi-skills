# AGENTS.md

This repository is a persistent LLM-maintained wiki. You own maintaining the wiki as a long-lived knowledge base that sits between raw sources and user-facing synthesis.

## Wiki Configuration

- Wiki name: {{WIKI_NAME}}
- Purpose/domain: {{WIKI_PURPOSE}}
- Primary use: {{PRIMARY_USE}}
- Structure level: {{STRUCTURE_LEVEL}}
- Preferred tooling: {{PREFERRED_TOOLING}}
- Provenance mode: {{PROVENANCE_MODE}}
- Save durable query outputs by default: {{SAVE_QUERY_OUTPUTS_DEFAULT}}

### Expected source types
{{SOURCE_TYPES}}

### Expected output types
{{OUTPUT_TYPES}}

### Suggested page families
{{SUGGESTED_PAGE_FAMILIES}}

### Naming guidance
{{NAMING_GUIDANCE}}

## Repository Structure

- `raw/` contains immutable source material.
- `wiki/` contains agent-maintained markdown pages.
- `wiki/index.md` is the content-oriented catalog of the wiki.
- `wiki/log.md` is the chronological append-only history of operations.
- `wiki/overview.md` is the top-level synthesis and orientation page.

Do not modify files in `raw/`.

## Source of Truth Rules

1. Raw sources are the immutable source of truth.
2. The wiki is a maintained synthesis layer built from raw sources and prior wiki work.
3. Preserve uncertainty and disagreement explicitly; do not flatten contradictions silently.
4. Prefer updating existing wiki pages over creating unnecessary new pages.
5. Keep the wiki navigable with links, summaries, and index updates.

## Core Workflows

### Ingest

When asked to ingest a source, always do the following:

1. Read the source from `raw/`.
2. Extract or infer basic metadata where possible.
3. Create or update a wiki page for that source.
4. Identify existing wiki pages impacted by the source.
5. Update impacted pages with new information, links, and synthesis.
6. If new concepts or entities clearly deserve pages, create them.
7. Record tensions, contradictions, or superseded claims explicitly.
8. Update `wiki/index.md`.
9. Append an entry to `wiki/log.md`.

### Query

When answering a question against the wiki, always do the following:

1. Read `wiki/index.md` first.
2. Read the relevant wiki pages.
3. Synthesize the answer from the wiki and cited source pages.
4. Cite the wiki pages and source pages used when practical.
5. If the output is durable and useful, ask whether to save it into the wiki unless saving is already the configured default.
6. If saved, update `wiki/index.md` and append to `wiki/log.md`.

### Lint

When asked to lint or health-check the wiki, you MUST always check EVERY following step. Name them out loud before you work on them. Do them in order:

- orphan pages
- missing links or weak cross-references
- missing summaries
- contradictions or contested claims
- stale pages
- likely duplicate pages
- concepts repeatedly mentioned without dedicated pages
- structural issues in `index.md` or `log.md`

After linting:

1. Report findings clearly.
2. If changes are made, update affected pages.
3. Append a lint entry to `wiki/log.md`.

## Index Rules

`wiki/index.md` is the primary navigation file.

It must:

- list important wiki pages
- include a short description for each page
- remain organized enough for the agent to scan before deeper reads
- be updated whenever major pages are created, renamed, merged, or removed

## Log Rules

`wiki/log.md` is append-only.

Every major operation should append a dated entry using this format:

`## [YYYY-MM-DD] <operation> | <subject>`

Valid operation labels include:

- `init`
- `ingest`
- `query`
- `lint`
- `maintenance`

Each log entry should briefly note:

- what happened
- which pages were created or updated
- any notable issues or follow-up ideas

## Editing Rules

- Never edit `raw/` sources.
- Keep markdown readable and plain.
- Prefer concise sections and explicit links.
- Avoid unnecessary page proliferation.
- When in doubt, update an existing page before creating a new one.
- Keep naming consistent with the configuration guidance above.
- Preserve provenance according to the configured provenance mode.

## Provenance Rules

If provenance mode is `light`:

- cite relevant source pages in the surrounding section or related-sources area
- make it easy to trace important claims back to source pages

If provenance mode is `strict`:

- ensure nontrivial claims are traceable to specific source pages
- avoid unsupported synthesis statements
- prefer explicit source references in the relevant section

## Page Creation Heuristics

Create a new page when at least one of these is true:

- the concept or entity is central and recurs across multiple sources
- the page would reduce confusion or duplication elsewhere
- the user explicitly asks for the page
- a query produces a durable analysis worth preserving

Do not create a new page merely because a term appears once.

## Style of Work

- Treat the wiki as a persistent artifact that compounds over time.
- Make incremental, maintainable updates.
- Preserve disagreement, uncertainty, and open questions.
- Help the user grow a useful wiki, not just answer one-off questions.
