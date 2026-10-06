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
- Support for multiple public repositories plus explicitly allowlisted private repositories
- Lightweight roadmap rechecking every 10 seconds while visible, plus a manual Sync button

The MVP is **GitHub-to-dashboard read-only**. It refreshes every 10 seconds while the tab is visible or on demand, not via webhooks yet. Detected checklist changes are saved in this browser with their **detection timestamps**, not attributed to arbitrary commits. Browser-local positions and public-repository task-change history are not shared across devices. Private roadmap task content is intentionally not written to that persisted progress history. Two-way edits, signed webhooks, Neon persistence and protected pull request creation remain later work.

## Setup

Prerequisites: Node.js 22+. In the repo folder run:

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

Open http://localhost:3000 and select Trade Alerts. Public repositories require no GitHub credential. Private repositories use the server-side configuration below.

## Deployment

Connect this repository's `main` branch to Vercel as a Next.js project. Neon is not required for the read-only MVP; it will hold synchronized layouts, activity events and credentials metadata after the protected write-back phase.

## Markdown rules

See `docs/ROADMAP_CONTRACT.md` for the checklist format. The first project's existing canonical source remains `trade-alerts/phases.md`; no conversion or rename is required.

## Secure private GitHub repositories

Voyages remains **read-only**. Public repositories continue to load without authentication. Private repositories are handled only after all of these checks pass:

1. the public raw GitHub lookup fails;
2. the requested `owner/repo` is present in `GITHUB_PRIVATE_REPO_ALLOWLIST`;
3. the browser has a valid signed, HttpOnly Voyages private-access session; and
4. the server has `GITHUB_READ_TOKEN`.

Only then does the server call GitHub's Contents API for that exact allowlisted repository. The GitHub token is never returned to the browser, placed in `NEXT_PUBLIC_*`, written to source code, or included in API errors. The same server-side credential is used for recent commit activity on the private roadmap file.

The private-access session is important even with an allowlist: without it, anyone who knew the public Vercel URL and an allowlisted repository name could use Voyages as a read proxy for that private repository. `VOYAGES_PRIVATE_ACCESS_SECRET` prevents that while keeping the GitHub credential server-only.

### Recommended credential

For this personal Vercel-hosted tool, a **fine-grained personal access token** is the most practical option. Restrict it to only the private repositories Voyages needs and give it the minimum repository permissions:

- **Contents: Read-only**
- **Metadata: Read-only** (GitHub supplies this automatically)

Do not grant Issues, Pull requests, Administration, Actions, or any write permission.

A GitHub App can provide shorter-lived installation tokens and is a good future upgrade if Voyages becomes multi-user or manages many repositories. For one owner and a small selected repository set, a fine-grained PAT is substantially simpler while still supporting least privilege.

### Creating the fine-grained GitHub token

In GitHub:

1. Open **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Choose **Generate new token**.
3. Select your GitHub account as the resource owner.
4. Set **Repository access** to **Only select repositories**.
5. Select only the private repositories Voyages should read, starting with `jenozu/yuzimiONLINE`.
6. Under **Repository permissions**, set **Contents** to **Read-only**. Leave every other optional permission at **No access**. Metadata remains read-only automatically.
7. Give the token a reasonable expiration date and create it.
8. Copy the token directly into Vercel's `GITHUB_READ_TOKEN` environment variable. Do not paste it into Voyages, source code, chat logs, screenshots, or any `NEXT_PUBLIC_*` variable.

If you later authorize another private repository, update both the token's selected repository access in GitHub **and** the Voyages allowlist in Vercel.

### Environment variables

Copy the names from `.env.example`:

```env
GITHUB_READ_TOKEN=
GITHUB_PRIVATE_REPO_ALLOWLIST=jenozu/yuzimiONLINE
VOYAGES_PRIVATE_ACCESS_SECRET=
```

`GITHUB_PRIVATE_REPO_ALLOWLIST` is a comma-separated, case-insensitive list. To add another private repository later:

```env
GITHUB_PRIVATE_REPO_ALLOWLIST=jenozu/yuzimiONLINE,jenozu/tsuya-tsuya
```

