import { useEffect, useState } from 'react';
import type { LogLine } from '../app/api/logs/route';
import type { Span } from '../app/api/traces/route';

export const useLogs = (selected: Span | null) => {
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) { setLogs([]); return; }
    const fetchLogs = async () => {
      setLogsLoading(true);
      setLogsError(null);
      try {
        const start = new Date(selected.startTime).getTime();
        const BUFFER_MS = 30_000;
        const from = start - BUFFER_MS;
        const to = start + Math.max(selected.durationMs, 1000) + BUFFER_MS;
        const params = new URLSearchParams({
          from: String(from),
          to: String(to),
          env: selected.env,
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

  return { logs, logsLoading, logsError };
};
