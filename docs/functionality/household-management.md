# Household Management

> A household is the shared space where members work together. Create one or join one, manage who is in it and what they can do, and set the timezone and categories everyone shares.

## What You Can Do

- Create a household, or join one with an invite code
- Leave a household
- As an admin: rename the household, set its timezone, remove members, promote or demote admins, and regenerate the invite code

## How It Works

### Creating and Joining

Anyone signed in without a household can create one by giving it a **name**. Its **timezone** is taken from the browser and can be changed later by an admin. The creator becomes an **admin**, and an 8-character **invite code** of letters and numbers (for example, A3BX9K2M) is generated for sharing.

Others join by entering that invite code. New members join as regular members, not admins. A person can belong to only one household at a time.

All data is isolated per household: one household never sees another's tasks, providers or projects.

### Roles

| Capability | Admin | Member |
|-----------|-------|--------|
| View household details and members | Yes | Yes |
| Create and manage tasks | Yes | Yes |
| Complete, skip and comment on occurrences | Yes | Yes |
| Update household settings (name, timezone) | Yes | No |
| Remove members | Yes | No |
| Promote and demote admins | Yes | No |
| Create custom categories | Yes | No |
| Regenerate the invite code | Yes | No |

### Leaving and Former Members

Any member can leave, with one constraint: the **last admin cannot leave** while other members remain. They must first promote someone else or remove the other members.

When someone leaves, or is removed by an admin:

- Their name is kept as a **former member**, as it was at the time they left
- They are removed from the default assignees of every task
- They are removed from pending occurrences due today or later; overdue ones keep them
- Past and completed occurrences are left untouched, for historical accuracy

Former members stay visible wherever they appear in history: assignee lists on past occurrences, occurrence timelines, and comments. Their names are shown dimmed and in italics to set them apart from current members. They do not appear in assignee filters or pickers.

If the person rejoins the same household, they become a normal active member again.

### Timezone

Each household has a timezone (for example, America/New_York), which admins pick from a list of common timezones. It decides what "today" means for reminders, makes sure a reminder is sent at most once per day, and is used when showing dates and times.

### Categories

Tasks are organized by category, in two tiers:

- **Default categories** are shared by every household, always available, and cannot be changed or removed.
- **Custom categories** are private to one household, can only be created by its admins, and must have a name that is unique within the household. There is no screen for creating them yet.

### Invite Codes

Invite codes are 8 characters and case-sensitive. An admin can regenerate the code at any time, and the old code stops working immediately, which is useful if a code has been shared too widely.

## Connections

- **[Task Management](./task-management.md)**: members are the people tasks are assigned to, and categories organize tasks.
- **[Notifications and Reminders](./notifications-and-reminders.md)**: notifications go to household members, timed by the household's timezone.
- **[Providers](./providers.md)**: the provider directory is shared by the household, and admins manage its categories, statuses and access keys.
- **[Projects](./projects.md)**: the project list is shared by the household, and any member can change any project.

## Where It Appears

- **Household setup**: shown after first sign-in, to create or join a household
- **Household page**: details, members, invite code and settings
- **Profile page**: leaving the household
- **Throughout the app**: member names in assignee pickers and filters, and former members in history

## Current Limitations

- A person can belong to only one household at a time.
- There are only two roles, admin and member; there are no finer-grained permissions.
- Default categories cannot be edited or removed.
- Custom categories have no screen for creating them, and cannot be renamed or deleted.
- The timezone list on the Household page covers common timezones only.
