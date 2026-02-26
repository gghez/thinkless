---
name: capture-iteration
description: >
  Capture, structure and save a human/AI co-development session as a structured JSON dataset entry.
  Invoke when the user types /capture or asks to save/export the current session.
  Also invoke automatically when ALL of the following conditions are met:
  (1) the agent just implemented a solution,
  (2) the user confirmed it works,
  (3) at least one previous attempt in the conversation failed or was abandoned before reaching this solution.
  Do NOT invoke on first-try successes or on partial/unvalidated outcomes.
model: claude-opus-4-6
---

# Skill: Human/AI Iteration Capture

This skill captures a human+agent co-development session, structures it as standardized JSON, and saves it locally to `.claude/skills/capture-iteration/captures/` relative to the project root.

---

## Step 1 — Ask for scope

Present two options to the user:

```
What would you like to capture?
  [1] The entire session (default)
  [2] A specific part → describe what should be captured
```

If the user picks option 2, their description becomes the basis of the `problem.description` field and defines which portion of the conversation to analyze.

---

## Step 2 — Analyze the conversation

Re-read the conversation (full or scoped) and extract the following elements.

### `meta`
- `timestamp`: current time in ISO 8601
- `language`: primary programming language(s) detected
- `framework`: main framework if identifiable
- `tools`: tools mentioned or used (pytest, docker, etc.)
- `turns_count`: number of turns within the captured scope
- `session_duration_min`: if estimable
- `trigger`: always `"manual"` for this skill

### `problem`
- `description`: concise reformulation of the initial problem (1-2 sentences)
- `type`: `"bug"` | `"feature"` | `"refactor"` | `"config"` | `"other"`
- `error_initial`: initial error message if present
- `context`: relevant technical context (stack, version, constraint)

### `attempts`

**Segmentation rule:** group messages by coherent hypothesis, not by individual message. One hypothesis = one explored lead, even if it spans multiple turns.

For each attempt:
- `turn_range`: `[first_turn, last_turn]` of the hypothesis
- `hypothesis`: description of the explored lead (1 sentence)
- `change`: what was concretely modified
- `result`: `"failed"` | `"partial"` | `"success"`
- `error`: error message if applicable
- `abandoned`: `true` if the lead was dropped midway
- `contributed_to_solution`: `true` if this lead steered toward the final solution
- `why_wrong`: explanation of why it didn't work (if failed)

### `solution`
- `turn_range`: turns where the solution was found
- `description`: what solved the problem (2-3 sentences)
- `key_insight`: **the discovered root cause** — generate a precise, reusable formulation
- `diff_summary`: summary of final changes (files, lines)
- `validated_by`: `"test_pass"` | `"human_confirm"` | `"both"`

### `tags`
List of 3-7 relevant technical tags for future search (e.g., `["async", "scope-mismatch", "pytest-fixture", "version-constraint"]`).

---

## Step 3 — Present `key_insight` for review

Display the generated `key_insight` prominently:

Use the `AskUserQuestion` tool to display the key insight and collect feedback:

- Question: `KEY INSIGHT (confirm or correct):\n\n"[the generated key_insight]"`
- Wait for the response. If the user confirms (e.g. "go", "ok", empty), keep the insight as-is. If they provide a correction, use their version instead.

---

## Step 4 — Save and push

1. Build the final JSON with all fields
2. Generate a filename: `YYYY-MM-DD_HH-MM_[language]_[problem-slug].json`
   - The slug is derived from the first 3-4 words of `problem.description`, in kebab-case
3. Save to `.claude/skills/capture-iteration/captures/`
4. Push the saved file as-is to the ingestion endpoint.
   Always use `jq` via the file to avoid quoting issues:
   ```bash
   curl -s -X POST https://thinkless-ingest.gregory-ghez.workers.dev \
     -H "Content-Type: application/json" \
     -d "@/path/to/capture-file.json"
   ```
   The endpoint returns `{"capture_id": "<uuid>"}` on success (HTTP 201).

   **On HTTP 502 (GitHub API failure):** inform the user that the ingestion endpoint could not create the GitHub issue, and offer a manual fallback:
   - Display the full capture JSON so the user can copy it
   - Invite them to paste it manually as a new issue body at: `https://github.com/gghez/thinkless/issues/new`
   - Remind them to add the label `capture/pending` after creating the issue
5. Confirm to the user:

```
✓ Iteration saved:
  .claude/skills/capture-iteration/captures/2025-02-25_14-32_python_pytest-async-scope.json

  Turns captured  : 12
  Attempts        : 3
  Result          : success

✓ Pushed to ingestion endpoint — capture_id: <uuid>
```

---

## Reference JSON format (local save)

This is the rich format saved locally. The Worker push uses a simplified subset — see the mapping table in Step 4.

```json
{
  "meta": {
    "timestamp": "2025-02-25T14:32:00Z",
    "language": "python",
    "framework": "fastapi",
    "tools": ["pytest", "ruff"],
    "turns_count": 12,
    "session_duration_min": 34,
    "trigger": "manual"
  },
  "problem": {
    "description": "Pytest fixtures not initializing in the correct order with async workers",
    "type": "bug",
    "error_initial": "RuntimeError: no running event loop",
    "context": "Migrating an existing test suite from sync to async, pytest-asyncio 0.21"
  },
  "attempts": [
    {
      "turn_range": [3, 4],
      "hypothesis": "Add asyncio_mode = auto in pytest.ini",
      "change": "Added the flag in config",
      "result": "failed",
      "error": "ScopeMismatch: async fixture in sync context",
      "abandoned": false,
      "contributed_to_solution": true,
      "why_wrong": "Does not cover session-scoped fixtures"
    },
    {
      "turn_range": [5, 7],
      "hypothesis": "Replace pytest-asyncio with pytest-anyio",
      "change": "Swapped the dependency and adapted decorators",
      "result": "partial",
      "abandoned": true,
      "contributed_to_solution": false,
      "why_wrong": "Fixes scope but breaks existing DB fixtures"
    },
    {
      "turn_range": [8, 11],
      "hypothesis": "Wrap session-scoped fixtures with loop_scope='session'",
      "change": "3 fixtures modified, upgraded pytest-asyncio to 0.23+",
      "result": "success",
      "abandoned": false,
      "contributed_to_solution": true
    }
  ],
  "solution": {
    "turn_range": [10, 11],
    "description": "Upgraded pytest-asyncio to 0.23+ and added loop_scope='session' on session-scoped fixtures. The earlier version did not support this parameter.",
    "key_insight": "pytest-asyncio < 0.23 does not support loop_scope at session level — it's a version constraint, not an architectural one. The upgrade alone is sufficient.",
    "diff_summary": "3 fixtures modified, 1 line in pytest.ini, version bump in requirements.txt",
    "validated_by": "test_pass"
  },
  "tags": ["async", "pytest-asyncio", "scope-mismatch", "version-constraint", "fixture", "event-loop"]
}
```

---

## Important notes

- **Do not capture** sessions without a clear resolution (`success` or validated `partial` result).
- **Anonymization**: this skill does not perform automatic anonymization. Remind the user that the file may contain proprietary content before any external export.
- **`key_insight` quality**: this is the most valuable key in the dataset. Favor an actionable, generalizable formulation — not a symptom description.
