# Cyber Scotland Connect — Slide Deck Improvement Backlog

This document tracks prioritized architectural and design enhancements for the native Google Slides automation pipeline (`scripts/slide-ops.ts`) and Master Presentation Template (`16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ`).

---

## 🎯 Tier 1 — High Leverage & Low Friction

### 1. Dynamic Sponsor & Venue Partner Logos (Slides 3 & 12)
- **Current State:** Renders partner names and descriptions as text inside cards.
- **Proposed Enhancement:** When `logoUrl` or local image asset exists in `src/assets/partners/`, dynamically insert company logos inside the top half of the cards via `gslides mutate insert-image-from-file` or `add-image`. Fall back to styled SVG icons when no logo is available.
- **Data Hook:** `src/content/partners/*.md` (`logoUrl`, `logo`).

### 2. Event-Specific Slido Poll & Q&A Room (Slide 10)
- **Current State:** Uses a static placeholder question and generic options A–D in the master template.
- **Proposed Enhancement:** Ingest a `poll:` frontmatter block from `src/content/events/<slug>.md`:
  ```yaml
  poll:
    code: "CSC-EDI-NOV"
    question: "Which defensive priority is top of mind for your team this quarter?"
    options:
      - "AI & Agentic SoC Automation"
      - "Supply Chain & Build Config Security"
      - "Evaluating LLM Agent Guardrails"
      - "API Object-Level Authorization Controls"
  ```
  Dynamically populate the question, options, and generate an event-specific Slido QR code.

### 3. Dedicated Pub Name, Walking Time & Next Gathering City (Slide 13)
- **Current State:** Generic "Social: Local Pub (Central Edinburgh) (All Welcome)".
- **Proposed Enhancement:**
  - Pull designated social venue from frontmatter (e.g. `pub: "The Hanging Bat (5 mins walk)"`).
  - Scan `src/content/events/*.md` for the chronologically next scheduled meetup to dynamically populate: `"Next gathering: Glasgow • December 2026 • RSVPs open on Meetup"`.

---

## 🚀 Tier 2 — Visual Richness & Ecosystem Integration

### 4. Real Speaker Headshots & Author Takeaways (Slides 6–9)
- **Current State:** Generic circular avatar silhouette and default takeaways list.
- **Proposed Enhancement:**
  - Pull speaker photo from `src/assets/speakers/<slug>.jpg` or remote avatar URL and position it over the circular avatar frame.
  - Ingest custom `takeaways:` lists directly from the speaker metadata in event markdown, preserving practitioner-supplied bullet points.

### 5. Automated Sister Event Feed on Open Mic (Slide 11)
- **Current State:** Static placeholder bullet points for community events.
- **Proposed Enhancement:** Query `src/content/events/*.md` at build time for events occurring in the 30-day window following the meetup date (e.g., upcoming DEFCON Dundee, OWASP Scotland, or Scot-Secure) and dynamically write the top 2–3 events onto the "Community Events" card.

### 6. Flexible Agenda Timeline Grid (Slide 5)
- **Current State:** Fixed 6-card timeline layout.
- **Proposed Enhancement:** Add dynamic card count awareness. If an event has 3, 4, or 5 agenda items, dynamically adjust the card widths and X-offsets (or hide unused card shapes) to avoid empty placeholder slots.

---

## 🔮 Tier 3 — Advanced Automations

### 7. Venue Accessibility Direct Injection (Slide 4)
- **Current State:** Generic statement on step-free access and hearing loops.
- **Proposed Enhancement:** Pull venue-specific accessibility notes from `event.accessibility` (e.g., lift locations, step-free entrance details, hearing loop frequencies) and format them into the "Venue & Accessibility" card.

### 8. GitHub Actions Slide Generation Workflow
- **Proposed Enhancement:** Create `.github/workflows/generate-slides.yml` that triggers when an event markdown file in `src/content/events/` is created or modified on `main`. Automatically runs `slide-ops.ts`, saves the presentation ID into the event frontmatter, and commits the PDF to an event release asset.
