import { useEffect, useState } from 'react';
import type { LogLine } from '../app/api/logs/route';
import type { Span } from '../app/api/traces/route';

export type LogWindow = { from: number; to: number; env: string };

// Module-level cache keyed by query-string so repeated span selections avoid redundant API calls.
const cache = new Map<string, LogLine[]>();

// Builds the time window for a log query around a span's execution period.
// Adds a 30s buffer on each side to capture logs just before/after the span.
// Clamps minimum duration to 1 s so very fast spans still get a meaningful window.
// Example: span at 12:00:00.500 with 200 ms duration → window 11:59:30.500 – 12:00:31.700
const toWindow = (span: Span): LogWindow => {
  const start = new Date(span.startTime).getTime();
  const BUFFER_MS = 30_000;
  return {
    from: start - BUFFER_MS,
    to: start + Math.max(span.durationMs, 1000) + BUFFER_MS,
    env: span.env,
  };
};

// Fetches Mezmo logs for the time window surrounding the selected span.
// Results are cached for the session to avoid redundant fetches when the user re-selects the same span.
export const useLogs = (selected: Span | null) => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logWindow, setLogWindow] = useState<LogWindow | null>(null);

  useEffect(() => {
    if (!selected) { setLogs([]); setLogWindow(null); return; }
    const window = toWindow(selected);
    setLogWindow(window);
    const params = new URLSearchParams({
      from: String(window.from),
      to: String(window.to),
      env: window.env,
      size: '100',
    });
    const cacheKey = params.toString();
    if (cache.has(cacheKey)) {
      setLogs(cache.get(cacheKey)!);
      return;
    }
    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const res = await fetch(`/api/logs?${params}`);
        const json = await res.json();
        if (!res.ok) { setLogsError(json.error ?? 'Unknown error'); return; }
        cache.set(cacheKey, json.logs);
        setLogs(json.logs);
      } catch (e) {
        setLogsError(e instanceof Error ? e.message : 'Network error');
      } finally {
        setLogsLoading(false);
      }
    };
    fetchLogs();
  }, [selected]);

  return { logs, logsLoading, logsError, logWindow };
};
