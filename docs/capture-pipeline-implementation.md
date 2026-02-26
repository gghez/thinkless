# Capture Pipeline — Implementation Track

This document describes the implementation of the capture validation pipeline.
See `CLAUDE.md` for the high-level architecture intent.

## Status

**Fully operational as of 2026-02-26.**

| Component | Status |
|---|---|
| Cloudflare Worker | deployed ✅ |
| GitHub Issues queue | live (labels created) ✅ |
| GitHub Action — AI review | operational ✅ |
| GitHub Action — commit on validation | operational ✅ |
| GitHub Action — generate summary | operational ✅ |
| GitHub Action — update captures page | operational ✅ |
| `docs/captures.html` — public captures page | live ✅ |

## Context and constraints

- The capture skill runs on a **contributor's local machine** during their daily development sessions.
- Contributors are **anonymous**: no GitHub account, no `gh` CLI, no special tooling required.
- The only dependency on the contributor side is an **HTTPS POST** — universally available.
- The thinkless team owns the full downstream pipeline (ingestion → validation → commit).

## Flow

```
capture skill (user machine, anonymous)
     │
     ▼  HTTPS POST JSON — no auth, no account
Cloudflare Worker (https://thinkless-ingest.gregory-ghez.workers.dev)
     │  carries thinkless service account token
     ▼
GitHub Issue opened (label: capture/pending)
     │  title: first 50 chars of problem.description
     │  body: problem + solution descriptions + raw JSON block
     ▼
review-capture.yml (trigger: issue opened with capture/pending)
     └─→ Claude API analyzes the capture
     └─→ posts a structured review comment on the issue
     │
     ▼
Operator labels issue "capture/validated"
     │
     ▼
commit-capture.yml (trigger: issue labeled capture/validated)
     └─→ extracts JSON from issue body
     └─→ commits docs/captures/<capture-id>.json to main
     └─→ closes issue with commit reference
     └─→ dispatches generate-summary.yml (workflow_dispatch)
     │
     ▼
generate-summary.yml (trigger: workflow_dispatch, input: capture_id)
     └─→ calls Claude API (Haiku) to generate a markdown summary
     └─→ commits docs/summaries/<capture-id>.md to main
         (using GH_PAT to trigger the next workflow automatically)
     │
     ▼  push to docs/summaries/*.md (requires GH_PAT — see secrets)
update-captures-page.yml (trigger: push on docs/summaries/*.md)
     └─→ reads all .md files in docs/summaries/
     └─→ extracts title + date from each
     └─→ regenerates the captures list in docs/captures.html
     └─→ commits docs/captures.html to main
```

## Components

### 1. Cloudflare Worker — ingestion endpoint

See [`cloudflare-worker.md`](cloudflare-worker.md) for setup instructions and context.

- Public HTTPS endpoint, no user authentication.
- Receives a JSON payload (structured capture from the skill).
- Validates the payload shape minimally.
- Opens a GitHub Issue on the thinkless repo using the service account token stored as a Worker secret.
- Returns `201` with a capture ID on success.
- Free tier: 100k requests/day — sufficient for the expected volume.

### 2. GitHub Issues — capture queue

- Each pending capture is a GitHub Issue in the thinkless repo.
- Issue body contains the full structured capture (JSON block + human-readable summary).
- Labels used: `capture/pending`, `capture/validated`, `capture/rejected`.

### 3. GitHub Actions — AI review bot

- Trigger: `issues` → `opened` with label `capture/pending`.
- Calls Claude API with the capture content.
- Posts a comment with: quality score, suggested edits, flags for sensitive content.

### 4. GitHub Actions — commit on validation

- Trigger: `issues` → `labeled` with label `capture/validated`.
- Extracts the JSON block from the issue body (between ` ```json ` and ` ``` `).
- Extracts `capture_id` from the JSON payload (not from the title).
- Commits the file to `docs/captures/<capture-id>.json` on `main`.
- Closes the issue with a reference to the commit.
- Dispatches `generate-summary.yml` via `gh workflow run`.

> **Note**: the workflow requires `permissions: contents: write`, `permissions: issues: write`, and `permissions: actions: write`. The last one is needed to dispatch other workflows.

