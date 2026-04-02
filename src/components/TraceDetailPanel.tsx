import type { Span } from '../app/api/traces/route';
import type { LogLine } from '../app/api/logs/route';
import type { LogWindow } from '../hooks/useLogs';
import type { SentryIssue } from '../app/api/sentry-issues/route';
import { STATUS_COLORS, codeColor } from '../lib/format';
import { Row } from './Row';
import { LogsSection } from './LogsSection';
import { SentryIssuesSection } from './SentryIssuesSection';

type TraceDetailPanelProps = {
  width: number;
  selected: Span | null;
  logs: LogLine[];
  logsLoading: boolean;
  logsError: string | null;
  logWindow: LogWindow | null;
  sentryIssues: SentryIssue[];
  sentryLoading: boolean;
  sentryError: string | null;
  sentryWindow: number;
  setSentryWindow: (w: number) => void;
};

export const TraceDetailPanel = ({
  width,
  selected,
  logs,
  logsLoading,
  logsError,
  logWindow,
  sentryIssues,
  sentryLoading,
  sentryError,
  sentryWindow,
  setSentryWindow,
}: TraceDetailPanelProps) => (
  <div className="flex flex-col bg-gray-900 overflow-y-auto shrink-0" style={{ width }}>
    {selected ? (
      <div className="p-4 flex flex-col gap-4">
        <div>
          <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Trace Detail</div>
          <div className="flex flex-col gap-1.5">
            <Row label="Resource" value={selected.resource} />
            {/* Show URL as pathname+search for readability; fall back to full URL if parsing fails. */}
            {selected.url && (() => {
              let display = selected.url;
              try { display = new URL(selected.url).pathname + new URL(selected.url).search; } catch {}
              return (
                <div className="grid grid-cols-[5rem_1fr] gap-2 text-xs items-start">
                  <span className="text-gray-600 shrink-0">URL</span>
                  <a
                    href={selected.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-400 hover:text-blue-300 break-all leading-snug"
                    title={selected.url}
                  >
                    {display}
                  </a>
                </div>
              );
            })()}
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
                valueClass={codeColor(selected.statusCode)}
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

        <LogsSection logs={logs} loading={logsLoading} error={logsError} logWindow={logWindow} />
        <SentryIssuesSection issues={sentryIssues} loading={sentryLoading} error={sentryError} window={sentryWindow} onWindowChange={setSentryWindow} />
      </div>
    ) : (
      <div className="flex-1 flex items-center justify-center text-gray-700 text-xs">
        Expand a trace and select a span to see details
      </div>
    )}
  </div>
);
