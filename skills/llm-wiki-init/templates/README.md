# {{WIKI_NAME}}

{{WIKI_PURPOSE}}

## Structure

- `raw/` — immutable source material
- `wiki/` — LLM-maintained markdown knowledge base
- `AGENTS.md` — operating rules and workflows for maintaining the wiki

## Core files

- `wiki/index.md` — content-oriented catalog
- `wiki/log.md` — chronological history
- `wiki/overview.md` — top-level synthesis

## How to use

1. Put source material into `raw/`.
2. Ask the agent to ingest a source.
3. Ask questions against the wiki.
4. Periodically ask the agent to lint the wiki.

## Notes

- Raw files are never edited.
- The wiki is expected to evolve over time.
- Suggested page families may emerge as the wiki grows: {{PAGE_FAMILY_INLINE}}.
