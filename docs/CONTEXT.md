# Cyber Scotland Connect (CSC) — Project Context & Operational Knowledge Base

> **Primary Source Ingestion & Grounding Document**  
> Synthesized from:
> 1. `CSC New Website Requirements` (Project Specification & Migration Strategy)
> 2. `CSC Events Mods Manual V2.0` (Playbook & Operations Manual for Organizers, Speakers, and Volunteers)
>
> *Last Updated: 2026-08-30*

---

## 1. Background & Mission

Cyber Scotland Connect (CSC) is an inclusive, grassroots community connecting cyber security practitioners, students, researchers, career switchers, and enthusiasts across Scotland.

### The Problem with Legacy WordPress
The previous WordPress site suffered from fatal errors, plugin incompatibilities, maintenance overhead, and security vulnerability risks inherent in dynamic CMS platforms. 

### The Target State
Migrate to a modern, high-performance, community-driven **Static Site on GitHub Pages** deployed via GitHub Actions.
- **Zero dynamic server vulnerabilities:** No PHP, no backend database, no plugin conflicts.
- **Open-source transparency:** All content and policies managed in Markdown via version-controlled GitHub Pull Requests.
- **High accessibility & speed:** Blazing fast load times, accessible design, and low maintenance burden.

---

## 2. Core Stakeholders & Use Cases

| Stakeholder | Key Interactions & Desired Outcomes |
| :--- | :--- |
| **Community Members** | Discover upcoming local and virtual events; access speaker slide archives and workshop tutorials; explore career paths and job opportunities; join real-time Discord discussions. |
| **Speakers & Presenters** | Understand the "High-Signal, Zero-Sales" speaking standard; submit talk proposals; find AV/tech requirements for in-person venues and virtual green rooms. |
| **Venues & Partners** | Review partnership agreements and hosting guidelines; understand venue accessibility baselines (step-free access, hearing loops); receive brand recognition as supporters. |
| **Organizers & Moderators** | Manage content via standard git pull requests; publish and enforce the Code of Conduct; maintain transparency over community guidelines and donation/supporter links. |

---

## 3. Operational Playbook & Event Delivery Model

CSC operates across physical, virtual, and hybrid delivery models with strict operational baselines.

### 3.1 Regional Chapters & Physical Hubs
CSC hosts quarterly in-person events across key Scottish technology corridors:
- **Edinburgh:** Central hub (e.g. CodeBase Edinburgh, WaverleyGate, Trustpilot).
- **Glasgow:** Western hub targeting enterprise teams and academic networks.
- **Dundee:** Tech and academic hub (e.g. Abertay cyberQuarter).

#### Venue Capacity Tiers
- **Small (25–30 attendees):** Technical workshops, interactive roundtables, regional market validation.
- **Medium (31–70 attendees):** Standard evening meetups, multi-speaker briefings (e.g. CodeBase).
- **Large (71–120+ attendees):** Annual keynotes, multi-track panels, seasonal summits.

### 3.2 Accessibility & Technical Baseline (Mandatory)
Every physical event listing and venue must account for:
1. **Physical Mobility:** Step-free route from public transit to presentation space, working lifts, wide doorways, clearly signed accessible gender-neutral facilities.
2. **Hearing Loops:** Audit for Induction Hearing Loops patched into the master soundboard; explicitly state availability (or lack thereof) on event announcements.
3. **Livestream Feeds:** Dedicated, high-bandwidth connection (minimum 20 Mbps upload) isolated from public Wi-Fi.

### 3.3 Virtual Event Operations (Google Meet to YouTube Live)
- **Tech Stack:** Google Meet (speaker room) bridged via RTMP to YouTube Live (public broadcast).
- **Pre-Flight Green Room (T-Minus 30 min):** Mandatory soundcheck (external mics + headphones to eliminate feedback), macOS screen-sharing permission tests, front-facing lighting checks.
- **Moderation:** Live Q&A routed through dedicated Slido links or CSC Discord to avoid unmoderated chat spam.

---

## 4. Speaker Guide & Content Policy

CSC's community trust depends on technical integrity and neutrality. Every speaker must follow the **High-Signal, Zero-Sales** philosophy.

### 4.1 Non-Negotiable Rules
- **60-Second Intro Rule:** Speakers may show employer logo, job title, and company scale for a maximum of 60 seconds.
- **Core Presentation:** Must focus exclusively on open methodologies, operational strategies, code patterns, threat research, or security architectures the audience can action independently.
- **Strict Anti-Pitch Ban:** No product demos, vendor feature pitch decks, proprietary pricing, sales contact forms, or recruitment funnels.

