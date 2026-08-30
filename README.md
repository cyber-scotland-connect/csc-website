# Cyber Scotland Connect (CSC) Website

[![GitHub Pages Deployment](https://img.shields.io/github/deployments/cyber-scotland-connect/csc-website/github-pages?label=GitHub%20Pages&logo=github)](https://cyber-scotland-connect.github.io/csc-website/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Branch Protection](https://img.shields.io/badge/main-protected-green.svg)](https://github.com/cyber-scotland-connect/csc-website)

The official website for **Cyber Scotland Connect (CSC)** — an inclusive, grassroots community connecting cyber security professionals, students, academics, and enthusiasts across Scotland.

---

## 🚀 Overview

This repository houses the source code, assets, and content for the CSC public website, hosted on **GitHub Pages**.

- **Community Hub:** Meetups, conference updates, local chapter details (Edinburgh, Glasgow, Aberdeen, Dundee, and beyond).
- **Resources & Guidance:** Curated cybersecurity learning paths, speaker resources, and community projects.
- **Fast & Accessible:** Static-first, lightweight architecture ensuring high performance and accessibility.

---

## 🛠️ Architecture & Tech Stack

- **Hosting:** GitHub Pages via GitHub Actions workflow
- **Runtime / Package Management:** Modern TypeScript / JavaScript tooling (recommended: [`bun`](https://bun.sh) or `npm`/`pnpm`)
- **Deployment Model:** Pure Static Site Generation (SSG). No backend server; client-side secrets are strictly forbidden.

---

## 💻 Getting Started

### Prerequisites

- [Bun](https://bun.sh) (recommended) or [Node.js](https://nodejs.org) (v20+)
- [Git](https://git-scm.com)
- [GitHub CLI (`gh`)](https://cli.github.com) (optional, for PR and issue management)

### 1. Clone the Repository

```bash
git clone https://github.com/cyber-scotland-connect/csc-website.git
cd csc-website
```

### 2. Configure Environment

Copy the example environment configuration:

```bash
cp .env.example .env
```

> **Security Note:** All variables exposed via `.env` are bundled into client-side assets for GitHub Pages. **Never add private keys, database credentials, or secret API tokens to `.env`.**

### 3. Install Dependencies & Run Locally

```bash
# Using Bun (preferred)
bun install
bun run dev

# Or using npm
npm install
npm run dev
```

### 4. Build for Production

To test the static production build locally:

```bash
bun run build
bun run preview
```

---

## 🤝 Contribution & PR Workflow

We welcome contributions from everyone in the Scottish cyber security community! To keep the repository clean and secure, we enforce branch protection on `main`.

### Workflow Steps

1. **Create a Topic Branch:** Never commit directly to `main`.
   ```bash
   git checkout -b feat/add-speaker-section
   # Or: fix/nav-mobile-overflow, docs/update-code-of-conduct
   ```
2. **Make & Test Your Changes:** Verify locally that builds pass and there are no lint or formatting regressions.
3. **Commit with Clarity:** Follow conventional commits (e.g., `feat:`, `fix:`, `docs:`, `chore:`).
4. **Push & Open a Pull Request:**
   ```bash
   git push -u origin feat/add-speaker-section
   gh pr create --web
   ```
5. **Review & Approval:**
   - External PRs require at least **1 approving review** from a maintainer before merging.
   - Maintainers can review, suggest adjustments, and approve.
   - Maintainers and admins can self-approve and merge operational PRs as needed.

---

## 🤖 AI Agents & Automated Collaborators

If you are using an AI coding assistant (e.g., Claude Code, Antigravity, Cursor, Copilot Workspace) or contributing automated tooling, please consult:

👉 **[`AGENT.md`](AGENT.md)** — Architectural standards, verification gates, security boundaries, and the `/grill-me` alignment protocol.

---

## 🔒 Security Policy

Because this is a cybersecurity community platform, security and supply-chain hygiene are top priorities:

- **No Secrets in Bundles:** GitHub Pages is fully public. Any token committed or bundled is considered compromised.
- **Dependency Hygiene:** Regularly audit dependencies for CVEs.
- **Reporting Vulnerabilities:** If you discover a security issue or misconfiguration in this website, please open a GitHub Security Advisory or contact the maintainers directly rather than opening a public issue.

---

## 📜 Code of Conduct

All contributors and community members are expected to uphold a welcoming, respectful, and harassment-free environment. Be kind, collaborate constructively, and support newcomers.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
