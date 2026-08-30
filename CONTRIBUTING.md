# Contributing to Cyber Scotland Connect

Thank you for your interest in contributing to the Cyber Scotland Connect (CSC) website! We are an open, community-driven project and welcome contributions of all kinds: bug fixes, new features, content updates, design enhancements, and documentation improvements.

---

## 🧭 Code of Conduct

All contributors are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) at all times.

---

## 🛠️ Development Setup

1. **Fork or Clone:**
   ```bash
   git clone https://github.com/cyber-scotland-connect/csc-website.git
   cd csc-website
   ```
2. **Environment Configuration:**
   ```bash
   cp .env.example .env
   ```
   > **Note:** Never add secrets or sensitive credentials to `.env`. This website is deployed to GitHub Pages and all bundle variables are publicly exposed.
3. **Install Dependencies:**
   ```bash
   # Using Bun (recommended)
   bun install
   bun run dev
   ```

---

## 🌿 Contribution Lifecycle

### 1. Branching
Always create a dedicated topic branch off `main`. **Direct commits to `main` are blocked by branch protection.**
- `feat/name-of-feature`
- `fix/description-of-fix`
- `docs/page-or-readme-update`
- `chore/build-or-deps`

### 2. Making Changes
- Keep changes atomic and well-documented.
- Maintain WCAG 2.1 AA accessibility standards (semantic HTML, contrast, keyboard navigation).
- Ensure mobile and desktop responsiveness.

### 3. Local Verification
Before opening a pull request, verify that:
- The build succeeds without warnings (`bun run build` / `npm run build`).
- No lint or TypeScript type errors are introduced.
- Assets and links load properly.

### 4. Submitting a Pull Request
1. Push your branch to GitHub.
2. Open a Pull Request targeting `main`.
3. Complete the provided PR template, including the verification checklist.
4. A maintainer will review your pull request. At least **1 approving review** from a maintainer is required before merge.

---

## 🤖 Working with AI Agents

If you are using AI pair programming assistants (Antigravity, Claude Code, Cursor, Copilot, etc.), please follow the guidelines in [`AGENT.md`](AGENT.md), including the `/grill-me` protocol for any ambiguous or high-impact architectural decisions.

---

## 💬 Getting Help & Questions

Have questions or want to discuss an idea before building it? Open an issue or join our community discussions!
