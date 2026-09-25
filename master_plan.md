# Voyages — Master Plan

## M1: Working GitHub expedition (current)
- [x] Inspect trading repository and select canonical phases.md as first voyage source
- [x] Scaffold Next.js/TypeScript with Markdown parser and public GitHub import endpoint
- [x] Create interactive hand-drawn nautical SVG islands, clickable detail panel, task brief copying and local layout persistence
- [x] Add a multi-project selector, manual and timed refresh, truthful GitHub file commit activity
- [x] Commit source to jenozu/roadmap main (without modifying trade-alerts)
- [x] Verify automated tests, typecheck and production build in GitHub Actions (run 36039662540 passed)
- [x] Initial Vercel deployment connected and original trade-alerts overview verified by supplied browser screenshot (13 islands; 598/744 tasks)
- [ ] Recheck the latest two-dimensional map deployment across desktop and mobile browsers

## M1.1: Quest navigation and source instructions
- [x] Add a persistent map-side quest panel tab, with independently scrolling panel content
- [x] Allow expanding any task to inspect actual nested instructions, section source notes, surrounding work items and phase completion criteria
- [x] Confirm updated task-drawer commits pass automated CI
- [ ] Manually recheck latest map and drawer interactions in deployed browser

## M1.2: Repository audit and expanded archipelago
- [x] Replace horizontal map coordinates with a tested multi-row, two-dimensional island layout
- [x] Add two-axis panning, Whole map overview, Find my ship, quick island selection and safer drag boundaries
- [x] Replace mountain-style illustrations with five understated ink-style island scenes and a treasure destination
- [x] Add browser-local, source-verified checkbox transition history without inventing original completion timestamps
- [x] Support own `## M1:` / decimal milestone roadmap headings, safe relative document links and clear empty-import guidance
- [x] Add regression tests for map layout, checklist state transitions, source link resolution and Markdown parsing
- [ ] Visually QA the final deployed archipelago at different viewport sizes, zoom levels and with long task lists
- [ ] Introduce a committed dependency lockfile so CI can use reproducible `npm ci`
- [ ] Consider splitting the large dashboard into separate map, project navigation and quest drawer components

## M1.3: Immersive atlas and navigation repair
- [x] Implement optional full-window map with the quest drawer available on top
- [x] Replace scroll-dependent navigation with screen-space panning that works even when the full map fits the viewport
- [x] Open new voyages at a legible zoom centered on the first unfinished island; preserve world position while toggling full window
- [x] Support wheel/trackpad travel, Ctrl+wheel zoom, keyboard arrow panning and zoom-around-center controls
- [x] Add focused camera unit tests for panning, fit, anchored zoom and resize behavior
- [x] Run automated Chromium interaction tests covering full-window view, whole-map panning and draggable islands (GitHub Actions 36051940319 passed)
- [ ] Visually inspect the latest Vercel deployment and manually verify touch dragging on physical mobile devices

## M1.4: Fleet editing and recovery
- [x] Add separate Edit and Remove controls for every saved voyage
- [x] Prefill an editable form with display name, repository, branch and Markdown roadmap path
- [x] Reject invalid paths and duplicate repository entries without modifying the fleet
- [x] Require confirmation before removing a voyage; never mutate its GitHub repository
- [x] Preserve legacy stored voyages, allow the initial voyage to be removed, and keep an intentionally empty fleet after reload
- [x] Add helper unit tests and Chromium browser regressions for editing, removal and persistence
- [ ] Manually inspect the deployed fleet controls on desktop and mobile

## M2: GitHub-backed workflow
- [ ] Create a Neon PostgreSQL database for user projects, map settings, task snapshots and an event ledger
- [ ] Configure GitHub App with least-privilege repository access
- [ ] Implement HMAC-verified webhook delivery and idempotent task event processing
- [ ] Protect all write operations with admin authentication and CSRF protection
- [ ] Implement dashboard task editing through reviewable GitHub pull requests
- [ ] Handle conflicts when source commits change between fetching and editing
- [ ] Verify live progress across browser sessions and different devices

## M3: Voyage gamification
- [ ] Introduce stable task IDs and migration helper for new projects
- [ ] Implement configurable XP weights and award once per unique task completion
- [ ] Achievement badges, chapter milestone unlocks and subtle ship movement animation
- [ ] Island illustration templates and polished custom handwritten map assets
- [ ] Add CI security checks, accessibility and cross-browser interactions

Do not claim deployment, two-way synchronization, stored historical events or verified tests until the corresponding task is actually completed.
