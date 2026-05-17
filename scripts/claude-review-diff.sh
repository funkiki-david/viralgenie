#!/usr/bin/env bash
set -euo pipefail

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code CLI is not installed or not available in PATH."
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Not inside a git repository."
  exit 1
fi

echo "Running Claude Code review on current git diff..."

git diff --stat
git diff | claude -p "Review this git diff. Focus on schema consistency, migration safety, API contract mismatch, authentication, permissions, Railway deployment risk, and regression risk. Return only concrete issues, suggested fixes, affected files, and verification commands."
