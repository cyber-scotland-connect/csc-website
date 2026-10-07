#!/bin/zsh -l
# CSC Event Discovery — Weekly cron runner
# Fires every Monday 08:00, logs to logs/event-discovery.log (gitignored)
# Crontab entry: 0 8 * * 1 /Users/harrymclaren/Projects/csc-website/scripts/run-event-discovery.sh

set -euo pipefail

# Ensure full user environment and PATH under non-interactive cron
export HOME="/Users/harrymclaren"
export USER="harrymclaren"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:$HOME/Projects/LifeOS/local-bun/bin:$HOME/.antigravity/antigravity/bin:$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"

if [ -f "$HOME/.zprofile" ]; then
  source "$HOME/.zprofile" 2>/dev/null || true
fi
if [ -f "$HOME/.zshrc" ]; then
  source "$HOME/.zshrc" 2>/dev/null || true
fi

REPO_DIR="/Users/harrymclaren/Projects/csc-website"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/event-discovery.log"
BUN_BIN="$HOME/Projects/LifeOS/local-bun/bin/bun"
GH_BIN="/opt/homebrew/bin/gh"
OSASCRIPT_BIN="/usr/bin/osascript"

# Fallbacks if binaries are not at standard paths
if [ ! -x "$BUN_BIN" ]; then
  BUN_BIN="$(which bun 2>/dev/null || echo 'bun')"
fi
if [ ! -x "$GH_BIN" ]; then
  GH_BIN="$(which gh 2>/dev/null || echo 'gh')"
fi
if [ ! -x "$OSASCRIPT_BIN" ]; then
  OSASCRIPT_BIN="$(which osascript 2>/dev/null || echo 'osascript')"
fi

mkdir -p "$LOG_DIR"

echo "========================================" >> "$LOG_FILE"
echo "Run started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

cd "$REPO_DIR"

# 1. Deterministic Fast Feed Discovery (RSS, iCal, Bluesky)
echo "Executing deterministic feed discovery..." >> "$LOG_FILE"
"$BUN_BIN" run discover >> "$LOG_FILE" 2>&1 || true

# 2. Check for new event files
NEW_FILES=$(git status --porcelain src/content/events/ 2>/dev/null || true)

if [ -n "$NEW_FILES" ]; then
  echo "New events found on disk:" >> "$LOG_FILE"
  echo "$NEW_FILES" >> "$LOG_FILE"
  
  echo "Verifying site build & lint..." >> "$LOG_FILE"
  if "$BUN_BIN" run build >> "$LOG_FILE" 2>&1 && "$BUN_BIN" run lint >> "$LOG_FILE" 2>&1; then
    echo "Verification passed (build & lint clean)." >> "$LOG_FILE"
    
    BRANCH="auto/events-$(date '+%Y-%m-%d')"
    echo "Creating branch: $BRANCH" >> "$LOG_FILE"
    git checkout -b "$BRANCH" >> "$LOG_FILE" 2>&1 || git checkout "$BRANCH" >> "$LOG_FILE" 2>&1
    git add src/content/events/ >> "$LOG_FILE" 2>&1
    git commit -m "feat(events): auto-discovered Scottish cyber events ($(date '+%Y-%m-%d'))" >> "$LOG_FILE" 2>&1
    
    if git push -u origin "$BRANCH" >> "$LOG_FILE" 2>&1; then
      echo "Pushed branch $BRANCH to origin." >> "$LOG_FILE"
      
      echo "Creating Pull Request via GitHub CLI..." >> "$LOG_FILE"
      PR_URL=$("$GH_BIN" pr create \
        --base main \
        --head "$BRANCH" \
        --title "feat(events): auto-discovered Scottish cyber events ($(date '+%Y-%m-%d'))" \
        --body "### 🤖 Auto-Discovered Events ($(date '+%Y-%m-%d'))

The CSC Event Discovery Engine identified and staged new community events:

\`\`\`
$NEW_FILES
\`\`\`

- ✅ Astro site build & schema validation verified clean
- ✅ ESLint passed with 0 errors" 2>&1 || true)
      
      echo "PR status: $PR_URL" >> "$LOG_FILE"
      
      # macOS User Notification
      "$OSASCRIPT_BIN" -e "display notification \"New events discovered! PR created: $BRANCH\" with title \"CSC Event Discovery\" sound name \"Glass\"" 2>/dev/null || true
    else
      echo "Failed to push branch $BRANCH to origin (check network/credentials)." >> "$LOG_FILE"
      "$OSASCRIPT_BIN" -e "display notification \"Event discovery found new events, but git push failed.\" with title \"CSC Event Discovery\" sound name \"Basso\"" 2>/dev/null || true
    fi
    git checkout main >> "$LOG_FILE" 2>&1
  else
    echo "Build or lint failed! Reverting unverified files for safety." >> "$LOG_FILE"
    git checkout -- src/content/events/ >> "$LOG_FILE" 2>&1 || true
    git clean -fd src/content/events/ >> "$LOG_FILE" 2>&1 || true
  fi
else
  echo "No new events discovered from feeds." >> "$LOG_FILE"
fi

echo "----------------------------------------" >> "$LOG_FILE"
echo "Run finished: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit 0
