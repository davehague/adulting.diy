---
name: update-docs
description: Use after completing feature work to update project documentation. Covers changelog, functionality docs, tech docs, CLAUDE.md, and plan archival.
---

# Update Documentation After Feature Work

Run through these steps after completing any feature, fix, or significant change.

## 1. Update the Changelog

Add an entry to `docs/functionality/changelog.md` under today's date:
- Group changes under a descriptive heading (e.g., "Flexible Reminders")
- Use bullet points describing what changed from a user/product perspective
- Keep entries concise (1 line each)

## 2. Update or Create Functionality Docs

Functionality docs live in `docs/functionality/` and describe features from a **product perspective** (what it does, how users interact with it).

- If the feature modifies an existing area, update the relevant doc
- If the feature is entirely new, create a new doc following the pattern of existing ones
- Cross-link related docs where appropriate
- If, after you've done your research for a feature, you find that  we're missing a doc, go ahead and create it. 

Current functionality docs:
- `notifications-and-reminders.md` - Notification events, reminders, channels, preferences
- `task-management.md` - Task definitions, scheduling, occurrences, lifecycle
- `household-management.md` - Households, roles, categories, invite codes
- `changelog.md` - Chronological record of changes

## 3. Update or Create Tech Docs

Tech docs live in `docs/tech/` and describe **implementation details** for developers (architecture, key files, algorithms, how to extend).

- If the feature changes system internals, update the relevant tech doc
- If a new subsystem was introduced, create a new tech doc
- Include key file paths, data flow diagrams, and extension points
- If, after you've done your research for a feature, you find that we're missing a doc, go ahead and create it.

Current tech docs:
- `notification-system.md` - Provider pattern, event types, reminder flow, preference logic
- `task-scheduling.md` - Cron config, recurrence patterns, generation flow, catch-up
- `testing.md` - Framework, structure, commands, coverage
- `api-endpoints.md` - Full API reference
- `dev-login-bypass.md` - Development authentication bypass guide

## 4. Update CLAUDE.md (Only If Needed)

Only update `CLAUDE.md` if:
- The project structure tree changed (new directories, moved files)
- Development workflow changed (new commands, new tools)
- A new ADR was created
- The tech stack changed

Do NOT update CLAUDE.md for:
- New features (that's what functionality docs are for)
- Implementation details (that's what tech docs are for)
- API changes (that's what api-endpoints.md is for)

## 5. Archive Completed Plans

If the work was guided by a plan in `docs/plans/`:
- Move completed plan files to `docs/plans/completed/` using `git mv`
- Fix any typos in filenames during the move
