# Voyages — Project Cartography

A quiet, hand-drawn pirate atlas that turns GitHub Markdown checklists into interactive island journeys. Source code now lives directly in this repository. The first voyage reads the existing `jenozu/trade-alerts` `phases.md` on `main` without editing that project.

## Working MVP source

- Next.js 15 + React 19 + TypeScript
- Interactive **two-dimensional archipelago** with a hand-drawn, ink-style SVG nautical map, multi-row island layout and full horizontal/vertical panning
- Overview of the full archipelago, zoom controls, Find my ship, an island-jump menu and draggable island positions saved locally
- Independently scrolling quest drawer with an always-visible side tab and expanded Markdown source instructions
- Safe links to related documents in the original GitHub repository, not broken links within the dashboard
- Supports both `# Phase 0 — Name` and `## M1: Name` / `## M1.1: Name` roadmap sections
- Clickable milestone detail panel, quest checklists and links to the exact GitHub source lines
- Copyable task briefs to hand back to a coding assistant
- XP/level and measured completion statistics, file-specific GitHub commit activity and a **browser-local checklist change history** captured when GitHub synchronization detects previously unchecked tasks marked complete or reopened
- Support for multiple public Markdown roadmap repositories
- Background rechecking every 90 seconds and manual Sync button

The MVP is **GitHub-to-dashboard read-only**. It refreshes every 90 seconds or on demand, not via webhooks yet. Detected checklist changes are saved in this browser with their **detection timestamps**, not attributed to arbitrary commits. Browser-local positions and task-change history are not shared across devices. Two-way edits, signed webhooks, Neon persistence and protected pull request creation remain later work.

## Setup

Prerequisites: Node.js 22+. In the repo folder run:

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000 and select Trade Alerts. Public repositories require no secrets in the first release.

## Deployment

Connect this repository's `main` branch to Vercel as a Next.js project. Neon is not required for the read-only MVP; it will hold synchronized layouts, activity events and credentials metadata after the protected write-back phase.

## Markdown rules

See `docs/ROADMAP_CONTRACT.md` for the checklist format. The first project's existing canonical source remains `trade-alerts/phases.md`; no conversion or rename is required.

## Security boundary

Do not enable an anonymous write endpoint or put a GitHub personal access token in a public browser bundle. Two-way edits require an authenticated server-side workflow and reviewable GitHub pull requests.

## Roadmap

See `master_plan.md` for staged verification and planned features.

## Using the archipelago

The atlas starts in **Whole map** view with the quest panel closed. Select **Find my ship** to focus on the first unfinished milestone, or **Jump to island** to navigate directly to any stage and open its detailed quests. Drag empty ocean to pan horizontally and vertically, drag island drawings to rearrange your chart, and use +/- to zoom around the visible center. **Reset islands** discards only this project's browser-local custom island positions. The new two-dimensional layout is stored under a v2 browser-storage key; older horizontal layouts are left untouched but not imported automatically.

If a project imports with no islands, check the supported milestone heading format in `docs/ROADMAP_CONTRACT.md`.

## Full-window map and genuine drag navigation

Choose **Full screen** from the atlas toolbar to expand the map over the entire browser viewport, hiding the surrounding project dashboard while keeping the independently toggleable quest drawer. Press **Exit full screen** or Escape to return; when the quest drawer is open, Escape closes it first. The current world location is preserved as the viewport changes size.

The map now uses a **screen-space camera**, not the SVG element's own scrollbars. Drag empty water in any direction to pan **even at Whole map overview scale**, drag an island to change its saved chart position, wheel/trackpad to travel, Ctrl+wheel (trackpad pinch) to zoom at the pointer, and +/- to zoom about the visible center. The normal view starts closer to your first unfinished island so labels aren't microscopic. Whole map remains one click away.

Camera math and overview/resize interactions have dedicated regression tests in `tests/map-camera.test.mjs`; direct visual/browser verification of the Vercel deployment is still a manual check.

## Managing voyages

In the fleet sidebar, use **Edit** beside an existing voyage to correct its display name, GitHub `owner/repo`, branch or Markdown roadmap path. Correcting a repository name replaces that voyage rather than adding a duplicate; identical repository entries are prevented. Changes are saved to browser-local storage, and the edited voyage is immediately reloaded. If GitHub returns 404, check that the repository is **public** and that the exact Markdown file and branch exist.

Use **Remove** to open a confirmation panel. Removing a voyage deletes only its entry in this browser; it **does not delete or edit the GitHub repository**. You can remove the initial Trade Alerts voyage too, and an intentionally empty fleet stays empty after refreshing. Existing locally stored voyage lists remain compatible with this update. Browser-local map positions and checklist history are not erased by removing a voyage, so re-adding the same public repository can restore them.
