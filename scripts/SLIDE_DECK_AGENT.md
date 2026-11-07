# CSC Slide Deck Operations Agent Guide

## Overview

The Cyber Scotland Connect (CSC) slide automation engine generates presentation decks for monthly meetups directly in Google Slides. It clones the Master Template, ingests event and partner markdown data, executes atomic updates in a single API call, and exports production PDFs.

- **Master Slide Template ID:** `16TZeMduvfvE1NcIf0SaVxnqittEc2HNGJEvLO3928WQ`
- **Automation Engine:** `scripts/slide-ops.ts`
- **Native PDF Renderer:** `scripts/render-pdf.js`
- **Font Audit Tool:** `scripts/audit-fonts.ts`
- **Primary Data Sources:**
  - Event metadata & speakers: `src/content/events/<slug>.md`
  - Venue & sponsor descriptions: `src/content/partners/*.md`

---

## The Google Slides API & `gslides` Rules

### 1. Text Update vs. Styling Dispatch
- `"op": "update-text"`: Only deletes existing text and inserts new text string. It **silently ignores** `font_family`, `font_size`, `color`, and `bold`.
- `"op": "style-text"`: Required to apply font properties. Must specify:
  - `font_family`: `"Plus Jakarta Sans"` (CSC Brand Standard)
  - `font_size`: number in points (e.g. `15`, `10.5`, `9.5`)
  - `color`: hex color code (e.g. `"#21203A"`, `"#56548C"`, `"#FFFFFF"`)
  - `bold`: boolean
- `"op": "style-paragraph"`: Required for text alignment (`"START"`, `"CENTER"`, `"END"`).
- Always use the helper `updateAndStyle(...)` in `scripts/slide-ops.ts` to ensure updates never revert to default 14pt Arial.

### 2. Element Resizing Scale Factor
The Google Slides API represents base vector shapes with a 3,000,000 EMU dimension (`236.22047244 pt`).
When issuing `"op": "resize-element"`:
- `x`: target X coordinate in points
- `y`: target Y coordinate in points
- `width`: `targetWidthPt / 236.22047244` (scale factor)
- `height`: `targetHeightPt / 236.22047244` (scale factor)

Passing raw points directly to `width` or `height` without converting to scale factor will expand text boxes by 236x and break the slide layout.

---

## Slide-by-Slide Layout Conventions

| Slide | Purpose | Key Elements & Rules |
| :--- | :--- | :--- |
| **1** | Welcome | `p1_i10` Date (`#6FB7E6`), `p1_i15` Venue, `p1_i17` MC Lead, `p1_i19` WiFi. All bold Plus Jakarta Sans. |
| **2** | Ethos | Static master slide. Three core pillars: Strictly Zero-Sales, Radically Welcoming, Practitioner-Led. |
| **3** | Ecosystem Partners | `p3_i21` Host Venue title, `p3_i18` Host description, `p3_i22` Sponsor title, `p3_i19` Sponsor description. Ingested from `src/content/partners/`. |
| **4** | Code of Conduct | Static master slide. Contributor Covenant v2.1, Chatham House Rule, Photography Opt-Out. |
| **5** | Agenda Timeline | 6 card slots. Titles positioned at `y=282` (h=36, 9.5pt bold). Descriptions/speakers positioned at `y=326` (h=45, 8.5pt regular) to prevent text collision. |
| **6–9** | Speaker Slots | Speaker Name (15pt `#21203A`), Role (10pt `#895294`), Bio (9.5pt `#56548C`, h=44), LinkedIn pill (w=175pt, handle text offset right of icon). Unused slots deleted via `delete-slide`. |
| **10** | Slido Poll | `p7_i20` Slido URL pill (h=24pt, 11pt bold). 4 survey options in Plus Jakarta Sans. |
| **11** | Open Mic | Community shouts, hiring managers, and CFP announcement. |
| **12** | Community Heroes | Gratitude for Speakers, Host Venue Partner, Community Sponsor, and Pay It Forward. |
| **13** | Closing & Social | `p10_i17` Next month meetup subtitle. `p10_i19` Pub social pill text (single line, w=290pt). `p10_i18` Website centered at bottom. *(Do not write pub text to `p10_i18`)*. |

---

## Mandatory Visual Verification Protocol (CONSTITUTIONAL)

Slide output can never be declared complete without visual proof:
1. Export presentation to PDF:
   ```bash
   gslides readonly export <presentationId> dist/slides/<slug>.pdf --format pdf
   ```
2. Render PDF pages to high-resolution PNGs using native macOS PDFKit:
   ```bash
   osascript -l JavaScript scripts/render-pdf.js dist/slides/<slug>.pdf dist/slides/rendered
   ```
3. Visually inspect all rendered PNG files (`dist/slides/rendered/slide-1.png` through `slide-13.png`) using `read_file`.
4. Check specifically for:
   - Zero font regressions (all text is Plus Jakarta Sans).
   - Zero text box wrapping or collisions.
   - All partner descriptions populated from verified markdown files.
   - Proper margin and pill alignment.

---

## Git & Repository Hygiene

- **Do Not Commit `dist/`:** All PDF exports, JSON batches, and rendered PNG screenshots reside in `dist/slides/` which is protected by `.gitignore`.
- **Committed Files:** Only commit production code (`scripts/slide-ops.ts`, `scripts/render-pdf.js`, `scripts/audit-fonts.ts`) and markdown guides (`scripts/SLIDE_DECK_AGENT.md`). Never commit temporary inspect or scratch scripts.
