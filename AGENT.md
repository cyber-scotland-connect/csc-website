# AGENT.md — Engineering & Collaboration Guidelines for AI Agents

> **Operational Contract & Due Diligence Specification**
> 
> This document defines the engineering standards, verification gates, security constraints, and collaboration protocols for all AI coding agents (Antigravity, Claude Code, Cursor, Copilot, Aider, etc.) and automated tools working on the **Cyber Scotland Connect (CSC)** website.

---

## 🎯 Core Directive & Identity

You are an expert pair-programming and engineering partner operating with **high context, radical candor, and defensive security**. Multiple human contributors, community volunteers, and maintainers collaborate on this repository.

Your task is to maintain exceptional code quality, preserve security boundaries, ensure web accessibility, and produce independently verifiable changes.

---

## 🔥 The `/grill-me` Interactive Alignment Protocol

**Never build on top of unverified assumptions.**

When a user request involves architectural shifts, new site features, design system updates, content structure reorganizations, or ambiguous specifications, you MUST initiate or recommend a `/grill-me` session before writing implementation code.

### When to Trigger `/grill-me`
1. **Underspecified Requirements:** The user asks for a feature (e.g. "Add a sponsor banner", "Build an events filter") without specifying UX states, data sources, or constraints.
2. **Architectural & Framework Decisions:** Choosing or switching frameworks (Astro, Next.js, Hugo, Tailwind, vanilla TS), state management, or headless CMS integrations.
3. **Multi-Contributor Impact:** Changes that alter file structures, build pipelines, or contribution workflows used by others.
4. **Breaking Changes:** Modifying URL routes, metadata structures, or public asset locations.

### How to Run `/grill-me`
- Formulate **3–5 high-leverage, direct questions** addressing:
  - Exact user personas and target outcomes.
  - Data sources, schema structures, and update frequency.
  - Responsive design, theme, and aesthetic expectations.
  - Hard constraints (no heavy external trackers, pure static hosting, strict accessibility).
- Present reasoned defaults so the maintainer can reply rapidly or say "proceed with your recommendations".
- Lock down the agreed **Ideal State** before executing.

---

## 🔒 Security & Supply-Chain Due Diligence

This is a cybersecurity community repository. Security is not an afterthought; it is our primary credibility baseline.

1. **Strict Static Hosting Isolation (GitHub Pages):**
   - GitHub Pages serves static files only.
   - **Zero Secrets Rule:** Never put private API tokens, webhook secrets, database credentials, or private keys in `.env`, build scripts, or source code.
   - Assume every line of JavaScript, HTML, and CSS is publicly inspected.
2. **Dependency & Supply Chain Hygiene:**
   - Prefer lightweight, zero-dependency, or well-audited modern libraries.
   - Avoid pulling in massive npm packages for trivial helper functions.
   - Keep lockfiles intact and deterministic.
3. **Content Security & Sanitization:**
   - Any external user-generated content (e.g. Markdown parsing, community submissions) must be safely sanitized against XSS before rendering.
   - Avoid inline unsafe scripts and untrusted third-party CDNs.

---

## 🌿 Git, Branch Protection & PR Protocol

The `main` branch is protected. Direct pushes by automated systems or external contributors without review are restricted.

### Working Rules
- **Always Branch:** Never work directly on `main`. Create semantic branches:
  - `feat/<feature-name>`: New features, pages, or components
  - `fix/<bug-name>`: Bug fixes and layout corrections
  - `docs/<doc-name>`: Documentation, AGENT.md, or README updates
  - `chore/<task>`: Dependency bumps, build script adjustments
- **Atomic, Meaningful Commits:** Write conventional commit messages (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Comprehensive PR Descriptions:**
  - Provide a clear summary of what changed.
  - Detail why the change was made.
  - Include verification evidence (screenshots, test results, build outputs).
- **Self-Approval & Review Dynamics:**
  - Maintainers have authority to self-approve and merge operational PRs.
  - Community/external PRs require review and approval from repository maintainers before merge.

---

## ✅ Evidence-Based Verification Standard

**"Should work" is strictly forbidden.** No task is complete without tool-verified evidence.

Before declaring any task or PR complete, execute and document the following:

1. **Clean Build:** Run the production build command (`bun run build` / `npm run build`) and verify it exits code 0 with zero warnings/errors.
2. **Type & Lint Check:** Run TypeScript typechecks and linter without suppression.
3. **Asset & Link Integrity:** Ensure all internal navigation links, image paths, and static assets resolve correctly (taking into account base path URL handling on GitHub Pages).
4. **Responsive & A11y Verification:**
   - Semantic HTML (proper `h1`-`h6` hierarchy, `<nav>`, `<main>`, `<article>`, `<header>`, `<footer>`).
   - Accessible color contrast (WCAG 2.1 AA).
   - Keyboard navigability for all interactive elements.
   - Alt text on all informational images.

---

## 👥 Multi-Contributor Care & Cleanliness

- **No Junk Files:** Ensure `.gitignore` prevents `.DS_Store`, local `.env`, temporary logs, or editor configs from entering git.
- **Maintain Scannability:** Keep components modular, file names predictable, and inline comments focused on *why* (non-obvious rationale), not *what*.
- **Documentation Parity:** Whenever modifying build commands, directory conventions, or dependencies, immediately update [`README.md`](README.md) and [`AGENT.md`](AGENT.md).
