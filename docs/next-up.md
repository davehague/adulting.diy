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

Capture with photos (slice 1) and steps with next steps on the dashboard (slice 2) are live. See [functionality/projects.md](functionality/projects.md).

- Slice 3: link providers to a project, each link with a status (considering, contacted, chosen, passed), then quotes recorded as numbers. Not designed yet
- Slice 4: AI help. Suggested next steps and time estimates, and "describe your problem" routing to a provider category with a reason for each shortlisted provider. Ranking stays deterministic; the AI explains and routes and never picks the contractor. Regenerating steps must keep existing ones, and planning must not run inside a single web request
- A clean-up job for the stored photos of long-deleted projects

## Projects - Deferred

- Reordering steps
- A step count on project cards and a total of the time remaining
- Assignees, due dates and reminders on steps
- Showing the date a project was marked Done
- Keeping typing in an open step when another step's save finishes at the same moment
- Reserving space for the dashboard's Project next steps section so the page does not shift as it loads
- An automated test for the shared API helper's error path (new-account sign-up depends on it)
