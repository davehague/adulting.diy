# Projects

Projects are the household's running list of things to fix, improve or build around the house, from a 15-minute chore to a multi-contractor build. The Projects page (`/projects`) is a shared, household-wide list: both household members can create, edit and delete any project.

## What a Project Is

Each project has a title, an optional location (free text, e.g. "Master bathroom"), a status, a path, optional notes, and up to 10 photos. There is no owner or assignee field; anyone in the household can change anything.

## Status

Every project has one of four fixed statuses: Planning, Active, Future, Done. Statuses are not configurable per household. A newly captured project always starts in Planning. Moving a project to Done records when that happened; moving it away from Done clears that record.

## Path

Path says whether the household plans to do a project themselves or hire it out: DIY, Hire, or Not sure. A new project has no path set. A project without a path shows a "Needs details" marker on its card and in the path filter, so it is easy to find the projects that still need that decision.

## Capturing a Project

**New project** (`/projects/new`) only requires a title. Location is optional, and so are photos, so a thought captured away from home still saves.

Photos are added from a phone's camera or photo library (or a desktop file picker). Each photo is shrunk in the browser before it is uploaded, so cellular uploads stay small and fast; a full-size copy and a thumbnail are both kept. Saving creates the project first, then uploads any chosen photos one at a time while the form stays on screen. Each photo shows its own state (ready, uploading, uploaded, failed). If a photo fails, the project is still saved; a **Retry** button appears on that photo, and a link lets you move on to the project page without it. Leaving or reloading the new-project page drops any photo that has not finished uploading; it can be added again from the project page.

## The Projects List

The list shows Active and Planning projects by default. A "Show future and done" toggle adds the other two statuses. A path filter narrows the list to DIY, Hire, Not sure, or Needs details (no path set).

Each card shows the cover thumbnail (the first photo added, or a placeholder if there are none yet), title, location, a status badge, a path badge or the "Needs details" marker, and a photo count when there is more than one photo.

The empty state shows a short line and the New project button.

A **Projects** link sits beside Providers in the main navigation, in both the desktop and mobile menu.

## The Project Page

The project page (`/projects/:id`) shows every photo in order; tapping one opens it full size. Title, location, status, path and notes are all editable in place, saving as soon as a field is changed. Photos can be added here the same way as on the new-project form, up to the 10-photo cap, and removed one at a time with a confirmation.

## Photo Limits and Privacy

A project can hold at most 10 photos. Photos are private: only a signed-in member of the owning household can load one. A photo URL opened without the right household's credentials (for example, in a private browser window) returns an error, not the image.

## Deleting

Deleting a project hides it everywhere but keeps the record and its photos; nothing can load them afterward because every route excludes deleted projects. Deleting a single photo removes it for good, along with its stored files.

## Not Yet

These are designed for later slices and are not part of this one:
- Steps on a project (a checklist with an order and an optional time estimate).
- A cross-project next-step list showing what to do next on each active project.
- Linking providers to a project, with an engagement status and quotes.
- AI help: suggested next steps, time estimates, or problem-to-category routing.

## Related

- [Providers](providers.md)
- [Household Management](household-management.md)
