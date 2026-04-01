import { useEffect, useState } from 'react';
import type { LogLine } from '../app/api/logs/route';
import type { Span } from '../app/api/traces/route';

export type LogWindow = { from: number; to: number; env: string };

const toWindow = (span: Span): LogWindow => {
  const start = new Date(span.startTime).getTime();
  const BUFFER_MS = 30_000;
  return {
    from: start - BUFFER_MS,
    to: start + Math.max(span.durationMs, 1000) + BUFFER_MS,
    env: span.env,
  };
};

export const useLogs = (selected: Span | null) => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logWindow, setLogWindow] = useState<LogWindow | null>(null);

  useEffect(() => {
    if (!selected) { setLogs([]); setLogWindow(null); return; }
    const window = toWindow(selected);
    setLogWindow(window);
    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const params = new URLSearchParams({
          from: String(window.from),
          to: String(window.to),
          env: window.env,
          size: '100',
        });
        const res = await fetch(`/api/logs?${params}`);
        const json = await res.json();
        if (!res.ok) { setLogsError(json.error ?? 'Unknown error'); return; }
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
