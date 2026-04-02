import type { Span } from '../app/api/traces/route';
import type { TraceGroup } from '../hooks/useTraces';
import { STATUS_COLORS, codeColor, fmt } from '../lib/format';
import { WaterfallView } from './WaterfallView';

type TraceGroupRowProps = {
  group: TraceGroup;
  isExpanded: boolean;
  onToggle: () => void;
  selectedSpanId: string | null;
  onSelectSpan: (s: Span | null) => void;
};

export const TraceGroupRow = ({
  group: g,
  isExpanded,
  onToggle,
  selectedSpanId,
  onSelectSpan,
}: TraceGroupRowProps) => {
  const env = g.primary.env;
  return (
    <div className={isExpanded ? 'border-l-2 border-blue-600' : 'border-l-2 border-transparent'}>
      <button
        onClick={onToggle}
        className={`w-full grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 px-3 py-1.5 border-b text-left transition-colors hover:bg-gray-800 ${isExpanded ? 'bg-gray-800 border-gray-700' : 'border-gray-900'}`}
      >
        <span className="flex items-center gap-1">
          <span className={`mr-1 ${isExpanded ? 'text-blue-400' : 'text-gray-600'}`}>{isExpanded ? '▾' : '▸'}</span>
          <span className={STATUS_COLORS[g.primary.status] ?? 'text-gray-400'}>{g.primary.status ?? '—'}</span>
          {/* Secondary badge when a child span has a worse status than the root span,
              e.g. root is "ok" but a downstream call returned an error. */}
          {g.worstStatus !== g.primary.status && (
            <span className={`text-xs ${g.worstCode !== null ? codeColor(g.worstCode) : STATUS_COLORS[g.worstStatus] ?? 'text-gray-500'}`}>·{g.worstStatus}</span>
          )}
        </span>
        <span className="text-gray-200 truncate flex items-center gap-2">
          {g.primary.method && g.primary.method !== g.primary.resource
            ? <span className="text-gray-500">{g.primary.method} </span>
            : null}
          {g.primary.resource}
          {g.spans.length > 1 && (
            <span className="text-gray-600 text-xs shrink-0">{g.spans.length} spans</span>
          )}
        </span>
        <span className="text-right text-gray-300">{g.primary.durationMs}</span>
        <span className="text-right flex items-center justify-end gap-1">
          <span className={codeColor(g.primary.statusCode)}>{g.primary.statusCode ?? '—'}</span>
          {g.worstCode !== null && g.worstCode !== g.primary.statusCode && g.worstCode >= 400 && (
            <span className={`text-xs ${codeColor(g.worstCode)}`}>+{g.worstCode}</span>
          )}
        </span>
        <span className={`text-right text-xs ${env === 'staging' ? 'text-amber-400' : env === 'production' ? 'text-sky-400' : 'text-gray-500'}`}>
          {env || '—'}
        </span>
        <span className="text-right text-gray-500">{fmt(g.startTime)}</span>
      </button>
      {isExpanded && (
        <WaterfallView
          spans={g.spans}
          selectedSpanId={selectedSpanId}
          onSelectSpan={onSelectSpan}
        />
      )}
    </div>
  );
};
