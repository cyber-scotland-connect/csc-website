# Cyber Scotland Connect (CSC) Website

[![GitHub Pages Deployment](https://img.shields.io/github/deployments/cyber-scotland-connect/csc-website/github-pages?label=GitHub%20Pages&logo=github)](https://cyber-scotland-connect.github.io/csc-website/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Branch Protection](https://img.shields.io/badge/main-protected-green.svg)](https://github.com/cyber-scotland-connect/csc-website)
[![Accessibility WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-purple.svg)](#-accessibility--inclusive-design)

The official website for **Cyber Scotland Connect (CSC)** — an inclusive, grassroots community connecting cyber security practitioners, students, researchers, career switchers, and enthusiasts across Scotland.

---

## 🚀 Overview

This repository contains the complete static website and content collections for Cyber Scotland Connect, hosted on **GitHub Pages**.

- **Community Hub:** Meetups, conference updates, local chapter details across Edinburgh, Glasgow, Dundee, Aberdeen, and virtual streams.
- **High-Signal, Zero-Sales:** Strict community charter prohibiting vendor sales pitches.
- **Fast, Accessible & Lean:** Built with [Astro](https://astro.build), [TypeScript](https://www.typescriptlang.org/), and [Tailwind CSS](https://tailwindcss.com/) with zero client-side JavaScript overhead by default.
- **Multi-Contributor & AI-Friendly:** All events, leaders, and partners are managed via type-safe Markdown files in `src/content/`. Anyone (or any AI agent) can add or update entries via standard Pull Requests.

---

## ♿ Accessibility & Inclusive Design

CSC is dedicated to radical inclusivity and accessibility (WCAG 2.1 AA/AAA compliance):
- **Theme Selection:** Dark mode (default), light mode, and system preference detection with zero flash of unstyled content (FOUC).
- **Dyslexia Font Switcher:** One-click toggle switching between standard typography and [Atkinson Hyperlegible](https://brailleinstitute.org/freefont) / OpenDyslexic with optimized line-height and letter-spacing.
- **Text Sizing Controls:** Three-tier scaling (Normal 100%, Large 112%, Extra Large 125%).
- **High-Contrast Mode:** Enhanced visual borders for low-vision users.
- **Physical Venue Disclosures:** Every event explicitly states step-free mobility routes and induction hearing loop availability.
- **Keyboard & Screen Reader Ready:** Skip-to-content links, semantic HTML5 landmarks, ARIA labels, and visible focus rings.

---

## 🛠️ Architecture & Tech Stack

- **Static Site Generator:** [Astro 5](https://astro.build) (Pure SSG, zero runtime vulnerabilities)
- **Styling:** [Tailwind CSS](https://tailwindcss.com) configured with the CSC Brand System (`#21203a` Deep Purple, `#56548c` Lilac, `#895294` Pink)
- **Type Safety & Schemas:** TypeScript + Zod content schemas
- **Hosting:** GitHub Pages via automated GitHub Actions workflow (`.github/workflows/deploy.yml`)
- **Supported Runtimes:** [Bun](https://bun.sh) (recommended) or [Node.js](https://nodejs.org) (v20+)

---

## 💻 Getting Started (Windows, macOS, Linux)

This project supports contributions from **any platform** (Windows PowerShell/CMD/WSL, macOS zsh, Linux bash).

### 1. Clone the Repository
```bash
git clone https://github.com/cyber-scotland-connect/csc-website.git
cd csc-website
```

### 2. Configure Environment (Optional)
```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```
> ⚠️ **Security Warning:** GitHub Pages serves static files only. **Never commit private API keys, database credentials, or secret tokens.**

### 3. Install Dependencies
```bash
# Using Bun (preferred)
bun install

# Or using npm
npm install
```

### 4. Run Development Server
```bash
# Using Bun
bun run dev

# Or using npm
npm run dev
```
Open `http://localhost:4321` in your browser.

### 5. Build for Production
```bash
# Using Bun
bun run build

# Or using npm
npm run build
```
The compiled, optimized static website will be output to `dist/`.

---

## 📂 Repository Layout

```
csc-website/
├── .github/
│   ├── workflows/deploy.yml       # Automated GitHub Pages CI/CD
│   └── content-templates/         # Markdown templates for events, leaders & partners
├── public/
│   ├── branding/                  # High-res logos, icons, badges
│   └── favicon.svg
├── src/
│   ├── content/                   # Type-safe Content Collections
│   │   ├── config.ts              # Zod schemas (events, leaders, partners)
│   │   ├── events/                # Event Markdown files
│   │   ├── leaders/               # Organizer & moderator Markdown files
│   │   └── partners/              # Sponsor & partner Markdown files
│   ├── components/
│   │   ├── AccessibilityBar.astro # Theme, dyslexia font & text-size toolbar
│   │   ├── Header.astro           # Sticky navigation header
│   │   ├── Footer.astro           # Footer links & copyright
│   │   ├── EventCard.astro        # Event preview card
│   │   ├── LeaderCard.astro       # Organizer / Moderator card
│   │   └── PartnerCard.astro      # Sponsor / Partner card
│   ├── layouts/
│   │   └── BaseLayout.astro       # Master HTML scaffold with SEO & JSON-LD
│   ├── pages/
│   │   ├── index.astro            # Homepage & About Us
│   │   ├── events/                # Events calendar & detail views
│   │   ├── leaders.astro          # Leadership directory
│   │   ├── partners.astro         # Sponsors & partner directory
│   │   ├── code-of-conduct.astro  # Community safety charter
│   │   └── security.astro         # Security policy & disclosure
│   └── styles/
│       └── global.css             # CSS variables, a11y classes & brand tokens
├── astro.config.mjs               # Astro configuration
├── tailwind.config.mjs            # Tailwind CSS configuration
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## ✍️ How to Contribute Content

Adding an upcoming meetup, partner event, new organizer bio, or sponsor takes just a couple of minutes:

1. **Create a new Markdown file** in the appropriate directory:
   - Events: `src/content/events/YYYY-MM-DD-event-slug.md`
   - Leaders / Mods: `src/content/leaders/firstname-lastname.md`
   - Partners / Sponsors: `src/content/partners/organization-name.md`
2. **Copy the schema from `.github/content-templates/`** and fill in the frontmatter fields.
3. **Verify locally:** Run `bun run build` (or `npm run build`) to ensure Zod validation passes.
4. **Submit a Pull Request!**

Consult [`CONTRIBUTING.md`](CONTRIBUTING.md) for branch naming and workflow rules.

---

## 🤖 AI Agents & Automated Collaborators

If you are using an AI assistant (Antigravity, Claude Code, Cursor, Copilot Workspace, Aider):
- Consult **[`AGENT.md`](AGENT.md)** for our strict engineering standards, content schemas, verification gates, and the `/grill-me` alignment protocol.

---

## 🔒 Security Policy

We treat security and supply-chain integrity with paramount importance:
- **Zero Secrets Rule:** Client-side static hosting only.
- **Reporting Vulnerabilities:** Please report security findings via the [GitHub Security Advisory](https://github.com/cyber-scotland-connect/csc-website/security/advisories/new) or consult [`SECURITY.md`](SECURITY.md).

---

## 📜 Code of Conduct

All contributors and participants must adhere to our [Contributor Covenant 2.1 Code of Conduct](CODE_OF_CONDUCT.md).

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
