#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/Users/harrymclaren/Projects/LifeOS/local-bun/bin:$PATH"

exec /Users/harrymclaren/Projects/LifeOS/bin/lifeos-loop \
  --max-retries 1 \
  --timeout 120000 \
  --emit-evidence /Users/harrymclaren/.gemini/config/plugins/lifeos-plugin/LIFEOS/MEMORY/STATE/assay-csc-website.json \
  --check "tests:bun test" \
  --check "astro-check:bun run check" \
  --check "lint:bun run lint"
