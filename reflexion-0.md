# Skill: Human/AI Iteration Capture
> Foundational reflection for the development of the Claude Code skill

---

## Context & Problem

LLMs feed on web data (Stack Overflow, forums, community docs), but by capturing the audience, they dry up the very source that fed them.

**Concrete data:** Stack Overflow lost ~70% of its new questions between March 2023 (87,105/month) and December 2024 (25,566/month). The site is back to May 2009 levels.

**The vicious cycle:**
- Fewer devs post on forums → less quality data
- Future models trained on this impoverished web will be worse
- Especially on recent or niche questions

**Same threat to open source:** low-adoption libraries won't be created anymore if an agent can generate the equivalent in 2 minutes. The middle ground of the open source ecosystem disappears.

---

## The Core Idea

A human+agent co-development session is a rich, underexploited source of knowledge. It contains:

- The agent's initial mistakes
- Human corrections and feedback
- Edge cases discovered along the way
- The developer's implicit reasoning ("no, that doesn't work because...")
- The final validated result

This is comparable to years of library enrichment through production bugs — except it vanishes into the void at the end of every session.

**Goal:** capture, structure and share these iterations to feed the training of future models.

---

## The Skill to Build

### Trigger
The skill fires when a fix is found:
- Tests passing after having failed
- Human confirmation message ("it works!", "perfect", etc.)
- Closing pattern in the conversation

### Pipeline

```
1. CAPTURE    → Record the full conversation (turns + tech context)
2. STRUCTURE  → Format as standardized JSON
3. ANONYMIZE  → Offer to remove proprietary content
4. SHARE      → Offer to publish on a platform (GitHub / HuggingFace)
```

### Target JSON format

```json
{
  "meta": {
    "timestamp": "...",
    "language": "python",
    "tools": ["pytest", "fastapi"],
    "turns_count": 12
  },
  "problem": "Description of the initial problem",
  "attempts": [
    {
      "turn": 3,
      "approach": "Description of the attempt",
      "result": "failed",
      "error": "TypeError: ..."
    }
  ],
  "solution": {
    "turn": 11,
    "description": "What finally solved the problem",
    "key_insight": "The discovered root cause"
  },
  "tags": ["async", "race-condition", "pytest-fixture"]
}
```

---

## Technical Challenges

### 1. Trigger detection
Not trivial in Claude Code. Options:
- Hook on test runs (exit code 0 after non-0 exit code)
- Analysis of recent messages for confirmation patterns
- Manual user command (`/capture`)

### 2. Anonymization *(big chunk)*
An LLM can anonymize but with a non-zero error rate → legal/trust risk.
What needs to be detected and replaced:
- Revealing business variable names
- File paths (`/home/user/company/project/...`)
- Proprietary constants and strings
- Business function/class names
- Internal URLs

### 3. Target platform
Chicken-and-egg problem without an existing community.
Temporary options:
- **HuggingFace Datasets** — existing ML ecosystem, suitable format
- **GitHub** — accessible, versionable
- Long term: dedicated platform with community curation

### 4. Signal quality
How to distinguish a good iteration from a bad one?
- Passing tests = strong signal
- Explicit human validation = strong signal
- Duration/complexity of the iteration = richness indicator

---

## Minimalist Approach (MVP)

> The value lies first in **capture and structure**. Anonymization and sharing come later.

**Step 1 — Local only:**
- The skill captures the conversation at trigger time
- Structures it as standardized JSON
- Stores it in a local folder `~/.claude/iterations/`

**Step 2 — Anonymization:**
- Manual LLM-assisted review
- User validates before any export

**Step 3 — Sharing:**
- Export to HuggingFace Datasets or GitHub Gist
- Quality metadata (tests OK, number of turns, languages)

---

## Long-Term Vision

An equivalent of **Git for AI co-development sessions**:
- Each iteration turn = a commit
- Associated tests = the CI
- The final diff = the exportable training data

Feed a structured public dataset of real problem resolutions, with their complete iterative path — something neither Stack Overflow nor docs have ever had.

---

## References
- Stack Overflow Data Explorer: questions/month data
- HuggingFace Datasets: https://huggingface.co/datasets
- Claude Code hooks documentation: to be verified
