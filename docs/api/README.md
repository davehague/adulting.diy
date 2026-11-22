# Using the Adulting.DIY API

The household API lets a script or an agent do what a household member does on the site: add providers, create projects and tasks, and finish a project (read it, update it, work its checklist, attach and tidy its documents and photos). There is no client library on purpose: call the HTTP routes directly. This page is the front door; the full contracts are in [project-task-ingest.md](../tech/project-task-ingest.md) (projects, steps, files, tasks) and [provider-ingest.md](../tech/provider-ingest.md) (providers, categories).

## Before the first call

- **Base URL:** `https://www.adulting.diy/api/ingest`. Always `www`: the bare domain redirects, and most HTTP clients drop the `Authorization` header on the redirect, so the call comes back 401.
- **Key:** a household admin creates one under **Household > Provider settings** (shown once; `adk_` + random characters). Make **one key per caller** (the watcher, a script, an agent setup) and name it after the caller, so each can be revoked alone and its `lastUsedAt` means something.
- **Keep it out of code and repos.** Read it from the `ADULTING_API_KEY` environment variable (or an env file your caller loads). Never print it in logs or paste it into issues.
- **Send it as** `Authorization: Bearer $ADULTING_API_KEY`. Everything you write is attributed to the person who created the key; if they leave the household, writes start answering 403.

## What you can do

| Goal | Call |
|---|---|
| See the household's category names | `GET /categories` |
| Add or update contractors | `POST /providers` |
| Create projects (optionally with steps) | `POST /projects` (batch, 1–100) |
| List projects | `GET /projects` |
| Read one project in full (notes, steps, documents, photos, providers) | `GET /projects/{id}` |
| Change title, location, status, path or notes; add a paragraph to the notes | `PATCH /projects/{id}` (`notesAppend` adds a paragraph) |
| Delete a project | `DELETE /projects/{id}` |
| Add checklist steps | `POST /projects/{id}/steps` (batch; skips text that matches an unchecked step) |
| Edit, check off or remove a step | `PATCH` / `DELETE /projects/{id}/steps/{stepId}` |
| Attach a document (PDF, Word, Excel, JPEG, PNG, ≤ 25 MB) | three calls: `POST .../documents/upload-url`, `PUT` the file, `POST .../documents` |
| Rename, re-note or remove a document | `PATCH` / `DELETE /projects/{id}/documents/{documentId}` |
| Add a photo (JPEG, plus a thumbnail) | `POST /projects/{id}/photos` (multipart; send a `photoId`) |
| Remove a photo, or set the order and cover | `DELETE /projects/{id}/photos/{photoId}`, `PUT /projects/{id}/photos/order` |
| Create recurring or one-time tasks | `POST /tasks` (batch) |

## Rules that save you a debugging session

1. **Read before you write.** `GET /projects/{id}` shows what is already there, with ids. Use it to avoid duplicates and to confirm your writes.
2. **Batches answer 200 even when items fail.** Check `created`, `skipped` and `errors` in the response; `index` is the item's position in your request.
3. **Retries are safe** on every route except a photo POST without a `photoId`. Always send a `photoId` (a UUID you generate and keep) so a retry after a lost response returns the same photo instead of a copy.
4. **A second DELETE answers 404.** Treat that as done.
5. **PATCH bodies are strict.** An unknown field (`note` for `notes`, `estimate` for `estimateMinutes`) is a 400, not silently ignored. `{}` is a 400 too.
6. **Replacing a document** is upload the new one, then delete the old one. There is no in-place replace.
7. **Setting the cover** means listing every photo id, cover first, in `PUT .../photos/order`.
8. **Deleting a project is a soft delete** that leaves its files in storage. If a script made a project only to test, delete its documents and photos first.
9. **Checking off the last step does not mark the project Done.** Set `status` yourself if that is what you mean.

## A helper to copy