> **Race condition**: when multiple captures are validated simultaneously, concurrent pushes will conflict. The workflow does `git pull --rebase origin main` before pushing to handle this.

### 5. GitHub Actions — generate summary

- Trigger: `workflow_dispatch` with input `capture_id`.
- Reads `docs/captures/<capture-id>.json`.
- Calls Claude Haiku API with a structured prompt to produce a markdown summary.
- Summary format: H1 title, blockquote with date, H2 sections (Problem / Solution / Insight), link to raw JSON.
- Commits `docs/summaries/<capture-id>.md` using `GH_PAT` (so the push triggers `update-captures-page`).

> **Race condition**: same fix — `git pull --rebase` before push.

### 6. GitHub Actions — update captures page

- Trigger: `push` on `docs/summaries/*.md` (requires `GH_PAT` on the upstream push) + `workflow_dispatch`.
- Reads all `.md` files in `docs/summaries/`, extracts title (first H1) and date (first blockquote).
- Sorts entries by date descending.
- Replaces the content between `<!-- CAPTURES-LIST-START -->` and `<!-- CAPTURES-LIST-END -->` in `docs/captures.html`.
- Commits `docs/captures.html`.

### 7. `docs/captures.html` — public captures page

- Listed under "for humans" in the main site navigation.
- Renders a clickable list of captures (title + date).
- On click: fetches `docs/summaries/<id>.md`, parses markdown to HTML in-browser (vanilla JS, no libraries), displays in a modal popup.
- The list is static HTML injected by `update-captures-page.yml` — no JS needed to render the list itself.

## What the capture skill sends

The skill sends the full rich capture JSON as produced locally — no transformation, no simplified subset. The Worker accepts any non-empty JSON object without strict schema validation, so the format can evolve freely.

See `SKILL.md` in `.claude/skills/capture-iteration/` for the reference JSON format.

## Secrets and ownership

| Secret | Owner | Where stored | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` (Worker secret) — PAT `public_repo` | thinkless team | Cloudflare Worker secret ✅ | Open GitHub Issues from the Worker |
| `GITHUB_REPO` — `gghez/thinkless` | thinkless team | Cloudflare Worker secret ✅ | Target repo for issue creation |
| `CLAUDE_API_KEY` | thinkless team | GitHub Actions secret ✅ | AI review + summary generation |
| `GH_PAT` — classic PAT or fine-grained PAT, `contents: write` | thinkless team | GitHub Actions secret ✅ | Push from `generate-summary` to trigger `update-captures-page` |

The contributor has zero secrets to manage.

> **Important — `GH_PAT` type**: must be a real Personal Access Token (`ghp_*` classic or `github_pat_*` fine-grained), **not** an OAuth App token (`gho_*`). GitHub does not allow OAuth App tokens to trigger downstream workflow runs. Without a proper PAT, `update-captures-page` must be triggered manually via `gh workflow run update-captures-page.yml --repo gghez/thinkless`.

## Security — rate limiting and abuse protection

See [`worker-security.md`](worker-security.md) for the full threat model and implementation layers (rate limiting, WAF, circuit breaker, payload validation).

## End-to-end test procedure

Use this procedure to validate the full pipeline from scratch.

### Prerequisites

- `CLAUDE_API_KEY` set in GitHub Actions secrets
- `GH_PAT` set (proper PAT, not OAuth token — see secrets section)
- `gh` CLI authenticated locally

### Step 1 — Send test captures to the Worker

```bash
# Build a minimal valid capture file
cat > /tmp/test-capture.json << 'EOF'
{
  "meta": {
    "timestamp": "2026-02-26T10:00:00Z",
    "language": "typescript",
    "framework": null,
    "tools": ["tsc"],
    "turns_count": 4,
    "session_duration_min": 10,
    "trigger": "manual"
  },
  "problem": {
    "description": "Short description of the problem encountered.",
    "type": "bug",
    "error_initial": "Error message if any",
    "context": "Relevant technical context"
  },
  "attempts": [
    {
      "turn_range": [1, 2],
      "hypothesis": "First attempt description",
      "change": "What was changed",
      "result": "failed",
      "abandoned": false,
      "contributed_to_solution": true,
      "why_wrong": "Why it failed"
    },
    {
      "turn_range": [3, 4],
      "hypothesis": "Second attempt",
      "change": "Final fix applied",
      "result": "success",
      "abandoned": false,
      "contributed_to_solution": true
    }
  ],
  "solution": {
    "turn_range": [3, 4],
    "description": "What solved the problem.",
    "key_insight": "The generalizable insight from this session.",
    "diff_summary": "Files and lines changed",
    "validated_by": "human_confirm"
  },
  "tags": ["typescript", "bug", "example"]
}
EOF

