# Voyages — Project Cartography

A quiet, hand-drawn pirate atlas that turns GitHub Markdown checklists into interactive island journeys. Source code now lives directly in this repository. The first voyage reads the existing `jenozu/trade-alerts` `phases.md` on `main` without editing that project.

## Working MVP source

- Next.js 15 + React 19 + TypeScript
- Interactive, horizontally navigable SVG nautical map with spaced-out islands
- Draggable island positions saved to this browser
- Clickable milestone detail panel, quest checklists and links to the exact GitHub source lines
- Copyable task briefs to hand back to a coding assistant
- XP/level and measured completion statistics, plus file-specific GitHub commit activity
- Support for multiple public Markdown roadmap repositories
- Background rechecking every 90 seconds and manual Sync button

The MVP is **GitHub-to-dashboard read-only**. Two-way edits, signed webhooks, shared Neon persistence and authentication-protected PR creation are explicitly later work. Git commits are shown as activity only, not evidence that unchecked tasks were completed.

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
