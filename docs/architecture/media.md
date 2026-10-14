# Job photos and videos

Garages and advisors add photos and videos of the customer's car to a service request: the car as it came in, the work in progress, the finished job. Customers see them on their request page.

## Who can do what

| Role | See | Upload | Edit caption / stage / "customer can see" | Delete |
|---|---|---|---|---|
| Super admin | Everything | Yes | Yes | Yes |
| Advisor | Every request (advisors can open any request today) | Yes | Yes | Yes |
| Garage (owner, manager, staff) | Requests whose job is at their garage (or, before the job exists, that are assigned to it) | Yes | No | Only their own upload, within 24 hours (`Media:GarageDeleteWindowHours`) |
| Customer | Their own requests, only items marked "customer can see" | No | No | No |

- Garages can't edit: the owner asked for advisors and admins to manage the gallery. The 24-hour delete lets a garage fix a wrong upload without calling the advisor.
- Garages that only quoted (and were not picked) see nothing. That keeps one customer's car photos away from competing garages.
- Uploads default to "customer can see". Untick it for workshop-only shots. An advisor can hide or show any item later.
- Upload, edit and delete are written to the audit log (`MEDIA_UPLOADED`, `MEDIA_UPDATED`, `MEDIA_DELETED`).
- Delete is soft: the row is kept with `IsDeleted` so the audit log still points at it, and the file stays on disk. Nobody can see or stream it any more.

## Files and limits

- **Photos:** JPG, PNG, WebP, HEIC. Up to 10 MB each.
- **Videos:** MP4, MOV, WebM. Up to 100 MB each.
- **At most 30** photos and videos per request (`Media:MaxItemsPerRequest`).
- The API reads each file's first bytes (magic numbers) and checks that the name and the type the browser sent agree with them. A renamed HTML file, a PNG called `.jpg` or a GIF is refused with a 400 and a message the uploader can understand.
- The browser makes a small JPEG preview (a scaled photo or the first frame of a video) and sends it with the upload. Galleries load these previews instead of full photos, which matters on phone data. When the browser can't decode a file (e.g. HEIC outside Safari), there is no preview and the original is shown.
- HEIC photos display only in Safari. Other browsers show a tile with a link to open or download the original.

## Storage

- Files are saved under `Media:StoragePath` (default `data/media` under the API's content root, never under `wwwroot`), as `yyyy/MM/<random>.<ext>`. The name the customer's phone gave the file is only stored as text for display.
- In Docker the folder is `/app/data/media`, kept in the named volume **`broco-mod-media`** (see `docker-compose.yml`). **Back it up with the database** (e.g. `docker run --rm -v broco-mod-media:/data -v $PWD/backups:/backups alpine tar czf /backups/media-$(date +%F).tgz -C /data .`).
- Everything goes through `IMediaStorage` (`LocalDiskMediaStorage` today). Moving to S3 or Cloudflare R2 means a new implementation of that interface; the streaming endpoint would then redirect to a pre-signed bucket URL instead of sending the file itself.

## How pictures load without the login token

The web app keeps the login token in `localStorage`, which `<img>` and `<video>` tags can't send. So every list response carries **signed links**:

```
/api/v1/media/{id}/content?exp=<unix seconds>&sig=<audience>:<HMAC>
```

- The HMAC-SHA256 covers the media id, the expiry and the audience (`c` customer or `s` staff). The key is `Media:SigningKey`, or, when that is empty, a key derived from `Jwt:Secret`.
- Links last about an hour (`Media:UrlLifetimeMinutes`, rounded up to 15 minutes so the same URL repeats and the browser can cache the file). The gallery fetches fresh links when an old one stops working.
- A customer's link stops working as soon as the item is hidden from customers or deleted. A bad, expired or tampered link gets **403**.
- The endpoint supports HTTP range requests, so videos seek and play on phones. It sends `X-Content-Type-Options: nosniff`, a sandbox CSP, and the content type found from the file's bytes, never the one the browser sent.

## API

All under `/api/v1/media`, signed-in users only, except the content link.

| Method and path | What it does |
|---|---|
| `GET requests/{requestId}` / `GET jobs/{jobId}` | List with signed links, `canUpload`, `canEdit`, `remainingSlots` and the limits |
| `POST requests/{requestId}` / `POST jobs/{jobId}` | Upload one file as `multipart/form-data`: `file`, optional `caption` (500 characters), `stage` (Before, During, After, Inspection, Other), `isVisibleToCustomer`, `thumbnail` |
| `PATCH {id}` | `{ caption?, stage?, isVisibleToCustomer? }` (advisor, admin) |
| `DELETE {id}` | Soft delete |
| `GET {id}/content?exp=&sig=[&thumb=1]` | Stream the file or its preview (no login, signed link) |

Uploads are one file per request so the app can show progress for each and retry just the one that failed. The API accepts request bodies up to 105 MB on the upload routes; Nginx allows 110 MB and 5-minute timeouts on `/api/v1/media/` only.

## Configuration (`Media` section)

| Key | Default |
|---|---|
| `StoragePath` | `data/media` (Docker: `/app/data/media`) |
| `SigningKey` | empty (derived from `Jwt:Secret`); env `MEDIA_SIGNING_KEY` in `.env` |
| `UrlLifetimeMinutes` | 60 |
| `MaxPhotoBytes` / `MaxVideoBytes` | 10 MB / 100 MB (videos can't go above the 105 MB request limit without a code change) |
| `MaxItemsPerRequest` | 30 |
| `GarageDeleteWindowHours` | 24 |

## Screens

- **Garage → Jobs → job:** "Photos & videos" card with Add (camera, video or gallery on phones).
- **Advisor → Requests → request** and **Advisor → Jobs → job:** add, edit caption and stage, hide from or show to the customer, delete.
- **Admin → Requests → request:** the same as the advisor.
- **Customer → My requests → request:** view only, with a full-screen viewer (swipe or arrow keys, Escape to close).
