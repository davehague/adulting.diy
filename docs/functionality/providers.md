# Providers

> Keep a shared household directory of contractors and service providers (plumbers, electricians, landscapers and so on) with your own ratings and notes, neighbor recommendations, and links to the tasks they help with.

## What You Can Do

- Add, edit and remove providers, each with a category and a status
- Record a private rating, hired date and notes
- Add extra contacts for a provider, such as an office manager or crew lead
- See which providers neighbors recommend, and read the original posts
- Search, filter and sort the directory
- Comment on a provider
- Link providers to tasks
- As an admin: manage the household's provider categories and statuses, and the access keys that let the automated watcher load providers

## How It Works

### What a Provider Is

Each provider has a name, a category and a status, plus optional company, primary contact name, phone, email, website, address, license number and Google Place ID. A provider can also have several extra contacts, each with a name, role, phone and email.

Every household member sees the same providers. Removing a provider hides it everywhere but keeps the record, so a later neighbor sighting that matches it does not bring it back. (A sighting that does not match, for example one filed under a different category, is loaded as a new provider.)

A provider added without a status gets the first status in the household's order. Out of the box that is Lead, which is hidden by default, so pick a status when adding a provider by hand if you want it to show in the default list.

### Private Fields

These are the household's own record of the relationship, and automated loading never touches them:

- **Rating**: 1 to 5
- **Hired date**: when the provider was first hired
- **Notes**: free text

### Categories and Statuses

Both are set up per household by admins. Other members can use them but not change them.

- **Categories** are free-form (Plumber, HVAC and so on) and can be added, renamed, reordered and deleted. A household starts with none, so an admin has to add at least one before anyone can add a provider by hand. Deleting a category that providers use requires choosing another category to move them to.
- **Statuses** have a name, a kind (neutral, positive or negative) that drives the badge color, and a "hidden by default" flag. The first time a household opens Providers it gets the defaults: Lead (hidden by default), Recommended, Hired, Passed and Avoid. Statuses can be renamed and reordered, and deleting one that is in use also requires moving its providers.

### Neighbor Evidence

An automated watcher can scan neighborhood sources and load the providers that neighbors mention. A provider it has not seen before is added as a Lead; for one it already knows, it adds the sighting and fills in any contact details that were blank. It creates categories and statuses it needs that do not exist yet. Each sighting is kept as evidence with a source link, source group, date, snippet and kind: neighbor recommendation, self-promotion, or lead.

This shows as a badge such as "recommended by 3 neighbors". Only neighbor recommendations count toward the neighbor number; self-promotion and leads count toward total mentions only. The provider page lists every sighting with its link, so you can read the original post.

The watcher gets in with an access key. An admin creates a key, which is shown once and can be revoked at any time.

### Finding Providers

The directory supports search (across name, company, primary contact and notes), filtering by category and status, and sorting by mentions (the default), name, last sighting or rating. Providers whose status is hidden by default (Lead, out of the box) stay hidden until you turn on "Show hidden statuses" or pick that status in the status filter.

### Comments and Contacts

Any household member can comment on a provider ("Came out Tuesday, quote was fair"). Only the author can edit or delete their own comment. Extra contacts are added, edited and removed on the provider page.

### Linking Providers to Tasks

A task can have many providers and a provider can be linked to many tasks. Links are made and removed from the task page, and the provider page shows which tasks it is linked to.

## Connections

- **[Task Management](./task-management.md)**: providers are linked to the tasks they do.
- **[Household Management](./household-management.md)**: the directory belongs to the household, and only admins manage its categories, statuses and access keys.
- **[Projects](./projects.md)**: not connected yet; linking providers to projects is planned.

## Where It Appears

- **Providers page**: the directory, reached from the main navigation
- **Provider page**: details, private fields, contacts, evidence, comments and linked tasks
- **Household > Provider settings**: categories, statuses and access keys (admins)
- **Task page**: the section for linking providers

For how the watcher loads providers, see [Provider Ingest (developer)](../tech/provider-ingest.md).

## Current Limitations

- No record of quotes or engagements (what was quoted, what was done, what it cost).
- No file attachments on providers (quotes, invoices, photos).
- Recommendations are not shared between households.
- Contact details are entered by hand; there is no lookup to fill them in.
- Providers cannot be linked to projects yet.
