import { NextRequest, NextResponse } from 'next/server';

const SENTRY_TOKEN = process.env.SENTRY_AUTH_TOKEN ?? '';
const SENTRY_ORG = 'invoice-simple';
const SENTRY_PROJECT_ID = '4509010820268032';
const SENTRY_BASE = 'https://sentry.io/api/0';

export type SentryIssue = {
  id: string;
  shortId: string;
  title: string;
  culprit: string;
  level: string;
  priority: string;
  count: string;
  userCount: number;
  lastSeen: string;
  firstSeen: string;
  permalink: string;
};

// Converts a Datadog resource_name to a path prefix suitable for a Sentry issue search.
// Sentry culprit strings use short path prefixes, not full parameterised paths, so
// we strip the method and keep only the first segment.
// Example: "GET /checkout/[documentId]/success" → "/checkout"
const resourceToPathQuery = (resource: string): string => {
  // Strip HTTP method prefix if present
  const path = resource.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
  // Take the first path segment only — Sentry culprits rarely go deeper
  const segments = path.split('/').filter(Boolean);
  return segments[0] ? `/${segments[0]}` : path;
};

export const GET = async (req: NextRequest) => {
  if (!SENTRY_TOKEN) {
    return NextResponse.json({ error: 'SENTRY_AUTH_TOKEN is required' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const resource = searchParams.get('resource') ?? '';
  const env = searchParams.get('env') ?? 'production';
  const limit = Math.min(Number(searchParams.get('limit') ?? '10'), 25);

  const pathHint = resourceToPathQuery(resource);

  // Narrow results to issues last seen within ±window minutes of the trace start time.
  // Without this filter Sentry would return all unresolved issues for the route, many of
  // which may be unrelated to the specific request being inspected.
  // Example with from=1700000000000 and window=5 →
  //   lastSeen:>2023-11-14T22:08:20Z lastSeen:<2023-11-14T22:18:20Z
  const from = searchParams.get('from');
  const windowMs = Math.min(Number(searchParams.get('window') ?? '5'), 180) * 60 * 1000;
  const lastSeenFilter = from
    ? ` lastSeen:>${new Date(Number(from) - windowMs).toISOString()} lastSeen:<${new Date(Number(from) + windowMs).toISOString()}`
    : '';

  const params = new URLSearchParams({
    project: SENTRY_PROJECT_ID,
    query: `is:unresolved ${pathHint}${lastSeenFilter}`,
    environment: env,
    limit: String(limit),
    sortBy: 'date',
  });

  const url = `${SENTRY_BASE}/organizations/${SENTRY_ORG}/issues/?${params}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${SENTRY_TOKEN}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Sentry error: ${res.status}`, detail: text },
      { status: 502 }
    );
  }

  const raw = await res.json();

  const issues: SentryIssue[] = raw.map((i: Record<string, unknown>) => ({
    id: String(i.id),
    shortId: String(i.shortId),
    title: String(i.title),
    culprit: String(i.culprit ?? ''),
    level: String(i.level ?? 'error'),
    priority: String(i.priority ?? 'unknown'),
    count: String(i.count ?? '0'),
    userCount: Number(i.userCount ?? 0),
    lastSeen: String(i.lastSeen ?? ''),
    firstSeen: String(i.firstSeen ?? ''),
    permalink: String(i.permalink ?? ''),
  }));

  return NextResponse.json({ issues, meta: { resource, env, pathHint } });
};
