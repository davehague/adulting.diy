# Home projects, slice 5b: photos in the project chat (design spec)

Status: written 2026-10-08 from the brainstorm with David, right after slice 5 (the project chat, `2026-10-08-projects-ai-chat-design.md`) went live. Awaiting his review; the written plan follows his approval.

## Goal

From the chat, take or pick a photo and send it with a question, so the advisor can see what you have opened up. The photo lands in the project's Photos as it would from the project page, so there is one place for pictures and no second upload. The advisor also sees the project's existing photos on every turn, so it knows the job it is looking at.

In David's words (2026-10-08): "you're definitely going to need photos to upload to the model. To give it more context, especially once you open up the inside of whatever you're trying to work on. I don't really want to go back to the project to upload more photos. Is there a way that we can incorporate it into the chat interface so that the photos that we do upload within the chat interface also get added to the project?" And after the first live run, where the advisor answered "I don't see a picture on my end": "We really got to get these pictures in here."

## Decisions made in the brainstorm

1. **What the advisor sees on each message:** the photos attached to that message at full size, plus every other photo of the project as a thumbnail. Earlier messages' photos are covered by the thumbnails; the history stays text with a "(with N photos)" marker.
2. **Capture flow:** a camera button beside the text box opens the phone's camera-or-library picker; each picked photo is shrunk on the phone the usual way and uploads to the project's Photos at once, showing as a thumbnail chip above the box; Send attaches the chips to the message. A photo uploaded but never sent stays in the project. The chip's × removes it from the message, not from the project.
3. **Photo cap raised from 10 to 25 for every project**, on the project page and in the chat alike. The chat says "This project has all 25 photos." when full.
4. **Model:** the chat's default moves to `glm-5.3-flash`, which reads images (`glm-5.3` refuses them with HTTP 400; measured). `AI_CHAT_MODEL` still overrides.

## Out of scope

Photos from the advisor's side (it only reads); a full-size viewer inside the chat (the project page has one); deleting a photo from the chat; sending photos with a retry (a retry resends the row as saved, photos included); videos; photos on assistant rows; any change to how photos are stored.

## Evidence this builds on

Spikes on 2026-10-08 with generated images, nothing from the household:

