# o11y-dashboard

Internal observability dashboard for Invoice Simple. Pulls distributed trace data from **Datadog**, then cross-references each selected span against **Mezmo** (logs) and **Sentry** (errors) for a single-pane debugging view.

![alt text](/images/image-1.png)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy the env example and fill in your credentials:
   ```bash
   cp .env.local.example .env.local
   ```

   - `DD_API_KEY` / `DD_APP_KEY` — from [Datadog API Keys](https://app.datadoghq.com/organization-settings/api-keys)
   - `MEZMO_SERVICE_KEY` — from Mezmo Settings → Organization → API Keys → **Service Keys** (must be a plain hex key — `sts_`-prefixed tokens will not work with `/v1/export`)
   - `SENTRY_AUTH_TOKEN` — from Sentry Settings → Account → API → Personal Tokens (requires `event:read`, `project:read` scopes; `org:read` is NOT needed)

3. Start the dev server (runs on port 3007):
   ```bash
   npm run dev
   ```

## Stack

- **Next.js 15** (App Router)
- **React 19**
- **Tailwind CSS**
- **TypeScript**

---

## Data Flow

All external API calls are made **server-side** inside Next.js Route Handlers — credentials are never sent to the browser.

```
Browser (React hooks)
  → /api/traces         → Datadog   (DD_API_KEY / DD_APP_KEY)
  → /api/logs           → Mezmo     (MEZMO_SERVICE_KEY)
  → /api/sentry-issues  → Sentry    (SENTRY_AUTH_TOKEN)
```

The React hooks (`useTraces`, `useLogs`, `useSentryIssues`) only call your own `/api/*` endpoints. Filtering, grouping, and correlation happen client-side after the data is returned.

---

## How It Works

### Datadog

Queries `POST /api/v2/spans/events/search` for up to **3 pages × 1000 spans** per request, filtered by service name and time window. Spans are grouped client-side by `traceId` into trace groups. The primary span (longest duration) represents each group; worst status/code is rolled up across all spans.

Service names follow a `<name>-<env>` pattern (e.g. `is-unifiedxp-production`). Staging may have no data if `DD_SERVICE`/`DD_ENV` aren't set in the deployment workflow.

### Mezmo

Time window per selected span: `[spanStart − 30s, spanStart + max(duration, 1s) + 30s]`, filtered by env tag. The logs panel includes an **"Open in Mezmo ↗"** link to the correct service+env saved view. Note: Mezmo's web viewer ignores `from`/`to` URL params, so the link opens at "latest" — not the exact time window.

The logs panel has **client-side search and level filtering** — no extra network requests:
- **Level pills** (`ALL | ERR | WARN | INFO | DEBUG`) — hide logs not matching the selected level
- **Search input** — filters to logs whose message contains the query; matching text is highlighted inline

### Sentry

Fuzzy correlation: queries for unresolved issues whose `lastSeen` falls within `±N minutes` of the span start (default ±5m, configurable). Match is based on a partial path prefix extracted from the resource — not a guaranteed 1:1 match to the specific trace.

---

## Overall Features

- **Multi-source single pane** — Datadog traces, Mezmo logs, and Sentry errors correlated in one view per span.
- **Trace grouping** — spans are grouped by `traceId`; the longest-duration span is used as the representative (primary) span for each group.
- **Primary status + child badge** — the row shows the primary span's real status/code (e.g. `ok · 200`); if a child span is worse, a secondary badge is shown (e.g. `·error`, `+429`) rather than promoting the child's status to the row level.
- **Waterfall view** — expand any trace row to see all its spans laid out as a parent-child waterfall with proportional offset and width.
- **Mezmo logs panel** — shows logs in the `[spanStart − 30s, spanStart + duration + 30s]` window, with level pills (`ALL | ERR | WARN | INFO | DEBUG`) and inline-highlighted text search.
- **Sentry issues panel** — fuzzy-matches unresolved Sentry issues by path prefix within a configurable `±N min` window around the span start.
- **Datadog deep link** — "Open full trace in Datadog" button on every selected span.
- **Mezmo deep link** — "Open in Mezmo ↗" shortcut to the correct service+env saved view.
- **Auto-paginated Datadog fetch** — backend fetches up to 3 × 1000 spans per UI page request, yielding ~40–50 trace groups per page.
- **Cursor-based pagination** — Next / Prev buttons navigate Datadog pages using a cursor stack; no total page count needed.
- **Resource category bar** — classifies each trace group into `checkout / reports / nextjs / events / sentry / other`; categories are individually toggleable, and **All** enables or disables all at once.

---

## Status + Code Display

Each trace row shows **two columns**: Status (ok / warn / error) and Code (HTTP status code). Both come from the **root span** (the entry-point request, `parentId === null`). If a child span has a worse outcome, a secondary badge appears inline.

| What you see | What it means |
|---|---|
| `ok` · `200` | Root span succeeded; no child errors |
| `ok` · `200 +429` | Root returned 200; a child span (e.g. Sentry ingest) was rate-limited — **not an app failure** |
| `ok` · `200 +502` | Root returned 200; a downstream internal call failed (e.g. `/api/v1/identities/`) — page likely rendered with a graceful fallback |
| `ok ·error` · `200 +500` | Root returned 200; a child call returned 500 — checkout succeeded but something internal broke |
| `ok ·warn` · `302 +429` | Root redirected (302); a child was rate-limited |
| `error` · `500` | Root span itself failed — the user-facing request errored |
| `error` · `4xx` | Root returned a client error (e.g. 404, 401) |

**Color coding:**
- Secondary status badge (`·error`, `·warn`) uses the **worst child code's color** — yellow for 4xx, red for 5xx — so the severity is visually distinct from the primary status.
- Secondary code badge (`+429`, `+502`) is always the `Math.max` of all child codes, colored the same way.

**Rule of thumb:** if the primary code is `2xx` and the secondary badge is a `4xx` (yellow), it's usually noise (rate limits, Sentry ingest). If the secondary is `5xx` (red), something real broke internally even though the page appeared to load.

---

## Filters

| Filter | How | Re-fetches DD? |
|---|---|---|
| **Service** | Sets the Datadog `service:` query tag; `env:` is derived from the name suffix | Yes — resets cursor |
| **Time window** | `hours` param → `from/to` timestamps on the Datadog query | Yes — resets cursor |
| **Refresh button** | Manually re-runs the current fetch | Yes |
| **Status** | Client-side filter on `ok / error / 4xx / 5xx` | No |
| **Category bar** | Client-side; classifies traces into `checkout / nextjs / events / sentry / other` | No |
| **Sentry window** | Changes the `±N min` search window; re-fetches Sentry on change | No (Sentry only) |
| **Log level** | Client-side pill filter on `error / warn / info / debug` in the Mezmo panel | No |
| **Log search** | Client-side text filter + inline highlight on log messages | No |

---

## Caching

Mezmo and Sentry results are cached client-side in module-level `Map`s (one per hook). Cache lives for the browser session; hits are synchronous with no loading flicker.

| | Cache key |
|---|---|
| **Mezmo** | `from + to + env + size` |
| **Sentry** | `resource + env + from + window` |

Datadog trace fetches are never cached — always live.

---

## Known Limitations

- **Cross-service span gap** — Traces are fetched with a `service:` filter, so only spans originated by that service are returned. Downstream services (`is-parse-server`, `is-api`, `flagsmith`) that participate in the same trace are excluded. This means span counts here will be lower than what Datadog's full trace view shows (e.g. 56 vs 68 spans). A complete trace would require a second fetch using `trace_id:XXXX` with no `service:` filter — not yet implemented.
- **Mezmo deep-link** — "Open in Mezmo ↗" cannot jump to a specific time window; Mezmo's web viewer ignores `from`/`to` URL params on saved view URLs.
- **Sentry correlation is fuzzy** — matched by partial path prefix, not by trace/request ID.

---

## Notes

### Timezone display

All timestamps are shown in the **browser's local timezone** (indicated by the abbreviation in the Time column header, e.g. `PST`, `EST`). API queries to Datadog, Mezmo, and Sentry always use UTC internally — the timezone only affects how times are rendered.

### `POST /api/4509010820268032/envelope/` — Sentry Ingest

This span shows up in traces because the Sentry SDK inside `is-unifiedxp` POSTs captured events to Sentry's ingest API (`/api/{projectId}/envelope/`). The project ID `4509010820268032` is Invoice Simple's Sentry project.

A **429** on this span means Sentry is rate-limiting the ingest — too many events sent in a short window. This is **not an app failure**; the checkout flow still returns 200. It just means some Sentry telemetry was dropped. Common causes on staging:

- Per-project rate limits set lower than production (Sentry Settings → Project → Client Keys)
- A noisy error being thrown repeatedly and exhausting the quota

The trace row will show the primary span's real status (`ok · error`, `200 +429`) rather than promoting the Sentry 429 to the top-level status.

---

## Further Reading

- `DETAILS.md` — full technical breakdown (API shapes, grouping logic, caching internals, pagination)
- `CHALLENGES.md` — issues and iteration cycles encountered during development

---

## Further Work / Improvements

### Multi-service support *(high value)*
Currently hardcoded for `is-unifiedxp` with categories tuned to its routes (Checkout, Reports, Landing, Auth). To support other services (`is-api`, `is-parse-server`, `admin`, etc.):
- Make categories **configurable per service** — each service declares its own route-to-category mapping
- The service selector would load the relevant category set automatically
- `is-api` categories might be: `invoices / estimates / payments / auth / webhooks / other`
- `is-parse-server` might be: `functions / files / users / sessions / other`

### Cross-service span fetch *(high value)*
Traces are currently fetched with a `service:` filter, so only spans originated by the selected service are returned. Spans from downstream services that participated in the same trace (`is-parse-server`, `is-api`, `flagsmith`) are excluded, making span counts lower than what Datadog's full trace view shows. When a trace is expanded, a second fetch using `trace_id:XXXX` with no `service:` filter would pull in all spans for that trace — making the waterfall complete and surfacing errors in downstream services.

### Span-level log + error correlation *(medium value)*
Currently Mezmo and Sentry are correlated against the **selected primary span** only. Expanding a span in the waterfall could fetch logs/errors scoped to that individual child span's time window, letting you drill into exactly which internal call triggered an error.

### Auto-refresh / live tail *(medium value)*
Add an optional polling interval (e.g. every 30s) so the dashboard stays live without manual refreshes — useful when watching a deploy or incident in real time.

### Error rate trend chart *(medium value)*
A small sparkline or bar chart above the trace list showing error rate over the selected time window. Would make it easier to see if errors are spiking or isolated without scrolling through rows.

### Resource text search *(low value)*
Filter the trace list by typing part of a resource path — useful when you know the specific endpoint you're investigating (e.g. filter to only `/checkout/[documentId]/success` rows).

### Datadog monitor alerts panel *(medium value)*
Add a top-bar or sidebar panel showing active Datadog monitors in `Alert` or `Warn` state for the selected service. The Monitors API (`GET /api/v1/monitors?tags=service:{service}`) already works with the existing `DD_API_KEY` / `DD_APP_KEY`. Each entry would show monitor name, status, and a deep link to Datadog. Main prerequisite: monitors must be tagged by service consistently.

### Sentry alert / incident panel *(medium value)*
Surface active Sentry alert rule triggers and open incidents alongside the trace list. Relevant endpoints:
- Alert rules: `GET /api/0/projects/{org}/{project}/alert-rules/`
- Active incidents: `GET /api/0/organizations/{org}/incidents/?status=open`

Requires two new env vars: `SENTRY_ORG_SLUG` and `SENTRY_PROJECT_SLUG`. The project ID (`4509010820268032`) is already visible in traces so the slug is derivable. The existing `SENTRY_AUTH_TOKEN` is sufficient for these endpoints.

### Shareable span deep link *(medium value)*
Encode the selected trace + span into the URL so you can paste a link to a teammate and they land on the exact correlated view — Mezmo logs and Sentry issues already loaded for that span. Datadog already deep-links to spans, but it doesn't show the Mezmo + Sentry correlation. This would be the unique value: one URL that opens this dashboard with a specific span selected and all three panels populated. Would also cover the "Persistent filter state" item below as a by-product.

### Persistent filter state *(low value)*
Sync filters (service, hours, category, status) to URL query params so a specific view can be bookmarked or shared.
