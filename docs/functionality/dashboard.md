# Dashboard

## Overview

The dashboard is the main landing page after login. It provides a quick summary of the household's task status and upcoming work.

## Stat Cards

Three summary cards are displayed at the top:

| Card | What it shows | Links to |
|------|--------------|----------|
| **Overdue** | Count of pending occurrences past their due date | Occurrences page (pending filter) |
| **Due Today** | Count of pending occurrences due today | Occurrences page (pending filter) |
| **Completed (7d)** | Count of occurrences completed in the last 7 days | Occurrences page (completed filter) |

Each card includes a progress bar scaled relative to a baseline of ~20 items.

## Coming Up

Below the stat cards, a "Coming Up" feed shows the next 5 pending occurrences sorted by due date (earliest first). Each entry displays:

- Color-coded dot (red = overdue, amber = due today, grey = upcoming)
- Task name and category
- Due date (bold red if overdue)
- Assignee names (visible on larger screens)

Clicking an entry navigates to the occurrence detail page. A "View all occurrences" link at the bottom goes to the full occurrences list.

## Greeting

The header shows a time-of-day greeting ("Good morning/afternoon/evening") with the user's first name.

## Data Loading

The dashboard fetches all data in a single optimized API call (`GET /api/dashboard`) and shows skeleton loaders while loading.
