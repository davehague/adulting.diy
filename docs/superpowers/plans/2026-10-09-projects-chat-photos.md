# Photos in the Project Chat (Slice 5b) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the chat, take or pick up to three photos that upload into the project's Photos and go to the model with the question; the model also sees every other project photo as a thumbnail; the chat runs on `glm-5.3-flash`.

**Architecture:** One nullable-free JSON column on `project_chat_messages` (`photoIds`), the photo cap raised to 25, the chat model default changed, `images` on the Ollama message type, the prompt builder taking photo bytes, the service validating photo ids and reading blobs, and a composer that uploads through the existing photo route and attaches ids. Three tasks.

**Tech Stack:** as slice 5 (Nuxt 3 / Vue 3, Nitro, Prisma on CockroachDB, Zod, Tailwind, Lucide, Vitest with mocked Prisma and a mocked blob module). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-08-projects-chat-photos-design.md`. Slice 5's plan and code are the pattern: `docs/superpowers/plans/2026-10-08-projects-ai-chat.md`, `server/services/ProjectChatService.ts`, `server/utils/chat-prompts.ts`, `components/projects/ChatComposer.vue`, `components/projects/PhotoUploader.vue` (the upload pattern to copy).

## Execution rules (set by David)

- Subagent-driven development: Sonnet implementers (`model: "sonnet"`), Opus reviewers (`model: "opus"`) for every task review, re-review and the final review; every reviewer writes its full report to a file in this plan's workspace under `.superpowers/sdd/`.
- Branch `feat/chat-photos` (already created from `main` at df0e0a2; the spec is its first commit). No worktrees. Tasks one at a time. Never `git stash`, never the dev server, never `nuxt build`. Explicit-path commits; `.claude/settings.local.json` is never committed.
- Local dev uses the PRODUCTION database: no `prisma migrate dev/deploy`, `db push`, `migrate status`, seeds. `npx prisma validate`, `npx prisma generate` and `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` are safe.
- No subagent calls an external service; every model call, search and blob read in tests is a mock. No subagent reads `.env`.
- **David HAS pre-approved for this slice** (2026-10-09): applying the migration, the merge and the push. The controller does them after the final review and docs, never a subagent.
- Code style per CLAUDE.md; match neighbouring comment density; Markdown prose unwrapped.
- Screens cannot be run in the suite: the Task 3 implementer writes a hand trace; the Opus reviewer compiles the real files in the slice 5 harness (`/private/tmp/claude-501/-Users-davidhague-source-adulting-diy/64aa3fa3-d771-424e-bddc-4cb2014634c7/scratchpad/chat-harness/`, extended).
- Say plainly what was only unit-tested and what was never run.

## Global Constraints

- `MAX_CHAT_PHOTOS = 3` per message; `MAX_PROJECT_PHOTOS` 10 → 25 everywhere (one constant; the two service tests that spell "10 photos" change to 25; the project page and uploader read the constant).
- `DEFAULT_CHAT_MODEL = 'glm-5.3-flash'`.
- Body rules: `text` 0–2,000 chars after trim (message "A message must be 1 to 2000 characters" stays for over-long text); `photoIds` at most 3 ("At most 3 photos per message"); text or a photo required ("Add a message or a photo"); each photo id must be an active photo of this project ("Photo not found", 404).
- Images go only on the LAST user message: every other project photo's thumbnail first (position order), then the attached photos' full images in attachment order; the text gets the prefix line "[Pictures: N small ones are the project's photos; the last M large ones are attached to this message]" and reads "(photo attached, no question)" when empty; earlier user rows with photos get "(with N photos) ". No images when the project has no photos at all. A blob that cannot be read is skipped and counted.
- Never sent: photo ids, paths, file names, who uploaded. Nothing logged contains text; the log line gains `photos A/T` (attached/total images sent).
- Retry resends the saved row with its photos. The lock, polling, recovery, searches and deadline are unchanged.
- Screen copy: button label "Add photo" (icon only on phones, with `aria-label`); "Couldn't add the photo."; "This project has all 25 photos."; "At most 3 photos per message".

## Caller audit (2026-10-09 by grep)

- `MAX_PROJECT_PHOTOS`: `types/project.ts:13`, `pages/projects/new.vue:96`, `pages/projects/[id].vue:128`, `components/projects/PhotoUploader.vue:32,172`, `server/services/ProjectPhotoService.ts:33-34,71-74`, tests `tests/unit/services/project-photo-service.test.ts:56,120` (literal "10 photos"). Docs `docs/functionality/projects.md:8,159` and `changelog.md` (controller's docs step).
- `buildChatPrompt`: `ProjectChatService.ts:100` and `tests/unit/utils/chat-prompts.test.ts`, `tests/unit/services/project-chat-service.test.ts` (calls through the service). Task 2 adds a fifth parameter; the test files are updated in Task 2.
- `parseChatSendInput`: `chat.post.ts` and `tests/unit/utils/chat-schemas.test.ts`, `tests/unit/api/project-chat-routes.test.ts`. Task 1.
- `ChatComposer` emits `send(text)`: `pages/projects/chat/[id].vue` only. Task 3.
- `ChatMessageDto` consumers: the page, `ChatThread.vue`, the service `toDto`, the harness. Tasks 1–3.

## Review Focus

1. A photo id from another project or household in `photoIds`: must be 404 before anything is saved. Task 2 pins it.
2. The model gets images only on the last user message, in the documented order, and never an id or path. Task 2 pins the exact `messages` array.
3. A blob read that throws must not fail the ask; the count shows in the log. Task 2 pins it.
4. An upload that finishes after the composer was cleared (fast Send) must not re-attach to the next message. Task 3's hand trace and the harness cover it.
5. The cap: the 26th photo from the chat shows "This project has all 25 photos." and nothing hangs. Task 3.

---

### Task 1: Foundations (column, migration, types, cap, model default, images on the wire, body rules)

**Files:**
- Modify: `prisma/schema.prisma` (`ProjectChatMessage`), `types/chat.ts`, `types/project.ts:13`, `server/utils/ollama.ts` (`ChatMessage`), `server/utils/chat-schemas.ts`
- Create: `prisma/migrations/20261009120000_add_chat_message_photos/migration.sql`
- Test: `tests/unit/utils/ai-config.test.ts`, `tests/unit/utils/ollama.test.ts`, `tests/unit/utils/chat-schemas.test.ts`, `tests/unit/api/project-chat-routes.test.ts`, `tests/unit/services/project-photo-service.test.ts`

**Interfaces produced:** `MAX_CHAT_PHOTOS`, `CHAT_PHOTO_COUNT_MESSAGE = 'At most 3 photos per message'`, `CHAT_EMPTY_MESSAGE = 'Add a message or a photo'`, `CHAT_PHOTOS_FULL_MESSAGE = 'This project has all 25 photos.'`, `CHAT_PHOTO_FAILED_MESSAGE = "Couldn't add the photo."`; `ChatMessageDto.photoIds: string[]`; `ChatSendInput = { text: string; photoIds: string[] } | { retry: true }`; `ChatMessage.images?: string[]`; `parseChatSendInput` with the new rules; Prisma field `photoIds`.

- [ ] **Step 1: Failing tests**

`tests/unit/utils/ai-config.test.ts`: change the `chatModel` default test to expect `'glm-5.3-flash'`.

`tests/unit/utils/ollama.test.ts`, in `describe('callOllamaChat')`:

```ts
  it('passes images on a message through untouched', async () => {
    respond({ message: { role: 'assistant', content: 'A red square.' } })
    const messages = [{ role: 'system' as const, content: 'sys' }, { role: 'user' as const, content: 'what is this', images: ['AAAA', 'BBBB'] }]
    await callOllamaChat({ ...chatInput, messages })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).messages).toEqual(messages)
  })
