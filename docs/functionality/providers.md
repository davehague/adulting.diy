# Providers

Providers are the contractors and service providers a household keeps track of: plumbers, electricians, landscapers, and so on. The Providers page (`/providers`) is a shared, household-wide directory with private ratings and notes, neighbor recommendations, and links to tasks.

## What a Provider Is

Each provider has a name, a category, and a status, plus optional company, primary contact name, phone, email, website, address, license number, and Google Place ID. Providers can also have several extra contacts (name, role, phone, email) for people like an office manager or a crew lead.

Providers are soft-deleted: removing one hides it everywhere but keeps the record, so a neighbor sighting loaded later does not bring it back.

## Private Fields

Every household member sees the same providers. These fields are the household's own record of the relationship:
- **Rating** - 1 to 5
- **Hired date** - when the provider was first hired
- **Notes** - free text

They are never touched by automated loaders.

## Categories and Statuses

Both are configured per household by admins in **Household > Provider settings** (`/household/providers-settings`).
- **Categories** are free-form (Plumber, HVAC, and so on) and can be added, renamed, reordered, and deleted. Deleting a category that providers use requires choosing another category to move them to.
- **Statuses** have a name, a kind (neutral, positive, negative) that drives the badge color, and a "hidden by default" flag. The first time a household opens Providers it gets the defaults: Lead (hidden by default), Recommended, Hired, Passed, Avoid. Deleting an in-use status also requires moving its providers.

Non-admin members can use categories and statuses but not change them.

## Neighbor Evidence

An automated watcher can scan neighborhood sources and load providers that neighbors mention (see [Provider Ingest](../tech/provider-ingest.md)). Each sighting is stored as evidence with a source link, source group, date, snippet, and kind (neighbor recommendation, self-promotion, or lead).

The list and detail pages show this as a badge such as "recommended by 3 neighbors". Only neighbor recommendations count toward the neighbor number; self-promotion and leads count toward total mentions only. The detail page lists every sighting with its link so you can read the original post.

## Finding Providers

The list page supports search, filtering by category and status, and sorting by name, mentions, last sighting, or rating. Providers whose status is hidden by default (Lead out of the box) are hidden until you toggle "include hidden".

## Comments

Either household member can add comments on a provider ("Came out Tuesday, quote was fair"). Only the author can edit or delete their own comment.

## Contacts

Extra contacts are added, edited, and removed from the provider detail page.

## Linking Providers to Tasks

A task can have many providers and a provider can be linked to many tasks. On the task detail page, use the provider section to link or unlink providers. The provider detail page shows which tasks it is linked to.

## Related

- [Task Management](task-management.md)
- [Household Management](household-management.md)
- [Provider Ingest (developer)](../tech/provider-ingest.md)
