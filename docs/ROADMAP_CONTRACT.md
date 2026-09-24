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


## Quest detail display

Click a quest in its island panel to expand the source-backed instructions. A quest has **task-specific instructions** only when a checklist item has explicitly indented steps beneath it:

    - [ ] Build the webhook receiver <!-- task:T004 -->
      - Validate GitHub's signed HMAC header
      - Reject duplicate delivery IDs
      - Record errors without printing secrets

The UI distinguishes these direct instructions from **section notes** (paragraphs, code blocks and links under the same heading), the **other checklist items in the same section**, and **phase-level Done when criteria**. These neighboring tasks and phase criteria are displayed as context rather than falsely attributed to the clicked task.

Repositories like trade-alerts/phases.md often contain terse checkboxes instead of complete per-task procedures. In that case, the panel states that no specific procedure is recorded and shows the exact surrounding Markdown available. To provide richer instructions, add indented steps or a linked detail document to the source roadmap. The panel renders source Markdown, including code blocks; it does not fabricate instructions.

The quest panel has a fixed side tab for opening and closing even after scrolling a long checklist. Its header is fixed and its list scrolls independently of the map. Press Escape to close it.
