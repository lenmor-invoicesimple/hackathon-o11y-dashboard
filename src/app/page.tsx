'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Span } from './api/traces/route';
import type { LogLine } from './api/logs/route';

const LOG_LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400',
  warn:  'text-yellow-400',
  info:  'text-sky-400',
  debug: 'text-gray-500',
  trace: 'text-gray-600',
};

const STATUS_COLORS: Record<string, string> = {
  ok: 'text-emerald-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
};

const CODE_COLOR = (code: number | null) => {
  if (!code) return 'text-gray-400';
  if (code < 400) return 'text-emerald-400';
  if (code < 500) return 'text-yellow-400';
  return 'text-red-400';
};

const fmt = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

type FilterState = {
  service: string;
  hours: string;
};

type ResourceCategory = 'checkout' | 'nextjs' | 'events' | 'sentry' | 'other';

const RESOURCE_CATEGORIES: { id: ResourceCategory; label: string }[] = [
  { id: 'checkout', label: 'Checkout' },
  { id: 'nextjs',   label: 'Next.js' },
  { id: 'events',   label: 'Events' },
  { id: 'sentry',   label: 'Sentry' },
  { id: 'other',    label: 'Other' },
];

const classifyResource = (resource: string): ResourceCategory => {
  if (resource.includes('/checkout/')) return 'checkout';
  if (resource.includes('/_next/') || resource.includes('/public/') || resource.includes('/_not_found')) return 'nextjs';
  if (resource.includes('events.')) return 'events';
  if (resource.includes('sentry.io')) return 'sentry';
  return 'other';
};

// Category priority: checkout wins over others if any span in the group matches
const CATEGORY_PRIORITY: ResourceCategory[] = ['checkout', 'nextjs', 'events', 'sentry', 'other'];

const classifyGroup = (resources: string[]): ResourceCategory => {
  const categories = new Set(resources.map(classifyResource));
  return CATEGORY_PRIORITY.find((c) => categories.has(c)) ?? 'other';
};

