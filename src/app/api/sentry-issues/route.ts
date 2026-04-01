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

// Extract the path segments from a DD resource_name like "GET /checkout/[documentId]/success"
// and match against Sentry culprit like "/checkout/:documentId"
const resourceToPathQuery = (resource: string): string => {
  // Strip HTTP method prefix if present
  const path = resource.replace(/^(GET|POST|PUT|DELETE|PATCH)\s+/, '');
  // Take the first two path segments as a search hint (e.g. /checkout)
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

  const params = new URLSearchParams({
    project: SENTRY_PROJECT_ID,
    query: `is:unresolved ${pathHint}`,
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
