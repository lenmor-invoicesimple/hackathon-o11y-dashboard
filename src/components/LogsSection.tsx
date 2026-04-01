import type { LogLine } from '../app/api/logs/route';
import { LOG_LEVEL_COLORS } from '../lib/format';

type LogsSectionProps = {
  logs: LogLine[];
  loading: boolean;
  error: string | null;
};

export const LogsSection = ({ logs, loading, error }: LogsSectionProps) => (
  <div>
    <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">
      Logs
      <span className="ml-2 text-gray-700 normal-case">±30s window</span>
    </div>
    {loading && <div className="text-gray-600 text-xs px-1">Loading logs…</div>}
    {error && <div className="text-red-400 text-xs px-1">{error}</div>}
    {!loading && !error && logs.length === 0 && (
      <div className="text-gray-700 text-xs px-1">No logs found in this time window.</div>
    )}
    {!loading && logs.length > 0 && (
      <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
        {logs.map((log, i) => (
          <div key={i} className="flex gap-2 text-xs font-mono leading-relaxed">
            <span className="text-gray-600 shrink-0">
              {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className={`shrink-0 w-10 ${LOG_LEVEL_COLORS[log.level] ?? 'text-gray-400'}`}>
              {String(log.level ?? '').slice(0, 4).toUpperCase()}
            </span>
            <span className="text-gray-300 break-all">{log.message}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);
