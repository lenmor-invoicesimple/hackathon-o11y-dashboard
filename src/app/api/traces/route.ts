import { NextRequest, NextResponse } from 'next/server';

const DD_API_KEY = process.env.DD_API_KEY ?? '';
const DD_APP_KEY = process.env.DD_APP_KEY ?? '';
const DD_SPANS_URL = 'https://api.datadoghq.com/api/v2/spans/events/search';

export type Span = {
  spanId: string;
  parentId: string | null;
  traceId: string;
  resource: string;
  method: string | null;
  statusCode: number | null;
  status: string;
  durationMs: number;
  startTime: string;
  ddLink: string;
  env: string;
  service: string;
  url: string | null;
};

type DDSpanAttributes = {
  trace_id?: string;
  parent_id?: string;
  resource_name?: string;
  status?: string;
  env?: string;
  start_timestamp?: string;
  end_timestamp?: string;
  service?: string;
  custom?: {
    duration?: number;
    http?: {
      method?: string;
      status_code?: number | string;
      url?: string;
    };
  };
};

type DDSpan = {
  id: string;
  attributes: DDSpanAttributes;
};

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

const toSpan = (raw: DDSpan, fallbackEnv: string): Span => {
  const a = raw.attributes;
  const durationNs = a.custom?.duration ?? 0;
  const traceId = a.trace_id ?? raw.id;
  const rawResource = a.resource_name ?? '(unknown)';
  // When DD only captured the HTTP method as resource_name, try to use the URL path instead
  const resource = HTTP_METHODS.has(rawResource.trim())
    ? (a.custom?.http?.url ? new URL(a.custom.http.url).pathname : rawResource)
    : rawResource;
  return {
    spanId: raw.id,
    parentId: a.parent_id ?? null,
    traceId,
    resource,
    method: a.custom?.http?.method ?? null,
    statusCode: a.custom?.http?.status_code
      ? Number(a.custom.http.status_code)
      : null,
    status: a.status ?? 'ok',
    durationMs: Math.round(durationNs / 1_000_000),
    startTime: a.start_timestamp ?? '',
    ddLink: `https://app.datadoghq.com/apm/trace/${traceId}`,
    env: a.env ?? fallbackEnv,
    service: a.service ?? '',
    url: a.custom?.http?.url ?? null,
  };
};

export const GET = async (req: NextRequest) => {
  if (!DD_API_KEY || !DD_APP_KEY) {
    return NextResponse.json(
      { error: 'DD_API_KEY and DD_APP_KEY are required' },
      { status: 500 }
    );
  }

  const { searchParams } = req.nextUrl;
  const service = searchParams.get('service') ?? 'is-unifiedxp-production';
  const hours = Number(searchParams.get('hours') ?? '1');
  const limit = 1000;

  // Derive env from service name suffix (e.g. is-unifiedxp-staging → staging)
  const envSuffix = service.split('-').at(-1);
  const envFilter = envSuffix === 'staging' || envSuffix === 'production' ? ` env:${envSuffix}` : '';

  const now = Date.now();
  const from = new Date(now - hours * 60 * 60 * 1000).toISOString();
  const to = new Date(now).toISOString();

  const debugQuery = searchParams.get('q');
  const resolvedQuery = debugQuery ?? `service:${service}${envFilter}`;
  const cursor = searchParams.get('cursor') ?? undefined;

  const body = {
    data: {
      attributes: {
        filter: {
          query: resolvedQuery,
          from,
          to,
        },
        sort: '-timestamp',
        page: cursor ? { limit, cursor } : { limit },
      },
      type: 'search_request',
    },
  };

  const res = await fetch(DD_SPANS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': DD_API_KEY,
      'DD-APPLICATION-KEY': DD_APP_KEY,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Datadog error: ${res.status}`, detail: text },
      { status: 502 }
    );
  }

  const json = await res.json();

  if (searchParams.get('debug') === '1') {
    return NextResponse.json({ raw: json.data?.[0] ?? null, query: resolvedQuery, total: json.data?.length ?? 0 });
  }

  const env = envSuffix === 'staging' || envSuffix === 'production' ? envSuffix : '';
  const spans: Span[] = (json.data ?? []).map((raw: DDSpan) => toSpan(raw, env));
  const nextCursor: string | null = json.meta?.page?.after ?? null;

  const query = resolvedQuery;
  return NextResponse.json({ spans, meta: { from, to, service, query }, nextCursor });
};
