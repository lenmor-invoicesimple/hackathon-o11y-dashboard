import { useState } from 'react';
import type { LogLine } from '../app/api/logs/route';
import type { LogWindow } from '../hooks/useLogs';
import { LOG_LEVEL_COLORS } from '../lib/format';

const MEZMO_STAGING = 'https://app.mezmo.com/a958fd65c8/logs/view/30898eb929';
const MEZMO_PROD = 'https://app.mezmo.com/a958fd65c8/logs/view/7f1922a2d7';

// Builds a deep-link URL into the Mezmo web UI pre-set to the same time window.
// Mezmo's URL params use epoch seconds while our LogWindow uses milliseconds.
const mezmoUrl = (window: LogWindow): string => {
  const base = window.env === 'production' ? MEZMO_PROD : MEZMO_STAGING;
  // Mezmo web UI expects epoch seconds
  const params = new URLSearchParams({
    from: String(Math.floor(window.from / 1000)),
    to: String(Math.floor(window.to / 1000)),
  });
  return `${base}?${params}`;
};

const LEVELS = ['all', 'error', 'warn', 'info', 'debug'] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_LABELS: Record<Level, string> = {
  all: 'ALL',
  error: 'ERR',
  warn: 'WARN',
  info: 'INFO',
  debug: 'DEBUG',
};

// Split text on query match and wrap matches in a highlight span.
// Split with a capture group puts the matched portions at odd indices.
const highlightMatch = (text: string, query: string) => {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-yellow-400/30 text-yellow-200 rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

type LogsSectionProps = {
  logs: LogLine[];
  loading: boolean;
  error: string | null;
  logWindow: LogWindow | null;
};

export const LogsSection = ({ logs, loading, error, logWindow }: LogsSectionProps) => {
  const [search, setSearch] = useState('');
  const [levelFilter, setLevelFilter] = useState<Level>('all');

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch = !search || log.message.toLowerCase().includes(search.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  return (
    <div>
      <div className="text-gray-500 text-xs uppercase tracking-wide mb-2 flex items-center justify-between">
        <span>
          Logs
          <span className="ml-2 text-gray-700 normal-case">±30s window</span>
        </span>
        {logWindow && (
          <a
            href={mezmoUrl(logWindow)}
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:text-purple-300 normal-case text-xs"
          >
            Open in Mezmo ↗
          </a>
        )}
      </div>

      {/* Search + level filter — only shown when there are logs to filter */}
      {!loading && logs.length > 0 && (
        <div className="flex flex-col gap-1.5 mb-2">
          <div className="flex gap-1 flex-wrap">
            {LEVELS.map((level) => (
              <button
                key={level}
                onClick={() => setLevelFilter(level)}
                className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
                  levelFilter === level
                    ? level === 'all'
                      ? 'bg-gray-600 border-gray-500 text-white'
                      : `border-current bg-white/10 ${LOG_LEVEL_COLORS[level] ?? 'text-gray-400'}`
                    : 'border-gray-700 text-gray-600 hover:border-gray-500 hover:text-gray-400'
                }`}
              >
                {LEVEL_LABELS[level]}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs…"
            className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>
      )}

      {loading && <div className="text-gray-600 text-xs px-1">Loading logs…</div>}
      {error && <div className="text-red-400 text-xs px-1">{error}</div>}
      {!loading && !error && logs.length === 0 && (
        <div className="text-gray-700 text-xs px-1">No logs found in this time window.</div>
      )}
      {!loading && logs.length > 0 && filteredLogs.length === 0 && (
        <div className="text-gray-700 text-xs px-1">No logs match your filter.</div>
      )}
      {!loading && filteredLogs.length > 0 && (
        <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto">
          {filteredLogs.slice().reverse().map((log, i) => (
            <div key={i} className="flex gap-2 text-xs font-mono leading-relaxed">
              <span className="text-gray-600 shrink-0">
                {new Date(log.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={`shrink-0 w-10 ${LOG_LEVEL_COLORS[log.level] ?? 'text-gray-400'}`}>
                {String(log.level ?? '').slice(0, 4).toUpperCase()}
              </span>
              <span className="text-gray-300 break-all">{highlightMatch(log.message, search)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
