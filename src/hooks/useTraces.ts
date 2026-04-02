import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Span } from '../app/api/traces/route';
import type { FilterState, ResourceCategory } from './useTraceFilters';
import { classifyResource } from '../lib/classify';

type TraceMeta = { from: string; to: string; service: string; query: string };

export type TraceGroup = {
  traceId: string;
  primary: Span;
  spans: Span[];
  worstStatus: string;
  worstCode: number | null;
  startTime: string;
  category: ResourceCategory;
};

type UseTracesParams = {
  filters: FilterState;
  statusFilter: 'all' | 'ok' | 'error' | '4xx' | '5xx';
  resourceFilters: Set<ResourceCategory>;
  allEnabled: boolean;
};

// Fetches and manages Datadog trace spans for the dashboard.
// Handles cursor-based pagination: cursorStack tracks visited pages so "Prev" can navigate back.
export const useTraces = ({ filters, statusFilter, resourceFilters, allEnabled }: UseTracesParams) => {
  const [spans, setSpans] = useState<Span[]>([]);
  const [meta, setMeta] = useState<TraceMeta | null>(null);
  const [selected, setSelected] = useState<Span | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // Stack of cursors for visited pages — push on Next, pop on Prev
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());

  const load = useCallback(async (f: FilterState, cursor?: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ service: f.service, hours: f.hours });
      if (cursor) params.set('cursor', cursor);
      const res = await fetch(`/api/traces?${params}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Unknown error');
        return;
      }
      setSpans(json.spans);
      setMeta(json.meta);
      setNextCursor(json.nextCursor ?? null);
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCursorStack([]);
    setNextCursor(null);
    load(filters);
  }, [filters]);

  // Prefer HTTP status code for error/ok determination; fall back to DD span status
  // when statusCode is absent (e.g. internal/background spans with no HTTP context).
  const statusFilteredSpans = spans.filter((s) => {
    const code = s.statusCode;
    const st = s.status?.toLowerCase();
    const isError = code !== null ? code >= 400 : st === 'error' || st === 'warn';
    const isOk = code !== null ? code < 400 : st === 'ok';
    if (statusFilter === 'all') return true;
    if (statusFilter === 'ok') return isOk;
    if (statusFilter === 'error') return isError;
    if (statusFilter === '4xx') return code !== null ? code >= 400 && code < 500 : isError;
    if (statusFilter === '5xx') return code !== null ? code >= 500 : false;
    return true;
  });

  // Groups flat spans by traceId, elects a primary span, and computes per-group
  // rollup fields (worstStatus, worstCode, startTime) for the traces table.
  const { traceGroups, categoryCounts } = useMemo(() => {
    const map = new Map<string, Span[]>();
    for (const s of statusFilteredSpans) {
      const group = map.get(s.traceId) ?? [];
      group.push(s);
      map.set(s.traceId, group);
    }
    const allGroups = Array.from(map.values()).map((groupSpans): TraceGroup => {
      // Prefer the root span (no parent); fall back to the longest span as the representative row.
      const root = groupSpans.find(s => s.parentId === null);
      const primary = root ?? groupSpans.reduce((a, b) => a.durationMs >= b.durationMs ? a : b);
      // Bubble up the worst span status so the row can show a secondary badge.
      const worstStatus = groupSpans.some(s => s.status === 'error') ? 'error'
        : groupSpans.some(s => s.status === 'warn') ? 'warn' : 'ok';
      const codes = groupSpans.map(s => s.statusCode).filter((c): c is number => c !== null);
      const worstCode = codes.length ? Math.max(...codes) : null;
      const startTime = groupSpans.reduce((a, b) => a.startTime < b.startTime ? a : b).startTime;
      const category = classifyResource(primary.resource);
      return { traceId: primary.traceId, primary, spans: groupSpans, worstStatus, worstCode, startTime, category };
    });
    // Count groups per category to populate the filter bar badges.
    const counts = {} as Record<ResourceCategory, number>;
    for (const g of allGroups) counts[g.category] = (counts[g.category] ?? 0) + 1;
    return {
      // When allEnabled, skip the per-category filter so every group is shown.
      traceGroups: allGroups.filter((g) => allEnabled || resourceFilters.has(g.category)),
      categoryCounts: counts,
    };
  }, [statusFilteredSpans, resourceFilters, allEnabled]);

  const toggleTrace = (traceId: string) =>
    setExpandedTraces((prev) => {
      const next = new Set(prev);
      next.has(traceId) ? next.delete(traceId) : next.add(traceId);
      return next;
    });

  const onRefresh = () => {
    setCursorStack([]);
    setNextCursor(null);
    load(filters);
  };

  const onNext = () => {
    if (!nextCursor) return;
    // Push current page's cursor before advancing so onPrev can return to it.
    setCursorStack((s) => [...s, nextCursor]);
    load(filters, nextCursor);
  };

  const onPrev = () => {
    // Pop the last cursor; load from the one before it (undefined = first page).
    const stack = [...cursorStack];
    stack.pop();
    const prevCursor = stack.at(-1);
    setCursorStack(stack);
    load(filters, prevCursor);
  };

  return {
    spans,   // total unfiltered spans (for footer count)
    meta,
    selected,
    setSelected,
    loading,
    error,
    nextCursor,
    cursorStack,
    traceGroups,
    categoryCounts,
    visibleSpans: statusFilteredSpans,
    expandedTraces,
    toggleTrace,
    onRefresh,
    onNext,
    onPrev,
  };
};