```

`tests/unit/utils/chat-schemas.test.ts`: replace the file's cases with:

```ts
import { describe, it, expect } from 'vitest'
import { parseChatSendInput } from '@/server/utils/chat-schemas'

const caught = (body: unknown): unknown => { try { parseChatSendInput(body); return null } catch (e) { return e } }

describe('parseChatSendInput', () => {
  it('returns the trimmed text and no photos', () => {
    expect(parseChatSendInput({ text: '  hello  ' })).toEqual({ text: 'hello', photoIds: [] })
  })
  it('returns photos with empty text', () => {
    expect(parseChatSendInput({ photoIds: ['a', 'b'] })).toEqual({ text: '', photoIds: ['a', 'b'] })
    expect(parseChatSendInput({ text: '   ', photoIds: ['a'] })).toEqual({ text: '', photoIds: ['a'] })
  })
  it('returns a retry when retry is exactly true, ignoring the rest', () => {
    expect(parseChatSendInput({ retry: true, text: 'x', photoIds: ['a'] })).toEqual({ retry: true })
  })
  it('needs a message or a photo', () => {
    for (const body of [null, {}, { text: '' }, { text: '   ' }, { photoIds: [] }, { retry: 'yes' }, { retry: false }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'Add a message or a photo' })
  })
  it('rejects over-long or non-string text with the length message', () => {
    for (const body of [{ text: 5 }, { text: 'x'.repeat(2001) }, { text: 'x'.repeat(2001), photoIds: ['a'] }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'A message must be 1 to 2000 characters' })
  })
  it('rejects more than three photos, a non-array, or a non-string id', () => {
    expect(caught({ photoIds: ['a', 'b', 'c', 'd'] })).toMatchObject({ statusCode: 400, message: 'At most 3 photos per message' })
    for (const body of [{ photoIds: 'a' }, { photoIds: [1] }, { photoIds: [''] }])
      expect(caught(body)).toMatchObject({ statusCode: 400, message: 'At most 3 photos per message' })
  })
  it('accepts exactly 2000 characters and exactly three photos', () => {
    expect(parseChatSendInput({ text: 'x'.repeat(2000), photoIds: ['a', 'b', 'c'] })).toEqual({ text: 'x'.repeat(2000), photoIds: ['a', 'b', 'c'] })
  })
})
```

`tests/unit/api/project-chat-routes.test.ts`: the POST "sends the trimmed text" expectation becomes `send('h1', 'u1', 'p1', { text: 'hello', photoIds: [] })`; add "POST sends photo ids": body `{ text: 'look', photoIds: ['ph1'] }` → `send(..., { text: 'look', photoIds: ['ph1'] })`; the 400 cases' message for `null`, `{}`, whitespace becomes 'Add a message or a photo' (the 2001-character case keeps the length message).

`tests/unit/services/project-photo-service.test.ts:56,120`: `'This project already has 25 photos'`; check the fixtures that build "10 existing photos" and make them 25 (read the file; the count that triggers the cap must be `MAX_PROJECT_PHOTOS`, so prefer building the fixture from the constant).

- [ ] **Step 2: Run to see them fail**

`npx vitest run tests/unit/utils/ai-config.test.ts tests/unit/utils/ollama.test.ts tests/unit/utils/chat-schemas.test.ts tests/unit/api/project-chat-routes.test.ts tests/unit/services/project-photo-service.test.ts` → FAIL.

- [ ] **Step 3: Types, cap, model**

`types/project.ts:13`: `export const MAX_PROJECT_PHOTOS = 25;`

`types/chat.ts`: `DEFAULT_CHAT_MODEL = 'glm-5.3-flash'`; add

```ts
export const MAX_CHAT_PHOTOS = 3;
export const CHAT_PHOTO_COUNT_MESSAGE = `At most ${MAX_CHAT_PHOTOS} photos per message`;
export const CHAT_EMPTY_MESSAGE = 'Add a message or a photo';
export const CHAT_PHOTOS_FULL_MESSAGE = 'This project has all 25 photos.';
export const CHAT_PHOTO_FAILED_MESSAGE = "Couldn't add the photo.";
```

(import `MAX_PROJECT_PHOTOS` from `@/types/project` and build `CHAT_PHOTOS_FULL_MESSAGE` from it: `` `This project has all ${MAX_PROJECT_PHOTOS} photos.` ``). `ChatMessageDto` gains `// photos attached to a user row, in order; [] on assistant rows` `photoIds: string[];`. `ChatSendInput` becomes `{ text: string; photoIds: string[] } | { retry: true }`.

