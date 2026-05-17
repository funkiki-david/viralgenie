# Project Agent Instructions

This project uses Codex Desktop / Codex CLI as the primary coding environment.
The user is not using Cursor.

Supported workflows:

## Mode A: Local Dual-Agent Mode
Codex implements locally, then calls Claude Code CLI to review the current git diff.

## Mode B: GitHub PR Review Mode
Codex implements on a branch and prepares a GitHub PR. Claude Code reviews through GitHub PR / Issue / Actions.

Default behavior:
- Use Mode A for normal implementation.
- Use Mode B for database schema, migration, auth, permission, payment, deployment, or large refactor changes.

Before editing:
- Check git status.
- Create a new branch.
- Inspect package scripts and existing conventions.
- Do not overwrite user changes.
- Do not delete files unless explicitly approved.

Verification:
Run available commands when present:
- npm run lint
- npm run typecheck
- npm run build
- npm test

If a command does not exist, report that clearly.

Deployment:
- Do not push, merge, deploy, or run production migrations without explicit human approval.
- Railway deployment should only happen through the approved GitHub workflow unless I explicitly instruct otherwise.

Final response after work:
- Summarize files changed.
- Summarize commands run.
- Summarize Claude Code review result, if Mode A or Mode B used.
- Summarize remaining risks.
- Ask for approval before push / merge / deploy.
