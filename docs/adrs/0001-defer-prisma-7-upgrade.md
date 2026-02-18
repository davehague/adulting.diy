# ADR-0001: Defer Prisma 7 Upgrade

**Status:** Accepted
**Date:** 2026-02-18
**Deciders:** Dave Hague

## Context

Prisma CLI reports a major version upgrade available: 5.22.0 to 7.4.0. Prisma 7 removes the Rust query engine entirely, replacing it with JavaScript driver adapters (`@prisma/adapter-pg`). This is a significant architectural change.

## Decision

Defer the upgrade. Revisit in Q3 2026.

## Rationale

### Why not now

1. **CockroachDB + `@prisma/adapter-pg` is immature.** There were compatibility issues as recently as Prisma 7.0.0 (patched in 7.0.1, GitHub issue #25691). The combination hasn't been widely battle-tested yet.

2. **Medium-high effort for zero feature gain.** The upgrade touches ~8+ files, requires a new `prisma.config.ts`, changes all import paths, and rewrites the client singleton to use driver adapters. All of this for plumbing — no user-facing improvement.

3. **SSL and connection pooling changes.** The old Rust engine handled SSL and pooling internally. With driver adapters, these must be configured explicitly via the `pg` driver. On Vercel serverless + CockroachDB Cloud, this needs careful testing.

4. **Current version works fine.** No bugs, no performance issues, no missing features blocking development.

### What we'd gain (eventually)

- ~90% smaller deployment bundle (no Rust binary) — meaningful for Vercel cold starts
- Long-term support — Prisma 5 will eventually lose security patches
- Simpler architecture (pure JS, no binary)

## Upgrade scope (when we do it)

| Area | Changes |
|------|---------|
| `prisma/schema.prisma` | Change provider to `prisma-client`, add `output` field, remove `url` from datasource |
| New file: `prisma.config.ts` | Holds DB URL and migration config |
| `server/utils/prisma/client.ts` | Rewrite to use `PrismaPg` driver adapter with explicit SSL/pool config |
| ~7 other files | Update import paths from `@prisma/client` to generated output path |
| `scripts/*.js` | Each needs driver adapter setup |
| `package.json` | Add `@prisma/adapter-pg`, bump `prisma` and `@prisma/client` to ^7.x |

No database migration is required (CockroachDB is exempt from the v6 m-to-n index change).

## Trigger to revisit

- Prisma 5 end-of-life or security advisory
- CockroachDB + adapter-pg gains wider adoption and stability reports
- Vercel bundle size becomes a deployment blocker
- Q3 2026 routine review

## References

- [Prisma 5 to 6 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-6)
- [Prisma 6 to 7 upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)
- [CockroachDB + adapter-pg issue #25691](https://github.com/prisma/prisma/issues/25691)
- [Prisma 7 release announcement](https://www.prisma.io/blog/announcing-prisma-orm-7-0-0)
