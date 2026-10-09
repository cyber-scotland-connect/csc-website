# Slides Archive

This directory stores slide decks and presentation PDFs shared by speakers at Cyber Scotland Connect gatherings.

## Recommended Organization

Organize files by year:
`/public/slides/{year}/{YYYY-MM-DD}-{speaker-slug}-{talk-slug}.pdf`

Example:
`/public/slides/2026/2026-10-08-ash-hunt-refactoring-the-enterprise.pdf`

## Compression & Size Guidelines

- Aim for files under **15 MB**.
- If a speaker exports a raw keynote or deck with uncompressed media, run it through PDF compression (e.g. macOS Preview "Reduce File Size" or Ghostscript) before committing to keep repository clone times fast.
- Link the file in the event markdown via `slidesUrl: "/slides/2026/2026-10-08-ash-hunt-refactoring-the-enterprise.pdf"` either at the event level or directly under the individual speaker entry.
