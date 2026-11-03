# Cyber Scotland Connect (CSC) — System Architecture, Context & Engineering Standard

> **Canonical System State & Knowledge Base**
>
> This document provides comprehensive domain, architectural, and operational context for all engineers and AI coding assistants collaborating on the **Cyber Scotland Connect (CSC)** website and platform.

---

## 1. Executive Summary & Purpose

**Cyber Scotland Connect (CSC)** is an inclusive, non-profit, volunteer-led cybersecurity community initiative serving Scotland. Established in 2018 through the unification of regional technical security meetups, CSC provides high-signal, zero-sales knowledge exchange, technical presentations, career enablement, and networking opportunities for security professionals, students, researchers, and hobbyists across the Scottish cyber ecosystem.

The primary goals of this repository and public website are:
1. **Centralize Community Gatherings:** Provide a single, reliable calendar and archive of all CSC meetups across Edinburgh, Glasgow, Dundee, Aberdeen, and virtual sessions.
2. **Promote Downstream Ecosystem Events:** Signpost ethical, non-sales events hosted by trusted Scottish cyber security partners, university societies, and regional clusters.
3. **Showcase Community Leadership & Resources:** Recognize volunteer organizers, student societies, and provide access to curated tools, reading materials, and standards.
4. **Demonstrate Open Engineering Excellence:** The site itself serves as an open-source demonstration of high-performance static web architecture, defensive security hygiene, WCAG 2.1 AA accessibility, and automated continuous delivery.

---

## 2. Technical Stack & Architecture

The website is engineered as a modern, high-performance static site built with **Astro 5** and **Tailwind CSS**, hosted on **GitHub Pages**.

- **Core Framework:** [Astro v5](https://astro.build/) (Static Site Generation / SSG mode).
- **Package & Runtime Manager:** [Bun](https://bun.sh/) (ultra-fast TypeScript/JavaScript runtime, package manager, and test runner).
- **Styling & Design System:** Tailwind CSS v4 with customized brand color palettes, dark/light theme persistence, typography scale, and tactile glassmorphic cards.
- **Content Engine:** Astro Content Collections with strict compile-time TypeScript / Zod validation schemas (`src/content.config.ts`).
- **Icons:** `lucide-astro` (modern, lightweight SVG icons).
- **Deployment & Hosting:** Pure static HTML/CSS/JS export (`dist/`) automatically deployed via GitHub Actions to GitHub Pages at `cyberscotlandconnect.com`.

---

## 3. Brand Identity & Visual Design Tokens

CSC’s visual identity balances professional cybersecurity credibility with warm, accessible Scottish community aesthetics:

- **Midnight Navy (`#21203a`):** Primary background for dark theme, representing deep technical focus and security resilience.
- **Electric Heather / Thistle (`#895294`):** Primary brand accent inspired by the Scottish thistle, used for interactive badges, primary buttons, borders, and active highlights.
- **Saltire Sky (`#6fb7e6`):** Secondary accent inspired by the Scottish flag and northern sky, used for tags, hyperlinks, and hover glow effects.
- **Muted Lavender (`#bdaccf`):** Low-contrast supporting text, borders, and subtle icon accents.
- **Warm White (`#fbf8f5`):** Warm background for light theme, avoiding stark clinical white.

---

## 4. Key Architectural & Security Decisions

1. **Pure Static Generation (SSG):** The entire site compiles to static assets. There are no server-side databases, serverless compute functions, or dynamic backend APIs. This minimizes the attack surface to zero server-side vulnerabilities.
2. **Zero Client-Side Trackers:** The site uses zero intrusive third-party cookies, tracking pixels, or foreign ad networks.
3. **Defensive Content Security Policy (CSP):** Strict security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) are embedded directly in the static layout templates.
4. **Strict Scottish Geography Invariant:** Physical event locations and Royal Mail postcodes are strictly validated against genuine Scottish regions (`AB, DD, DG, EH, FK, G, HS, IV, KA, KW, KY, ML, PA, PH, TD, ZE`, excluding `TD15` Berwick-upon-Tweed). Non-Scottish UK locations fail build validation deterministically.
5. **Strict Tri-State Accessibility Model:** All event files enforce a tri-state accessibility model (`stepFree: boolean | null`, `hearingLoop: boolean | null`). True assertions require specific accommodation notes to prevent guessing.

---

## 5. Directory Structure & Key Files

```text
csc-website/
├── src/
│   ├── components/            # Reusable Astro UI components (EventCard, Navbar, Footer, etc.)
│   ├── content/               # Markdown content collections
│   │   ├── events/            # Meetup archive & upcoming event records
│   │   ├── leaders/           # Organizers and advisory board members
│   │   ├── partners/          # Host venues, sponsors, and academic collaborators
│   │   ├── resources/         # Curated reading list, tools, and living standards
│   │   └── community/         # Scottish hacker societies and community groups
│   ├── layouts/               # BaseLayout and page wrappers
│   ├── pages/                 # File-based routes (index, events, partners, feeds, etc.)
│   └── utils/                 # Geography, calendar, RSS, and partner registry utilities
├── scripts/                   # Automated event discovery, Discord notifier, link checker
├── tests/                     # Unit and archive integrity test suite (bun test)
├── public/                    # Static assets (favicons, logos, brand vectors)
└── astro.config.mjs           # Astro SSG build configuration
```

---

## 6. Content Collections & Schema Specifications

### Data Schemas (`src/content.config.ts`)
- **Event Schema (`src/content/events/*.md`):** `title`, `date`, `time`, `location`, `locationUrl`, `city`, `isPartnerEvent` (boolean, strictly true ONLY for verified partners in `src/content/partners/`), `partnerName`, `organizerType`, `accessType`, `meetupUrl`, `registrationUrl`, `streamUrl`, `slidesUrl`, `recordingUrl`, `accessibility`, `speakers`, `agenda`.
- **Leader Schema (`src/content/leaders/*.md`):** `name`, `role`, `chapter`, `bio`, `avatar`, `linkedin`, `github`, `website`, `status`, `order`.
- **Partner Schema (`src/content/partners/*.md`):** `name`, `tier` (`Host Venue` | `Ecosystem Partner` | `Sponsor` | `Academic Partner`), `logo`, `websiteUrl`, `active`, `order`.
- **Resource Schema (`src/content/resources/*.md`):** `title`, `url`, `category`, `type`, `description`, `isScottishOrUK`, `order`.
- **Community Schema (`src/content/community/*.md`):** `name`, `category`, `city`, `websiteUrl`, `chatUrl`, `meetingFrequency`, `description`, `active`, `order`.

---

## 7. Community Origins & Foundational Leadership

Cyber Scotland Connect was established through the merger of two prominent Scottish cyber security meetup groups, co-founded by **Harry McLaren** and **Stu Hirst**, and announced at DIGIT Expo.
