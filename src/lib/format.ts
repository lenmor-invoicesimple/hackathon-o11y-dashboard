// Tailwind text-color classes for log levels and HTTP status codes.
// Used consistently across LogsSection and WaterfallView.
export const LOG_LEVEL_COLORS: Record<string, string> = {
  error: 'text-red-400',
  warn:  'text-yellow-400',
  info:  'text-sky-400',
  debug: 'text-gray-500',
  trace: 'text-gray-600',
};

export const STATUS_COLORS: Record<string, string> = {
  ok: 'text-emerald-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
};

// Returns a Tailwind text color for an HTTP status code.
// null / 0 → gray, 1xx–3xx → green, 4xx → yellow, 5xx → red
export const codeColor = (code: number | null) => {
  if (!code) return 'text-gray-400';
  if (code < 400) return 'text-emerald-400';
  if (code < 500) return 'text-yellow-400';
  return 'text-red-400';
};

// Formats an ISO timestamp as a short local time string, e.g. "03:45:12 PM"
export const fmt = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};
