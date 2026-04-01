import type { SentryIssue } from '../app/api/sentry-issues/route';

type SentryIssuesSectionProps = {
  issues: SentryIssue[];
  loading: boolean;
  error: string | null;
};

export const SentryIssuesSection = ({ issues, loading, error }: SentryIssuesSectionProps) => (
  <div>
    <div className="text-gray-500 text-xs uppercase tracking-wide mb-2">Sentry Issues</div>
    {loading && <div className="text-gray-600 text-xs px-1">Loading…</div>}
    {error && <div className="text-red-400 text-xs px-1">{error}</div>}
    {!loading && !error && issues.length === 0 && (
      <div className="text-gray-700 text-xs px-1">No issues found for this route.</div>
    )}
    {!loading && issues.length > 0 && (
      <div className="flex flex-col gap-2">
        {issues.map((issue) => (
          <a
            key={issue.id}
            href={issue.permalink}
            target="_blank"
            rel="noreferrer"
            className="flex flex-col gap-0.5 px-2 py-1.5 rounded bg-gray-800 border border-gray-700 hover:border-red-900 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className={`text-xs shrink-0 ${issue.level === 'error' ? 'text-red-400' : 'text-yellow-400'}`}>
                ● {issue.level}
              </span>
              <span className="text-gray-500 text-xs">{issue.shortId}</span>
              <span className="ml-auto text-gray-600 text-xs">{issue.count}×</span>
            </div>
            <div className="text-gray-200 text-xs truncate">{issue.title}</div>
            <div className="text-gray-600 text-xs truncate">{issue.culprit}</div>
            <div className="text-gray-700 text-xs">
              last seen {new Date(issue.lastSeen).toLocaleString()}
            </div>
          </a>
        ))}
      </div>
    )}
  </div>
);