curl -s -X POST https://thinkless-ingest.gregory-ghez.workers.dev \
  -H "Content-Type: application/json" \
  -d "@/tmp/test-capture.json"
# → {"capture_id":"<uuid>"}
```

Multiple captures can be sent in parallel. Each creates one GitHub Issue.

### Step 2 — Verify issue creation

```bash
gh issue list --repo gghez/thinkless --label "capture/pending" --state open --json number,title
```

Expected: one issue per capture, title = `[capture] <first 50 chars of problem.description>`, body showing `**problem:**`, `**solution:**`, and the JSON block.

### Step 3 — Validate (act as human operator)

```bash
gh issue edit <number> --repo gghez/thinkless --add-label "capture/validated"
```

This triggers `commit-capture.yml`. Check progress:

```bash
gh run list --repo gghez/thinkless --workflow commit-capture.yml --limit 5
```

### Step 4 — Verify capture committed and summary generated

```bash
# Captures committed to docs/captures/
gh api repos/gghez/thinkless/contents/docs/captures --jq '.[].name'

# Summaries generated in docs/summaries/
gh api repos/gghez/thinkless/contents/docs/summaries --jq '.[].name'

# Check generate-summary runs
gh run list --repo gghez/thinkless --workflow generate-summary.yml --limit 5
```

### Step 5 — Verify captures.html updated

```bash
gh run list --repo gghez/thinkless --workflow update-captures-page.yml --limit 5
```

If no run appeared (GH_PAT not a proper PAT), trigger manually:

```bash
gh workflow run update-captures-page.yml --repo gghez/thinkless
```

Then verify the page:

```bash
gh api repos/gghez/thinkless/contents/docs/captures.html \
  --jq '.content' | base64 -d | grep -A 20 "CAPTURES-LIST-START"
```

Expected: one `<div class="capture-item">` per validated capture.

### Cleanup between test runs

```bash
# Delete open test issues
gh issue list --repo gghez/thinkless --state open --json number \
  --jq '.[].number' | xargs -I{} gh issue delete {} --repo gghez/thinkless --yes

# Reset summaries locally and push (also resets captures.html via workflow)
cd <project-root>
git pull --rebase origin main
rm -f docs/summaries/*.md
git add docs/summaries/
git commit -m "chore: reset summaries for test"
git push
```

Note: this will trigger `update-captures-page` which sets `captures.html` back to "no captures yet."

## Known gotchas

- **YAML + shell multiline**: never interpolate a multiline shell variable directly into a `--body` argument inside a YAML `run` block — write it to a temp file and use `--body-file` instead.
- **GitHub Actions permissions**: declare `permissions: issues: write` (review bot), `permissions: contents: write` (commit action), and `permissions: actions: write` (workflow dispatch) explicitly — the default token is read-only.
- **Wrangler in non-interactive environments**: use `npx wrangler` (no global install needed), pipe secrets via stdin, set `CLOUDFLARE_API_TOKEN` in the environment.
- **Race condition on concurrent validations**: validating multiple issues simultaneously causes concurrent pushes to the same branch. Fixed with `git pull --rebase origin main` before each `git push` in both `commit-capture.yml` and `generate-summary.yml`.
- **GH_PAT must be a real PAT**: OAuth App tokens (`gho_*`) do not trigger downstream workflow runs on push. Only classic PATs (`ghp_*`) or fine-grained PATs (`github_pat_*`) work for cross-workflow chaining.
- **`gh run rerun` uses original workflow version**: if a workflow fails and you push a fix, `gh run rerun` will re-execute the old version. Remove and re-add the triggering label instead to get a fresh run on the latest workflow.
- **Capture ID extraction**: `commit-capture.yml` extracts `capture_id` from the JSON body, not from the issue title (which now contains a human-readable description).

## Open questions

- Moderation policy: auto-close after N days if not reviewed?
