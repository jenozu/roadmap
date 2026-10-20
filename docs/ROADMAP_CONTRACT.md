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

## Recommended v2 format — plain-English checkpoints

For projects maintained with an LLM, use one **top-level checkbox per checkpoint** and nested checkboxes for the exact steps inside that checkpoint. This gives Voyages three useful levels:

1. **Phase / island** — the major project stage.
2. **Checkpoint** — one meaningful piece of work on that island.
3. **Step** — the exact next action inside the checkpoint.

Use this structure:

```markdown
## M5: Product database

Progress: ACTIVE.

### Goal
Create the product data the website needs.

### Implementation

- [ ] Generate the website product catalog <!-- task:M5-T01 -->
  Simple: Turn the product information we already collected into one clean file the website can use.
  Why: The storefront cannot show products until this file exists.
  - [x] Export the current approved product records <!-- step:M5-T01-S01 -->
  - [ ] Clean up missing names and descriptions <!-- step:M5-T01-S02 -->
  - [ ] Generate products.ts from the cleaned data <!-- step:M5-T01-S03 -->
  - [ ] Open the site and confirm the products appear <!-- step:M5-T01-S04 -->
  Done when: The website loads the approved products without missing fields or errors.

  Technical details:
  - Keep the existing TypeScript product schema.
  - Do not overwrite manually verified compatibility fields.

- [ ] Connect product images <!-- task:M5-T02 -->
  Simple: Make sure each product displays the correct image.
  Why: Customers need to recognize the product before requesting a quote.
  - [ ] Match image filenames to product IDs <!-- step:M5-T02-S01 -->
  - [ ] Add fallback images for products without photography <!-- step:M5-T02-S02 -->
  - [ ] Check the catalog and product pages <!-- step:M5-T02-S03 -->
  Done when: Every launch product has a valid image or approved fallback.
```

Voyages treats the **top-level checkbox as the map checkpoint**. Nested checkbox items are its steps and do **not** create additional checkpoint markers. The first unchecked top-level checkpoint is the current quest; inside it, the first unchecked nested checkbox is **Do this next**.

The fields `Simple:`, `Why:`, and `Done when:` are optional but strongly recommended. They are source-controlled, so the dashboard does not have to invent or guess a plain-English explanation at runtime. Coding assistants updating a roadmap should maintain these fields whenever they add or materially change a checkpoint.

Any other indented Markdown remains available behind **Technical details**. This means commands, file names, implementation notes, and links can stay in the roadmap without overwhelming the primary task view.

When a coding assistant finishes a step, it should change that nested checkbox from `[ ]` to `[x]` in the repository. Voyages' normal repository refresh then moves **Do this next** to the next unchecked step. When the overall checkpoint is verified, the assistant should also check the top-level task.
