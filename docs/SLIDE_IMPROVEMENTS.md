# Cyber Scotland Connect — Slide Deck Improvement Backlog

This document tracks completed and future architectural and design enhancements for the native Google Slides automation pipeline (`scripts/slide-ops.ts`) and Master Presentation Template (`16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ`).

---

## ✅ Completed Enhancements (Shipped 2026-11-07)

### 1. Dynamic Sister & Partner Event Feed (Slide 10 — Open Mic)
- **Status:** Shipped in `scripts/slide-ops.ts`.
- **Capability:** Queries `src/content/events/*.md` at build time for gatherings in the 30-day window following the meetup date. Single-line character budgeting (`formatEvBullet`) prevents text wrapping and card collisions on `p8_i29` and `p8_i30`.

### 2. Repurpose "Jobs" to Discord #careers Signpost (Slide 10)
- **Status:** Shipped in master template and `scripts/slide-ops.ts`.
- **Capability:** Replaced static, rot-prone job listings with a permanent Discord `#careers` community signpost (`• Post roles in Discord #careers`, `• Take 30s at the mic to shout out your role`).

### 3. Slido Poll Purged from Master & Deck Rotation
- **Status:** Shipped in master template and `scripts/slide-ops.ts`.
- **Capability:** Deleted slide `p7` permanently from the master template. Pipeline produces a focused 12-slide presentation natively.

### 4. Dynamic Agenda Timeline Grid (Slide 5)
- **Status:** Shipped in master template and `scripts/slide-ops.ts`.
- **Capability:**
  - Card 1 subtitle updated to `"Arrivals & Refreshments"` across master template and pipeline fallback.
  - Timestamps preserved at native `y: 261.75` inside container frames, preventing border clipping.
  - Slide footer updated: `"Talks conclude at 20:15 with Q&A • Event closes at 20:30 for community social at the pub."`
  - Dynamic width/gap scaling for 3–5 items; cleans unused text slots.

### 5. Word-Boundary Abstract Truncation (Slides 6–9)
- **Status:** Shipped in `scripts/slide-ops.ts`.
- **Capability:** Upgraded abstract processor to 210 characters with strict word-boundary clipping (`lastIndexOf(' ')`), eliminating mid-word cuts across speaker slides.

### 6. Pub & Next Meetup Auto-Detection (Slide 12)
- **Status:** Shipped in `scripts/slide-ops.ts`.
- **Capability:** Frontmatter `pub:` support, plus auto-scan of upcoming CSC meetups to dynamically inject next month's city into the closing slide subtitle.

---

## 🔮 Future Backlog

### 1. Dynamic Sponsor & Venue Partner Logos (Slides 3 & 11)
- **Current State:** Renders partner names and descriptions as text inside cards. Post-batch image insertion supported when `logoUrl` exists.
- **Proposed Enhancement:** Expand local partner asset library in `src/assets/partners/` and automate logo image resizing and container positioning.

### 2. Venue Accessibility Direct Injection (Slide 4)
- **Current State:** Master slide has standard statement on step-free access and hearing loops.
- **Proposed Enhancement:** Ingest venue-specific notes from `event.accessibility.notes` (lift locations, step-free entrance details, hearing loop frequencies) and format them into the "Venue & Accessibility" card.

### 3. GitHub Actions Slide Generation Workflow
- **Proposed Enhancement:** Create `.github/workflows/generate-slides.yml` triggering on event markdown modifications on `main`. Automatically runs `slide-ops.ts`, saves the presentation ID into event frontmatter, and exports the production PDF as a release asset.
