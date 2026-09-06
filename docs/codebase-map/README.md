# Codebase Map

Project Chronos is the Skanida web administration portal: a Next.js App Router application with Logto session/role checks, tRPC routers, and Astra-facing proxy/client behavior.

| Area | Read |
| --- | --- |
| Access control and composition | [Architecture overview](architecture/overview.md) |
| Administration routers and pages | [Modules](modules.md) |
| Configuration mapping and exports | [Modules](modules.md) |
| Login, password change, and role admission | [Access and authentication](flows/access-and-authentication.md) |
| Attendance, paging, and export | [Attendance and export](flows/attendance-and-export.md) |
| Leave lifecycle | [Leave management](flows/leave-management.md) |
| Rules | [Invariants](invariants.md) |

## Current audit boundary

The map records implemented structure and explicit risks, not desired-state claims. The Chronos–Astra contract, profiles/student information architecture, and attendance taxonomy remain settlement decision gates; see the decision index.
