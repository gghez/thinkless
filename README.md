# Thinkless

> Capturing the problem-solving journeys of human/AI co-development — before they vanish.

---

## The Problem

LLMs are trained on web knowledge: Stack Overflow, forums, community docs. But by capturing developer attention, they are drying up the very source that fed them.

Stack Overflow lost ~70% of its new questions between March 2023 and December 2024 — down from 87,000/month to 25,000. It's back to 2009 levels.

The feedback loop is breaking:
- Fewer developers post on forums → less quality training data
- Future models trained on this impoverished web will be worse
- Especially on niche, recent, or complex problems

The same threat looms over open source: if an agent can generate an equivalent library in 2 minutes, the middle ground of the ecosystem quietly disappears.

---

## The Insight

Every human+AI co-development session is a rich, underexploited source of knowledge. It contains:

- The agent's initial mistakes
- Human corrections and feedback
- Edge cases discovered along the way
- The developer's implicit reasoning ("no, that won't work because...")
- The final validated solution

This is comparable to years of production bug reports enriching a library — except it disappears into the void at the end of every session.

---

## What Thinkless Does

Thinkless captures these iterations, structures them as standardized JSON, and saves them locally. Each capture records:

- The initial problem and its context
- Every attempted hypothesis (what was tried, why it failed)
- The solution and its root cause (`key_insight`)
- Tags for future search and retrieval

The goal: build a public dataset of real problem-solving journeys, with their full iterative path — something neither Stack Overflow nor documentation has ever had.

---

## Vision

Think of it as **Git for AI co-development sessions**:
- Each iteration = a commit
- The associated tests = the CI
- The final diff = exportable training data

A structured, community-curated dataset of resolved problems — with the messy, valuable path that led to the solution.

---

## Status

Early stage. The `/capture` skill for Claude Code is the first building block: it captures a session, structures it as JSON, and saves it to `~/.claude/iterations/`.

Anonymization and sharing (HuggingFace Datasets, GitHub) come next.
