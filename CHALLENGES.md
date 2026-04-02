# Challenges & Iterations

## 1. Mezmo Time Window Dropdown — Added Then Reverted

**Attempted:** Added a configurable time window dropdown to the Mezmo logs section, mirroring the Sentry `±N minutes` dropdown.

**Why it was reverted:** Unlike Sentry — where the window meaningfully changes which issues surface — the Mezmo log window is already scoped to the exact span's start time and duration (`spanStart − 30s` to `spanStart + duration + 30s`). Making the buffer configurable would just add noise (unrelated logs) without providing useful signal. The window is inherently defined by the trace itself.

**Lesson:** Configurable windows only make sense when the correlation is fuzzy (Sentry). When the window is already exact (Mezmo), a dropdown adds complexity without value.

---

## 2. Too Few Traces Per Page

**Problem:** Only ~13 traces were showing before pagination, leaving most of the screen empty. The footer showed "13 traces (1000 spans)".

**Root cause:** Datadog's Spans Search API has a hard max of 1000 spans per request. With each trace averaging 40–70 spans, 1000 spans only produced ~13–15 trace groups.

**Fix:** The backend (`/api/traces`) now auto-paginates Datadog up to 3 pages (3000 spans) per UI page request, yielding ~40–50 traces. It stops early if a page returns fewer than 1000 spans or has no next cursor — so quiet time windows don't make unnecessary extra requests.

```ts
// src/app/api/traces/route.ts
const MAX_PAGES = 3;
for (let i = 0; i < MAX_PAGES; i++) {
  // fetch one DD page
  if (!lastCursor || pageSpans.length < limit) break;
}
```

The `nextCursor` returned to the UI is from the last DD page fetched, so the Next/Prev buttons continue correctly.

---

## 3. Redundant Sentry & Mezmo Re-fetches

**Problem:** Every time a span was selected, both Sentry issues and Mezmo logs were re-fetched from scratch — even if the same span had been viewed moments before.

**Fix:** Added module-level `Map` caches in `useSentryIssues.ts` and `useLogs.ts`. Cache keys are the full query param strings, so they're naturally unique per span. Cache hits are synchronous (no loading state, no flicker).

| Hook | Cache key fields |
|---|---|
| `useLogs` | `from + to + env + size` |
| `useSentryIssues` | `resource + env + from + window` |

Changing the Sentry time window dropdown busts the cache naturally (new `window` value = new key). No explicit invalidation needed since historical span data doesn't change.

---

## 4. Datadog — Wrong API Endpoint

**Problem:** `GET /api/v1/services` returned `{"errors": ["Not found"]}`.

**Root cause:** That endpoint doesn't exist. Span search in DD v2 is a POST.

**Fix:** Switched to `POST /api/v2/spans/events/search`.

---

## 5. Datadog — Service Name Not What We Expected

**Problem:** `service:is-unifiedxp` returned empty data.

**Root cause:** DD auto-tags service names from Kubernetes labels. Production registers as `is-unifiedxp-production`. Staging had no DD data at all because `DD_SERVICE`/`DD_ENV`/`DD_VERSION` were not set in the staging workflow (they were already set via Porter env groups, not the GH workflow).

**Fix:** Use `is-unifiedxp-production` as the service name. Reverted the redundant workflow changes.

---

## 6. Datadog — Filter Syntax & Operation Name

**Problem:** `service:is-unifiedxp-production@span.kind:server` returned empty results.

**Root cause 1:** DD filter syntax requires a space before `@`-prefixed tags.

**Root cause 2:** `span.kind` wasn't the right tag anyway. The correct filter for inbound route spans is `@operation_name:next.request`.

**Fix:** `service:is-unifiedxp-production @operation_name:next.request`.

---

## 7. Mezmo — Wrong Token Type

**Problem:** An `sts_`-prefixed token gave `{"error":"Service Key Validation Error: Invalid or deactivated servicekey"}`.

**Root cause:** `sts_` tokens are service-to-service tokens for Mezmo's newer API, not classic Service Keys. The `/v1/export` endpoint requires a plain hex Service Key.

**Fix:** DevOps generated a proper Service Key from Mezmo Settings → Organization → API Keys.

---

## 8. Mezmo — Wrong Auth Header Format

**Problem:** Sending the key as `servicekey: KEY` returned `NotAuthorized`.

**Root cause:** Mezmo `/v1/export` uses HTTP Basic auth with the key as the username and an empty password.

**Fix:** Changed to `Authorization: Token KEY` (or equivalently `-u "KEY:"` in curl).

---

## 9. Mezmo — `log.level` Not Always a String

**Problem:** After wiring in Mezmo logs, a runtime TypeError occurred accessing `LOG_LEVEL_COLORS[log.level]`.

**Root cause:** Some Mezmo log lines return `level` as a non-string or omit it entirely.

**Fix:** Added a `parseLevel` guard in the API route to normalize `level` to a lowercase string with a fallback of `'info'`.