- [ ] **Step 4: Schema and migration**

`prisma/schema.prisma`, `ProjectChatMessage`, after `searches`: `  photoIds     Json     @default("[]") // string[]: ProjectPhoto ids attached to a user row, in order; [] on assistant rows`. `npx prisma validate`, `npx prisma generate`. Migration file:

```sql
-- AlterTable
ALTER TABLE "project_chat_messages" ADD COLUMN "photoIds" JSONB NOT NULL DEFAULT '[]';
```

(confirm the type and default against `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` output for that column, then delete the output).

- [ ] **Step 5: Wire type and body rules**

`server/utils/ollama.ts`, `ChatMessage`: add `// base64 JPEG/PNG bytes; the model reads them with the message` `images?: string[];`. Nothing else: `callOllamaChat` already serialises messages whole.

`server/utils/chat-schemas.ts`:

```ts
import { z } from 'zod';
import { HttpError } from '@/server/utils/api-errors';
import { CHAT_EMPTY_MESSAGE, CHAT_MESSAGE_LENGTH_MESSAGE, CHAT_PHOTO_COUNT_MESSAGE, MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_PHOTOS, type ChatSendInput } from '@/types/chat';

const bodySchema = z.object({
  text: z.string({ invalid_type_error: CHAT_MESSAGE_LENGTH_MESSAGE }).trim().max(MAX_CHAT_MESSAGE_CHARS, CHAT_MESSAGE_LENGTH_MESSAGE).default(''),
  photoIds: z.array(z.string({ invalid_type_error: CHAT_PHOTO_COUNT_MESSAGE }).min(1, CHAT_PHOTO_COUNT_MESSAGE), { invalid_type_error: CHAT_PHOTO_COUNT_MESSAGE }).max(MAX_CHAT_PHOTOS, CHAT_PHOTO_COUNT_MESSAGE).default([]),
});

// A send is either a retry of the last unanswered message or a new message with text, photos or both. Each failure has one fixed message.
export const parseChatSendInput = (body: unknown): ChatSendInput => {
  if (typeof body === 'object' && body !== null && (body as { retry?: unknown }).retry === true) return { retry: true };
  const parsed = bodySchema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(parsed.error.issues[0].message, 400);
  const { text, photoIds } = parsed.data;
  if (!text && photoIds.length === 0) throw new HttpError(CHAT_EMPTY_MESSAGE, 400);
  return { text, photoIds };
};
```

If a test case's message comes out differently because Zod reports another issue first (for example `{ text: 5 }`), order the checks so the test's expected message wins; report what you changed.

- [ ] **Step 6: Green**