`VOYAGES_PRIVATE_ACCESS_SECRET` is a separate 24+ character password used only to unlock private Voyages reads in the browser. It must **not** be the GitHub token.

### Vercel configuration

In the Vercel project:

1. Open **Settings → Environment Variables**.
2. Add `GITHUB_READ_TOKEN`.
3. Add `GITHUB_PRIVATE_REPO_ALLOWLIST`.
4. Add `VOYAGES_PRIVATE_ACCESS_SECRET`.
5. Apply them to **Production**. Add Preview/Development only if you intentionally want private-repo access in those environments.
6. Redeploy after changing environment variables.

The app does not require these variables at build time, so CI remains secret-free.

### Adding a private voyage

Use the normal voyage form. Enter only:

- Repository: `owner/repo`
- Display name
- Markdown roadmap path
- Branch

Do **not** enter a GitHub token. On the first private load, Voyages asks for the separate private-access password. After a successful unlock, it stores only a signed HttpOnly session cookie for 12 hours. A successfully loaded private voyage shows a subtle **Private repository** badge.

### Error behavior

Private access returns intentionally sanitized errors:

- roadmap/branch missing → `FILE_NOT_FOUND`
- repository unavailable to the configured credential → `REPOSITORY_UNAVAILABLE`
- private repo not in the allowlist → `PRIVATE_REPO_NOT_AUTHORIZED`
- browser has not unlocked private access → `PRIVATE_SESSION_REQUIRED`
- GitHub token missing → `GITHUB_CREDENTIAL_NOT_CONFIGURED`
- token expired/invalid → `GITHUB_CREDENTIAL_INVALID`
- token lacks access → `PRIVATE_REPO_ACCESS_DENIED`

Upstream GitHub response bodies are not copied into client errors.

### Credential rotation

To rotate the GitHub credential:

1. Create a replacement fine-grained PAT with the same selected repositories and read-only Contents permission.
2. Replace `GITHUB_READ_TOKEN` in Vercel.
3. Redeploy and verify one public and one private voyage.
4. Revoke/delete the old PAT in GitHub.

To rotate browser access, replace `VOYAGES_PRIVATE_ACCESS_SECRET` and redeploy. Existing private-session cookies immediately stop validating.

## Security boundary

Do not enable an anonymous GitHub-token proxy and do not put a GitHub credential in frontend code. Private reads are allowlisted and session-gated. Two-way edits remain out of scope and would require a separate authenticated, reviewable write workflow.

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

In the fleet sidebar, use **Edit** beside an existing voyage to correct its display name, GitHub `owner/repo`, branch or Markdown roadmap path. Correcting a repository name replaces that voyage rather than adding a duplicate; identical repository entries are prevented. Changes are saved to browser-local storage, and the edited voyage is immediately reloaded. If loading fails, verify the repository name, branch and Markdown path. For private repositories, also verify the repository is allowlisted and selected in the fine-grained token.

Use **Remove** to open a confirmation panel. Removing a voyage deletes only its entry in this browser; it **does not delete or edit the GitHub repository**. You can remove the initial Trade Alerts voyage too, and an intentionally empty fleet stays empty after refreshing. Existing locally stored voyage lists remain compatible with this update. Browser-local map positions and checklist history are not erased by removing a voyage, so re-adding the same repository can restore them.

## Island checkpoint mode

Double-click any island on the world map to enter a **local island chart**. Every unchecked/checkmarked roadmap item in that milestone becomes a checkpoint along the island trail. Completed checkpoints are marked, the **first unchecked task is the current quest**, and upcoming checkpoints remain muted. The side panel in this view shows only the focused/current task and its nested roadmap instructions, avoiding the full scrolling quest list.

When every checkpoint is complete, the island's **final clue** unlocks and the interface directs you back to the world map to continue to the next island.

For loaded repositories, Voyages performs a lightweight roadmap refresh every **10 seconds while the tab is visible**, plus an immediate refresh when the window regains focus. That means a pushed checklist update normally advances the current task within about 10 seconds. This is near-live polling, not a true GitHub push webhook; true instant delivery remains part of the GitHub App/Neon phase.
