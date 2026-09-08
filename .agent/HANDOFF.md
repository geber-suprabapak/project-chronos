# Current Objective

Complete Ticket 07 Monthly Attendance Recap in Chronos with only minimal
published contract additions for existing Astra routes if required.

# Completed

- Read repository, applicable AGENTS, RTK, TDD/continuity guidance, CONTEXT,
  ADR-0013, issue/spec, testing/domain docs, and codebase map.
- Created isolated Chronos worktree `/home/robin/worktrees/ticket-07/chronos`
  on branch `codex/ticket-07-monthly-recap` from integrated HEAD
  `672ff6f121d11df45ea6c3de3c1b8939b8b658e1`.
- Confirmed integrated Astra HEAD `37623cc30bfd2a07d493bb75783e766cd65e7c71`
  already implements enrollment and calendar-exception GET routes, while the
  published contract snapshot omits those routes.

# In Progress

Monthly aggregation and source boundary are not yet implemented.

# Exact Next Action

Implement one red→green pure aggregation slice covering scheduled dates,
leave/attendance precedence, cutoff, and totals.

# Important Decisions

- Keep aggregation pure and expose one dataset for UI and future export.
- Use complete attendance collection plus complete/validated list sources;
  never call a capped result complete.
- Use effective enrollment timelines and approved leave periods only.

# Changed Files

Only continuity files so far.

# Validation

No Ticket 07 implementation checks run yet.

# Known Issues / Blockers

Chronos contract snapshot currently omits existing GET `/enrollments` and
`/calendar-exceptions` routes; decide whether minimal publication is needed
after implementing the collector.

# Git State

Branch `codex/ticket-07-monthly-recap`; worktree clean before implementation.