Step 2 command → PASS; `npx vitest run 2>&1 | tail -6` (baseline 68 files / 1117; count grows by the new cases); `npx nuxi typecheck 2>&1 | grep -E "types/chat|chat-schemas|ollama|ProjectChatService|chat/\[id\]"` → the service and page will now fail to type-check on `ChatSendInput`/`photoIds` until Tasks 2 and 3; list those errors in the report and confirm they are only the missing `photoIds` field (Task 2 and 3 fix them). Everything else: nothing.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20261009120000_add_chat_message_photos/migration.sql types/chat.ts types/project.ts server/utils/ollama.ts server/utils/chat-schemas.ts tests/unit/utils/ai-config.test.ts tests/unit/utils/ollama.test.ts tests/unit/utils/chat-schemas.test.ts tests/unit/api/project-chat-routes.test.ts tests/unit/services/project-photo-service.test.ts
git commit -m "feat: chat photo foundations (photoIds column, cap 25, flash default, images on the wire, body rules)"
```

---

### Task 2: Prompt and service

**Files:**
- Modify: `server/utils/chat-prompts.ts`, `server/services/ProjectChatService.ts`, `server/utils/blob-storage.ts`
- Test: `tests/unit/utils/chat-prompts.test.ts`, `tests/unit/services/project-chat-service.test.ts`

**Interfaces:**
- Produces `readPrivateBytes(pathname): Promise<Buffer | null>` in `blob-storage.ts`; `ChatPhotos { attached: Buffer[]; others: Buffer[] }`; `ChatHistoryRow.photoCount: number`; `buildChatPrompt(context, history, currentUserId, today, photos: ChatPhotos)`; the service saving and returning `photoIds`.

- [ ] **Step 1: Failing tests**

`tests/unit/utils/chat-prompts.test.ts`: every existing `buildChatPrompt(...)` call gains a fifth argument `{ attached: [], others: [] }` (add a `const noPhotos = { attached: [], others: [] }`). The history fixture rows gain `photoCount: 0`. Add:

```ts
describe('photos', () => {
  const png = (byte: number) => Buffer.from([byte, byte, byte])
  const rows: ChatHistoryRow[] = [
    { role: 'user', content: 'Here is the valve', createdById: 'u1', photoCount: 2 },
    { role: 'assistant', content: 'I see a gate valve.', createdById: 'u1', photoCount: 0 },
    { role: 'user', content: 'And this?', createdById: 'u1', photoCount: 1 },
  ]
  it('puts the project thumbnails then the attached photos on the last user message with the prefix line', () => {
    const built = buildChatPrompt(context(), rows, 'u1', today, { attached: [png(1)], others: [png(2), png(3)] })
    const last = built.messages.at(-1)!
    expect(last.role).toBe('user')
    expect(last.images).toEqual([png(2).toString('base64'), png(3).toString('base64'), png(1).toString('base64')])
    expect(last.content).toBe("[Pictures: 2 small ones are the project's photos; the last 1 large ones are attached to this message]\nAnd this?")
    expect(built.messages[1]).toEqual({ role: 'user', content: '(with 2 photos) Here is the valve' })
    expect(built.messages[2]).toEqual({ role: 'assistant', content: 'I see a gate valve.' })
    expect('images' in built.messages[1]).toBe(false)
  })
  it('says there is no question when the text is empty', () => {
    const built = buildChatPrompt(context(), [{ role: 'user', content: '', createdById: 'u1', photoCount: 1 }], 'u1', today, { attached: [png(1)], others: [] })
    expect(built.messages.at(-1)!.content).toBe("[Pictures: 0 small ones are the project's photos; the last 1 large ones are attached to this message]\n(photo attached, no question)")
  })
  it('sends only thumbnails, with the prefix, when nothing is attached but the project has photos', () => {
    const built = buildChatPrompt(context(), [{ role: 'user', content: 'Same faucet?', createdById: 'u1', photoCount: 0 }], 'u1', today, { attached: [], others: [png(9)] })
    const last = built.messages.at(-1)!
    expect(last.images).toEqual([png(9).toString('base64')])
    expect(last.content).toBe("[Pictures: 1 small ones are the project's photos; the last 0 large ones are attached to this message]\nSame faucet?")
  })
  it('sends no images and no prefix when the project has no photos', () => {
    const built = buildChatPrompt(context(), [{ role: 'user', content: 'Hi', createdById: 'u1', photoCount: 0 }], 'u1', today, { attached: [], others: [] })
    expect(built.messages.at(-1)).toEqual({ role: 'user', content: 'Hi' })
  })
  it('keeps the other-member prefix in front of the pictures line', () => {
    const two: ChatHistoryRow[] = [{ role: 'user', content: 'a', createdById: 'u1', photoCount: 0 }, { role: 'user', content: 'b', createdById: 'u2', photoCount: 1 }]
    const built = buildChatPrompt(context(), two, 'u1', today, { attached: [png(1)], others: [] })
    expect(built.messages.at(-1)!.content.startsWith('(another household member) [Pictures:')).toBe(true)
  })
  it('the rules mention photos', () => {
    expect(buildChatPrompt(context(), [], 'u1', today, { attached: [], others: [] }).messages[0].content).toContain('never guess a brand or model you cannot read')
  })
})
```

`tests/unit/services/project-chat-service.test.ts`: add to the Prisma mock `projectPhoto: { findMany: vi.fn() }`; add `vi.mock('@/server/utils/blob-storage', () => ({ readPrivateBytes: vi.fn() }))` and `import { readPrivateBytes } from '@/server/utils/blob-storage'`; in `beforeEach`: `db.projectPhoto.findMany.mockResolvedValue([])` and `vi.mocked(readPrivateBytes).mockResolvedValue(Buffer.from('img'))`. Every `send(... { text })` call gains `photoIds: []`; the `created('user')` expectation gains `photoIds: []`; `history()`'s select expectation (if asserted) gains `photoIds: true`; DTO expectations gain `photoIds: []`. The `userRow`/`assistantRow` fixtures gain `photoIds: []`. Add:

```ts
describe('photos', () => {
  const photos = [
    { id: 'ph1', fullPath: 'h/p/ph1-full.jpg', thumbPath: 'h/p/ph1-thumb.jpg' },
    { id: 'ph2', fullPath: 'h/p/ph2-full.jpg', thumbPath: 'h/p/ph2-thumb.jpg' },
    { id: 'ph3', fullPath: 'h/p/ph3-full.jpg', thumbPath: 'h/p/ph3-thumb.jpg' },
  ]
  beforeEach(() => {
    db.projectPhoto.findMany.mockResolvedValue(photos)
    vi.mocked(readPrivateBytes).mockImplementation(async (path: string) => Buffer.from(path))
  })
  it('refuses a photo that is not this project's before saving anything', async () => {
    await expect(service.send('h1', 'u1', 'p1', { text: 'x', photoIds: ['ph1', 'nope'] })).rejects.toMatchObject({ statusCode: 404, message: 'Photo not found' })
    expect(db.projectChatMessage.create).not.toHaveBeenCalled()
    expect(db.aiRequestLog.create).not.toHaveBeenCalled()
    expect(db.projectPhoto.findMany.mock.calls[0][0]).toEqual({ where: { projectId: 'p1' }, orderBy: { position: 'asc' }, select: { id: true, fullPath: true, thumbPath: true } })
  })
  it('saves the photo ids on the user row and returns them', async () => {
    const result = await service.send('h1', 'u1', 'p1', { text: 'look', photoIds: ['ph2', 'ph1'] })
    expect(created('user')).toMatchObject({ photoIds: ['ph2', 'ph1'] })
    expect(result.userMessage.photoIds).toEqual(['ph2', 'ph1'])
    expect(result.assistantMessage.photoIds).toEqual([])
    expect(created('assistant').photoIds ?? []).toEqual([])
  })
  it('reads full images for the attached photos in attachment order and thumbnails for the rest in position order, onto the last message only', async () => {
    db.projectChatMessage.findMany.mockResolvedValue([userRow({ id: 'new', content: 'look', photoIds: ['ph2', 'ph1'], createdAt: at(0) }), userRow({ id: 'old', content: 'earlier', photoIds: ['ph3'], createdAt: at(-5000) })])
    await service.send('h1', 'u1', 'p1', { text: 'look', photoIds: ['ph2', 'ph1'] })
    const sent = sentMessages() as { role: string; content: string; images?: string[] }[]
    expect(sent[1]).toEqual({ role: 'user', content: '(with 1 photos) earlier' })
    expect(sent[2].images).toEqual(['h/p/ph3-thumb.jpg', 'h/p/ph2-full.jpg', 'h/p/ph1-full.jpg'].map((p) => Buffer.from(p).toString('base64')))
    expect(sent[2].content).toBe("[Pictures: 1 small ones are the project's photos; the last 2 large ones are attached to this message]\nlook")
    expect(vi.mocked(readPrivateBytes).mock.calls.map((c) => c[0])).toEqual(['h/p/ph3-thumb.jpg', 'h/p/ph2-full.jpg', 'h/p/ph1-full.jpg'])
  })
  it('skips a photo whose blob cannot be read and says so in the log line', async () => {
    vi.mocked(readPrivateBytes).mockImplementation(async (path: string) => (path.includes('ph1') ? Promise.reject(new Error('blob down')) : Buffer.from(path)))
    db.projectChatMessage.findMany.mockResolvedValue([userRow({ id: 'new', content: 'look', photoIds: ['ph1'], createdAt: at(0) })])
    await service.send('h1', 'u1', 'p1', { text: 'look', photoIds: ['ph1'] })
    const sent = sentMessages() as { images?: string[] }[]
    expect(sent.at(-1)!.images).toHaveLength(2)
    expect(vi.mocked(console.info).mock.calls[0][0]).toMatch(/photos 0\/2 \(1 unreadable\)$/)
  })
  it('a retry resends the saved row's photos', async () => {
    db.projectChatMessage.findFirst.mockResolvedValue(userRow({ failedAt: at(-100), photoIds: ['ph3'] }))
    db.projectChatMessage.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...userRow({ photoIds: ['ph3'] }), ...data }))
    db.projectChatMessage.findMany.mockResolvedValue([userRow({ content: 'It will not budge', photoIds: ['ph3'], createdAt: at(0) })])
    await service.send('h1', 'u1', 'p1', { retry: true })
    expect((sentMessages().at(-1) as { images?: string[] }).images).toEqual(['h/p/ph1-thumb.jpg', 'h/p/ph2-thumb.jpg', 'h/p/ph3-full.jpg'].map((p) => Buffer.from(p).toString('base64')))
  })
  it('sends no images when the project has no photos', async () => {
    db.projectPhoto.findMany.mockResolvedValue([])
    await service.send('h1', 'u1', 'p1', { text: 'hi', photoIds: [] })
    expect('images' in (sentMessages().at(-1) as object)).toBe(false)
    expect(readPrivateBytes).not.toHaveBeenCalled()
  })
  it('the log line counts photos', async () => {
    await service.send('h1', 'u1', 'p1', { text: 'hi', photoIds: ['ph1'] })
    expect(vi.mocked(console.info).mock.calls[0][0]).toMatch(/; photos 1\/3$/)
  })
})
```

Adjust `userRow` so `photoIds` defaults to `[]` and the `photos` tests' `findMany` rows match what the service's `history` select returns (the service reads `photoIds` on history rows; the mock returns whole rows, so include `photoIds` on them).

- [ ] **Step 2: Run to see them fail.** `npx vitest run tests/unit/utils/chat-prompts.test.ts tests/unit/services/project-chat-service.test.ts` → FAIL.

- [ ] **Step 3: `blob-storage.ts`**

```ts
// The whole object as bytes, for sending a photo to the model. null when the blob does not exist.
export const readPrivateBytes = async (pathname: string): Promise<Buffer | null> => {
  const result = await getPrivate(pathname);
  if (!result || !result.stream) return null;
  return Buffer.from(await new Response(result.stream).arrayBuffer());
};
```

- [ ] **Step 4: `chat-prompts.ts`**

`ChatHistoryRow` gains `// photos attached to this row (user rows)` `photoCount: number;`. Add:

