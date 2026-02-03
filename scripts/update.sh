#!/usr/bin/env bash
set -euo pipefail
# Update script: pull latest from origin and rebuild locally
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Fetching latest from origin..."
git fetch origin

echo "Merging origin/main into current branch (fast-forward when possible)..."
if ! git merge --ff-only origin/main; then
  echo "Fast-forward merge not possible; attempting standard merge..."
  git merge origin/main || {
    echo "Merge failed. Resolve conflicts manually.";
    exit 1;
  }
fi

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

 echo "Update complete."
