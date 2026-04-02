import { useEffect, useState } from 'react';
import type { SentryIssue } from '../app/api/sentry-issues/route';
import type { Span } from '../app/api/traces/route';

// Module-level cache to avoid re-fetching the same resource+env+time combination.
const cache = new Map<string, SentryIssue[]>();

// Fetches Sentry issues matching the selected span's route within a ±windowMinutes time window.
// windowMinutes is user-adjustable via the SentryIssuesSection dropdown (default ±5 min).
export const useSentryIssues = (selected: Span | null, windowMinutes: number = 5) => {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) { setIssues([]); return; }
    const params = new URLSearchParams({
      resource: selected.resource,
      env: selected.env,
      from: String(new Date(selected.startTime).getTime()),
      window: String(windowMinutes),
    });
    const cacheKey = params.toString();
    if (cache.has(cacheKey)) {
      setIssues(cache.get(cacheKey)!);
      return;
    }
    const fetch_ = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sentry-issues?${params}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Unknown error'); return; }
        cache.set(cacheKey, json.issues);
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
