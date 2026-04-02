'use client';

import { useState, useRef, useCallback } from 'react';
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
    categoryCounts,
    visibleSpans,
    expandedTraces,
    toggleTrace,
    onRefresh,
    onNext,
    onPrev,
  } = useTraces({ filters, statusFilter, resourceFilters, allEnabled });

  const [sentryWindow, setSentryWindow] = useState(5);
  // Width in px of the right-side detail panel; draggable between 260 and 800px.
  const [detailWidth, setDetailWidth] = useState(384);
  const dragging = useRef(false);

  // Attaches temporary mousemove/mouseup listeners on the window so the drag
  // continues even when the cursor leaves the handle element.
  // Width is derived from distance to the right viewport edge: innerWidth - clientX.
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const onMove = (mv: MouseEvent) => {
      if (!dragging.current) return;
      const next = window.innerWidth - mv.clientX;
      setDetailWidth(Math.min(Math.max(next, 260), 800));
    };
    const onUp = () => {
      dragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const { logs, logsLoading, logsError, logWindow } = useLogs(selected);
  const { issues: sentryIssues, loading: sentryLoading, error: sentryError } = useSentryIssues(selected, sentryWindow);

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
        categoryCounts={categoryCounts}
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
        <div className="flex flex-col flex-1 overflow-hidden">
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

        {/* Drag handle */}
        <div
          className="w-1 cursor-col-resize bg-gray-800 hover:bg-blue-600 active:bg-blue-500 transition-colors shrink-0"
          onMouseDown={onDragStart}
        />

        <TraceDetailPanel
          width={detailWidth}
          selected={selected}
          logs={logs}
          logsLoading={logsLoading}
          logsError={logsError}
          logWindow={logWindow}
          sentryIssues={sentryIssues}
          sentryLoading={sentryLoading}
          sentryError={sentryError}
          sentryWindow={sentryWindow}
          setSentryWindow={setSentryWindow}
        />
      </div>
    </div>
  );
}
