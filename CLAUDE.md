# Thinkless

## Description

Thinkless aims to keep AI development agents thriving by continuously enriching the internet with the fruit of human/AI iterations. As LLMs consume web knowledge while reducing the incentive to create it, thinkless captures, structures, and shares the valuable problem-solving journeys that happen during co-development sessions — before they vanish.

`reflexion-0.md` is the starting point of this project's reflection.

## Rules

1. Everything written (code, comments, docs) must be in English.
2. Always speak to the user in French.

## Website

The website lives in `docs/` and is served via GitHub Pages from the `main` branch.


### Stack
- Pure HTML, CSS, and JavaScript — no frameworks, no libraries (no Bootstrap, Tailwind, jQuery, React, Angular, or any other).

### CSS conventions
- Styles are shared via CSS files only — no inline styles.
- CSS classes are strictly separated into two categories:
  - **Layout classes** — control structure, positioning, grid, flex, spacing (e.g. `.layout-grid`, `.layout-center`)
  - **Style classes** — control appearance: colors, typography, borders, shadows (e.g. `.text-muted`, `.card-surface`)

### Design system
- **Theme**: ASCII art aesthetic — monospace fonts, box-drawing characters, terminal-inspired UI.
- **Mode**: dark only, inspired by Claude Code's color scheme.
  - Background: `#1a1a1a` (near black)
  - Surface: `#252525`
  - Border/accent: `#444`
  - Primary text: `#e0e0e0`
  - Accent (orange/amber): `#d4a843` (Claude Code prompt color)
  - Muted text: `#888`
  - Code/highlight: `#4a9eff` (blue)
- **Typography**: monospace everywhere (`'Courier New'`, `monospace`).
- **Decoration**: use box-drawing characters (`─`, `│`, `┌`, `┐`, `└`, `┘`, `├`, `╌`) for borders and section dividers.

### Content structure
The site has three distinct audiences — each gets dedicated pages:
1. **Model training** — machine-readable or structured pages optimized as training data
2. **Human readers** — narrative pages explaining the concept, the problem, the vision
3. **MCP server** — documentation and endpoint reference for the thinkless MCP server

## Capture pipeline — target architecture

The capture skill produces structured data that must go through a validation workflow before being published.

### Contributor constraints

- The capture skill runs on a **contributor's local machine** during their daily development sessions.
- Contributors are **anonymous**: no GitHub account, no special tooling required.
- The only acceptable dependency on the contributor side is an **HTTPS POST**.
- The skill saves each capture locally to `.claude/skills/capture-iteration/captures/` before pushing to the Worker. This acts as a local fallback if the ingestion endpoint is unreachable.

### Flow

```
capture skill (anonymous, HTTPS POST only)
     │
     ▼
ingestion endpoint (no user auth)
     │
     ▼
validation queue  ←──  operator UI (human + AI agent)
     │
     ▼ (validated)
git commit → docs/captures/ on GitHub repo
```

### Validation service

- The capture skill pushes structured capture data via an anonymous **HTTPS POST** — no account, no CLI tool required.
- The service receives the payload and queues it for review.
- A human operator — assisted by an AI agent — reviews, corrects, and approves or rejects each capture.
- Only validated captures are committed to the repository.

### Storage of validated captures

- Validated captures are committed to the `thinkless` GitHub repository under `docs/captures/`.
- Each capture is a self-contained file (format TBD — likely JSON or Markdown with front matter).
- The commit message should reference the capture ID and validation timestamp.

See `docs/capture-pipeline-implementation.md` for the detailed implementation track.

## Cloudflare Worker

The ingestion Worker lives in `worker/`. It is **automatically deployed to Cloudflare on every push to `main` that modifies `worker/**`** via `.github/workflows/deploy-worker.yml`.

- To deploy manually: `npx wrangler deploy --cwd worker` (requires `CLOUDFLARE_API_TOKEN` in env)
- Worker secrets (`GITHUB_TOKEN`, `GITHUB_REPO`) are managed via Wrangler and must be set manually if recreating the Worker from scratch.