```ts
export interface ChatPhotos {
  // the photos attached to the message being answered, full size, in attachment order
  attached: Buffer[];
  // every other photo of the project, as thumbnails, in position order
  others: Buffer[];
}
```

In `rules()`, after the "Do not repeat the project description back" bullet, add: `- Photos may be attached. Say what you see when it matters, say when the picture is too small or unclear to tell, and never guess a brand or model you cannot read.`

Replace `historyMessages` and `buildChatPrompt` with:

```ts
const picturesLine = (photos: ChatPhotos): string =>
  `[Pictures: ${photos.others.length} small ones are the project's photos; the last ${photos.attached.length} large ones are attached to this message]`;

// The whole conversation goes every time; the context window is far larger than the cap. Members are never named. Images ride only on the last user message: the project's thumbnails, then the attached photos.
const historyMessages = (history: ChatHistoryRow[], currentUserId: string, photos: ChatPhotos): ChatMessage[] => {
  const recent = history.slice(-MAX_CHAT_HISTORY);
  const authors = new Set(recent.filter((row) => row.role === 'user').map((row) => row.createdById));
  const lastIndex = recent.length - 1;
  const hasImages = photos.attached.length + photos.others.length > 0;
  return recent.map((row, index) => {
    if (row.role === 'assistant') return { role: 'assistant', content: row.content };
    const member = authors.size > 1 && row.createdById !== currentUserId ? '(another household member) ' : '';
    const text = redactContactDetails(row.content);
    if (index === lastIndex && hasImages) {
      const body = text.trim() ? text : '(photo attached, no question)';
      return {
        role: 'user',
        content: `${member}${picturesLine(photos)}\n${body}`,
        images: [...photos.others, ...photos.attached].map((bytes) => bytes.toString('base64')),
      };
    }
    const marker = row.photoCount > 0 ? `(with ${row.photoCount} photos) ` : '';
    return { role: 'user', content: `${member}${marker}${text}` };
  });
};

// The one place that decides what the chat sends. Rebuilt on every message, so edits to the project show up in the next reply.
export const buildChatPrompt = (
  context: ChatContext,
  history: ChatHistoryRow[],
  currentUserId: string,
  today: string,
  photos: ChatPhotos,
): { messages: ChatMessage[]; tools: ChatTool[] } => ({
  messages: [{ role: 'system', content: `${rules(today)}\n\nProject:\n${projectBlock(context)}` }, ...historyMessages(history, currentUserId, photos)],
  tools: chatTools,
});
```

- [ ] **Step 5: `ProjectChatService.ts`**

- `messageSelect` gains `photoIds: true`; `toDto` parses it with `searchesSchema` the same way into `photoIds` (`[]` when unreadable).
- Import `readPrivateBytes` from `@/server/utils/blob-storage` and `type ChatPhotos` from chat-prompts.
- In `send`, right after the 403 check and BEFORE the lock read: `const photoRows = await prisma.projectPhoto.findMany({ where: { projectId }, orderBy: { position: 'asc' }, select: { id: true, fullPath: true, thumbPath: true } });` then, for a plain send, `const attachedIds = input.photoIds; if (attachedIds.some((id) => !photoRows.some((row) => row.id === id))) throw new HttpError('Photo not found', 404);` For a retry, `attachedIds` comes from the refreshed row (`parsedPhotoIds(userRow.photoIds)`), computed after the row is read; ids that no longer exist are simply absent from `photoRows` and are skipped.
- The user-row create's `data` gains `photoIds: input.photoIds`.
- Add a private `photos(photoRows, attachedIds): Promise<{ photos: ChatPhotos; unreadable: number }>`: `others` = rows whose id is not in `attachedIds`, in the given order, read by `thumbPath`; `attached` = for each id in `attachedIds` order, the row's `fullPath`; each read wrapped in try/catch, a throw or a null counts as unreadable and is skipped. Reads run with `Promise.all` in the documented order so the call order is deterministic (build the list of `{ path }` first, map to reads, then split).
- Call it inside the existing `try` together with `context` and `history` (`Promise.all` of the three), pass `photos` as the fifth argument to `buildChatPrompt`, and extend the info line: `` `[chat] ok in … ; searches ${searches.length}; photos ${photos.attached.length}/${photos.attached.length + photos.others.length}` `` plus `` ` (${unreadable} unreadable)` `` when unreadable > 0.
- `history()`'s select gains `photoIds: true`; each row maps `photoCount: parsedPhotoIds(row.photoIds).length`.
- Nothing else changes. The service test's existing exact `toEqual` on `created('user')` is updated in Step 1 to include `photoIds`.

- [ ] **Step 6: Green.** Step 2 command → PASS; full suite; `npx nuxi typecheck 2>&1 | grep -E "chat-prompts|ProjectChatService|blob-storage"` → nothing (the page's error from Task 1 remains until Task 3; say so).

- [ ] **Step 7: Commit**

```bash
git add server/utils/chat-prompts.ts server/services/ProjectChatService.ts server/utils/blob-storage.ts tests/unit/utils/chat-prompts.test.ts tests/unit/services/project-chat-service.test.ts
git commit -m "feat: the chat sends attached photos and the project's thumbnails to the model"
```

---

### Task 3: The composer, the thread and the page

**Files:**
- Modify: `components/projects/ChatComposer.vue`, `components/projects/ChatThread.vue`, `pages/projects/chat/[id].vue`

**Interfaces:** `ChatComposer` props gain `projectId: string`; emits `send(text: string, photoIds: string[])`; exposes `clear()`, `restore(text: string, photoIds: string[])`, `focus()`. `ChatThread` renders `message.photoIds`.

- [ ] **Step 1: `ChatComposer.vue`**

Template: inside the form, before the textarea's label, a chips row and the camera button. Replace the whole `<template>` with:

```vue
<template>
  <form class="border-t border-stone-200 bg-white px-3 py-2 pb-[max(1.5rem,env(safe-area-inset-bottom))]" @submit.prevent="submit">
    <ul v-if="chips.length > 0" class="mb-2 flex gap-2" aria-label="Photos to send">
      <li v-for="chip in chips" :key="chip.key" class="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
        <AuthedImage v-if="chip.photoId" :project-id="projectId" :photo-id="chip.photoId" variant="thumb" alt="" />
        <span v-else class="flex h-full w-full items-center justify-center text-xs text-stone-500" aria-live="polite">…</span>
        <button type="button"
                class="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-sm leading-none text-stone-700 hover:bg-white"
                :aria-label="chip.photoId ? 'Remove photo from message' : 'Cancel upload'"
                @click="removeChip(chip.key)">
          &times;
        </button>
      </li>
    </ul>
    <p v-if="photoError" class="mb-1 text-sm text-red-700" aria-live="polite">{{ photoError }}</p>
    <div class="flex items-end gap-2">
      <label class="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-stone-300 text-stone-700 hover:bg-stone-50"
             :class="{ 'pointer-events-none opacity-50': disabled || chips.length >= MAX_CHAT_PHOTOS }"
             aria-label="Add photo">
        <Camera :size="18" aria-hidden="true" />
        <input type="file" accept="image/*" multiple class="sr-only" :disabled="disabled || chips.length >= MAX_CHAT_PHOTOS" @change="onPick">
      </label>
      <label for="chat-text" class="sr-only">Your message</label>
      <textarea id="chat-text"
                ref="box"
                v-model="text"
                rows="1"
                :maxlength="MAX_CHAT_MESSAGE_CHARS + 200"
                :disabled="disabled"
                placeholder="Ask about this project…"
                enterkeyhint="send"
                class="w-full min-w-0 resize-none overflow-y-auto rounded-md border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 text-base sm:text-sm disabled:opacity-60"
                @keydown.enter="onEnter" />
      <div class="flex shrink-0 flex-col items-end gap-1">
        <span v-if="text.length > MAX_CHAT_MESSAGE_CHARS - 200" class="text-xs" :class="overLimit ? 'text-red-700' : 'text-stone-500'">{{ text.length }} / {{ MAX_CHAT_MESSAGE_CHARS }}</span>
        <button type="submit"
                :disabled="!canSend"
                class="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors disabled:opacity-50">
          Send
        </button>
      </div>
    </div>
  </form>
</template>
```

Script: add imports `Camera` from `lucide-vue-next`, `AuthedImage` from `@/components/projects/AuthedImage.vue`, `resizePhoto` from `@/utils/image-resize`, `useProjects` from `@/composables/useProjects`, `hasApiStatus` from `@/utils/api-error`, and `CHAT_PHOTO_COUNT_MESSAGE, CHAT_PHOTO_FAILED_MESSAGE, CHAT_PHOTOS_FULL_MESSAGE, MAX_CHAT_PHOTOS` from `@/types/chat`. Props gain `projectId: string`. The emit becomes `(e: 'send', text: string, photoIds: string[]): void`. Add:

```ts
interface Chip {
  key: number;
  // set once the upload is done; the photo is then part of the project
  photoId: string | null;
}

const { uploadPhoto } = useProjects();
const chips = ref<Chip[]>([]);
const photoError = ref<string | null>(null);
let nextKey = 0;
// Every upload belongs to the chips row it started in; clearing the row makes the number jump, so a late upload cannot attach to the next message.
let generation = 0;

const uploading = computed(() => chips.value.some((chip) => chip.photoId === null));
const photoIds = computed(() => chips.value.flatMap((chip) => (chip.photoId ? [chip.photoId] : [])));
```

`canSend` becomes `!props.disabled && !uploading.value && !overLimit.value && (text.value.trim().length > 0 || photoIds.value.length > 0)`. `submit` emits `emit('send', text.value.trim(), photoIds.value)`.

```ts
const onPick = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  photoError.value = null;
  const room = MAX_CHAT_PHOTOS - chips.value.length;
  if (files.length > room) photoError.value = CHAT_PHOTO_COUNT_MESSAGE;
  const started = generation;
  // One at a time, as the project page does: order is kept and phone uploads are more reliable in sequence.
  for (const file of files.slice(0, Math.max(0, room))) {
    const chip: Chip = { key: nextKey++, photoId: null };
    chips.value = [...chips.value, chip];
    try {
      const resized = await resizePhoto(file);
      const photo = await uploadPhoto(props.projectId, resized);
      if (generation !== started) return;
      chips.value = chips.value.map((c) => (c.key === chip.key ? { ...c, photoId: photo.id } : c));
    } catch (e) {
      if (generation !== started) return;
      chips.value = chips.value.filter((c) => c.key !== chip.key);
      photoError.value = hasApiStatus(e, 409) ? CHAT_PHOTOS_FULL_MESSAGE : CHAT_PHOTO_FAILED_MESSAGE;
    }
  }
};

