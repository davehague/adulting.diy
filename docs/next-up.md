## Future Enhancements (Post-MVP)

- File attachments for tasks
- Rich text support in descriptions
- Granular permissions within households
- Enhanced dashboard with widgets
- Calendar view
- Task dependencies
- Mobile app with push notifications

## Providers - Deferred

- Quotes and engagements per provider (what was quoted, what was done, cost)
- File attachments on providers (quotes, invoices, photos)
- Cross-household neighborhood pool so households can share recommendations
- Google Places lookup to fill in contact details and Place IDs
- Ledger diffing in the watcher so only new sightings are sent

## Projects - Planned

Capture with photos (slice 1), steps with next steps on the dashboard (slice 2), and providers linked to a project with a status through the Find a provider window (slice 3a) are live. See [functionality/projects.md](functionality/projects.md).

- Slice 4, next: AI help, in two parts. First, provider suggestions inside the Find a provider window: "describe your problem" routing to a provider category, with a reason for each shortlisted provider. Second, suggested next steps and time estimates on a project. Ranking stays deterministic; the AI explains and routes and never picks the contractor. Regenerating steps must keep existing ones, and planning must not run inside a single web request. Not designed yet; the handoff is [superpowers/specs/2026-10-05-projects-slice-4-brief.md](superpowers/specs/2026-10-05-projects-slice-4-brief.md)
- Slice 3b, on hold until the first real quote arrives: quotes recorded as numbers on a project's provider link. Not designed yet; open questions are one quote per link or several over time, and whether a quote has a date, a note and what it covers
- A clean-up job for the stored photos of long-deleted projects

## Projects - Deferred

- Reordering steps
- A step count on project cards and a total of the time remaining
- Assignees, due dates and reminders on steps
- Showing the date a project was marked Done
- Keeping typing in an open step when another step's save finishes at the same moment
- Reserving space for the dashboard's Project next steps section so the page does not shift as it loads
- An automated test for the shared API helper's error path (new-account sign-up depends on it)
- Notes or a date on a linked provider; a step that points at a provider
- Find a provider: a category that fails to save from the window shows its error only after the window is closed; on a long details view the Back control scrolls out of sight; phone browsers zoom in when a small text field is focused (app-wide)
- Provider links: when two saves overlap, the reply that arrives last wins, so the list can briefly show an older state until the page reloads (steps have the same gap)
- Provider links: a Remove that fails because someone else already removed the provider leaves the row until reload; two simultaneous adds could pass the cap of 25
- Tap-to-call: a phone field holding two numbers, or a label before the number, gets no usable call link
- Loading a project to check it exists also loads its provider links; trim when it matters
