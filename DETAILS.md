# O11y Dashboard — Technical Details

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Browser (React)                     │
│                                                         │
│  useTraceFilters ──► useTraces ──► TraceGroupRow list   │
│                          │                              │
│                    (span selected)                      │
│                          │                              │
│              ┌───────────┴───────────┐                  │
│           useLogs              useSentryIssues          │
│              │                      │                   │
└──────────────┼──────────────────────┼───────────────────┘
               │                      │
        /api/logs              /api/sentry-issues
               │                      │
           Mezmo API              Sentry API
```

```
Browser → /api/traces → Datadog Spans Search API
         (up to 3 pages × 1000 spans, cursor-based)
```

---

## 1. Datadog Fetch

**File:** `src/app/api/traces/route.ts`

### Query

```ts
// Derived from ?service=is-unifiedxp-production&hours=1
const resolvedQuery = `service:${service} env:${envSuffix}`;
const from = new Date(now - hours * 3600_000).toISOString();
const to   = new Date(now).toISOString();
```

The query hits `POST https://api.datadoghq.com/api/v2/spans/events/search` with `sort: '-timestamp'` and `page: { limit: 1000, cursor? }`.

### Auto-pagination

```ts
const MAX_PAGES = 3;
for (let i = 0; i < MAX_PAGES; i++) {
  // fetch one DD page
  allSpans.push(...pageSpans);
  if (!lastCursor || pageSpans.length < limit) break; // stop early if partial page
}
return { spans: allSpans, nextCursor: lastCursor };
```

Each UI "page" accumulates up to 3000 spans before returning. The `nextCursor` from the last DD page is passed back to the UI for the Next button.

> **Note:** The `service:` filter means only spans originating from `is-unifiedxp-*` are returned. A trace that calls `is-parse-server`, `is-api`, or `flagsmith` will appear to have fewer spans here than in Datadog's full trace view (e.g. 56 vs 68). A full trace fetch would require a second query by `trace_id:XXXX` with no service filter — not yet implemented.

### Span Mapping (`toSpan`)

```ts
// DDSpanAttributes → Span
resource:   resource_name (falls back to URL pathname if DD only captured HTTP method)
method:     custom.http.method
statusCode: custom.http.status_code
status:     attributes.status
durationMs: custom.duration / 1_000_000  (nanoseconds → ms)
startTime:  start_timestamp
ddLink:     `https://app.datadoghq.com/apm/trace/${traceId}`
env:        attributes.env (falls back to service name suffix)
url:        custom.http.url
```

The resource name fallback:
```ts
const resource = HTTP_METHODS.has(rawResource.trim())
  ? (a.custom?.http?.url ? new URL(a.custom.http.url).pathname : rawResource)
  : rawResource;
```

---

## 2. Trace Grouping & Displayed Attributes

**File:** `src/hooks/useTraces.ts`

Spans are grouped client-side by `traceId`:

```ts
const map = new Map<string, Span[]>();
for (const s of statusFilteredSpans) {
  const group = map.get(s.traceId) ?? [];
  group.push(s);
  map.set(s.traceId, group);
}
```

Each `TraceGroup` computes:

```ts
primary:     root span (parentId === null); falls back to longest durationMs if no root found
worstStatus: 'error' if any span.status === 'error', else 'warn' if any warn, else 'ok'
worstCode:   Math.max(...all non-null statusCodes)
startTime:   earliest span.startTime across all spans in group
category:    classifyResource(primary.resource)  // based on primary span only
```

The primary span is the root of the trace (entry-point request). Using the longest span as primary was incorrect — it could be an internal API call, masking the real user-facing outcome.

### What's Displayed per Row (`TraceGroupRow`)

| Column | Value |
|---|---|
| Status badge | `primary.status` + secondary `·worstStatus` badge if worse |
| Method | `primary.method` |
| Resource | `primary.resource` |
| Span count | `group.spans.length` |
| Duration (ms) | `primary.durationMs` |
| HTTP code | `primary.statusCode` + secondary `+worstCode` badge if worse and ≥ 400 |
| Env | `primary.env` |
| Time | `group.startTime` (locale time) |

The secondary status badge color is derived from `worstCode` (yellow for 4xx, red for 5xx), not from `worstStatus` — so `·error` turns yellow when caused by a 429, not red.

### What's Displayed in the Detail Panel (`TraceDetailPanel`)

When a span is selected (clicking a row or a span in the waterfall):
- Resource, URL (clickable), Method, Duration, Status, HTTP Code, Start time, Trace ID
- "Open full trace in Datadog" link
- Mezmo logs section
- Sentry issues section

### Waterfall View (`WaterfallView`)

```ts
// Builds parent-child tree from parentId links
// Offset and width as % of total trace duration
const offsetPct = ((s.startTime - traceStart) / totalDuration) * 100;
const widthPct  = (s.durationMs / totalDuration) * 100;
```

Bar colors: teal = ok, yellow = 4xx/warn, red = error/5xx.

---

## 3. Mezmo Correlation

**Files:** `src/hooks/useLogs.ts`, `src/app/api/logs/route.ts`

### Time Window

Anchored to the **primary span** (`selected`):

```ts
const start    = new Date(span.startTime).getTime();
const BUFFER   = 30_000; // ms
const window   = {
  from: start - BUFFER,
  to:   start + Math.max(span.durationMs, 1000) + BUFFER,
  env:  span.env,
};
```

### Cache

```ts
const cache = new Map<string, LogLine[]>(); // module-level, lives for browser session

