type Meta = {
  from: string;
  to: string;
  query: string;
};

type TracesPaginationProps = {
  meta: Meta;
  traceCount: number;
  visibleSpanCount: number;
  totalSpanCount: number;
  loading: boolean;
  cursorStack: string[];
  nextCursor: string | null;
  onPrev: () => void;
  onNext: () => void;
};

export const TracesPagination = ({
  meta,
  traceCount,
  visibleSpanCount,
  totalSpanCount,
  loading,
  cursorStack,
  nextCursor,
  onPrev,
  onNext,
}: TracesPaginationProps) => (
  <div className="px-3 py-1.5 bg-gray-900 border-t border-gray-800 text-gray-600 text-xs shrink-0 flex items-center gap-3">
    <span className="flex-1">
      {traceCount} traces ({visibleSpanCount} spans{visibleSpanCount !== totalSpanCount ? ` of ${totalSpanCount}` : ''}) · {new Date(meta.from).toLocaleTimeString()} – {new Date(meta.to).toLocaleTimeString()}
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
);
