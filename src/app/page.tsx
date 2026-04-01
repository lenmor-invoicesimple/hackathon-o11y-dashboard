'use client';

import { useTraceFilters } from '../hooks/useTraceFilters';
import { useTraces } from '../hooks/useTraces';
import { useLogs } from '../hooks/useLogs';
import { useSentryIssues } from '../hooks/useSentryIssues';
import { DashboardHeader } from '../components/DashboardHeader';
import { ResourceFilterBar } from '../components/ResourceFilterBar';
import { TracesTableHeader } from '../components/TracesTableHeader';
import { TraceGroupRow } from '../components/TraceGroupRow';
import { TracesPagination } from '../components/TracesPagination';
import { TraceDetailPanel } from '../components/TraceDetailPanel';


export default function DashboardPage() {
  const {
    filters, setFilters,
    statusFilter, setStatusFilter,
    resourceFilters,
    allEnabled,
    toggleCategory,
    enableAllCategories,
  } = useTraceFilters();

  const {
    spans,
    meta,
    selected, setSelected,
    loading,
    error,
    nextCursor,
    cursorStack,
    traceGroups,
    visibleSpans,
    expandedTraces,
    toggleTrace,
    onRefresh,
    onNext,
    onPrev,
  } = useTraces({ filters, statusFilter, resourceFilters, allEnabled });

  const { logs, logsLoading, logsError } = useLogs(selected);
  const { issues: sentryIssues, loading: sentryLoading, error: sentryError } = useSentryIssues(selected);

  return (
    <div className="flex flex-col h-screen overflow-hidden font-mono text-sm">
      <DashboardHeader
        filters={filters}
        setFilters={setFilters}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        loading={loading}
        onRefresh={onRefresh}
      />

      <ResourceFilterBar
        allEnabled={allEnabled}
        enableAllCategories={enableAllCategories}
        resourceFilters={resourceFilters}
        toggleCategory={toggleCategory}
      />

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
          <TracesTableHeader />

          {/* Rows */}
          <div className="overflow-y-auto flex-1">
            {traceGroups.length === 0 && !loading && (
              <div className="px-4 py-8 text-gray-600 text-center">
                {error ? 'Error loading traces.' : 'No traces found.'}
              </div>
            )}
            {traceGroups.map((g) => (
              <TraceGroupRow
                key={g.traceId}
                group={g}
                isExpanded={expandedTraces.has(g.traceId)}
                onToggle={() => toggleTrace(g.traceId)}
                selectedSpanId={selected?.spanId ?? null}
                onSelectSpan={setSelected}
              />
            ))}
          </div>

          {meta && (
            <TracesPagination
              meta={meta}
              traceCount={traceGroups.length}
              visibleSpanCount={visibleSpans.length}
              totalSpanCount={spans.length}
              loading={loading}
              cursorStack={cursorStack}
              nextCursor={nextCursor}
              onPrev={onPrev}
              onNext={onNext}
            />
          )}
        </div>

        <TraceDetailPanel
          selected={selected}
          logs={logs}
          logsLoading={logsLoading}
          logsError={logsError}
          sentryIssues={sentryIssues}
          sentryLoading={sentryLoading}
          sentryError={sentryError}
        />
      </div>
    </div>
  );
}