const cacheKey = params.toString(); // "from=...&to=...&env=...&size=100"
if (cache.has(cacheKey)) { setLogs(cache.get(cacheKey)!); return; }
```

### API Call

`GET /api/logs?from={epochMs}&to={epochMs}&env={env}&size=100`

Backend calls `https://api.mezmo.com/v1/export` with:
```ts
{ from, to, size, query: 'unifiedxp', tags: env } // tags = 'staging' or 'production'
```

Response is NDJSON, parsed into `LogLine[]` and sorted by timestamp.

### Mezmo UI Link

```ts
// LogsSection.tsx
const base   = env === 'production' ? MEZMO_PROD : MEZMO_STAGING;
const params = new URLSearchParams({
  from: String(Math.floor(window.from / 1000)), // epoch seconds
  to:   String(Math.floor(window.to   / 1000)),
});
return `${base}?${params}`;
```

The `from`/`to` params are constructed but **Mezmo's web viewer does not honor them** — saved view URLs always open at "latest" regardless. The link is still useful as a one-click shortcut to the correct service+env view. No workaround was found in Mezmo's URL scheme.

### Client-side Search & Filter

**File:** `src/components/LogsSection.tsx`

Applied entirely in the browser against the already-fetched `LogLine[]` — no extra API calls.

**Level filter** — pill buttons toggle `levelFilter` state; `'all'` is the default:

```ts
const filteredLogs = logs.filter((log) => {
  const matchesLevel  = levelFilter === 'all' || log.level === levelFilter;
  const matchesSearch = !search || log.message.toLowerCase().includes(search.toLowerCase());
  return matchesLevel && matchesSearch;
});
```

**Search highlight** — the message is split on the search term using a capture-group regex; matched portions land at odd indices and are wrapped in a `<mark>`:

```ts
const highlightMatch = (text: string, query: string) => {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts   = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded-sm">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </>
  );
};
```

Both controls are hidden while logs are loading or when the panel is empty — they only appear once logs are present.

---

## 4. Sentry Correlation

**Files:** `src/hooks/useSentryIssues.ts`, `src/app/api/sentry-issues/route.ts`

### Time Window

Symmetric `±windowMinutes` around span start (default 5, adjustable via dropdown):

```ts
// useSentryIssues.ts
params = {
  resource: selected.resource,
  env:      selected.env,
  from:     selected.startTime (epoch ms),
  window:   windowMinutes,
};
```

Backend calculates:
```ts
const windowMs = windowMinutes * 60_000;
const filter   = `lastSeen:>${from - windowMs} lastSeen:<${from + windowMs}`;
// Full Sentry query:
// is:unresolved <pathHint> lastSeen:>... lastSeen:<...
```

`pathHint` is extracted from the resource:
```ts
// e.g. "GET /checkout/[documentId]/success" → "/checkout/"
const pathHint = resource.replace(/\[.*?\]/g, '').split('/').slice(0, 3).join('/');
```

### Cache

Same pattern as Mezmo — module-level `Map` keyed on `resource+env+from+window`.

```ts
const cache   = new Map<string, SentryIssue[]>();
const cacheKey = params.toString(); // "resource=...&env=...&from=...&window=..."
```

---

## 5. Filters

### Service Dropdown & Time Window

**File:** `src/hooks/useTraceFilters.ts`

```ts
type FilterState = { service: string; hours: string };
```

- **Service** — sets the `service:` tag in the Datadog query. The `env:` tag is derived from the suffix: `is-unifiedxp-production` → `env:production`.
- **Hours** — `1 | 3 | 6 | 12 | 24`. Computes `from = now - hours * 3600s`.

Both trigger a full re-fetch from Datadog (resets cursor stack). The **Refresh button** also triggers a re-fetch without changing filters. Status filter and category bar are purely client-side — they never hit the network.

### Status Filter

**File:** `src/hooks/useTraces.ts`

Client-side, applied after fetching:

```ts
if (statusFilter === 'ok')    return isOk;
if (statusFilter === 'error') return isError;      // code >= 400 OR status === 'error'
if (statusFilter === '4xx')   return code >= 400 && code < 500;
if (statusFilter === '5xx')   return code >= 500;
```

Filters individual spans; only trace groups that still have matching spans are shown.

### Resource Category Bar

