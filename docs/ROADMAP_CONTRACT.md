# Roadmap document contract

Voyages reads project milestones and checklist tasks directly from the repository's canonical Markdown roadmap. The first connected source is jenozu/trade-alerts/main/phases.md. No changes have been made to that source repo.

## Supported MVP format

```markdown
# Example roadmap

# Phase 0 — Foundation
## Goal
Establish a reproducible baseline.
## Implementation
- [x] Clone the repository <!-- task:T001 -->
- [ ] Run and record baseline tests <!-- task:T002 -->

# Phase 1 — Develop
## Goal
Implement the next milestone.
## Implementation
- [ ] Add core features <!-- task:T003 -->
```

* A heading of the form # Phase N — Name creates an island.
* Checkbox items under each phase are quests.
* ## Goal supplies an island's objective.
* Other Markdown headings group the quests in the detail panel.
* Fenced code blocks are ignored by the importer.
* Optional task IDs (HTML comments) help future two-way editing preserve identity if the source document changes.
* Until write-back is implemented, checking a quest means updating the actual Markdown file in GitHub or via your coding assistant.
* Completion is computed from checklist boxes, never assumed from a new commit. GitHub's recent file commits are a separate activity feed.
* Repeated verification checkboxes are counted separately; the imported source determines the denominator.

## Security

The first release reads public repository Markdown. The server never exposes a GitHub write credential and has no unauthenticated mutation endpoint. Two-way synchronization will be added with authenticated administrator requests, server-side write credentials, pull request review, signed push webhooks and a repository allowlist. GitHub secret keys must never be committed.

## Current product scope

Multiple public projects may be added locally from their owner/repo + branch + Markdown path. Local browser storage keeps the project list and individually dragged island locations. These settings do not sync across devices yet; persistence and signed webhooks belong in the Neon-backed phase.
