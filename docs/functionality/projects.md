# Projects

> Keep the household's running list of things to fix, improve or build around the house, from a 15-minute chore to a multi-contractor build, with photos and a checklist of steps for each.

## What You Can Do

- Capture a project with just a title, from a phone or a desktop
- Add a location, notes and up to 10 photos
- Set a status (Planning, Active, Future, Done) and a path (DIY, Hire, Not sure)
- Break a project into a checklist of steps, each with an optional time estimate
- Check off each Active project's next step from the dashboard
- Browse, filter and swipe through projects and their photos
- Edit anything in place, and delete photos or whole projects

## How It Works

### What a Project Is

Each project has a title, an optional location (free text, such as "Master bathroom", with suggestions from locations the household has already used), a status, a path, optional notes, up to 10 photos, and a checklist of steps. The list is shared by the whole household: there is no owner or assignee, and any member can create, edit and delete any project.

### Status and Path

Every project has one of four fixed statuses: Planning, Active, Future or Done. A newly captured project always starts in Planning. Moving a project to Done records when that happened; moving it away from Done clears that record.

Path says whether the household plans to do the project themselves or hire it out: DIY, Hire, or Not sure. A new project has no path set. A project without a path shows a "Needs details" marker on its card in the list, so it is easy to find the projects that still need that decision.

### Capturing a Project

A new project only requires a title. Location, multi-line notes and photos are all optional, so a thought captured away from home still saves.

Photos are added from a phone's camera or photo library, or a desktop file picker, and start uploading the moment they are picked rather than waiting for Save. The first photo picked creates the project immediately, using whatever title has been typed so far, or "Untitled project" if the title is still blank; the current location and notes are saved with it too. Title, location and notes stay editable while photos upload in the background, so typing can continue after the camera closes.

Each photo is shrunk before it is uploaded, so uploads over a cellular connection stay small and fast. A large copy and a thumbnail are both kept (not the untouched original), and photos upload one at a time, in order. Each photo shows its own state (ready, uploading, uploaded, failed), and a photo that has not been sent yet can be removed. The 10-photo cap counts uploaded, uploading, waiting and failed photos together.

**Save** needs a title; with a blank one it says so and does nothing, even if a photo has already created an "Untitled project". Otherwise it writes the current title, location and notes to the project (creating it first if no photo has been picked yet), waits for the picked photos to finish, and opens the project page if they all uploaded. If a photo failed, including because the project itself could not be created yet (for example, with no signal), the project is still saved, the project page is not shown, and a **Retry** button appears on that photo. Tapping it, or tapping Save again, tries again. A link also lets you move on to the project page without the failed photos.

Leaving or reloading the new-project form after a photo was picked but before Save leaves the project behind, titled "Untitled project" if no title was typed, with whatever photos had already uploaded. This is expected: the project can be found and finished from the list later.

### The Projects List

The list shows Active and Planning projects by default, ordered by status (Active, Planning, Future, Done) and newest first within each. A "Show future and done" toggle adds the other two statuses, and a path filter narrows the list to DIY, Hire, Not sure, or Needs details.

Each card shows the cover thumbnail (the first photo added, or a placeholder if there are none), the title, location, a status badge, a path badge or the "Needs details" marker, and a photo count when there is more than one photo. A card with more than one photo is swipeable: swiping left and right moves between photos, with small dots showing which one is in view. Tapping anywhere on the card opens the project.

When there are no projects, the list shows a short line and the New project button. When a filter leaves nothing to show, it says no projects match.

### The Project Page

The project page shows every photo in order. Title, location, status, path and notes are all editable in place, each saving when you leave the field or pick a value. The title cannot be blank. Photos can be added the same way as on the new-project form, up to the cap, and removed one at a time with a confirmation.

Tapping a photo opens it full size, showing the whole photo scaled to fit the screen rather than cropped. When a project has more than one photo, swiping (or, on larger screens, the previous and next arrows or the Left and Right arrow keys) moves between them, and a counter such as "2 / 5" shows the position. Close it with the close button, the Escape key, or by tapping the dark area outside the photo; tapping the photo itself, or swiping, never closes it.

### Steps

A project can have a checklist of steps, shown on the project page between the details and the photos. A step is a line of text (up to 200 characters) with a checkbox and an optional time estimate in whole minutes. Steps stay in the order they were added, and a new step goes to the bottom. A project can hold at most 100 steps. Steps can be added and edited whatever the project's status.

Type into **Add a step** and press Enter or tap Add; the cursor stays in the box so several steps can be entered in a row. The estimate is added afterward by editing the step. Tapping a step's text opens it for editing: the text and the estimate each save when the field is left or Enter is pressed, clearing the estimate removes it, and **Remove** deletes the step for good after a confirmation. Checked-off steps stay where they are, greyed and struck through, and unchecking one brings it back.

Checking off the last undone step asks whether to mark the project Done, with **Mark Done** and **Not yet**. Not yet changes nothing. The question is not asked when the project is already Done, or when a step is unchecked, edited or removed.

### Next Steps on the Dashboard

The dashboard shows a **Project next steps** section under the stat cards, with one row for each Active project: its next undone step (the first one not checked off), the project's title beneath it, and the estimate when there is one. Only Active projects appear, newest first. Tapping the text opens the project; ticking the box checks the step off and the row moves on to that project's next step.

An Active project with no steps, or with every step done, appears as itself, labelled "No steps yet" or "All steps done". Ticking that row, or ticking a project's last step, asks whether to mark the project Done; choosing Mark Done takes it off the list. When the household has projects but none is Active, the section says so and links to Projects. When the household has no projects, the section is not shown. If the steps cannot be loaded, the section says so and offers to try again.

### Privacy and Deleting

Photos are private: only a signed-in member of the owning household can load one. A photo link opened by anyone else, or in a browser that is not signed in, returns an error, not the image.

Deleting a project hides it everywhere but keeps the record and its photos; nothing can load them afterward. Deleting a single photo removes it for good.

## Connections

- **[Task Management](./task-management.md)**: project next steps sit on the dashboard alongside the task stat cards and Coming Up feed. Projects and tasks are otherwise separate; a step is not a task.
- **[Household Management](./household-management.md)**: the list belongs to the household, and membership is what grants access to projects and their photos.
- **[Providers](./providers.md)**: not connected yet; linking providers to a project is planned.

## Where It Appears

- **Projects page**: the list, reached from the main navigation beside Providers on desktop and mobile
- **New project form**: capture with photos
- **Project page**: details, steps, photos and the full-size viewer
- **Dashboard**: the Project next steps section

## Current Limitations

- At most 10 photos and 100 steps per project.
- Steps cannot be reordered.
- No step count on project cards, and no total of the time remaining.
- No assignees, due dates or reminders on steps or projects.
- Statuses are fixed and cannot be customized.
- The date a project was marked Done is recorded but not shown anywhere.
- Providers cannot be linked to a project, and there is nowhere to record quotes.
- No AI help yet: suggested next steps, time estimates, or routing a problem to a category.