**Files:** `src/lib/classify.ts`, `src/hooks/useTraceFilters.ts`, `src/components/ResourceFilterBar.tsx`

Category is assigned by running `classifyResource` against the **primary span's resource** only (not all spans in the group — scanning all spans caused misclassification, see CHALLENGES.md #17).

```ts
// classify.ts
const normalizePath = (resource: string) => resource.replace(/^[A-Z]+\s+/, '');
// Datadog resource_name often includes the HTTP method prefix (e.g. "GET /auth" → "/auth")

export const classifyResource = (resource: string): ResourceCategory => {
  const path = normalizePath(resource);
  if (path.includes('/checkout/'))               return 'checkout';
  if (path.includes('/report/'))                 return 'report';
  if (path === '/auth' || path.startsWith('/api/auth/')) return 'auth';
  if (path.startsWith('/(') || path === '/')     return 'landing'; // /(authenticated) → landing page
  if (path.includes('/_next/') || ...)           return 'nextjs';
  if (path.includes('sentry.io') ||
      path === '/monitoring' ||                  // Sentry SDK tunnel route
      path.includes('/envelope/'))               return 'sentry';
  return 'other';
};
```

Categories: `checkout | report | auth | landing | nextjs | sentry | other`

The filter bar toggles a `Set<ResourceCategory>`; groups not in the set are hidden. "All" enables every category at once.

### Sentry Time Window Dropdown

**File:** `src/components/SentryIssuesSection.tsx`

```ts
const WINDOW_OPTIONS = [
  { label: '±5m',  value: 5   },
  { label: '±15m', value: 15  },
  { label: '±30m', value: 30  },
  { label: '±1h',  value: 60  },
  { label: '±3h',  value: 180 },
];
```

State lives in `page.tsx` (`sentryWindow`), passed down to `useSentryIssues`. Changing it triggers a new Sentry fetch (cache miss on new `window` value).

---

## 6. Caching

Both `useLogs` and `useSentryIssues` use the same pattern: a module-level `Map` that persists for the browser session.

**Files:** `src/hooks/useLogs.ts`, `src/hooks/useSentryIssues.ts`

```ts
// module level — one per hook file
const cache = new Map<string, LogLine[]>();       // useLogs.ts
const cache = new Map<string, SentryIssue[]>();   // useSentryIssues.ts
```

### Cache Key

```ts
// Mezmo — from useLogs.ts
const params = new URLSearchParams({
  from: String(window.from),   // spanStart - 30s (epoch ms)
  to:   String(window.to),     // spanStart + duration + 30s (epoch ms)
  env:  window.env,
  size: '100',
});
const cacheKey = params.toString();
// e.g. "from=1712000370000&to=1712000431000&env=production&size=100"

// Sentry — from useSentryIssues.ts
const params = new URLSearchParams({
  resource: selected.resource,
  env:      selected.env,
  from:     String(new Date(selected.startTime).getTime()),
  window:   String(windowMinutes),
});
const cacheKey = params.toString();
// e.g. "resource=%2Fcheckout%2F%5BdocumentId%5D&env=production&from=1712000400000&window=5"
```

Because both keys include the exact span timestamp, **two different spans never share a cache entry** — even if they hit the same route. The cache only benefits re-selecting a span you've already viewed.

### Cache Hit Path

```ts
if (cache.has(cacheKey)) {
  setLogs(cache.get(cacheKey)!);   // synchronous — no loading state
  return;
}
// otherwise: fetch → cache.set(cacheKey, result) → setState
```

A cache hit bypasses `setLoading(true)` entirely, so the UI never flickers.

### Cache Invalidation

There is none — the cache is append-only for the session. This is intentional: observability data for a past span doesn't change. The only natural "bust" is the **Sentry window dropdown** — changing `windowMinutes` produces a new key, so a fresh fetch is made.

Datadog traces have **no client-side cache** (`cache: 'no-store'` on the fetch) since they reflect live/recent data and are always re-fetched on filter changes or pagination.

---

## 7. Pagination

**Files:** `src/hooks/useTraces.ts`, `src/app/api/traces/route.ts`

```
UI "Next" click
  → passes nextCursor to /api/traces?cursor=<cursor>
  → backend uses cursor on first DD page, then continues auto-paginating from there
  → returns new spans + new nextCursor

UI "Prev" click
  → pops cursorStack, re-fetches from that cursor
```

```ts
// useTraces.ts
const [cursorStack, setCursorStack] = useState<string[]>([]);

const onNext = () => {
  setCursorStack(s => [...s, nextCursor!]);
  load(filters, nextCursor!);
};

const onPrev = () => {
  const stack = [...cursorStack];
  stack.pop();
  load(filters, stack.at(-1)); // undefined = first page
  setCursorStack(stack);
};
```

The cursor is Datadog's opaque `meta.page.after` string. There is no total page count — Next is hidden when `nextCursor` is null after the 3-page auto-fetch.
