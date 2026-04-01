import { NextRequest, NextResponse } from 'next/server';

const MEZMO_SERVICE_KEY = process.env.MEZMO_SERVICE_KEY ?? '';
const MEZMO_EXPORT_URL = 'https://api.mezmo.com/v1/export';

export type LogLine = {
  ts: number;
  app: string;
  host: string;
  level: string;
  message: string;
};

type MezmoRawLine = {
  _ts?: number;
  _app?: string;
  _host?: string;
  _line?: string;
  level?: string;
  message?: string;
};

const parseLevel = (raw: MezmoRawLine, parsed: Record<string, unknown>): string => {
  if (typeof raw.level === 'string' && raw.level) return raw.level.toLowerCase();
  const l = parsed['level'] ?? parsed['severity'];
  if (typeof l === 'string') return l.toLowerCase();
  return 'info';
};

const parseMessage = (raw: MezmoRawLine, parsed: Record<string, unknown>): string => {
  if (raw.message) return raw.message;
  const m = parsed['message'] ?? parsed['msg'];
  if (typeof m === 'string') return m;
  return raw._line ?? '';
};

const toLogLine = (raw: MezmoRawLine): LogLine => {
  let parsed: Record<string, unknown> = {};
  try {
    if (raw._line) parsed = JSON.parse(raw._line);
  } catch {
    // _line is plain text
  }
  return {
    ts: raw._ts ?? 0,
    app: raw._app ?? '',
    host: raw._host ?? '',
    level: parseLevel(raw, parsed),
    message: parseMessage(raw, parsed),
  };
};

export const GET = async (req: NextRequest) => {
  if (!MEZMO_SERVICE_KEY) {
    return NextResponse.json({ error: 'MEZMO_SERVICE_KEY is not set' }, { status: 500 });
  }

  const { searchParams } = req.nextUrl;
  const fromMs = searchParams.get('from');
  const toMs = searchParams.get('to');
  const env = searchParams.get('env') ?? '';
  const size = Math.min(Number(searchParams.get('size') ?? '100'), 500);

  if (!fromMs || !toMs) {
    return NextResponse.json({ error: 'from and to are required (ms epoch)' }, { status: 400 });
  }

  const params = new URLSearchParams({
    from: fromMs,
    to: toMs,
    size: String(size),
    query: 'unifiedxp',
  });
  if (env === 'staging' || env === 'production') {
    params.set('tags', env);
  }

  const res = await fetch(`${MEZMO_EXPORT_URL}?${params}`, {
    headers: { Authorization: `Token ${MEZMO_SERVICE_KEY}` },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Mezmo error: ${res.status}`, detail: text },
      { status: 502 }
    );
  }

  const text = await res.text();
  const logs: LogLine[] = text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return toLogLine(JSON.parse(line)); }
      catch { return null; }
    })
    .filter((l): l is LogLine => l !== null)
    .sort((a, b) => a.ts - b.ts);

  return NextResponse.json({ logs });
};