- A chat message carries `images: [base64, ...]` (Ollama's wire format). `glm-5.3-flash` answered a 64 px test image in 0.9 s; `glm-5.3` returned HTTP 400 "this model does not support image input".
- One 2000×1500 PNG (1.07 MB): 3,949 prompt tokens, 2.3 s. Nine 400×300 images plus three 2000×1500 in one request (4.3 MB body): 13,232 prompt tokens, 3.9 s, HTTP 200, the right answer. Tokens follow pixels, not bytes, so a 3 MB JPEG of the same size costs the same.
- Project photos are stored as a 2000 px full JPEG (≤3 MB) and a 400 px thumbnail (≤200 KB) in the private blob store; the browser makes both before upload (`utils/image-resize.ts`).

## The flow

1. The composer gains a **camera** button (left of the text box). Tapping it opens the phone's picker (camera or library; several at once). Up to 3 photos per message.
2. Each picked photo is resized on the phone (existing `resizePhoto`) and uploaded through the existing project photo upload. While it uploads, a grey chip with a spinner sits above the box; when done, the chip shows the thumbnail with an ×. A failed upload shows "Couldn't add the photo." under the chips and no chip. Send is disabled while an upload is in flight.
3. The project at the cap: the camera button still opens the picker, but a photo that cannot be added shows "This project has all 25 photos." and nothing uploads.
4. Send goes with `{ text, photoIds }`. Text may be empty when at least one photo is attached. The message appears at once with its thumbnails above the text; the chips clear with the box.
5. The server saves the user row with its `photoIds`, reads the attached photos' full images and every other project photo's thumbnail from the blob store, puts them on the user message to the model, and answers as before. The reply is text as before.
6. The thread shows a user message's photos as a row of thumbnails above its text (the same authenticated thumbnail component as the project page). Both members see them.
7. The project page's Photos section shows the new photos next time it loads, in upload order.

## What is sent to the model

Decided in `server/utils/chat-prompts.ts` as before. New:

- The LAST user message (the one being answered) carries `images`: first every other project photo as its thumbnail (position order), then the attached photos at full size, in attachment order. Its text is prefixed with one line the model can rely on: "[Pictures: N small ones are the project's photos; the last M large ones are attached to this message]" followed by the typed text, or "(photo attached, no question)" when the text is empty.
- Earlier user rows with photos are sent as text with the prefix "(with N photos) ". Their images are not resent; the thumbnails cover them.
- A new rule line in the system prompt: "Photos may be attached. Say what you see when it matters, say when the picture is too small or unclear to tell, and never guess a brand or model you cannot read."
- Never sent: photo ids, file names, paths, the photographer.

A photo whose blob cannot be read is left out and counted in the log line; the ask goes on without it. If the configured model rejects images, the ask fails as any model error does (502, Retry), and the log says so.

## Data model

- `ProjectChatMessage` gains `photoIds Json @default("[]")` — the ordered list of `ProjectPhoto` ids attached to a user row; `[]` on assistant rows. A photo deleted later just drops out of the display (the thumbnail request 404s and the slot is hidden).
- `MAX_PROJECT_PHOTOS` 10 → 25 (`types/project.ts`); the project page's "max photos" message reads 25.
- Migration `20261009120000_add_chat_message_photos`: `ALTER TABLE "project_chat_messages" ADD COLUMN "photoIds" JSONB NOT NULL DEFAULT '[]';` Hand-written, applied before the merge. Recovery: `ALTER TABLE "project_chat_messages" DROP COLUMN IF EXISTS "photoIds"; npx prisma migrate resolve --rolled-back 20261009120000_add_chat_message_photos`.

## API

- `POST /api/projects/[id]/chat` body becomes `{ text?: string; photoIds?: string[] }` or `{ retry: true }`. `text` is 0 to 2,000 characters after trimming; the request needs text or at least one photo (400 "Add a message or a photo" otherwise). `photoIds`: at most 3 (400 "At most 3 photos per message"), each an active photo of this project (404 "Photo not found"). Everything else unchanged.
- `ChatMessageDto` gains `photoIds: string[]`. `GET` returns it.
- The upload stays `POST /api/projects/[id]/photos` (unchanged apart from the cap).

## Settings

- `DEFAULT_CHAT_MODEL` becomes `glm-5.3-flash`. `AI_CHAT_MODEL` is unset in Vercel, so the default applies on deploy. No new settings.

## Code shape

- `types/chat.ts`: `MAX_CHAT_PHOTOS = 3`, the DTO field, the two messages. `types/project.ts`: the cap.
- `server/utils/ollama.ts`: `ChatMessage` gains `images?: string[]` (base64); `callOllamaChat` passes messages through unchanged.
- `server/utils/chat-schemas.ts`: the new body rules.
- `server/utils/chat-prompts.ts`: `buildChatPrompt` takes `photos: { attached: Buffer[]; others: Buffer[] }` (bytes only; it base64-encodes and writes the prefix line) and `ChatHistoryRow` gains `photoCount`.
- `server/services/ProjectChatService.ts`: validates `photoIds` against `projectPhoto` rows of the project; reads blobs through the existing `blob-storage.getPrivate` (full path for attached, thumb path for the rest); saves `photoIds` on the user row; logs `photos 2/11` (attached/total sent).
- `components/projects/ChatComposer.vue`: the camera button, the hidden file input, the chips, upload through `useProjects().uploadPhoto` and `resizePhoto`; emits `send(text, photoIds)`; `clear()` also clears the chips; `restore(text, photoIds)` puts both back.
- `components/projects/ChatThread.vue`: thumbnails above a user message through `AuthedImage` (variant `thumb`), hidden when the image fails to load.
- `pages/projects/chat/[id].vue`: passes `photoIds` through send, the optimistic row and restore; a photo-only message renders without a text bubble.
- `pages/projects/[id].vue`: no change beyond the cap constant.

## Behaviour notes

- A photo added from the chat is a project photo from the moment the upload finishes, even if the message is never sent; there is no draft state for photos.
- Two members attaching at the same time can pass the cap of 25 by the race the project page already has; accepted.
- Retry resends the saved row; its photos go again as attached.
- The chat's deadline (60 s) stays; measured cost is a few seconds per message with photos.
- Everything else about the chat (lock, polling, searches, recovery) is unchanged.

## Testing

Unit tests with mocked Prisma and a mocked blob read: the schema rules (text-or-photo, at most 3, trim); the service (404 for a foreign or deleted photo id, `photoIds` saved, full read for attached and thumb for others, images only on the last user message in the right order, a failed blob read skipped and counted, the history marker, the log line); `chat-prompts` (prefix line text and counts, base64 placement, no ids); `callOllamaChat` passes `images`; the route body shapes; the cap constant. The composer and thread are exercised in the reviewer's harness (chips, upload states, send with photos only, restore) and on David's phone.

## Delivery

Branch `feat/chat-photos` from `main`. Migration applied on David's yes, then merge and push on his yes. No Vercel settings.

## Phone test (after deploy)

1. Open the faucet project's chat. Expected: a camera button left of the box.
2. Tap it, take a photo of the faucet. Expected: a grey chip, then the thumbnail with an ×, above the box; Send enabled even with the box empty.
3. Type "What kind of faucet is this?" and Send. Expected: your message shows the thumbnail above the text; the reply describes what it sees, names the type if it can read it, and says so if it cannot.
4. Go back to the project page. Expected: the photo is in Photos.
5. Send "Is this the same faucet as the other photos?" with no photo. Expected: the advisor answers from the project's existing pictures.
6. Attach two photos, tap × on one, send with text. Expected: one thumbnail on the message; both photos are in the project's Photos.
7. Fill the project to 25 photos (from the project page or the chat). Expected: "This project has all 25 photos." in the chat when adding one more; the project page says the same.
8. Amanda opens the chat. Expected: the thumbnails show on her phone too.

## Later (not designed here)

Tap a chat thumbnail to open the project's viewer; the advisor pointing at a region of a photo; photos on the DIY plan ask; a smaller "model" variant to cut tokens further if usage shows it matters; descriptions written by the model at upload time (David's idea, 2026-10-08), which would let the DIY plan and provider suggestions see photos cheaply, give Photos a readable caption, and bound cost if projects ever carry many more pictures. Measured today, thumbnails cost about as much as a description and keep the detail, so this waits for the ask log to show tokens matter; the cheaper first lever would be sending only the newest N thumbnails.
