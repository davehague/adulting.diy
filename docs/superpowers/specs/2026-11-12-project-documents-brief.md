# Project documents: brief for the design session

Written 2026-11-12 at the end of the "flesh-out-projects" session. This is a brief, not a spec: it records what David asked for, what exists, the one constraint that shapes the design, and the questions the brainstorm has to settle. Write the spec from it.

## What David asked for

A **Documents** section on a project page, so files that are not photos live with the project. The trigger: four contractor brief PDFs were made for real household projects and there was nowhere in Adulting.DIY to put them. Quotes and contracts from contractors are coming next (the back porch addition has four contractors bidding). His words: "go ahead with the documents section".

## What exists to build on

- **Photos** are the model to copy. `server/services/ProjectPhotoService.ts` (add, read, delete, caps, the race re-count after insert), routes under `server/api/projects/[id]/photos*`, the `ProjectPhoto` model in `prisma/schema.prisma`, and `components/projects/PhotoUploader.vue`.
- **Storage** is the private Vercel Blob store through `server/utils/blob-storage.ts`, the only module that talks to Blob. `putPrivate` hardcodes `contentType: 'image/jpeg'`, so it needs a content type parameter. Local dev and production share one store, so a local upload is a real upload (see CLAUDE.md on `BLOB_READ_WRITE_TOKEN` and never adding `BLOB_STORE_ID`).
- **The uploader** gained a drag-and-drop zone and HEIC support on 2026-11-10 (commit 0fe3df5). A documents uploader can reuse its drop handling.
- **Machine ingest** with the household API key exists for projects and tasks (`docs/tech/project-task-ingest.md`). A documents ingest route would let an agent attach PDFs without a browser.
- Photos go to the AI (suggestions, plan, chat) only where `server/utils/*-prompts.ts` say so. Documents should not reach any model unless the spec decides otherwise.

## The constraint that shapes the design

Photos are shrunk in the browser to stay under 3 MB and posted through a Nuxt server route. Documents cannot be shrunk, and the four briefs are already 2.5 to 3.5 MB; a contractor's scanned quote can be far larger. Vercel serverless functions cap the request body (4.5 MB at last check; verify the current limit). So large files likely need Vercel Blob's client upload (the browser uploads straight to Blob after the server issues a token and checks auth), not the photo route's multipart post. Settle this first; it decides the routes.

## Questions for the brainstorm

1. Which file types: PDF only, or also Word, Excel and images that are not project photos?
2. Size cap per file and count cap per project.
3. Viewing: open in a new tab, download, or an inline preview?
4. Naming: keep the uploaded file name, allow rename, and add an optional note ("Owens quote, Nov 2026")?
5. Where the section sits on the project page, and whether the project card or list shows a document count.
6. Delete: anyone in the household, with a confirmation, matching photos?
7. Does the API-key ingest get a documents route in this slice?
8. Should a document ever be linked to a provider on the project (a quote belongs to a contractor)? Probably a later slice; decide explicitly.

## After it ships

Upload the four brief PDFs to their projects (the household is c0323ab8-4e8e-4ddc-9b2e-4837d8d81ef9):

| PDF in ~/Downloads | Project |
|---|---|
| Back porch and lower room brief.pdf | 63d93d9c-b086-458b-81f2-b844599497fe |
| Kitchen update brief.pdf | 3b2f3af3-c1f1-48a7-8f46-623ea18c7923 |
| Front patio brief.pdf | 7930f054-e795-4d39-bf60-6070eedcf205 |
| Mudroom brief.pdf | f36cc6ff-3043-418e-a9de-05b8efd24555 |

The PDFs are rebuilt from `~/Downloads/house-projects/_brief-builder` (see its README); re-upload after any rebuild.

## How David wants the work run

Brainstorm one question at a time with a recommendation; no code before he approves a written spec and a written plan. Run the `feature-impact-analysis` skill against `docs/functionality/` before building and `update-docs` after. The schema change, the migration, the merge and the push each need his explicit go. End with exact phone and desktop test steps.
