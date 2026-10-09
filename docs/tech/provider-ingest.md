# Provider Ingest - Technical Reference

Providers (see [functionality doc](../functionality/providers.md)) can be loaded by machines through a per-household API key. This is how the neighborhood watcher feeds contractor recommendations into a household.

## Data Model

All models are in `prisma/schema.prisma` (migration `20260929120000_add_providers`).

| Model | Purpose |
|-------|---------|
| `ProviderCategory` | Household-managed category; unique on `(householdId, name)` |
| `ProviderStatus` | Household-managed status with `kind` (neutral, positive, negative) and `hiddenByDefault` |
| `Provider` | The provider; `nameKey` is the normalized name used for matching; `metaStatus` (active, deleted) is the soft delete; `rating`, `hiredAt`, `notes` are private; unique on `(householdId, googlePlaceId)` |
| `ProviderContact` | Extra contacts for a provider |
| `ProviderEvidence` | One row per sighting (`sourceUrl`, `sourceGroup`, `sourceDate`, `snippet`, `kind`); unique on `(providerId, sourceUrl)` |
| `ProviderComment` | Comments by household members |
| `TaskProvider` | Many-to-many link between tasks and providers |
| `ApiKey` | Per-household ingest key; only the SHA-256 hash is stored |

Evidence `kind` is `third_party` (a neighbor recommends), `self_promo`, or `lead`. Counts are derived at read time by `server/utils/provider-evidence.ts`: `mentionCount` is all evidence, `neighborCount` is `third_party` only, `lastSightingAt` is the newest `sourceDate`.

## Key Files

- `server/services/ProviderIngestService.ts` - batch ingest logic
- `server/services/ApiKeyService.ts`, `server/utils/api-key.ts`, `server/utils/api-key-auth.ts` - key creation, hashing, auth
- `server/utils/provider-schemas.ts` - Zod schemas for all provider endpoints including ingest
- `server/utils/provider-matching.ts` - `normalizeProviderName`
- `server/api/ingest/providers.post.ts` - the endpoint
- `server/api/api-keys/*` - admin key management

## API Keys

1. A household admin opens **Household > Provider settings** and creates a key with a name.
2. The plaintext key (`adk_` followed by random characters) is shown once. Only its hash and an 8 character prefix are stored, so it cannot be recovered; create a new key if it is lost.
3. The key is sent as `Authorization: Bearer adk_...` and scopes the request to that household.
4. Admins can revoke a key at any time. A revoked key stops working immediately. `lastUsedAt` is updated on use and shown in the settings page.

Missing or invalid keys return 401. Key management endpoints use the admin-only household handler (`defineHouseholdAdminEventHandler`); the ingest endpoint uses `defineApiKeyProtectedEventHandler`.

## Ingest Endpoint

`GET /api/ingest/categories` returns `{ "categories": ["Roofing, Siding & Gutters", ...], "taskCategories": [...] }` for the key's household. The Worthington watcher uses it as the category vocabulary so new finds land in existing, admin-managed categories.

`POST /api/ingest/providers`

```bash
curl -X POST https://<host>/api/ingest/providers \
  -H "Authorization: Bearer adk_REPLACE_ME" \
  -H "Content-Type: application/json" \
  -d '{
    "providers": [
      {
        "name": "Acme Plumbing (Bob)",
        "category": "Plumber",
        "phone": "614-555-0100",
        "evidence": [
          {
            "sourceUrl": "https://facebook.com/groups/example/posts/123",
            "sourceGroup": "Worthington Neighbors",
            "sourceDate": "2026-09-01",
            "snippet": "Acme fixed our water heater, highly recommend",
            "kind": "third_party"
          }
        ]
      }
    ]
  }'
```

### Request

The body is `{ "providers": [...] }` with 1 to 500 items. Anything else returns 400. Each item:

| Field | Required | Notes |
|-------|----------|-------|
| `name` | yes | 1-200 chars |
| `category` | yes | Category name; created for the household if it does not exist |
| `status` | no | Status name, used only when the provider is created; defaults to `Lead`; created if missing |
| `company`, `primaryContactName`, `phone`, `email`, `website`, `address`, `licenseNumber`, `googlePlaceId` | no | Up to 500 chars each |
| `evidence` | no | Array of `{ sourceUrl (valid URL, required), sourceGroup, sourceDate, snippet, kind (required: third_party, self_promo, lead) }` |

`sourceDate` is parsed leniently; an unparseable value is stored as null rather than failing the item.

### Response

```json
{ "created": 1, "updated": 0, "skippedDeleted": 0, "evidenceAdded": 1, "errors": [] }
```

`errors` holds `{ index, name, message }` per failed item. One bad item never fails the batch, and the response is 200 even when some items error, so callers must check `errors`.

### Matching Rules

For each item, the existing provider is found by:
1. `googlePlaceId`, when the item has one, within the household; otherwise
2. the normalized name (`nameKey`) within the same category.

Normalization lowercases, drops parenthetical text such as "(Owner Name)", turns `&` into "and", strips punctuation, and collapses whitespace. "Acme Plumbing (Bob)" and "ACME plumbing" match.

### Idempotency and Never-Overwrite Rules

Re-running the same payload is safe.
- Evidence is deduplicated on `(providerId, sourceUrl)`; repeats add nothing.
- A matched provider is never re-categorized or re-statused, and `rating`, `notes`, and `hiredAt` are never written by ingest.
- For a matched provider, contact-style fields (`company`, `primaryContactName`, `phone`, `email`, `website`, `address`, `licenseNumber`, `googlePlaceId`) are filled in only when currently empty; existing values are kept.
- A match counts as `updated` even when nothing new was added.
- If the match is a soft-deleted provider, the item is skipped and counted in `skippedDeleted`; its evidence is not added and it is not resurrected.

## Extending

- New provider field: add it to `prisma/schema.prisma`, `providerInputSchema` and `ingestItemSchema` in `provider-schemas.ts`, and to `FILLABLE_FIELDS` plus the create call in `ProviderIngestService` if the watcher should be able to fill it.
- New evidence kind: extend the enum in `ingestItemSchema` and the counting in `provider-evidence.ts`.
- New machine endpoint: wrap it in `defineApiKeyProtectedEventHandler`, which supplies `{ householdId, apiKeyId, userId }` (`userId` is the key's creator). Projects and tasks are ingested the same way: see [project-task-ingest.md](project-task-ingest.md).

## Loader and Watcher

- The Python loader lives in the separate `scripts-and-agents` repo: `scripts/providers_ingest.py` (on `main`). It parses the frozen markdown contractor ledger and posts it in batches of 100. It was used once to load the original Worthington ledger and is safe to re-run.
- The `worthington-watcher` skill (`~/.claude/skills/worthington-watcher`) now posts each run's contractor finds to this API (`https://www.adulting.diy`) instead of editing the markdown ledger, which is a frozen archive. It reads the category vocabulary from `GET /api/ingest/categories`, uses the key in `scripts-and-agents/.env` (`ADULTING_API_KEY`), and queues finds in `logs/worthington-socials/pending-ingest.jsonl` for retry when the site is unreachable. An item the server rejects 5 times moves to `rejected-ingest.jsonl`. See the skill's `SKILL.md` for the details.

## Related

- [API endpoints](api-endpoints.md)
- [Provider functionality](../functionality/providers.md)
