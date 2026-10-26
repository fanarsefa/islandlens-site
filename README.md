# IslandLens

Landing site for the Forge family: StackForge, BESSForge, CycleForge, CleanForge (planned) and GridForge (islanded systems).

Static HTML and CSS: `index.html` and `style.css`. No build step. On Vercel, import the repository with the "Other" framework preset and no build command.

To change a card, edit the `home-products` section of `index.html`.

## Sign-in log (`/admin`)

`admin.html` is a private page, not linked from the site, that lists who signed in to each Forge product: name, product, code hint, trial or full access, sign-ins, runs, trial runs used, first and last seen, and a feed of recent activity. "Active" means a sign-in or run in the last 30 minutes.

`api/signins.js` reads the shared Forge activity log and checks the admin code. Ten wrong codes from one address lock it out for ten minutes.

| Variable | Value |
| --- | --- |
| `ISLANDLENS_ADMIN_CODE` | Admin code for `/admin`, 12 or more characters. |
| `FORGE_ACTIVITY_REST_URL` | REST URL of the shared Forge activity database (Upstash Redis). |
| `FORGE_ACTIVITY_REST_TOKEN` | Its REST token. |

### Shared Forge activity log

One Upstash Redis database holds the log for the whole family. Set the same `FORGE_ACTIVITY_REST_URL` and `FORGE_ACTIVITY_REST_TOKEN` in every Forge product and in this site. Products keep their own trial counts in their own Redis.

Every product signs in with **Name + Access code** and appends one JSON entry to the list `forge:events` (newest first, `LTRIM` to 20,000) on each sign-in and each counted run:

| Field | Meaning |
| --- | --- |
| `t` | Time, epoch milliseconds |
| `p` | Product: `stackforge`, `bessforge`, `cycleforge`, `gridforge` |
| `e` | `signin` or `run` |
| `n` | Name typed at sign in (printable, single spaced, at most 60 characters) |
| `c` | Code hint: the first `min(4, floor(length / 3))` characters of the code, then `…`. Never the code. |
| `k` | Access: `trial`, `full`, or GridForge's `admin` / `analyst` |
| `u`, `l` | Trial runs used and the limit, on trial `run` entries |

Logging is best effort: a product never blocks a sign-in or a run because the log is unavailable. Names are self-declared, so give each person their own code and use the code hint to confirm who is who.
