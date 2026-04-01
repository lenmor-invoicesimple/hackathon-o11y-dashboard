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
    <div>
      <button
        onClick={onToggle}
        className="w-full grid grid-cols-[7rem_1fr_5rem_4rem_5rem_6rem] gap-x-2 px-3 py-1.5 border-b border-gray-900 text-left transition-colors hover:bg-gray-800"
      >
        <span className={STATUS_COLORS[g.worstStatus] ?? 'text-gray-400'}>
          <span className="text-gray-600 mr-1">{isExpanded ? '▾' : '▸'}</span>
          {g.worstStatus}
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
        <span className={`text-right ${codeColor(g.worstCode)}`}>{g.worstCode ?? '—'}</span>
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
