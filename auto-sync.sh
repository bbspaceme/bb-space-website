#!/usr/bin/env bash

# Auto-sync script for bb-space-website
# Automatically stages, commits, and pushes the current HEAD to GitHub main.

set -Eeuo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
cd "$REPO_ROOT"

REMOTE_NAME="${AUTO_SYNC_REMOTE_NAME:-origin}"
REMOTE_URL="${AUTO_SYNC_REMOTE_URL:-https://github.com/bbspaceme/bb-space-website.git}"
CURRENT_BRANCH="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || echo detached)"
SOURCE_REF="${AUTO_SYNC_SOURCE_REF:-HEAD}"
TARGET_BRANCH="${AUTO_SYNC_TARGET_BRANCH:-main}"
ALLOW_PUSH_FAILURE="${AUTO_SYNC_ALLOW_PUSH_FAILURE:-false}"

export GIT_TERMINAL_PROMPT=0

echo "🔄 Starting auto-sync process..."
echo "📁 Repository: $REPO_ROOT"
echo "🌿 Current branch: $CURRENT_BRANCH"
echo "🎯 Target: $REMOTE_NAME/$TARGET_BRANCH"

if ! git remote get-url "$REMOTE_NAME" >/dev/null 2>&1; then
  echo "🔗 Remote '$REMOTE_NAME' is missing; configuring $REMOTE_URL"
  git remote add "$REMOTE_NAME" "$REMOTE_URL"
fi

# Check if there are any tracked, staged, or untracked changes before staging.
UNTRACKED_FILES="$(git ls-files --others --exclude-standard)"
if git diff --quiet && git diff --staged --quiet && [ -z "$UNTRACKED_FILES" ]; then
  echo "✅ No changes to sync"
else
  echo "📁 Adding changes..."
  git add .
fi

# Commit only when staged changes exist.
if git diff --staged --quiet; then
  echo "✅ No staged changes to commit"
else
  TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
  CHANGES="$(git diff --staged --name-only | wc -l | tr -d ' ')"
  CHANGED_FILES="$(git diff --staged --name-only | head -5 | paste -sd ', ' -)"

  if [ "$CHANGES" -eq 1 ]; then
    COMMIT_MSG="auto-sync: $CHANGES file changed - $CHANGED_FILES"
  else
    COMMIT_MSG="auto-sync: $CHANGES files changed"
  fi
  COMMIT_MSG="$COMMIT_MSG ($TIMESTAMP)"

  echo "💾 Committing changes..."
  AUTO_SYNC_IN_PROGRESS=1 git commit -m "$COMMIT_MSG"
fi

# Push the selected source ref to GitHub main by default. This matches Vercel's
# production deployment trigger while still allowing overrides for staging/hotfixes:
#   AUTO_SYNC_TARGET_BRANCH=staging ./auto-sync.sh
#   AUTO_SYNC_SOURCE_REF=my-branch ./auto-sync.sh
echo "🚀 Pushing '$SOURCE_REF' to GitHub '$REMOTE_NAME/$TARGET_BRANCH'..."
if git push "$REMOTE_NAME" "$SOURCE_REF:$TARGET_BRANCH"; then
  echo "✅ Sync completed successfully!"
  echo "🔗 Commit: $(git rev-parse --short HEAD)"
else
  echo "❌ Push failed. Check network/proxy credentials or set AUTO_SYNC_REMOTE_URL with a writable remote."
  if [ "$ALLOW_PUSH_FAILURE" = "true" ]; then
    echo "⚠️ AUTO_SYNC_ALLOW_PUSH_FAILURE=true, so local auto-sync will not fail the caller."
    exit 0
  fi
  exit 1
fi
