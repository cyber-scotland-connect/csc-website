# Cyber Scotland Connect (CSC) — Brand & Design System Guidelines

> **Source:** Synthesized from the official *CSC Brand Manual* and *CSC Lookbook Collection* designed by Sophie Lanc.
>
> *Version: 1.0 (Web Specification)*

---

## 🛡️ Brand Concept & Logo Symbolism

- **The Mark:** "The Fragmented Shield"
- **Symbolism:** Represents individuals from varied cyber disciplines, backgrounds, and sectors uniting to forge a stronger Scottish cyber security community. The intertwining geometry also pays homage to the two co-founders (Harry McLaren & Stu Hirst) who merged two regional meetups under the CSC banner.
- **Clearspace Rule:** The minimum clear exclusion zone around the logo must equal **half the logo's height** ($\text{Clearspace} = \frac{\text{Height}}{2}$).
- **Minimum Web Size:** Minimum height of $24\text{px}$ for standalone icon, $32\text{px}$ for horizontal logotype with text.

---

## 🎨 Color Palette & CSS Variables

### Primary Palette (Core Brand Identifiers)

| Name | Hex Code | RGB | CMYK | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Deep Purple** | `#21203a` | `rgb(32, 31, 57)` | `95, 89, 44, 56` | Primary background, high-contrast dark surfaces, primary heading text. |
| **Lilac** | `#56548c` | `rgb(85, 86, 133)` | `76, 68, 24, 7` | Primary brand accent, button backgrounds, interactive states, borders. |
| **Pink / Magenta** | `#895294` | `rgb(137, 82, 148)` | `56, 76, 9, 0` | Vibrant highlight, badge fills, active states, callouts. |

### Secondary Supporting Palette (<60% Distribution)

| Name | Hex Code | RGB | Usage |
| :--- | :--- | :--- | :--- |
| **Deep Indigo** | `#382b5c` | `rgb(55, 43, 92)` | Card backgrounds, elevated surfaces on dark mode. |
| **Soft Lavender** | `#bdaccf` | `rgb(189, 172, 207)` | Secondary text on dark backgrounds, subtle pill tags. |
| **Electric Cyan** | `#6fb7e6` | `rgb(113, 183, 230)` | Highlighting technical terms, link hover states, info callouts. |
| **Pure White** | `#ffffff` | `rgb(255, 255, 255)` | Light mode backgrounds, inverse text. |
| **Muted Grey** | `#f4f4f7` | `rgb(244, 244, 247)` | Light mode surface cards and code blocks. |

### Ready-to-Use CSS / Tailwind Tokens

```css
:root {
  /* Primary */
  --csc-deep-purple: #21203a;
  --csc-lilac: #56548c;
  --csc-pink: #895294;

  /* Secondary */
  --csc-indigo: #382b5c;
  --csc-lavender: #bdaccf;
  --csc-cyan: #6fb7e6;
  
  /* Semantic */
  --csc-bg-dark: #21203a;
  --csc-surface-dark: #2a2948;
  --csc-border-dark: #3e3c66;
  --csc-text-primary-dark: #ffffff;
  --csc-text-secondary-dark: #bdaccf;
}
```

---

## 🔤 Typography Guidelines

- **Primary Font Family:** `Roboto`, sans-serif (Weights: Light 300, Regular 400, Bold 700)
- **Secondary / Heading Font:** `Roboto Condensed`, sans-serif (Weights: Regular 400, Bold 700)

### Type Hierarchy
1. **Hero / Marketing Titles:** `Roboto Condensed` Bold, uppercase, letter-spacing `+0.05em`.
2. **Section Headings (H1, H2):** `Roboto Condensed` Bold, sentence case or uppercase.
3. **Subheadings (H3, H4):** `Roboto` Bold, regular letter-spacing.
4. **Body Text:** `Roboto` Regular (16px base, 1.6 line height for comfortable readability).
5. **Captions & Meta Badges:** `Roboto` Regular / Medium (12–14px).

---

## 🖼️ Imagery & Visual Style

- **Photo Treatment:** Clean, desaturated authentic event photography with subtle duotone or purple/lilac gradient overlays. Avoid generic corporate stock photos.
- **Iconography:** Clean, geometric line icons styled in `--csc-lilac` or `--csc-cyan`.
