# Claude Code Review Instructions

Claude Code is the secondary reviewer, not the primary implementation agent.

Review priorities:
1. Database schema consistency
2. Migration safety
3. API contract mismatch
4. Authentication and role-based permissions
5. Data loss risk
6. Railway / production deployment risk
7. Regression risk
8. Missing tests or broken build assumptions
9. Unexpected changes outside the requested scope

Output format:
- Critical issues
- Suggested fixes
- Files affected
- Commands to verify
- Remaining risks

Rules:
- Do not rewrite unrelated code.
- Do not make broad refactors unless requested.
- Focus on concrete, actionable review findings.
- Prefer minimal patches that preserve existing behavior.
