# Providers (Contractor & Service Tracking) — Design

Date: 2026-09-29
Status: Approved design, awaiting spec review

## Purpose

Give a household a shared place to store contractors and service providers (roofers, plumbers, dentists, tutors, and so on) so two people (David and his wife) work from one list. The Worthington watcher job feeds the list through an API instead of a markdown file. This is a stepping stone toward project management in Adulting.DIY (porting ideas from `~/source/havemoneywantthingwhatdo`).

## Decisions

- Providers are general, not contractors only. All 38 watcher categories are imported.
- Watcher data goes straight into the household's own list (no shared neighborhood pool). The API is built so any household can ingest into its own list.
- All watcher content is imported, including per-source evidence. Anything can be dropped later.
- Categories and statuses are household-scoped and manageable by household admins.
- A task links to providers through a many-to-many join table.
- File attachments and quote/engagement tracking are deferred. A `ProviderAttachment` table is designed but not built.
- Diffing/reconciling against the existing markdown ledger is deferred.

## Data model

New Prisma models (all household-scoped):

- `ProviderCategory`: name, sortOrder. Unique on (householdId, name).
- `ProviderStatus`: name, kind (`neutral` | `positive` | `negative`), sortOrder, `hiddenByDefault` (boolean; the list page hides providers in such statuses unless toggled; Lead defaults to true). Unique on (householdId, name). Colors and filters key off `kind`. Default set per household: Lead, Recommended, Hired, Passed, Avoid.
- `Provider`: name, company, primaryContactName, phone, email, website, address, licenseNumber, googlePlaceId (optional, unique per household when set), categoryId, statusId, rating (private), hiredAt, notes (private), metaStatus (soft delete), createdAt, updatedAt.
- `ProviderContact`: providerId, name, role, phone, email.
- `ProviderEvidence`: providerId, sourceUrl (dedupe key), sourceGroup, sourceDate, snippet, kind (`third_party` | `self_promo` | `lead`).
- `ProviderComment`: providerId, authorId, body, createdAt, updatedAt. Authors can edit and delete their own.
- `TaskProvider`: taskDefinitionId, providerId. Unique pair.
- `ApiKey`: householdId, name, hashedKey, prefix, createdAt, revokedAt.
- `ProviderAttachment`: designed for later, not built now.

Derived (not stored): mention count, last-sighting date, and the "recommended by N neighbors" badge, all computed from `ProviderEvidence`.

Only name and category are required on a provider. Watcher data often has little else.

Deleting a category or status that is in use requires moving its providers to another one first.

## Ingest API

`POST /api/ingest/providers` accepts a batch and authenticates with a per-household API key (hashed at rest, shown once at creation, revocable).

- Upsert on `googlePlaceId` when present, otherwise on normalized name plus category.
- Missing categories and statuses are created by name (case-insensitive match).
- Evidence is appended and deduped on `sourceUrl`, so re-running the watcher is safe.
- Never overwrites private fields: rating, notes, hiredAt, or a status changed by hand.
- Returns counts (created, updated, evidence added) and per-item errors. One bad row does not fail the batch.

## UI

- `/providers`: list with search, category filter, status filter, and sort (mentions, last sighting, rating, name). Leads hidden by default with a toggle. "Recommended by N neighbors" badge.
- `/providers/[id]`: contacts, evidence with links, comments, linked tasks, private fields.
- Household settings (admins only): manage categories, statuses, and API keys.
- Task detail: a Providers section to link candidate providers.

## Testing

Vitest for the provider service and ingest logic (idempotency, matching, never-overwrite, evidence dedupe). API tests for auth and household isolation.

## Build slices (first cut; the implementation plan will firm these up)

1. Schema, categories, statuses, provider CRUD API.
2. List and detail UI with comments and contacts.
3. API keys and the ingest endpoint.
4. Watcher script in scripts-and-agents, plus an initial bulk load of the existing ledger.
5. Task-to-provider link.

## Out of scope

Quotes and engagements, file attachments, a shared cross-household pool, Google Places lookup, and ledger diffing.
