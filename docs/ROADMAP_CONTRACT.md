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

* A heading of the form `# Phase N — Name`, `## M1: Name`, `## M1.1: Name` or `## Milestone 2 — Name` creates an island.
* Island names are read directly from headings, and numeric or decimal milestone IDs order the route.
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


## Quest detail display

Click a quest in its island panel to expand the source-backed instructions. A quest has **task-specific instructions** only when a checklist item has explicitly indented steps beneath it:

    - [ ] Build the webhook receiver <!-- task:T004 -->
      - Validate GitHub's signed HMAC header
      - Reject duplicate delivery IDs
      - Record errors without printing secrets

The UI distinguishes these direct instructions from **section notes** (paragraphs, code blocks and links under the same heading), the **other checklist items in the same section**, and **phase-level Done when criteria**. These neighboring tasks and phase criteria are displayed as context rather than falsely attributed to the clicked task.

Repositories like trade-alerts/phases.md often contain terse checkboxes instead of complete per-task procedures. In that case, the panel states that no specific procedure is recorded and shows the exact surrounding Markdown available. To provide richer instructions, add indented steps or a linked detail document to the source roadmap. The panel renders source Markdown, including code blocks; it does not fabricate instructions.

The quest panel has a fixed side tab for opening and closing even after scrolling a long checklist. Its header is fixed and its list scrolls independently of the map. Press Escape to close it.

## Mapping and source links

The default view is a non-linear **two-dimensional archipelago** rather than a long horizontal strip. For each project, the voyage follows the numbered milestone order through a winding, multi-row course. There is a Whole map overview, Find my ship, zoom, keyboard-accessible island selection and a Jump to island selector. Manually dragged island positions are saved locally under a v2 layout key. These visual adjustments never modify source Markdown.

Relative Markdown document links in task or section instructions point to their original GitHub repository and branch, with paths resolved relative to the roadmap file. Imported remote images are linked rather than fetched automatically, to avoid displaying potentially tracking content from arbitrary imported Markdown.

## Progress observation

The live values always come from the source checkbox file, re-read every 90 seconds or manually. The dashboard also compares task identity/status across visits in this browser and records verified **status transitions detected on sync**, using phase, section and normalized task title where no explicit task ID exists. This history has detection timestamps and can miss intermediate changes between refreshes; it is not an immutable GitHub event log, and moving to Neon + signed push webhooks remains a future task.
