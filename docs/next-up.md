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

Capture with photos (slice 1), steps with next steps on the dashboard (slice 2), providers linked to a project with a status through the Find a provider window (slice 3a), AI provider suggestions inside that window (slice 4a, [design](superpowers/specs/2026-10-05-projects-ai-provider-suggestions-design.md)), the AI DIY plan on a project (slice 4b, [design](superpowers/specs/2026-10-06-projects-ai-diy-plan-design.md)) and the project chat (slice 5, [design](superpowers/specs/2026-10-08-projects-ai-chat-design.md)), all for selected households, are built. See [functionality/projects.md](functionality/projects.md).

- Project chat, next levels: streaming replies with a live "searching…" line; photos in the chat (needs a vision model such as glm-5.3-flash); the chat adding or ticking steps with confirmation; a "Start over" or archiving old turns; reading whole pages (`web_fetch`) with a loop cap; a per-message "think harder"; a household-wide chat across projects; voice input; notifying the other member when a reply lands; a chat cap if the ask log ever shows runaway use; bringing the reviewer's page harness into the repo as the first component tests
- DIY plan, next levels: a skill-level selector (beginner / handy / pro); cost on checklist steps with a total on the dashboard (schema change); photos as input (own privacy decision, slower call); a background-job mechanism if the ask log shows plans running past about 35 seconds; a merge on Plan again that keeps edits; product or video links only with a source the model cannot invent from; a separate model setting for plans if they want a different model
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
- DIY plan, behaviour: two members planning at once can pass the daily cap by one; adding steps is not transactional, so two simultaneous Add alls could pass 100 steps (same as adding one step); an ask picked up on return that then fails hides the saved plan until reload; the "Added n steps" note can go stale after a later checklist change; an Add error shows above the card, far from a step low in the list
- DIY plan, robustness: a reply with numbers as strings ("30") is rejected and retried; a 200-character cut can split an emoji; the failure log cannot say which validation check failed; a Prisma error from the batch add could log step text through the generic error path (every field is validated first)
- DIY plan, screen: "0 min" shows on pro steps; dollar amounts have no thousands separators; long why, safety, pro-step and tool text lacks break-words on a narrow phone
- Project chat, behaviour: two sends within the same few milliseconds can both get a reply (accepted); a failed ask-log insert leaves the question unmarked until the 75-second window passes; opening the chat during a pending reply fetches it twice; the character counter counts untrimmed text while the limit checks trimmed; Enter during IME composition sends; the whole thread re-renders every second while the page is open, and the thinking row's seconds are announced by screen readers every second
- Project chat, robustness: the 8,000-character cut on a reply can split an emoji; a bare web address ending in "&" loses its ";"; a web address inside parentheses is shown as text, not linked; a list number with 21 or more digits renders oddly; multi-line notes can pose as block structure in the prompt; search results are not named in the prompt's "information, not instructions" line; the shared `toHttpError` logs whole unknown errors (repo-wide); three copies of the POST sequence in the Ollama client
- Project chat, never run before the merge: the real model and search through this code (only the spike did), the assistant tool-call turn sent back without its thinking, any screen in a real browser (320 px, the iOS keyboard, safe-area padding, pointer detection, iOS background fetch failures)
- DIY plan, tests: no test pins that a trade name holding a phone number or link is masked before it is sent; redaction test covers two of six prompt fields; the 2-second call floor and the exact-true tooVague boundary are not pinned; the plan service tests do not assert "no log row on 429", "no cap count on 403", a 404 on run, or "no upsert when the model throws"; the batch-add tests do not assert the final select and order; route tests lack the 500 path, a null body, a non-string extra and a missing id
