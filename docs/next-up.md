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

Capture with photos (slice 1), steps with next steps on the dashboard (slice 2), providers linked to a project with a status through the Find a provider window (slice 3a), and AI provider suggestions inside that window for selected households (slice 4a, [design](superpowers/specs/2026-10-05-projects-ai-provider-suggestions-design.md)) are built. See [functionality/projects.md](functionality/projects.md).

- Slice 4b: suggested next steps and time estimates on a project. Regenerating steps must keep existing ones, and planning must not run inside a single web request, so it needs a background-job mechanism first; it can read the trades saved with a project's provider suggestions. Not designed yet
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
- Provider suggestions, behaviour: two members asking at the same moment can pass the daily cap by one; an ask that fails while the window is closed leaves no error on reopen; the first read of saved suggestions has no time limit, and the provider list waits for it; a provider filed under another category is never considered; bare web addresses and unusual phone formats inside free text are not masked; names inside posts are sent as written
- Provider suggestions, robustness: one empty or overlong reason rejects the whole reply (validate picks one at a time); a reply with braces in surrounding prose can fail to parse; the prompts do not tell the model that the project and provider text is data, not instructions (changing a prompt needs a fresh try-out); a search phrase ending "near me." gets a second "near me"
- Provider suggestions, screen: long category names and unbroken words can overflow on a narrow phone; "See all" can scroll short or move the page behind on iOS; Back from details restores the wrong position if the panel grew meanwhile; the waiting and error lines may not be announced by screen readers; in the failed state the date line sits apart from its parts; the suggested row markup and the status badge colors are duplicated
- Provider suggestions, cost and scale: sending photos; turning it on for other households with their agreement; a household search-area setting if "near me" proves wrong; recency rules in the ranking; comments are fetched without a limit before the ten newest are kept
- Provider suggestions, tests: the tier test and the top-five fallback test are weaker than they look; route tests lack a 500 case, a null body and the 500-character boundary; fixtures lack address, website and license fields; the component checks live only in a throwaway harness, not in the repo
- The 60-second request limit added for suggestions applies to every server route, including the two daily jobs
- The test suite prints a sign-in plugin warning on every run