---

## 10. Sentry — Project Slug vs Numeric ID

**Problem:** `GET /api/0/projects/invoice-simple/is-unifiedxp/` returned `{name: null}`.

**Root cause:** The project slug in the URL was wrong. The actual Sentry project URL uses a numeric ID (`4509010820268032`).

**Fix:** Switched to the organizations issues endpoint with the numeric project ID: `/api/0/organizations/invoice-simple/issues/?project=4509010820268032`.

---

## 11. Sentry — Token Scope Confusion

**Problem:** Multiple "permission denied" errors iterating through token types.

**Root cause / iterations:**
- `org:read` was required for listing projects but not available on our initial token
- Organization Tokens have a write-focused scope set (`org:ci`) — can't read issues
- Personal Tokens can get `project:read` + `event:read` but require the right Sentry UI path

**Fix:** Used a Personal Token (or Internal Integration token) with `project:read` + `event:read`. Skipped the projects-listing endpoint entirely since we already had the numeric project ID from the Sentry URL.

---

## 12. Datadog — Span Count Mismatch (56 vs 68)

**Problem:** The dashboard showed 56 spans for a trace; Datadog showed 68.

**Root cause:** Querying `service:is-unifiedxp-production` filters out spans from other services called within the same trace (`is-parse-server`, `is-api`, `flagsmith`, etc.).

**Status:** Open. Fix requires a second fetch by `trace_id:XXXX` with no service filter to pull cross-service spans.

---

## 13. Span Labels Showing "POST POST"

**Problem:** Some span rows displayed "POST POST" as the name.

**Root cause:** When DD only captures the HTTP method and not the full path, `resource_name` equals the method string (e.g., `"POST"`). The display code prepended the method again.

**Fix:** In `traces/route.ts`, fall back to the `http.url` pathname when `resource_name` is just an HTTP verb. In `TraceGroupRow`, suppress the method prefix when `resource === method`.

---

## 14. Mezmo Deep-Link Time Range Params Not Honored

**Problem:** The "Open in Mezmo ↗" link always opened at the latest logs, ignoring `from`/`to` URL params.

**Root cause:** Mezmo's web viewer does not honor `from`/`to` query parameters on saved view URLs — it always loads at "latest."

**Status:** Open / accepted limitation. The link is still useful as a service+env shortcut but cannot jump to the exact time window.

---

## 15. Trace Row Showing `error` When Root Request Returned 200

**Problem:** A checkout trace row showed `error` status and a red code badge, but opening the full trace in Datadog showed the root request returned 200. The error was coming from a Sentry ingest child span (`/api/4509010820268032/envelope/ 429`).

**Root cause — two compounding issues:**

1. **Wrong primary span** — primary was selected as the longest-duration span. On a checkout page load, the longest span was often an internal API call (e.g. `/api/v1/identities/`) rather than the root user-facing request. So the displayed status/code reflected an internal span, not what the user actually saw.

2. **worstStatus/worstCode promoted to row level** — the row showed `worstStatus` and `worstCode` directly, which picked up child span failures (Sentry 429, internal 500s) and displayed them as the primary outcome even when the root span was fine.

**Fix:**
- Changed primary span selection to `parentId === null` (root span), falling back to longest only if no root is found.
- Row now shows `primary.status` / `primary.statusCode` as the main badge. `worstStatus` / `worstCode` appear as smaller secondary badges (`·error`, `+429`) only when they differ from primary — indicating a child failure without misrepresenting the root outcome.
- Secondary badge color derived from `worstCode` (yellow for 4xx, red for 5xx) so a Sentry 429 reads yellow rather than red.

---

## 16. Category Misclassification — Wrong Spans Appearing in Sentry / Next.js Tabs

**Problem (a):** `/(authenticated)` page-load traces were appearing in the **Sentry** category tab instead of Next.js/Landing.

**Root cause:** `classifyGroup` scanned all spans in a group and picked the highest-priority category among them. Every `/(authenticated)` trace contains a Sentry envelope child span (the SDK reporting errors); since `sentry` was checked before `nextjs` in the priority list, the whole group was classified as Sentry.

**Problem (b):** `/api/4509010820268032/envelope/` traces were appearing in **Next.js** instead of Sentry.

**Root cause:** The envelope trace groups contained `/_next/` child spans; `nextjs` priority was higher than `sentry`, so Next.js won.

**Fix:** Changed category classification to use `classifyResource(primary.resource)` — the primary span's resource only — instead of scanning all spans. The group is what its entry point is. This eliminated cross-category bleed entirely and made the classification predictable.

**Bonus fix:** Datadog `resource_name` often includes the HTTP method prefix (e.g. `"GET /auth"`, `"POST /monitoring"`). A `normalizePath` helper strips the leading `METHOD ` before all pattern checks, so `resource === '/auth'` correctly matched `"GET /auth"`.