// Removes the photo from the message only; an uploaded photo stays in the project.
const removeChip = (key: number): void => {
  chips.value = chips.value.filter((chip) => chip.key !== key);
};
```

`clear()` also does `chips.value = []; photoError.value = null; generation++;`. `restore(value, ids)` sets the text as now and `chips.value = ids.map((photoId) => ({ key: nextKey++, photoId }))`. The chip removal of a still-uploading chip leaves the upload to finish and be ignored (its chip is gone; the photo stays in the project).

- [ ] **Step 2: `ChatThread.vue`**

In the user block, before the `<p>` bubble:

```vue
        <ul v-if="message.photoIds.length > 0" class="mb-1 flex w-full gap-2 sm:w-auto sm:justify-end" aria-label="Photos">
          <li v-for="photoId in message.photoIds" :key="photoId" class="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
            <AuthedImage :project-id="projectId" :photo-id="photoId" variant="thumb" alt="Photo sent with this message" />
          </li>
        </ul>
        <p v-if="message.content" class="…unchanged classes…">{{ message.content }}</p>
```

Props gain `projectId: string`; import `AuthedImage`. Read `AuthedImage.vue` first: if it renders a visible error state on a failed load, leave it (a deleted photo shows that state); if it exposes an `error` event, hide the `<li>` on it. Say which in the report.

- [ ] **Step 3: `pages/projects/chat/[id].vue`**

- `<ChatThread … :project-id="id" …>` and `<ChatComposer ref="composer" :project-id="id" :disabled="pending" @send="send" />`.
- `send(text: string, photoIds: string[])`: the optimistic row gains `photoIds`; `ask({ text, photoIds }, optimistic)`.
- Both `restore` calls become `restore(optimistic.content, optimistic.photoIds)`.
- `tookQuestion` matches on content as before (a photo-only message has empty content: match on `photoIds` equality when the content is empty — read the function and add that branch).
- Nothing else.

- [ ] **Step 4: Typecheck and suite.** `npx nuxi typecheck 2>&1 | grep -E "ChatComposer|ChatThread|projects/chat"` → nothing; `npx vitest run 2>&1 | tail -6` → green.

- [ ] **Step 5: Hand trace** in the report: (a) pick two photos → two grey chips, each turns into a thumbnail as its upload lands; Send enabled with empty text; (b) tap Send while the second is still uploading → Send is disabled until it lands; (c) send, then pick a photo for the next message while "Thinking…" → the camera is disabled while pending; (d) a photo picked, then × before the upload finishes → the chip goes, the upload completes, the photo is in the project but not on the message; (e) the 26th photo → "This project has all 25 photos."; (f) 409 from a busy reply → text and chips come back; (g) a late upload from a cleared row never attaches (generation).

- [ ] **Step 6: Commit**

```bash
git add components/projects/ChatComposer.vue components/projects/ChatThread.vue pages/projects/chat/[id].vue
git commit -m "feat: photos in the chat composer and thread, uploaded into the project and sent with the message"
```

---

## After the tasks (controller)

1. Final whole-branch Opus review over `main..feat/chat-photos`; one fix wave; one re-review.
2. Docs via `update-docs`: `projects.md` (cap 25 at lines 8 and 159; Project Chat section: photos; limitations), `changelog.md`, `architecture.md` (AI Project Chat: photos, `readPrivateBytes`, flash default), `api-endpoints.md` (body, DTO), `CLAUDE.md`/`README.md` (chat default model), `next-up.md` (the spec's Later list incl. descriptions-at-upload).
3. Pre-approved by David: `npx prisma migrate deploy` (one `ALTER TABLE ADD COLUMN`; recovery `ALTER TABLE "project_chat_messages" DROP COLUMN IF EXISTS "photoIds"; npx prisma migrate resolve --rolled-back 20261009120000_add_chat_message_photos`), then merge, then push. Then the phone test in the spec, and say plainly: no real image went through this code (the spike did), no screen ran in a real browser.
