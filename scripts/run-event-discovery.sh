#!/usr/bin/env bash
# CSC Event Discovery — Weekly cron runner
# Fires every Monday 08:00, logs to logs/event-discovery.log (gitignored)
# Crontab entry: 0 8 * * 1 /Users/harrymclaren/Projects/csc-website/scripts/run-event-discovery.sh

set -euo pipefail

REPO_DIR="/Users/harrymclaren/Projects/csc-website"
LOG_DIR="$REPO_DIR/logs"
LOG_FILE="$LOG_DIR/event-discovery.log"
AGY="/Users/harrymclaren/.local/bin/agy"
PROMPT_FILE="$REPO_DIR/scripts/FIND_EVENTS_AGENT.md"

mkdir -p "$LOG_DIR"

echo "========================================" >> "$LOG_FILE"
echo "Run started: $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
echo "========================================" >> "$LOG_FILE"

# Read the agent prompt from the versioned file
PROMPT=$(cat "$PROMPT_FILE")

# Run agy in print (non-interactive) mode and append output to log
"$AGY" --print "$PROMPT" >> "$LOG_FILE" 2>&1
EXIT_CODE=$?

echo "----------------------------------------" >> "$LOG_FILE"
echo "Run finished: $(date '+%Y-%m-%d %H:%M:%S') | Exit: $EXIT_CODE" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

exit $EXIT_CODE