Standard library plus Pillow (for the photo JPEGs). Copy it into your script; it is the whole client.

```python
import io, json, os, urllib.request, uuid
from PIL import Image, ImageOps

API = "https://www.adulting.diy/api/ingest"
KEY = os.environ["ADULTING_API_KEY"]

def call(method, path, body=None, raw=None, headers=None):
    url = path if path.startswith("http") else API + path
    h = {"Authorization": f"Bearer {KEY}"} if url.startswith(API) else {}
    if body is not None:
        raw, h["Content-Type"] = json.dumps(body).encode(), "application/json"
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, data=raw, method=method, headers=h), timeout=120) as r:
        text = r.read().decode()
        return json.loads(text) if text else {}

def upload_document(project_id, path, name=None, note=None):
    grant = call("POST", f"/projects/{project_id}/documents/upload-url", {"fileName": os.path.basename(path)})
    with open(path, "rb") as f:  # send every header the grant returns; don't hardcode them
        call(grant.get("method", "PUT"), grant["uploadUrl"], raw=f.read(), headers=grant.get("headers", {}))
    body = {"documentId": grant["documentId"], **({"name": name} if name else {}), **({"note": note} if note else {})}
    return call("POST", f"/projects/{project_id}/documents", body)

def add_photo(project_id, path, photo_id=None):
    photo_id = photo_id or str(uuid.uuid4())  # keep it: resending with the same id is safe
    img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
    def jpeg(edge, quality):
        copy = img.copy(); copy.thumbnail((edge, edge)); out = io.BytesIO(); copy.save(out, "JPEG", quality=quality)
        return out.getvalue(), copy.size
    (full, (w, h)), (thumb, _) = jpeg(2000, 85), jpeg(400, 80)
    b = uuid.uuid4().hex
    part = lambda n, d, f=None: (f'--{b}\r\nContent-Disposition: form-data; name="{n}"' + (f'; filename="{f}"\r\nContent-Type: image/jpeg' if f else '') + '\r\n\r\n').encode() + d + b"\r\n"
    body = part("full", full, "full.jpg") + part("thumb", thumb, "thumb.jpg") + b"".join(part(n, str(v).encode()) for n, v in (("width", w), ("height", h), ("photoId", photo_id))) + f"--{b}--\r\n".encode()
    return call("POST", f"/projects/{project_id}/photos", raw=body, headers={"Content-Type": f"multipart/form-data; boundary={b}"})
```

Example: file research into a project and tidy it.

```python
pid = "…"  # from GET /projects
call("PATCH", f"/projects/{pid}", {"notesAppend": "Plan: …", "path": "hire"})
call("POST", f"/projects/{pid}/steps", {"steps": [{"text": "Call the city"}, {"text": "Get two quotes", "estimateMinutes": 30}]})
new = upload_document(pid, "brief-v2.pdf", name="Brief v2")
old = [d for d in call("GET", f"/projects/{pid}")["documents"] if d["name"] == "Brief v1"]
for d in old: call("DELETE", f"/projects/{pid}/documents/{d['id']}")
photo = add_photo(pid, "yard.jpg")
others = [p["id"] for p in call("GET", f"/projects/{pid}")["photos"] if p["id"] != photo["id"]]
call("PUT", f"/projects/{pid}/photos/order", {"photoIds": [photo["id"], *others]})  # new photo becomes the cover
```

Errors come back as an HTTP error with a JSON `message` (`urllib` raises `HTTPError`; read its body for the message).

## Consumers

Every caller of this API is listed here. When a route changes, update every consumer in the same session and run each once.

| Consumer | Uses |
|---|---|
| Worthington watcher (Skill Library `worthington-watcher`, nightly) | `GET /categories`, `POST /providers` |
| `providers_ingest.py` (scripts-and-agents) | `POST /providers` |
| Agent sessions filing research into a project | projects, steps, documents, photos (ad hoc, from this page) |

Add a row when you add a caller.