### 4.2 Content Alignment
- **DO:** Base talks on standard frameworks (MITRE ATT&CK, SABSA, NIST, OWASP); share hard engineering lessons, failure retrospectives, and detection gaps; make complex topics accessible to career switchers and juniors.
- **DON'T:** Present sanitized corporate marketing case studies or lean on exclusionary, gatekeeping jargon.

---

## 5. Promotion & Event Lifecycle Timelines

Organizers execute a 4-week cadence for all events:
- **T-Minus 4 Weeks:** Publish Meetup page; initial LinkedIn announcement with date, city, and theme.
- **T-Minus 2 Weeks:** Update Meetup with speaker bios and technical abstracts; structured LinkedIn update tagging speakers/orgs.
- **T-Minus 1 Week:** Ticket capacity check; call-to-action on LinkedIn; reminder broadcast to RSVP'd attendees.
- **T-Zero (Event Day 12:00 BST):** Final "Tonight" post with transit, check-in, or stream access details.

---

## 6. Website Technical Architecture & Schema Implications

The website should be designed around structured, typed content models:

### 6.1 Recommended Page Structure
1. **Home / Landing:** Mission, upcoming featured events, quick links to Discord/Meetup, supporter showcase.
2. **Events Calendar (`/events`):** Filterable by chapter (Edinburgh, Glasgow, Dundee, Virtual), past archive with recordings and slide links, explicit accessibility tags.
3. **Speakers & Call for Papers (`/speakers`):** Speaker guidelines, "Zero-Sales" policy, CFP submission guide, past speaker roster.
4. **Community & Chapters (`/community`):** Chapter info, Discord join link, volunteer/organizer info.
5. **Resources & Careers (`/resources`):** Learning paths, slide repositories, job board / career switch guides.
6. **Partners & Transparency (`/partners`):** Supporter tiers, venue hosting criteria, financial transparency / donation links.
7. **Governance & Safety (`/about`, `/code-of-conduct`, `/security`):** Contributor Covenant 2.1, security disclosure policy, organizing team info.

### 6.2 Data Schemas (Markdown / Content Collections)
- **Event Schema:** `title`, `date`, `time`, `location` (venue name, address, chapter), `format` (in-person/virtual/hybrid), `meetupUrl`, `streamUrl`, `slidoUrl`, `accessibility` (stepFree, hearingLoop, notes), `speakers` (refs), `slidesUrl`, `recordingUrl`.
- **Speaker Schema:** `name`, `role`, `company`, `bio`, `avatar`, `socialLinks`, `talks` (refs).
- **Partner Schema:** `name`, `tier` (Host, Community Partner, Sponsor), `logoUrl`, `websiteUrl`, `active`.

---

## 7. Community Origins & Foundational Leadership

Cyber Scotland Connect was established through the merger of two prominent Scottish cyber security meetup groups, co-founded by **Harry McLaren** and **Stu Hirst**, and announced at DIGIT Expo.

### 7.1 Community Moderators & Advisory Network
The community is guided by local cyber security leaders across industry, government, and academia:
- 

### 7.2 Ecosystem Collaborations
CSC maintains active relationships across Scotland's broader cyber resilience ecosystem, including **ScotlandIS Cyber Cluster**, **Scottish Business Resilience Centre (SBRC) / Cyber and Fraud Centre Scotland**, **Abertay cyberQuarter**, **CodeBase**, and university student societies (e.g. ENUSEC).

---

## 8. Brand System & Local Assets

- **Brand Specification:** Detailed colour codes, CSS tokens, and font hierarchy live in [`docs/BRAND_GUIDELINES.md`](BRAND_GUIDELINES.md).
- **Historical Event Seed Data:** Curated past meetup talks, venues, and speaker abstracts live in [`docs/PAST_EVENTS_ARCHIVE.md`](PAST_EVENTS_ARCHIVE.md).
- **Static Brand Assets:** High-resolution transparent PNG logos, icons, and badges are available in [`public/branding/`](../public/branding/):
  - `logo-fullcolor-horizontal.png` & `logo-fullcolor-stacked.png`
  - `logo-white-horizontal.png` & `logo-white-stacked.png`
  - `icon-fullcolor.png`, `icon-deeppurple.png`, `icon-lilac.png`, `icon-pink.png`
  - `icon-linkedin.png`

