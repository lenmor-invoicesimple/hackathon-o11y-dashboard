'use client';

import type { Span } from '../app/api/traces/route';
import { codeColor, STATUS_COLORS } from '../lib/format';

type WaterfallNode = { span: Span; depth: number };

const buildTree = (spans: Span[]): WaterfallNode[] => {
  // Find root spans (no parent, or parent not in set)
  const spanIds = new Set(spans.map(s => s.spanId));
  const children = new Map<string, Span[]>();
  const roots: Span[] = [];

  for (const s of spans) {
    if (!s.parentId || !spanIds.has(s.parentId)) {
      roots.push(s);
    } else {
      const list = children.get(s.parentId) ?? [];
      list.push(s);
      children.set(s.parentId, list);
    }
  }

  // Sort roots by startTime
  roots.sort((a, b) => a.startTime.localeCompare(b.startTime));

  const result: WaterfallNode[] = [];
  const walk = (span: Span, depth: number) => {
    result.push({ span, depth });
    const kids = (children.get(span.spanId) ?? []).sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    for (const k of kids) walk(k, depth + 1);
  };
  for (const r of roots) walk(r, 0);

  // Fallback: spans that weren't reachable (orphans)
  const visited = new Set(result.map(n => n.span.spanId));
  for (const s of spans) {
    if (!visited.has(s.spanId)) result.push({ span: s, depth: 1 });
  }

  return result;
};

type Props = {
  spans: Span[];
  selectedSpanId: string | null;
  onSelectSpan: (s: Span | null) => void;
};

export const WaterfallView = ({ spans, selectedSpanId, onSelectSpan }: Props) => {
  if (!spans.length) return null;

  // Compute time bounds
  const startMs = spans.reduce(
    (min, s) => Math.min(min, new Date(s.startTime).getTime()),
    Infinity
  );
  const endMs = spans.reduce(
    (max, s) => Math.max(max, new Date(s.startTime).getTime() + s.durationMs),
    -Infinity
  );
  const totalMs = Math.max(endMs - startMs, 1);

  const nodes = buildTree(spans);

  return (
    <div className="border-t border-gray-900">
      {/* Time axis header */}
      <div className="grid grid-cols-[1fr_200px] gap-2 px-3 py-0.5 border-b border-gray-900 text-[10px] text-gray-600">
        <span>span</span>
        <div className="flex justify-between">
          <span>0</span>
          <span>{totalMs}ms</span>
        </div>
      </div>

      {nodes.map(({ span: s, depth }) => {
        const isSelected = s.spanId === selectedSpanId;
        const offsetPct = ((new Date(s.startTime).getTime() - startMs) / totalMs) * 100;
        const widthPct = Math.max((s.durationMs / totalMs) * 100, 0.5);
        const barColor = s.status === 'error'
          ? 'bg-red-500'
          : s.statusCode && s.statusCode >= 400
          ? 'bg-yellow-500'
          : 'bg-teal-500';

        return (
          <button
            key={s.spanId}
            onClick={() => onSelectSpan(isSelected ? null : s)}
            className={[
              'w-full grid grid-cols-[1fr_200px] gap-2 px-3 py-0.5 border-b border-gray-900/50 text-left text-[11px] transition-colors hover:bg-gray-800',
              isSelected ? 'bg-gray-800' : '',
            ].join(' ')}
          >
            {/* Left: label */}
            <span
              className="flex items-center gap-1.5 truncate min-w-0"
              style={{ paddingLeft: `${depth * 12}px` }}
            >
              <span className={`shrink-0 ${STATUS_COLORS[s.status] ?? 'text-gray-500'}`}>
                {isSelected ? '▶' : '·'}
              </span>
              {s.service && (
                <span className="text-gray-600 shrink-0 text-[10px]">{s.service}</span>
              )}
              <span className="text-gray-300 truncate">
                {s.method && s.method !== s.resource
                  ? <><span className="text-gray-600">{s.method} </span>{s.resource}</>
                  : s.resource
                }
              </span>
              <span className={`shrink-0 text-[10px] ${codeColor(s.statusCode)}`}>
                {s.statusCode ?? ''}
              </span>
            </span>

            {/* Right: time bar */}
            <div className="relative flex items-center h-4">
              <div
                className={`absolute h-2 rounded-sm opacity-80 ${barColor}`}
                style={{
                  left: `${offsetPct}%`,
                  width: `${widthPct}%`,
                }}
              />
              <span
                className="absolute text-[9px] text-gray-500 whitespace-nowrap"
                style={{ left: `${Math.min(offsetPct + widthPct + 0.5, 75)}%` }}
              >
                {s.durationMs}ms
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
