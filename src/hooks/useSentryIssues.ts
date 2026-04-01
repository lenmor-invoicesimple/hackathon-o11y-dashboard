import { useEffect, useState } from 'react';
import type { SentryIssue } from '../app/api/sentry-issues/route';
import type { Span } from '../app/api/traces/route';

export const useSentryIssues = (selected: Span | null, windowMinutes: number = 5) => {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) { setIssues([]); return; }
    const fetch_ = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          resource: selected.resource,
          env: selected.env,
          from: String(new Date(selected.startTime).getTime()),
          window: String(windowMinutes),
        });
        const res = await fetch(`/api/sentry-issues?${params}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Unknown error'); return; }
        setIssues(json.issues);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Network error');
      } finally {
        setLoading(false);
      }
    };
    fetch_();
  }, [selected, windowMinutes]);

  return { issues, loading, error };
};