export default function DashboardPage() {
  const [filters, setFilters] = useState<FilterState>({
    service: 'is-unifiedxp-production',
    hours: '1',
  });
  const [spans, setSpans] = useState<Span[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ok' | 'error' | '4xx' | '5xx'>('all');
  const [meta, setMeta] = useState<{ from: string; to: string; service: string; query: string } | null>(null);
  const [selected, setSelected] = useState<Span | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [resourceFilters, setResourceFilters] = useState<Set<ResourceCategory>>(new Set(['checkout']));
  const [expandedTraces, setExpandedTraces] = useState<Set<string>>(new Set());
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);

  const toggleTrace = (traceId: string) =>
    setExpandedTraces((prev) => {
      const next = new Set(prev);
      next.has(traceId) ? next.delete(traceId) : next.add(traceId);
      return next;
    });

  const toggleCategory = (id: ResourceCategory) => {
    setResourceFilters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allCategories = RESOURCE_CATEGORIES.map((c) => c.id);
  const allEnabled = allCategories.every((id) => resourceFilters.has(id));

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

  // Keep for footer count
  const visibleSpans = statusFilteredSpans;

  const traceGroups = useMemo(() => {
    const map = new Map<string, Span[]>();
    for (const s of statusFilteredSpans) {
      const group = map.get(s.traceId) ?? [];
      group.push(s);
      map.set(s.traceId, group);
    }
    const groups = Array.from(map.values()).map((groupSpans) => {
      const primary = groupSpans.reduce((a, b) => a.durationMs >= b.durationMs ? a : b);
      const worstStatus = groupSpans.some(s => s.status === 'error') ? 'error'
        : groupSpans.some(s => s.status === 'warn') ? 'warn' : 'ok';
      const codes = groupSpans.map(s => s.statusCode).filter((c): c is number => c !== null);
      const worstCode = codes.length ? Math.max(...codes) : null;
      const startTime = groupSpans.reduce((a, b) => a.startTime < b.startTime ? a : b).startTime;
      const category = classifyGroup(groupSpans.map(s => s.resource));
      return { traceId: primary.traceId, primary, spans: groupSpans, worstStatus, worstCode, startTime, category };
    });
    // Apply resource filter at group level
    return groups.filter((g) => allEnabled || resourceFilters.has(g.category));
  }, [statusFilteredSpans, resourceFilters, allEnabled]);

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

  const onRefresh = () => {
    setCursorStack([]);
    setNextCursor(null);
    load(filters);
  };

  const onNext = () => {
    if (!nextCursor) return;
    setCursorStack((s) => [...s, nextCursor]);
    load(filters, nextCursor);
  };

  const onPrev = () => {
    const stack = [...cursorStack];
    stack.pop();
    const prevCursor = stack.at(-1);
    setCursorStack(stack);
    load(filters, prevCursor);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden font-mono text-sm">
      {/* Header */}
      <header className="flex items-center gap-4 px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <span className="text-gray-300 font-semibold">O11y Dashboard</span>
        <span className="text-gray-600">·</span>
        <select
          className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 w-56 focus:outline-none focus:border-gray-500"
          value={filters.service}
          onChange={(e) => setFilters((f) => ({ ...f, service: e.target.value }))}
        >
          <option value="is-unifiedxp-production">is-unifiedxp-production</option>
          <option value="is-unifiedxp-staging">is-unifiedxp-staging</option>
        </select>
        <select
          className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 focus:outline-none"
          value={filters.hours}
          onChange={(e) => setFilters((f) => ({ ...f, hours: e.target.value }))}
        >
          <option value="1">Last 1h</option>
          <option value="3">Last 3h</option>
          <option value="6">Last 6h</option>
          <option value="24">Last 24h</option>
        </select>
        <select
          className="bg-gray-800 text-gray-200 px-2 py-0.5 rounded border border-gray-700 focus:outline-none"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="ok">OK (2xx)</option>
          <option value="error">Error (4xx+5xx)</option>
          <option value="4xx">4xx</option>
          <option value="5xx">5xx</option>
        </select>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="ml-auto px-3 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700 disabled:opacity-40 transition-colors"
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </header>

      {/* Resource category filter */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-gray-950 border-b border-gray-800 shrink-0">
        <span className="text-gray-600 text-xs">Show:</span>
        <button
          onClick={() => setResourceFilters(new Set(allCategories))}
          className={`px-2 py-0.5 rounded text-xs border transition-colors ${allEnabled ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
        >
          all
        </button>
        {RESOURCE_CATEGORIES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => toggleCategory(id)}
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${resourceFilters.has(id) ? 'bg-gray-700 border-gray-500 text-gray-200' : 'bg-transparent border-gray-700 text-gray-500 hover:text-gray-400'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Error bar */}
      {error && (
        <div className="px-4 py-2 bg-red-950 text-red-300 border-b border-red-900 text-xs shrink-0">
          {error}
        </div>
      )}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Traces list */}
        <div className="flex flex-col flex-1 overflow-hidden border-r border-gray-800">
          {/* Table header */}
          <div className="grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 px-3 py-1.5 bg-gray-900 border-b border-gray-800 text-gray-500 text-xs uppercase tracking-wide shrink-0">
            <span>Status</span>
            <span>Route</span>
            <span className="text-right">ms</span>
            <span className="text-right">Code</span>
            <span className="text-right">Env</span>
            <span className="text-right">Time</span>
          </div>

          {/* Rows */}
          <div className="overflow-y-auto flex-1">
            {traceGroups.length === 0 && !loading && (
              <div className="px-4 py-8 text-gray-600 text-center">
                {error ? 'Error loading traces.' : 'No traces found.'}
              </div>
            )}
            {traceGroups.map((g) => {
              const isExpanded = expandedTraces.has(g.traceId);
              const env = g.primary.env;
              return (
                <div key={g.traceId}>
                  {/* Group summary row */}
                  <button
                    onClick={() => toggleTrace(g.traceId)}
                    className="w-full grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 px-3 py-1.5 border-b border-gray-900 text-left transition-colors hover:bg-gray-800"
                  >
                    <span className={STATUS_COLORS[g.worstStatus] ?? 'text-gray-400'}>
                      <span className="text-gray-600 mr-1">{isExpanded ? '▾' : '▸'}</span>
                      {g.worstStatus}
                    </span>
                    <span className="text-gray-200 truncate flex items-center gap-2">
                      {g.primary.method ? <span className="text-gray-500">{g.primary.method} </span> : null}
                      {g.primary.resource}
                      {g.spans.length > 1 && (
                        <span className="text-gray-600 text-xs shrink-0">{g.spans.length} spans</span>
                      )}
                    </span>
                    <span className="text-right text-gray-300">{g.primary.durationMs}</span>
                    <span className={`text-right ${CODE_COLOR(g.worstCode)}`}>{g.worstCode ?? '—'}</span>
                    <span className={`text-right text-xs ${env === 'staging' ? 'text-amber-400' : env === 'production' ? 'text-sky-400' : 'text-gray-500'}`}>
                      {env || '—'}
                    </span>
                    <span className="text-right text-gray-500">{fmt(g.startTime)}</span>
                  </button>
                  {/* Expanded span rows */}
                  {isExpanded && g.spans.map((s) => {
                    const isSelected = s.spanId === selected?.spanId;
                    return (
                      <button
                        key={s.spanId}
                        onClick={() => setSelected(isSelected ? null : s)}
                        className={[
                          'w-full grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 pl-7 pr-3 py-1 border-b border-gray-900/60 text-left text-xs transition-colors hover:bg-gray-800',
                          isSelected ? 'bg-gray-800' : 'bg-gray-950',
                        ].join(' ')}
                      >
                        <span className={STATUS_COLORS[s.status] ?? 'text-gray-400'}>
                          {isSelected ? '▶' : '·'} {s.status}
                        </span>
                        <span className="text-gray-400 truncate">
                          {s.method ? <span className="text-gray-600">{s.method} </span> : null}
                          {s.resource}
                        </span>
                        <span className="text-right text-gray-500">{s.durationMs}</span>
                        <span className={`text-right ${CODE_COLOR(s.statusCode)}`}>{s.statusCode ?? '—'}</span>
                        <span className="text-right text-gray-600">—</span>
                        <span className="text-right text-gray-600">{fmt(s.startTime)}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {meta && (
            <div className="px-3 py-1.5 bg-gray-900 border-t border-gray-800 text-gray-600 text-xs shrink-0 flex items-center gap-3">
              <span className="flex-1">
                {traceGroups.length} traces ({visibleSpans.length} spans{visibleSpans.length !== spans.length ? ` of ${spans.length}` : ''}) · {new Date(meta.from).toLocaleTimeString()} – {new Date(meta.to).toLocaleTimeString()}
              </span>
              <span className="text-gray-700 truncate max-w-xs">query: {meta.query}</span>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={onPrev}
                  disabled={loading || cursorStack.length === 0}
                  className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={onNext}
                  disabled={loading || !nextCursor}
                  className="px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="w-96 flex flex-col bg-gray-900 overflow-y-auto shrink-0">
          {selected ? (
            <div className="p-4 flex flex-col gap-4">
              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Trace Detail</div>
                <div className="flex flex-col gap-1.5">
                  <Row label="Resource" value={selected.resource} />
                  {selected.method && <Row label="Method" value={selected.method} />}
                  <Row label="Duration" value={`${selected.durationMs} ms`} />
                  <Row
                    label="Status"
                    value={selected.status}
                    valueClass={STATUS_COLORS[selected.status] ?? 'text-gray-300'}
                  />
                  {selected.statusCode && (
                    <Row
                      label="HTTP Code"
                      value={String(selected.statusCode)}
                      valueClass={CODE_COLOR(selected.statusCode)}
                    />
                  )}
                  <Row label="Started" value={selected.startTime ? new Date(selected.startTime).toLocaleString() : '—'} />
                  <Row label="Trace ID" value={selected.traceId} valueClass="text-gray-500 text-xs break-all" />
                </div>
              </div>

              <a
                href={selected.ddLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-950 border border-purple-800 text-purple-300 hover:bg-purple-900 transition-colors text-xs"
              >
                Open full trace in Datadog ↗
              </a>

              <div>
                <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">
                  Logs
                  <span className="ml-2 text-gray-700 normal-case">
                    ±30s window
                  </span>
                </div>
                {logsLoading && (
                  <div className="text-gray-600 text-xs px-1">Loading logs…</div>
                )}
                {logsError && (
                  <div className="text-red-400 text-xs px-1">{logsError}</div>
                )}
                {!logsLoading && !logsError && logs.length === 0 && (
                  <div className="text-gray-700 text-xs px-1">No logs found in this time window.</div>
                )}
                {!logsLoading && logs.length > 0 && (
                  <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
                    {logs.map((log, i) => (
                      <div key={i} className="flex gap-2 text-xs font-mono leading-relaxed">
                        <span className="text-gray-600 shrink-0">
                          {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`shrink-0 w-10 ${LOG_LEVEL_COLORS[log.level] ?? 'text-gray-400'}`}>
                          {log.level.slice(0, 4).toUpperCase()}
                        </span>
                        <span className="text-gray-300 break-all">{log.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">
              Select a trace to see details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const Row = ({
  label,
  value,
  valueClass = 'text-gray-200',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) => (
  <div className="flex gap-2">
    <span className="text-gray-600 w-20 shrink-0">{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);
